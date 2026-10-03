/**
 * KGP ERP Auto-Login - Content Script
 * Automates form filling, security question answering, OTP request,
 * countdown display, and fallback to manual entry on 90s timeout.
 */

(() => {
  // Helpers for session storage with safe window.sessionStorage fallback
  async function getSessionStorage(keys) {
    let result = {};
    if (chrome && chrome.storage && chrome.storage.session && chrome.storage.session.get) {
      try {
        result = await new Promise((resolve) => {
          chrome.storage.session.get(keys, (res) => {
            if (chrome.runtime.lastError) resolve({});
            else resolve(res || {});
          });
        });
      } catch {
        result = {};
      }
    }
    for (const key of keys) {
      if (result[key] === undefined) {
        try {
          const item = window.sessionStorage.getItem(`kgp_${key}`);
          if (item !== null) result[key] = JSON.parse(item);
        } catch {}
      }
    }
    return result;
  }

  async function setSessionStorage(obj) {
    if (chrome && chrome.storage && chrome.storage.session && chrome.storage.session.set) {
      try {
        await new Promise((resolve) => {
          chrome.storage.session.set(obj, () => resolve());
        });
      } catch {}
    }
    for (const [k, v] of Object.entries(obj)) {
      try {
        window.sessionStorage.setItem(`kgp_${k}`, JSON.stringify(v));
      } catch {}
    }
  }

  // --- ERP Dark Mode Initializer & Live Listener ---
  // Synchronous execution at document_start eliminates white flash before first paint
  try {
    const isDarkStored = localStorage.getItem("kgp_dark_mode");
    // Only activate dark mode if explicitly enabled by user
    if (isDarkStored === "true") {
      document.documentElement.classList.add("kgp-dark-mode");

      const instantDarkStyle = document.createElement("style");
      instantDarkStyle.id = "kgp-instant-dark-preload";
      instantDarkStyle.textContent = `
        html.kgp-dark-mode, html.kgp-dark-mode body {
          background-color: #0b131e !important;
          color: #e2e8f0 !important;
        }
      `;
      (document.head || document.documentElement).appendChild(instantDarkStyle);
    }
  } catch (e) {}

  // Synchronously suppress ERP's broken SSO error screen before first paint
  const initialUrlParams = new URLSearchParams(window.location.search);
  const initialReqUrl = initialUrlParams.get("requestedUrl") || "";
  const isCdcErrorPage =
    window.location.pathname.includes("SSOAdministration") &&
    (initialReqUrl.includes("Notice.jsp") ||
     initialReqUrl.includes("TPStudent.jsp") ||
     initialReqUrl.includes("TrainingPlacementSSO"));

  if (isCdcErrorPage) {
    try {
      const instantGuardStyle = document.createElement("style");
      instantGuardStyle.id = "kgp-sso-instant-guard-style";
      instantGuardStyle.textContent = `
        .panel-danger {
          display: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(instantGuardStyle);
    } catch {}
  }

  function applyDarkMode(enabled) {
    if (enabled) {
      document.documentElement.classList.add("kgp-dark-mode");
      try { localStorage.setItem("kgp_dark_mode", "true"); } catch (e) {}
      cleanLightElements();
    } else {
      document.documentElement.classList.remove("kgp-dark-mode");
      try { localStorage.setItem("kgp_dark_mode", "false"); } catch (e) {}
      const preload = document.getElementById("kgp-instant-dark-preload");
      if (preload) preload.remove();
    }
  }

  // Sync preference with chrome.storage.local
  try {
    chrome.storage.local.get(["erpDarkMode"], (data) => {
      applyDarkMode(Boolean(data?.erpDarkMode));
    });
  } catch {}

  // Dynamic scanner for stubborn inline white elements on ERP headers and dialog overlays
  function cleanLightElements() {
    if (!document.documentElement.classList.contains("kgp-dark-mode")) return;
    try {
      // 1. Clean header/navigation elements
      document.querySelectorAll("header, nav, .navbar, .page-header, .page-head, .page-header-menu, div, table").forEach((el) => {
        if (el.id === "kgp-auto-login-banner" || el.closest("#kgp-auto-login-banner")) return;
        const rect = el.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < 150 && rect.width > 250 && rect.height > 15 && rect.height < 120) {
          const comp = window.getComputedStyle(el);
          if (comp.backgroundColor && (comp.backgroundColor === "rgb(255, 255, 255)" || comp.backgroundColor.includes("255, 255, 255"))) {
            el.style.setProperty("background-color", "#070e17", "important");
            el.style.setProperty("background-image", "none", "important");
            el.style.setProperty("border-color", "rgba(255, 255, 255, 0.08)", "important");
          }
        }
      });

      // 2. Darken modal/dialog overlays (jQuery UI, BlockUI, Bootstrap)
      document.querySelectorAll(".ui-widget-overlay, .modal-backdrop, .blockOverlay, [class*='overlay' i]").forEach((overlay) => {
        if (overlay.id === "kgp-auto-login-banner" || overlay.closest("#kgp-auto-login-banner")) return;
        overlay.style.setProperty("background-color", "rgba(3, 7, 18, 0.82)", "important");
        overlay.style.setProperty("background-image", "none", "important");
        overlay.style.setProperty("opacity", "1", "important");
      });
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cleanLightElements);
  } else {
    cleanLightElements();
  }
  setTimeout(cleanLightElements, 300);

  // Automatically observe dynamic elements like jQuery UI modals and dialog overlays
  let cleanDebounce = null;
  const domObserver = new MutationObserver(() => {
    if (!document.documentElement.classList.contains("kgp-dark-mode")) return;
    if (cleanDebounce) cancelAnimationFrame(cleanDebounce);
    cleanDebounce = requestAnimationFrame(cleanLightElements);
  });
  if (document.body) {
    domObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body) domObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Listen for live toggle events from popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE_DARK_MODE") {
      applyDarkMode(Boolean(msg.enabled));
    }
  });

  // Banner UI elements
  let banner = null;
  let bannerBody = null;
  let timerText = null;
  let progressFill = null;
  let countdownInterval = null;

  function createOverlayBanner() {
    if (document.getElementById("kgp-auto-login-banner")) return;

    banner = document.createElement("div");
    banner.id = "kgp-auto-login-banner";

    const logoUrl = chrome.runtime.getURL("icons/icon48.png");
    banner.innerHTML = `
      <div class="kgp-banner-header">
        <div class="kgp-banner-title">
          <div class="kgp-banner-logo-wrap">
            <img src="${logoUrl}" class="kgp-banner-logo" alt="KGP ERP" />
          </div>
          <span class="kgp-banner-appname">KGP Auto-Login</span>
          <span class="kgp-spinner" id="kgp-banner-spinner"></span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="kgp-banner-badge" id="kgp-banner-badge">RUNNING</span>
          <button class="kgp-banner-close" id="kgp-banner-close-btn" title="Dismiss">&times;</button>
        </div>
      </div>
      <div class="kgp-banner-body" id="kgp-banner-body">
        Initializing auto-login...
      </div>
      <div class="kgp-banner-timer" id="kgp-banner-timer-row" style="display:none;">
        <span id="kgp-timer-text">Waiting for Gmail OTP... (90s)</span>
        <div class="kgp-progress-bar-bg">
          <div class="kgp-progress-bar-fill" id="kgp-progress-fill"></div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    bannerBody = document.getElementById("kgp-banner-body");
    timerText = document.getElementById("kgp-timer-text");
    progressFill = document.getElementById("kgp-progress-fill");

    document.getElementById("kgp-banner-close-btn").addEventListener("click", () => {
      cleanupCountdown();
      banner.remove();
    });
  }

  function updateBannerStatus(msg, type = "info") {
    if (!banner || !bannerBody) return;
    bannerBody.innerHTML = msg;

    banner.classList.remove("banner-success", "banner-warning", "banner-error");
    const badge = document.getElementById("kgp-banner-badge");
    const spinner = document.getElementById("kgp-banner-spinner");

    if (type === "success") {
      banner.classList.add("banner-success");
      badge.textContent = "SUCCESS";
      badge.style.color = "#4ade80";
      badge.style.background = "rgba(74, 222, 128, 0.2)";
      if (spinner) spinner.style.display = "none";
    } else if (type === "warning") {
      banner.classList.add("banner-warning");
      badge.textContent = "ATTENTION";
      badge.style.color = "#f59e0b";
      badge.style.background = "rgba(245, 158, 11, 0.2)";
      if (spinner) spinner.style.display = "none";
    } else if (type === "error") {
      banner.classList.add("banner-error");
      badge.textContent = "FAILED";
      badge.style.color = "#f87171";
      badge.style.background = "rgba(248, 113, 113, 0.2)";
      if (spinner) spinner.style.display = "none";
    }
  }

  function startCountdown(totalSeconds = 90) {
    const timerRow = document.getElementById("kgp-banner-timer-row");
    if (timerRow) timerRow.style.display = "flex";

    let remaining = totalSeconds;
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      remaining -= 1;
      if (timerText) {
        timerText.textContent = `Waiting for Gmail OTP... (${remaining}s)`;
      }
      if (progressFill) {
        const pct = Math.max(0, (remaining / totalSeconds) * 100);
        progressFill.style.width = `${pct}%`;
      }

      if (remaining <= 0) {
        cleanupCountdown();
      }
    }, 1000);
  }

  function cleanupCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    const timerRow = document.getElementById("kgp-banner-timer-row");
    if (timerRow) timerRow.style.display = "none";
  }

  function dismissSweetAlert() {
    // If SweetAlert modal is open, gently dismiss it so user isn't blocked
    try {
      const swalConfirm = document.querySelector(".swal2-confirm");
      if (swalConfirm) swalConfirm.click();
      const swalClose = document.querySelector(".swal2-close");
      if (swalClose) swalClose.click();
    } catch {
      // Ignore if not present
    }
  }

  function setInputValue(input, val) {
    if (!input) return;
    input.value = val;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findSecurityAnswer(questionText, questionsMap) {
    if (!questionsMap || typeof questionsMap !== "object") return "";
    const cleanQ = questionText.trim().toLowerCase();

    for (const [savedQ, savedAns] of Object.entries(questionsMap)) {
      const cleanSavedQ = savedQ.trim().toLowerCase();
      if (cleanQ === cleanSavedQ || cleanQ.includes(cleanSavedQ) || cleanSavedQ.includes(cleanQ)) {
        return savedAns;
      }
    }
    // Fallback: if only one answer is stored, use it
    const entries = Object.entries(questionsMap);
    if (entries.length === 1) {
      return entries[0][1];
    }
    return "";
  }

  async function waitForQuestionToLoad(maxWaitMs = 4000) {
    const questionLabel = document.getElementById("question");
    const answerDiv = document.getElementById("answer_div");
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      if (answerDiv && !answerDiv.classList.contains("d-none")) {
        const text = questionLabel ? questionLabel.innerText.trim() : "";
        if (text && !text.toLowerCase().includes("security question") && !text.includes("FALSE")) {
          return text;
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return questionLabel ? questionLabel.innerText.trim() : "";
  }

  /** Max auto-OTP attempts before switching to manual mode */
  const MAX_AUTO_OTP_ATTEMPTS = 2;
  const ATTEMPT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

  async function runAutoLogin() {
    const loginForm = document.getElementById("loginForm");
    const userIdInput = document.getElementById("user_id");
    if (!loginForm || !userIdInput) {
      // Only clear session flags when we're on an AUTHENTICATED ERP page (/IIT_ERP3/),
      // NOT on intermediate SSO redirect pages (auth.htm, logout.htm) which also lack loginForm.
      // Clearing flags on those pages would wipe kgp_manual_otp_requested mid-redirect,
      // causing the extension to re-request OTP when landing back on the login page.
      const isAuthenticatedPage = window.location.pathname.includes("IIT_ERP3");
      if (isAuthenticatedPage) {
        try {
          if (chrome?.storage?.session?.remove) {
            chrome.storage.session.remove(["autoOtpAttempts", "attemptWindowStart", "lastSubmittedOtp"]);
          }
          window.sessionStorage.removeItem("kgp_autoOtpAttempts");
          window.sessionStorage.removeItem("kgp_attemptWindowStart");
          window.sessionStorage.removeItem("kgp_lastSubmittedOtp");
          window.sessionStorage.removeItem("kgp_manual_otp_sent");
          window.sessionStorage.removeItem("kgp_manual_otp_requested");
        } catch {}
      }

      // Save latest ssoToken on any ERP page (for sessionAlive checks)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoUrl = urlParams.get("ssoToken") || urlParams.get("ssotoken");
        if (ssoUrl) {
          chrome.storage.local.set({ latestSsoToken: ssoUrl });
        } else {
          const match = document.cookie.match(/\bssoToken=([^;]+)/i);
          if (match && match[1]) {
            chrome.storage.local.set({ latestSsoToken: match[1] });
          }
        }
      } catch {}

      return;
    }

    chrome.storage.local.get(
      ["erpRoll", "erpPassword", "gmailEmail", "securityQuestions", "autoLogin", "gmailAccountIndex", "otpFetchMode", "enableUidSnapshot"],
      async (stored) => {
        const autoLoginEnabled = stored.autoLogin !== false;
        if (!autoLoginEnabled) return;

        if (!stored.erpRoll || !stored.erpPassword) {
          createOverlayBanner();
          updateBannerStatus(
            "Setup needed! Please click the <strong>KGP ERP Auto-Login</strong> extension icon to configure your credentials.",
            "warning"
          );
          return;
        }

        // --- Layer 3: Retry counter ---
        // Uses window.sessionStorage ONLY (per-tab) so counter resets when tab is closed.
        // chrome.storage.session is extension-wide and would persist across tab closes, locking users out.
        let attempts = 0;
        let windowStart = 0;
        try {
          const rawAttempts = window.sessionStorage.getItem("kgp_autoOtpAttempts");
          const rawWindow = window.sessionStorage.getItem("kgp_attemptWindowStart");
          if (rawAttempts !== null) attempts = JSON.parse(rawAttempts);
          if (rawWindow !== null) windowStart = JSON.parse(rawWindow);
        } catch {}

        // Also read lastSubmittedOtp for dedup (still from both sources as fallback)
        const sessionData = await getSessionStorage(["lastSubmittedOtp"]);
        const now = Date.now();

        // Reset counter if window has expired
        if (now - windowStart > ATTEMPT_WINDOW_MS) {
          attempts = 0;
          windowStart = now;
        }

        const skipOtpAutomation = attempts >= MAX_AUTO_OTP_ATTEMPTS;

        createOverlayBanner();
        updateBannerStatus("Filling credentials...", "info");

        const passwordInput = document.getElementById("password");
        const answerInput = document.getElementById("answer");
        const otpInput = document.getElementById("email_otp1");
        const getOtpBtn = document.getElementById("getotp");
        const submitBtn = document.getElementById("loginFormSubmitButton");

        // 1. Fill Roll Number & Password
        setInputValue(userIdInput, stored.erpRoll);
        setInputValue(passwordInput, stored.erpPassword);

        // Trigger blur on user_id to invoke ERP's AJAX getSecurityQues.htm
        userIdInput.dispatchEvent(new Event("blur", { bubbles: true }));

        // 2. Wait for security question to load
        updateBannerStatus("Retrieving security question...", "info");
        let questionText = await waitForQuestionToLoad(2500);

        if (!questionText) {
          // Direct fallback: fetch via background service worker API
          try {
            const apiRes = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                { type: "FETCH_SECURITY_QUESTION", rollNumber: stored.erpRoll },
                resolve
              );
            });
            if (apiRes && apiRes.success && apiRes.question) {
              questionText = apiRes.question;
              const qLabel = document.getElementById("question");
              const ansDiv = document.getElementById("answer_div");
              if (qLabel) qLabel.innerText = questionText;
              if (ansDiv) ansDiv.classList.remove("d-none");
            }
          } catch (e) {
            console.warn("[ERP Extension] Background fetch question fallback error:", e);
          }
        }

        if (questionText) {
          const matchedAnswer = findSecurityAnswer(questionText, stored.securityQuestions);
          if (matchedAnswer) {
            setInputValue(answerInput, matchedAnswer);
            console.log("[ERP Extension] Filled security answer for:", questionText);
          } else {
            console.warn("[ERP Extension] No matching security answer found for:", questionText);
            updateBannerStatus(
              `Notice: No saved answer for "<em>${questionText}</em>". Please fill the answer manually if needed.`,
              "warning"
            );
          }
        }

        // --- Layer 3: If max attempts reached, skip OTP automation ---
        if (skipOtpAutomation) {
          createOverlayBanner();
          updateBannerStatus(
            `Auto-login tried <strong>${MAX_AUTO_OTP_ATTEMPTS} times</strong> without success. Please click <em>Send OTP</em> and enter the OTP manually.<br><span style="font-size:11px;opacity:0.7;margin-top:4px;display:inline-block;">💡 To retry auto-login, close this tab and open a new one.</span>`,
            "warning"
          );

          // Still make the OTP input and submit button accessible
          if (otpInput) {
            otpInput.classList.add("kgp-input-highlight");
            otpInput.focus();
          }
          if (submitBtn) {
            submitBtn.classList.remove("d-none");
          }
          return;
        }

        // 3. Branch based on OTP Fetch Mode (Auto vs Manual)
        const otpMode = (!stored.gmailEmail || stored.otpFetchMode === "manual") ? "manual" : "auto";

        if (otpMode === "manual") {
          const alreadyRequestedInSession = window.sessionStorage.getItem("kgp_manual_otp_requested");

          if (!alreadyRequestedInSession) {
            updateBannerStatus("Requesting OTP from ERP...", "info");
            window.sessionStorage.setItem("kgp_manual_otp_requested", "true");

            if (getOtpBtn) {
              getOtpBtn.click();
            } else {
              const s = document.createElement("script");
              s.textContent = `if(typeof getEmailOTP==="function") getEmailOTP("SI");`;
              document.documentElement.appendChild(s);
              s.remove();
            }

            await new Promise((r) => setTimeout(r, 1200));
            dismissSweetAlert();
            updateBannerStatus("✔ Credentials filled &amp; OTP sent! Enter your code and click <strong>Log In</strong>.", "success");
          } else {
            updateBannerStatus("✔ Credentials filled! Enter your OTP and click <strong>Log In</strong>.", "info");
          }

          if (otpInput) {
            otpInput.classList.add("kgp-input-highlight");
            otpInput.focus();

            // Allow pressing Enter in the OTP field to submit
            otpInput.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (submitBtn) {
                  submitBtn.classList.remove("d-none");
                  submitBtn.click();
                } else if (loginForm) {
                  loginForm.submit();
                }
              }
            });
          }

          if (submitBtn) {
            submitBtn.classList.remove("d-none");
          }

          // In manual mode, NEVER auto-submit on typing — user enters OTP and clicks Log In
          return;
        }

        // 4. Auto Mode: Request OTP and start Gmail polling
        updateBannerStatus("Requesting OTP from ERP...", "info");
        const startTime = Date.now();

        // Capture pre-dispatch inbox snapshot for UID-based detection (CLI approach) if feature is enabled
        let preSnapshotIds = [];
        const isUidDetectionEnabled = stored.enableUidSnapshot !== false;
        if (isUidDetectionEnabled) {
          try {
            const snapRes = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                { type: "SNAPSHOT_OTP_INBOX", accountIndex: stored.gmailAccountIndex ?? 0 },
                (r) => resolve(r || {})
              );
            });
            if (snapRes && snapRes.ids) {
              preSnapshotIds = snapRes.ids;
            }
          } catch (e) {}
        }

        if (getOtpBtn) {
          getOtpBtn.click();
        } else {
          // Fallback: inject a script into the page context to call ERP's own function
          const s = document.createElement("script");
          s.textContent = `if(typeof getEmailOTP==="function") getEmailOTP("SI");`;
          document.documentElement.appendChild(s);
          s.remove();
        }

        // Allow ERP AJAX request to initiate
        await new Promise((r) => setTimeout(r, 1200));
        dismissSweetAlert();

        // Increment attempt counter AFTER OTP is requested (per-tab only)
        attempts += 1;
        try {
          window.sessionStorage.setItem("kgp_autoOtpAttempts", JSON.stringify(attempts));
          window.sessionStorage.setItem("kgp_attemptWindowStart", JSON.stringify(windowStart || now));
        } catch {}

        // 4b. Start Gmail Polling with 90s timeout (Auto Mode)
        startCountdown(90);
        updateBannerStatus("Request sent! Checking your Gmail for incoming OTP...", "info");

        chrome.runtime.sendMessage(
          {
            type: "START_OTP_POLL",
            accountIndex: stored.gmailAccountIndex ?? 0,
            startTime,
            preSnapshotIds,
            timeoutMs: 90000,
          },
          async (response) => {
            cleanupCountdown();
            dismissSweetAlert();

            // Handle successful OTP detection
            if (response && response.success && response.otp) {

              // --- Layer 2: OTP dedup check ---
              const lastOtp = sessionData.lastSubmittedOtp || "";
              if (response.otp === lastOtp) {
                // Same OTP was already rejected by ERP — don't re-submit
                updateBannerStatus(
                  `⚠️ Same OTP (<strong>${response.otp}</strong>) was already rejected. Please enter a new OTP manually.`,
                  "warning"
                );
                if (otpInput) {
                  otpInput.classList.add("kgp-input-highlight");
                  otpInput.focus();
                }
                if (submitBtn) submitBtn.classList.remove("d-none");
                return;
              }

              // Store this OTP as the last submitted one
              await setSessionStorage({ lastSubmittedOtp: response.otp });

              setInputValue(otpInput, response.otp);
              updateBannerStatus(
                `✔ OTP detected: <strong>${response.otp}</strong>. Signing in now...`,
                "success"
              );

              // Auto-submit form
              setTimeout(() => {
                if (submitBtn) {
                  submitBtn.classList.remove("d-none");
                  submitBtn.click();
                } else {
                  loginForm.submit();
                }
              }, 500);
              return;
            }

            // Handle 90-second TIMEOUT (as explicitly requested by user)
            if (response && response.error === "TIMEOUT") {
              updateBannerStatus(
                `⚠️ <strong>OTP not found within 90s.</strong> Please check your Gmail and fill the OTP manually.`,
                "warning"
              );

              // Highlight and focus the OTP input so the user can easily paste it
              if (otpInput) {
                otpInput.classList.add("kgp-input-highlight");
                otpInput.focus();
                otpInput.select();
              }

              // Ensure submit button is visible
              if (submitBtn) {
                submitBtn.classList.remove("d-none");
              }
              return;
            }

            // Handle Gmail auth failure
            if (response && response.error === "AUTH_REQUIRED") {
              updateBannerStatus(
                `⚠️ Gmail not signed in. Please sign into Gmail in this browser, then fill OTP manually.`,
                "error"
              );
              if (otpInput) {
                otpInput.classList.add("kgp-input-highlight");
                otpInput.focus();
              }
              return;
            }

            // Other errors / abort
            updateBannerStatus(
              response?.message || "Could not retrieve OTP automatically. Please enter it manually.",
              "warning"
            );
            if (otpInput) {
              otpInput.classList.add("kgp-input-highlight");
              otpInput.focus();
            }
          }
        );
      }
    );
  }

  // --- Tab Visibility Guard ---
  // Only run auto-login when the tab is actually in the foreground.
  // If the page loads in a background tab (or the browser wakes from sleep
  // while a different tab is active), we defer until the user switches to
  // this tab. The flag prevents a second run if the tab is hidden/shown again.
  let autoLoginFired = false;

  function maybeRunAutoLogin() {
    if (autoLoginFired) return;
    if (document.visibilityState !== "visible") return;
    autoLoginFired = true;
    runAutoLogin();
  }

  // --- CDC & SSO In-Page Session Guard ---
  // When a user hits a deep CDC page (Notice.jsp or TPStudent.jsp) while logged out,
  // ERP redirects to SSOAdministration/login.htm, which renders "ERROR !!! Some system error occurred."
  // Instead of an intrusive full-screen overlay or auto-refresh loop, we cleanly replace the
  // error panel right on the page itself, keeping ERP's top banner intact.
  const CDC_PAGES = ["Notice.jsp", "TPStudent.jsp"];
  const isCdcPage = CDC_PAGES.some((p) => window.location.pathname.includes(p));

  function renderInPageLoggedOutCard() {
    // If the real login form is present, NEVER render the logged-out card!
    if (document.getElementById("loginForm") || document.getElementById("user_id")) {
      const existing = document.getElementById("kgp-cdc-inpage-guard");
      if (existing) existing.remove();
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const reqUrl = urlParams.get("requestedUrl") || window.location.pathname;

    // If requestedUrl points to IIT_ERP3, this is the official ERP login flow — do not show card!
    if (reqUrl.includes("IIT_ERP3")) {
      return;
    }

    if (document.getElementById("kgp-cdc-inpage-guard")) return;

    // Remove any old fixed overlay if present
    const oldOverlay = document.getElementById("kgp-cdc-session-guard");
    if (oldOverlay) oldOverlay.remove();

    // Hide ERP's raw error panel
    document.querySelectorAll(".panel-danger, .panel-danger *").forEach((el) => {
      el.style.setProperty("display", "none", "important");
    });

    const isMac =
      navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
      navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
    const shortcutHint = isMac
      ? "<kbd class='kgp-inpage-kbd'>⌘</kbd> <span class='kgp-inpage-plus'>+</span> <kbd class='kgp-inpage-kbd'>Shift</kbd> <span class='kgp-inpage-plus'>+</span> <kbd class='kgp-inpage-kbd'>E</kbd>"
      : "<kbd class='kgp-inpage-kbd'>Alt</kbd> <span class='kgp-inpage-plus'>+</span> <kbd class='kgp-inpage-kbd'>X</kbd>";

    const isNotice = reqUrl.includes("Notice");
    const isCdcApp = reqUrl.includes("TPStudent");

    const portalName = isNotice
      ? "the CDC Notice Board"
      : isCdcApp
      ? "CDC Applications"
      : "IIT KGP ERP";

    const logoUrl = chrome.runtime.getURL("icons/logo.png");
    const card = document.createElement("div");
    card.id = "kgp-cdc-inpage-guard";
    card.innerHTML = `
      <div class="kgp-inpage-card-inner">
        <!-- Extension Brand Header -->
        <div class="kgp-inpage-brand-bar">
          <img src="${logoUrl}" class="kgp-inpage-brand-icon" alt="KGP ERP Auto-Login Logo" />
          <span class="kgp-inpage-brand-name">KGP ERP Auto-Login</span>
        </div>

        <div class="kgp-inpage-divider"></div>

        <!-- Main Body -->
        <div class="kgp-inpage-body">
          <h2 class="kgp-inpage-title">Session Expired</h2>
          <p class="kgp-inpage-desc">
            You are logged out of ERP. Log back in to open <strong>${portalName}</strong>.
          </p>

          <div class="kgp-inpage-hotkey-box">
            <div style="margin-bottom: 4px;">Press ${shortcutHint}</div>
            <div class="kgp-inpage-hotkey-sub">to open ERP Home &amp; auto-login</div>
          </div>

          <button id="kgp-inpage-login-btn" class="kgp-inpage-btn" type="button">
            <span>Log In to ERP</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Locate the container in the page
    const container =
      document.querySelector(".container-fluid") ||
      document.querySelector(".container") ||
      document.body;

    // If on Notice.jsp / TPStudent.jsp with stale tables, hide them so user isn't misled
    if (isCdcPage) {
      document.querySelectorAll("table, .table, #notice_table, form").forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });
    }

    if (container) {
      container.prepend(card);
    } else {
      document.body.appendChild(card);
    }

    const btn = card.querySelector("#kgp-inpage-login-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        try { window.sessionStorage.clear(); } catch (e) {}
        chrome.runtime.sendMessage({ type: "FORCE_RELOGIN" });
      });
    }
  }

  function purgeClientStorage() {
    try {
      const darkPref = window.localStorage.getItem("kgp_dark_mode");
      window.localStorage.clear();
      if (darkPref !== null) {
        window.localStorage.setItem("kgp_dark_mode", darkPref);
      }
      window.sessionStorage.clear();
    } catch (e) {}
  }

  // Keyboard shortcut listeners
  window.addEventListener("keydown", (e) => {
    const isAltX = e.altKey && (e.key === "x" || e.key === "X");
    const isAltC = e.altKey && (e.key === "c" || e.key === "C");
    const isAltZ = e.altKey && (e.key === "z" || e.key === "Z");
    const isMacCmdShiftE =
      (e.metaKey || e.ctrlKey) &&
      e.shiftKey &&
      (e.key === "e" || e.key === "E" || e.key === "x" || e.key === "X");

    if (isAltX || isMacCmdShiftE) {
      e.preventDefault();
      purgeClientStorage();
      chrome.runtime.sendMessage({ type: "FORCE_RELOGIN" });
    } else if (isAltC) {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: "LAUNCH_CDC", url: "https://erp.iitkgp.ac.in/TrainingPlacementSSO/Notice.jsp" });
    } else if (isAltZ) {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: "LAUNCH_CDC", url: "https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPStudent.jsp" });
    }
  });

  // In-page session expiry monitor for long-lived tabs sitting on ERP menus
  let staleBannerRendered = false;
  function renderStaleSessionBanner() {
    if (staleBannerRendered) return;
    if (document.getElementById("loginForm") || document.getElementById("user_id")) return;
    if (document.getElementById("kgp-cdc-inpage-guard")) return;

    staleBannerRendered = true;
    let countdown = 5;

    const banner = document.createElement("div");
    banner.id = "kgp-stale-session-warning";
    banner.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #0f172a;
      border: 1px solid rgba(239, 68, 68, 0.4);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f8fafc;
    `;

    banner.innerHTML = `
      <div style="font-size: 20px; line-height: 1;">⚠️</div>
      <div style="display: flex; flex-direction: column;">
        <div style="font-size: 13px; font-weight: 600; color: #f8fafc;">Session Expired on Server</div>
        <div style="font-size: 11px; color: #94a3b8;">Auto-logging in <strong id="kgp-timer-sec">5</strong>s or press Alt+X...</div>
      </div>
      <button id="kgp-stale-relogin-btn" style="
        background: #3b82f6;
        color: #ffffff;
        border: none;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s;
        margin-left: 6px;
      ">Re-Login Now</button>
      <button id="kgp-stale-dismiss-btn" style="
        background: transparent;
        color: #64748b;
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
      ">✕</button>
    `;

    document.body.appendChild(banner);

    const triggerReLogin = () => {
      clearInterval(timer);
      purgeClientStorage();
      chrome.runtime.sendMessage({ type: "FORCE_RELOGIN" });
    };

    const timer = setInterval(() => {
      countdown--;
      const secEl = document.getElementById("kgp-timer-sec");
      if (secEl) secEl.textContent = countdown;
      if (countdown <= 0) {
        triggerReLogin();
      }
    }, 1000);

    const reloginBtn = banner.querySelector("#kgp-stale-relogin-btn");
    if (reloginBtn) {
      reloginBtn.addEventListener("click", triggerReLogin);
    }

    const dismissBtn = banner.querySelector("#kgp-stale-dismiss-btn");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        clearInterval(timer);
        banner.remove();
      });
    }
  }

  function monitorLiveSession() {
    if (document.getElementById("loginForm") || document.getElementById("user_id")) return;
    if (!window.location.pathname.includes("IIT_ERP3")) return;

    chrome.runtime.sendMessage({ type: "CHECK_SESSION" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.alive === false) {
        renderStaleSessionBanner();
      }
    });
  }

  // 1. If page is CDC error redirect page
  if (isCdcErrorPage) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderInPageLoggedOutCard);
    } else {
      renderInPageLoggedOutCard();
    }
  }

  // 2. If page is cached CDC page (Notice.jsp or TPStudent.jsp)
  if (isCdcPage) {
    fetch(window.location.href, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      redirect: "follow",
    })
      .then((res) => {
        const finalUrl = res.url || "";
        const isLoginPage =
          finalUrl.includes("SSOAdministration") ||
          finalUrl.includes("login") ||
          finalUrl !== window.location.href;

        if (isLoginPage) {
          renderInPageLoggedOutCard();
        }
      })
      .catch(() => {});
  }

  // 3. Fallback: Catch any ERP page that renders "ERROR !!! Some system error occurred."
  function checkSystemError() {
    if (document.getElementById("loginForm") || document.getElementById("user_id")) return;
    const errorPanel = document.querySelector(".panel-danger");
    if (errorPanel && document.body && document.body.textContent.includes("Some system error occurred")) {
      renderInPageLoggedOutCard();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkSystemError);
  } else {
    checkSystemError();
  }

  // Monitor session on authenticated pages (wait 15s after initial navigation)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(monitorLiveSession, 15000);
    });
  } else {
    setTimeout(monitorLiveSession, 15000);
  }

  // Check session status when tab regains focus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      maybeRunAutoLogin();
      monitorLiveSession();
    }
  });

  // Run as soon as DOM is ready AND tab is visible
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeRunAutoLogin);
  } else {
    maybeRunAutoLogin();
  }
})();

