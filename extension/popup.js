/**
 * KGP ERP Auto-Login - Popup Controller
 * Precision Dusk Theme | 2-State Lifecycle (Dashboard vs Setup)
 * Custom In-App Modals & Toasts (Zero Native Alerts)
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- View Elements ---
  const activeDashboardView = document.getElementById("activeDashboardView");
  const settingsForm = document.getElementById("settingsForm");
  const editModeBar = document.getElementById("editModeBar");
  const backToDashBtn = document.getElementById("backToDashBtn");

  // --- Dashboard Card Elements ---
  const dashRoll = document.getElementById("dashRoll");
  const dashEmail = document.getElementById("dashEmail");
  const dashEmailBadge = document.getElementById("dashEmailBadge");
  const dashGoogleLogo = document.getElementById("dashGoogleLogo");
  const dashKgpLogo = document.getElementById("dashKgpLogo");
  const dashQuestions = document.getElementById("dashQuestions");
  const launchErpBtn = document.getElementById("launchErpBtn");
  const settingsUnlockTriggerBtn = document.getElementById("settingsUnlockTriggerBtn");

  // --- Setup Form Elements ---
  const erpRoll = document.getElementById("erpRoll");
  const erpPassword = document.getElementById("erpPassword");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  const eyeIcon = document.getElementById("eyeIcon");
  const gmailEmail = document.getElementById("gmailEmail");
  const googleSvgLogo = document.getElementById("googleSvgLogo");
  const kgpImgLogo = document.getElementById("kgpImgLogo");
  const gmailAccountIndex = document.getElementById("gmailAccountIndex");
  const checkGmailBtn = document.getElementById("checkGmailBtn");
  const gmailStatusText = document.getElementById("gmailStatusText");
  const qaContainer = document.getElementById("qaContainer");
  const fetchQuestionBtn = document.getElementById("fetchQuestionBtn");
  const saveBtn = document.getElementById("saveBtn");
  const statusMessage = document.getElementById("statusMessage");

  // --- Common Header Elements ---
  const autoLoginToggle = document.getElementById("autoLoginToggle");
  const toggleStatusLabel = document.getElementById("toggleStatusLabel");

  // --- Quick Launch Hotkey Elements ---
  const hotkeyToggle = document.getElementById("hotkeyToggle");
  const hotkeyStatusDesc = document.getElementById("hotkeyStatusDesc");
  const shortcutsList = document.getElementById("shortcutsList");
  const hotkeyHome = document.getElementById("hotkeyHome");
  const hotkeyNotice = document.getElementById("hotkeyNotice");
  const hotkeyCdcApp = document.getElementById("hotkeyCdcApp");
  const quickLaunchHome = document.getElementById("quickLaunchHome");
  const quickLaunchNotice = document.getElementById("quickLaunchNotice");
  const quickLaunchCdcApp = document.getElementById("quickLaunchCdcApp");
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0 || navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;

  // --- Unlock Settings Modal Elements ---
  const unlockModal = document.getElementById("unlockModal");
  const unlockForm = document.getElementById("unlockForm");
  const unlockPasswordInput = document.getElementById("unlockPasswordInput");
  const unlockErrorMsg = document.getElementById("unlockErrorMsg");
  const closeUnlockModalBtn = document.getElementById("closeUnlockModalBtn");
  const cancelUnlockBtn = document.getElementById("cancelUnlockBtn");
  const resetDataBtn = document.getElementById("resetDataBtn");

  // --- Help Modal Elements ---
  const helpModal = document.getElementById("helpModal");
  const closeHelpModalBtn = document.getElementById("closeHelpModalBtn");
  const helpGotItBtn = document.getElementById("helpGotItBtn");
  const helpTriggers = document.querySelectorAll(".trigger-help-modal");

  // --- FAQ Modal Elements ---
  const faqModal = document.getElementById("faqModal");
  const closeFaqModalBtn = document.getElementById("closeFaqModalBtn");
  const faqGotItBtn = document.getElementById("faqGotItBtn");
  const faqTriggers = document.querySelectorAll(".trigger-faq-modal");

  // --- Toast Notification Elements ---
  const toastNotification = document.getElementById("toastNotification");
  const toastIconWrap = document.getElementById("toastIconWrap");
  const toastMessageText = document.getElementById("toastMessageText");
  let toastTimeout = null;

  // --- Dark Mode Elements ---
  const darkModeBtns = document.querySelectorAll(".trigger-dark-mode-btn");
  let isDarkMode = false;

  // --- OTP Fetch Mode Elements ---
  const otpAutoBtn = document.getElementById("otpAutoBtn");
  const otpManualBtn = document.getElementById("otpManualBtn");
  const dashOtpModeDesc = document.getElementById("dashOtpModeDesc");

  // Cached state
  let currentStoredData = {};

  // =========================================================================
  // In-App Toast System (Replaces window.alert)
  // =========================================================================
  function showToast(message, type = "info", duration = 3200) {
    if (toastTimeout) clearTimeout(toastTimeout);

    toastMessageText.textContent = message;
    toastNotification.className = `toast-popup ${type}`;

    if (type === "success") {
      toastIconWrap.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>`;
    } else if (type === "error") {
      toastIconWrap.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>`;
    } else {
      toastIconWrap.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>`;
    }

    toastNotification.style.display = "flex";

    toastTimeout = setTimeout(() => {
      toastNotification.style.display = "none";
    }, duration);
  }

  toastNotification.addEventListener("click", () => {
    toastNotification.style.display = "none";
  });

  // =========================================================================
  // Helpers
  // =========================================================================
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function isInstiEmail(email = "") {
    const e = email.toLowerCase().trim();
    return e.includes("iitkgp.ac.in") || e.includes("kgpian");
  }

  function updateSetupEmailBrandBadge(email = "") {
    if (isInstiEmail(email)) {
      googleSvgLogo.style.display = "none";
      kgpImgLogo.style.display = "block";
    } else {
      googleSvgLogo.style.display = "block";
      kgpImgLogo.style.display = "none";
    }
  }

  function updateDashEmailBrand(email = "") {
    if (isInstiEmail(email)) {
      dashGoogleLogo.style.display = "none";
      dashKgpLogo.style.display = "block";
    } else {
      dashGoogleLogo.style.display = "block";
      dashKgpLogo.style.display = "none";
    }
  }

  function updateToggleLabel() {
    if (toggleStatusLabel) {
      const isEnabled = autoLoginToggle.checked;
      toggleStatusLabel.textContent = isEnabled ? "Enabled" : "Disabled";
      toggleStatusLabel.className = `toggle-label ${isEnabled ? "enabled" : "disabled"}`;
      toggleStatusLabel.style.color = isEnabled ? "#3b82f6" : "#8da2bb";
    }
  }

  // --- Hotkey UI & Toggle Handling ---
  function updateHotkeyUI(isEnabled) {
    if (shortcutsList) {
      if (isEnabled) {
        shortcutsList.classList.remove("shortcuts-disabled");
      } else {
        shortcutsList.classList.add("shortcuts-disabled");
      }
    }

    if (hotkeyStatusDesc) {
      if (isEnabled) {
        hotkeyStatusDesc.textContent = "Active Global Hotkeys";
        hotkeyStatusDesc.classList.remove("disabled");
      } else {
        hotkeyStatusDesc.textContent = "Hotkeys Paused (Click to Open)";
        hotkeyStatusDesc.classList.add("disabled");
      }
    }

    if (hotkeyHome) {
      hotkeyHome.innerHTML = isMac
        ? `<kbd class="hotkey-key">⌘</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">Shift</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">E</kbd>`
        : `<kbd class="hotkey-key">Alt</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">X</kbd>`;
    }
    if (hotkeyNotice) {
      hotkeyNotice.innerHTML = isMac
        ? `<kbd class="hotkey-key">⌘</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">Shift</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">C</kbd>`
        : `<kbd class="hotkey-key">Alt</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">C</kbd>`;
    }
    if (hotkeyCdcApp) {
      hotkeyCdcApp.innerHTML = isMac
        ? `<kbd class="hotkey-key">⌘</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">Shift</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">Z</kbd>`
        : `<kbd class="hotkey-key">Alt</kbd><span class="hotkey-sep">+</span><kbd class="hotkey-key">Z</kbd>`;
    }
  }

  if (hotkeyToggle) {
    hotkeyToggle.addEventListener("change", () => {
      const isEnabled = hotkeyToggle.checked;
      chrome.storage.local.set({ hotkeyEnabled: isEnabled }, () => {
        updateHotkeyUI(isEnabled);
        showToast(isEnabled ? "Quick launch shortcuts enabled" : "Quick launch shortcuts paused", "info");
      });
    });
  }

  // --- Dark Mode UI & Broadcast Handling ---
  function updateDarkModeUI(enabled) {
    isDarkMode = Boolean(enabled);
    darkModeBtns.forEach((btn) => {
      const label = btn.querySelector(".theme-btn-label");
      const icon = btn.querySelector(".theme-moon-icon");
      if (isDarkMode) {
        btn.classList.add("active");
        if (label) label.textContent = "Dark ON";
        if (icon) icon.style.color = "#38bdf8";
      } else {
        btn.classList.remove("active");
        if (label) label.textContent = "Dark";
        if (icon) icon.style.color = "currentColor";
      }
    });
  }

  darkModeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextState = !isDarkMode;
      chrome.storage.local.set({ erpDarkMode: nextState }, () => {
        updateDarkModeUI(nextState);
        // Broadcast live to open ERP tabs
        chrome.tabs.query({ url: "*://erp.iitkgp.ac.in/*" }, (tabs) => {
          if (tabs) {
            tabs.forEach((t) => {
              chrome.tabs.sendMessage(t.id, { type: "TOGGLE_DARK_MODE", enabled: nextState }).catch(() => {});
            });
          }
        });
        showToast(nextState ? "ERP Dark Theme enabled" : "ERP Dark Theme disabled", "info");
      });
    });
  });

  function createQaRow(question = "", answer = "", index = 1) {
    const row = document.createElement("div");
    row.className = "qa-split-row";
    row.innerHTML = `
      <div class="qa-question-box">
        <input type="text" class="qa-question-input" placeholder="Security Question ${index}" value="${escapeHtml(question)}" />
      </div>
      <div class="qa-answer-box">
        <input type="text" class="qa-answer-input" placeholder="Your answer" value="${escapeHtml(answer)}" />
      </div>
    `;
    return row;
  }

  // =========================================================================
  // View Switcher (Dashboard vs Setup/Edit Mode)
  // =========================================================================
  function updateOtpModeUI(mode) {
    const isAuto = mode !== "manual";
    if (otpAutoBtn) otpAutoBtn.classList.toggle("active", isAuto);
    if (otpManualBtn) otpManualBtn.classList.toggle("active", !isAuto);
    if (dashOtpModeDesc) {
      dashOtpModeDesc.textContent = isAuto ? "Auto (Gmail)" : "Manual";
    }
    if (dashEmailBadge && currentStoredData) {
      if (!isAuto) {
        dashEmailBadge.textContent = "Manual Mode";
        dashEmailBadge.className = "summary-badge summary-badge-muted";
      } else {
        dashEmailBadge.textContent = currentStoredData.gmailEmail ? "✓ Verified" : "Not Linked";
        dashEmailBadge.className = "summary-badge";
      }
    }
  }

  if (otpAutoBtn) {
    otpAutoBtn.addEventListener("click", () => {
      currentStoredData.otpFetchMode = "auto";
      updateOtpModeUI("auto");
      chrome.storage.local.set({ otpFetchMode: "auto" });
      showToast("OTP Mode: Auto-fetch from Gmail", "info");
    });
  }

  if (otpManualBtn) {
    otpManualBtn.addEventListener("click", () => {
      currentStoredData.otpFetchMode = "manual";
      updateOtpModeUI("manual");
      chrome.storage.local.set({ otpFetchMode: "manual" });
      showToast("OTP Mode: Manual entry (Gmail skipped)", "info");
    });
  }

  function renderDashboard(data) {
    currentStoredData = data;
    dashRoll.textContent = data.erpRoll || "Not set";
    dashEmail.textContent = data.gmailEmail || "Not linked";
    updateDashEmailBrand(data.gmailEmail || "");
    updateOtpModeUI(data.otpFetchMode || "auto");

    const qCount = data.securityQuestions && typeof data.securityQuestions === "object"
      ? Object.keys(data.securityQuestions).length
      : 0;

    dashQuestions.textContent = qCount > 0 ? `${qCount} Configured` : "None set";

    activeDashboardView.style.display = "flex";
    settingsForm.style.display = "none";
    editModeBar.style.display = "none";
  }

  function switchToSetupView(isEdit = false) {
    activeDashboardView.style.display = "none";
    settingsForm.style.display = "flex";
    editModeBar.style.display = isEdit ? "flex" : "none";
  }

  // Back to Dashboard button (in edit mode)
  if (backToDashBtn) {
    backToDashBtn.addEventListener("click", () => {
      renderDashboard(currentStoredData);
    });
  }

  // =========================================================================
  // Load Initial Settings & State
  // =========================================================================
  function loadInitialSettings() {
    chrome.storage.local.get(
      [
        "erpRoll",
        "erpPassword",
        "gmailEmail",
        "gmailAccountIndex",
        "securityQuestions",
        "autoLogin",
        "hotkeyEnabled",
        "erpDarkMode",
        "otpFetchMode",
      ],
      (data) => {
        currentStoredData = data || {};
        updateOtpModeUI(data.otpFetchMode || "auto");

        if (data.autoLogin !== undefined) {
          autoLoginToggle.checked = Boolean(data.autoLogin);
        }
        updateToggleLabel();

        // Dark Mode initialization
        updateDarkModeUI(Boolean(data.erpDarkMode));

        // Hotkey Toggle initialization
        const hotkeyActive = data.hotkeyEnabled !== false;
        if (hotkeyToggle) hotkeyToggle.checked = hotkeyActive;
        updateHotkeyUI(hotkeyActive);

        // Populate Setup fields
        if (data.erpRoll) erpRoll.value = data.erpRoll;
        if (data.erpPassword) erpPassword.value = data.erpPassword;
        if (data.gmailEmail) {
          gmailEmail.value = data.gmailEmail;
          updateSetupEmailBrandBadge(data.gmailEmail);
          if (gmailStatusText) {
            gmailStatusText.textContent = "✓ Verified";
            gmailStatusText.className = "email-status-pill verified";
          }
        }
        if (data.gmailAccountIndex !== undefined) {
          gmailAccountIndex.value = data.gmailAccountIndex.toString();
        }

        // Populate Q&A pairs if stored
        if (data.securityQuestions && typeof data.securityQuestions === "object") {
          const entries = Object.entries(data.securityQuestions);
          if (entries.length > 0) {
            qaContainer.innerHTML = "";
            entries.forEach(([q, a]) => {
              const row = createQaRow(q, a);
              qaContainer.appendChild(row);
            });
          }
        }

        // Determine view state:
        // If credentials exist, show Active Dashboard. Otherwise, show Setup Form.
        if (data.erpRoll && data.erpPassword) {
          renderDashboard(data);
        } else {
          switchToSetupView(false);
        }
      }
    );
  }

  loadInitialSettings();

  // =========================================================================
  // Header Toggle Event
  // =========================================================================
  autoLoginToggle.addEventListener("change", () => {
    updateToggleLabel();
    chrome.storage.local.set({ autoLogin: autoLoginToggle.checked });
  });

  // =========================================================================
  // Setup Form Handlers
  // =========================================================================
  gmailEmail.addEventListener("input", () => {
    updateSetupEmailBrandBadge(gmailEmail.value);
    if (gmailStatusText) {
      gmailStatusText.textContent = "Ready";
      gmailStatusText.className = "email-status-pill";
    }
  });

  function verifyEmailAccount() {
    const inputEmail = gmailEmail.value.trim().toLowerCase();
    if (gmailStatusText) {
      gmailStatusText.textContent = "Checking...";
      gmailStatusText.className = "email-status-pill";
    }
    if (checkGmailBtn) checkGmailBtn.disabled = true;

    chrome.runtime.sendMessage(
      {
        type: "DETECT_GMAIL",
        targetEmail: inputEmail,
      },
      (res) => {
        if (checkGmailBtn) checkGmailBtn.disabled = false;
        if (!res || !res.success || !res.accounts || res.accounts.length === 0) {
          if (gmailStatusText) {
            gmailStatusText.textContent = "Not logged in";
            gmailStatusText.className = "email-status-pill error";
          }
          showToast("No active browser session found for this email.", "error");
          return;
        }

        let matched = null;
        if (inputEmail) {
          matched = res.accounts.find((a) => a.email.toLowerCase() === inputEmail);
        }

        if (matched) {
          gmailAccountIndex.value = matched.index;
          if (gmailStatusText) {
            gmailStatusText.textContent = "✓ Verified";
            gmailStatusText.className = "email-status-pill verified";
          }
          chrome.storage.local.set({
            gmailEmail: matched.email,
            gmailAccountIndex: matched.index,
          });
          showToast(`✓ Linked to slot u/${matched.index}`, "success");
        } else if (!inputEmail && res.accounts.length > 0) {
          const first = res.accounts[0];
          gmailEmail.value = first.email;
          updateSetupEmailBrandBadge(first.email);
          gmailAccountIndex.value = first.index;
          if (gmailStatusText) {
            gmailStatusText.textContent = "✓ Verified";
            gmailStatusText.className = "email-status-pill verified";
          }
          chrome.storage.local.set({
            gmailEmail: first.email,
            gmailAccountIndex: first.index,
          });
          showToast(`✓ Found ${first.email} (u/${first.index})`, "success");
        } else {
          if (gmailStatusText) {
            gmailStatusText.textContent = "Not logged in";
            gmailStatusText.className = "email-status-pill error";
          }
          showToast("Email not signed in on this Chrome profile.", "error");
        }
      }
    );
  }

  if (checkGmailBtn) {
    checkGmailBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      verifyEmailAccount();
    });
  }

  // Password visibility toggle
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = erpPassword.type === "password";
    erpPassword.type = isPassword ? "text" : "password";
    eyeIcon.innerHTML = isPassword
      ? `<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>`
      : `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>`;
  });

  // Fetch All 3 Security Questions from ERP
  fetchQuestionBtn.addEventListener("click", () => {
    const roll = erpRoll.value.trim();
    if (!roll) {
      showToast("Please enter your Roll Number first.", "error");
      erpRoll.focus();
      return;
    }

    fetchQuestionBtn.disabled = true;
    const originalText = fetchQuestionBtn.innerHTML;
    fetchQuestionBtn.innerHTML = `<span>Fetching...</span>`;

    chrome.runtime.sendMessage(
      {
        type: "FETCH_ALL_SECURITY_QUESTIONS",
        rollNumber: roll,
        maxAttempts: 15,
      },
      (res) => {
        fetchQuestionBtn.disabled = false;
        fetchQuestionBtn.innerHTML = originalText;

        if (!res || !res.success || !res.questions || res.questions.length === 0) {
          showToast(res?.message || "Failed to fetch questions from ERP.", "error");
          return;
        }

        const existingAnswers = {};
        qaContainer.querySelectorAll(".qa-split-row").forEach((row) => {
          const q = row.querySelector(".qa-question-input")?.value.trim().toLowerCase();
          const a = row.querySelector(".qa-answer-input")?.value.trim();
          if (q && a) existingAnswers[q] = a;
        });

        qaContainer.innerHTML = "";
        let firstEmptyAnswerInput = null;

        res.questions.forEach((qText) => {
          const cleanQ = qText.trim().toLowerCase();
          const matchedAnswer = existingAnswers[cleanQ] || "";
          const row = createQaRow(qText, matchedAnswer);
          qaContainer.appendChild(row);

          const answerInput = row.querySelector(".qa-answer-input");
          if (!matchedAnswer && !firstEmptyAnswerInput) {
            firstEmptyAnswerInput = answerInput;
          }
        });

        showToast(`Fetched ${res.questions.length} security questions!`, "success");

        if (firstEmptyAnswerInput) {
          firstEmptyAnswerInput.focus();
        }
      }
    );
  });

  // Save Settings
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const questionsMap = {};
    const rows = qaContainer.querySelectorAll(".qa-split-row");
    rows.forEach((row) => {
      const q = row.querySelector(".qa-question-input")?.value.trim();
      const a = row.querySelector(".qa-answer-input")?.value.trim();
      if (q && a) {
        questionsMap[q] = a;
      }
    });

    const settings = {
      erpRoll: erpRoll.value.trim(),
      erpPassword: erpPassword.value,
      gmailEmail: gmailEmail.value.trim(),
      gmailAccountIndex: parseInt(gmailAccountIndex.value, 10) || 0,
      securityQuestions: questionsMap,
      autoLogin: autoLoginToggle.checked,
    };

    chrome.storage.local.set(settings, () => {
      showToast("✔ Saved! Auto-login is ready.", "success");
      // Seamlessly switch to Dashboard
      renderDashboard(settings);
    });
  });

  // =========================================================================
  // Dashboard Action Handlers
  // =========================================================================
  function navigateOrOpenTab(url) {
    chrome.tabs.query({ url: "*://erp.iitkgp.ac.in/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const existingTab = tabs[0];
        chrome.tabs.update(existingTab.id, { active: true, url: url });
        chrome.windows.update(existingTab.windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: url });
      }
    });
  }

  if (launchErpBtn) {
    launchErpBtn.addEventListener("click", () => {
      navigateOrOpenTab("https://erp.iitkgp.ac.in/IIT_ERP3/");
    });
  }

  if (quickLaunchHome) {
    quickLaunchHome.addEventListener("click", () => {
      navigateOrOpenTab("https://erp.iitkgp.ac.in/IIT_ERP3/");
    });
  }

  if (quickLaunchNotice) {
    quickLaunchNotice.addEventListener("click", () => {
      navigateOrOpenTab("https://erp.iitkgp.ac.in/TrainingPlacementSSO/Notice.jsp");
    });
  }

  if (quickLaunchCdcApp) {
    quickLaunchCdcApp.addEventListener("click", () => {
      navigateOrOpenTab("https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPStudent.jsp");
    });
  }

  // =========================================================================
  // Settings Unlock Modal Flow (Password Protection for Shared PCs)
  // =========================================================================
  if (settingsUnlockTriggerBtn) {
    settingsUnlockTriggerBtn.addEventListener("click", () => {
      unlockPasswordInput.value = "";
      unlockErrorMsg.style.display = "none";
      unlockModal.style.display = "flex";
      unlockPasswordInput.focus();
    });
  }

  function closeUnlockModal() {
    unlockModal.style.display = "none";
    unlockPasswordInput.value = "";
    unlockErrorMsg.style.display = "none";
  }

  if (closeUnlockModalBtn) closeUnlockModalBtn.addEventListener("click", closeUnlockModal);
  if (cancelUnlockBtn) cancelUnlockBtn.addEventListener("click", closeUnlockModal);

  // Submit Password to Unlock
  if (unlockForm) {
    unlockForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const enteredPass = unlockPasswordInput.value;

      chrome.storage.local.get(["erpPassword"], (data) => {
        if (data.erpPassword && enteredPass === data.erpPassword) {
          closeUnlockModal();
          switchToSetupView(true); // Edit mode with "Back to Dashboard" button
          showToast("Settings unlocked for editing", "info");
        } else {
          unlockErrorMsg.style.display = "block";
          unlockPasswordInput.select();
        }
      });
    });
  }

  // Reset All Stored Data
  if (resetDataBtn) {
    resetDataBtn.addEventListener("click", () => {
      const confirmReset = confirm("Are you sure you want to reset all saved credentials and questions?");
      if (!confirmReset) return;

      chrome.storage.local.clear(() => {
        currentStoredData = {};
        erpRoll.value = "";
        erpPassword.value = "";
        gmailEmail.value = "";
        gmailAccountIndex.value = "0";
        if (gmailStatusText) {
          gmailStatusText.textContent = "Ready";
          gmailStatusText.className = "email-status-pill";
        }
        qaContainer.innerHTML = `
          <div class="qa-split-row">
            <div class="qa-question-box"><input type="text" class="qa-question-input" placeholder="Security Question 1" value="" /></div>
            <div class="qa-answer-box"><input type="text" class="qa-answer-input" placeholder="Your answer" value="" /></div>
          </div>
          <div class="qa-split-row">
            <div class="qa-question-box"><input type="text" class="qa-question-input" placeholder="Security Question 2" value="" /></div>
            <div class="qa-answer-box"><input type="text" class="qa-answer-input" placeholder="Your answer" value="" /></div>
          </div>
          <div class="qa-split-row">
            <div class="qa-question-box"><input type="text" class="qa-question-input" placeholder="Security Question 3" value="" /></div>
            <div class="qa-answer-box"><input type="text" class="qa-answer-input" placeholder="Your answer" value="" /></div>
          </div>
        `;
        closeUnlockModal();
        switchToSetupView(false);
        showToast("All configuration cleared", "info");
      });
    });
  }

  // =========================================================================
  // In-App Help Modal Flow
  // =========================================================================
  helpTriggers.forEach((btn) => {
    btn.addEventListener("click", () => {
      helpModal.style.display = "flex";
    });
  });

  function closeHelpModal() {
    helpModal.style.display = "none";
  }

  if (closeHelpModalBtn) closeHelpModalBtn.addEventListener("click", closeHelpModal);
  if (helpGotItBtn) helpGotItBtn.addEventListener("click", closeHelpModal);

  // =========================================================================
  // In-App FAQ Modal Flow
  // =========================================================================
  faqTriggers.forEach((btn) => {
    btn.addEventListener("click", () => {
      faqModal.style.display = "flex";
    });
  });

  function closeFaqModal() {
    faqModal.style.display = "none";
  }

  if (closeFaqModalBtn) closeFaqModalBtn.addEventListener("click", closeFaqModal);
  if (faqGotItBtn) faqGotItBtn.addEventListener("click", closeFaqModal);

  const faqIssueLink = document.getElementById("faqIssueLink");
  if (faqIssueLink) {
    faqIssueLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "https://github.com/Arnab-iitkgp/erp-auto-login-cli/issues" });
    });
  }

  const helpGithubLink = document.getElementById("helpGithubLink");
  if (helpGithubLink) {
    helpGithubLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "https://github.com/Arnab-iitkgp/erp-auto-login-cli" });
    });
  }

  // Close modals when clicking backdrop
  window.addEventListener("click", (e) => {
    if (e.target === unlockModal) closeUnlockModal();
    if (e.target === helpModal) closeHelpModal();
    if (e.target === faqModal) closeFaqModal();
  });
});
