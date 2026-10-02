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
    // Default to true if user hasn't explicitly disabled it
    if (isDarkStored !== "false") {
      document.documentElement.classList.add("kgp-dark-mode");
      localStorage.setItem("kgp_dark_mode", "true");

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
      if (data && data.erpDarkMode !== undefined) {
        applyDarkMode(Boolean(data.erpDarkMode));
      }
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
      // If inside ERP (logged in), clear session attempt counters for future logins
      try {
        if (chrome?.storage?.session?.remove) {
          chrome.storage.session.remove(["autoOtpAttempts", "attemptWindowStart", "lastSubmittedOtp"]);
        }
        window.sessionStorage.removeItem("kgp_autoOtpAttempts");
        window.sessionStorage.removeItem("kgp_attemptWindowStart");
        window.sessionStorage.removeItem("kgp_lastSubmittedOtp");
      } catch {}
      return;
    }

    chrome.storage.local.get(
      ["erpRoll", "erpPassword", "securityQuestions", "autoLogin", "gmailAccountIndex"],
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
        // Check how many auto-OTP attempts we've made recently
        const sessionData = await getSessionStorage(["autoOtpAttempts", "attemptWindowStart", "lastSubmittedOtp"]);

        let attempts = sessionData.autoOtpAttempts || 0;
        let windowStart = sessionData.attemptWindowStart || 0;
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
            `Auto-login tried <strong>${MAX_AUTO_OTP_ATTEMPTS} times</strong> without success. Please click <em>Send OTP</em> and enter the OTP manually.`,
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

        // 3. Request OTP
        updateBannerStatus("Requesting OTP from ERP...", "info");
        const startTime = Date.now();

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

        // Increment attempt counter AFTER OTP is requested
        attempts += 1;
        await setSessionStorage({
          autoOtpAttempts: attempts,
          attemptWindowStart: windowStart || now,
        });

        // 4. Start Gmail Polling with 90s timeout
        startCountdown(90);
        updateBannerStatus("Request sent! Checking your Gmail for incoming OTP...", "info");

        chrome.runtime.sendMessage(
          {
            type: "START_OTP_POLL",
            accountIndex: stored.gmailAccountIndex ?? 0,
            startTime,
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

  // Run as soon as DOM is ready AND tab is visible
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeRunAutoLogin);
  } else {
    maybeRunAutoLogin();
  }

  // If the tab was in the background when the page loaded, wait for it to
  // come to the foreground before triggering auto-login.
  document.addEventListener("visibilitychange", maybeRunAutoLogin);
})();
