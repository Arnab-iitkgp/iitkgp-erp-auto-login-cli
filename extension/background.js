/**
 * KGP ERP Auto-Login - Service Worker (Manifest V3)
 * Handles Gmail Atom Feed polling, account index discovery, and OTP extraction.
 */

const OTP_SUBJECT_REGEX = /OTP for Sign In in ERP Portal of IIT Kharagpur/i;
const OTP_CODE_REGEX = /\b(\d{6})\b/;

// Session keep-alive: ping ERP every 15 min to prevent idle logout
const SESSION_KEEPALIVE_ALARM = "kgp_erp_session_ping";
const KEEPALIVE_INTERVAL_MINUTES = 15;
const KEEPALIVE_URL = "https://erp.iitkgp.ac.in/IIT_ERP3/";

// Cache for active polling jobs: { [tabId]: { aborted: boolean } }
const activePolls = new Map();

// Allow content scripts to access chrome.storage.session in Manifest V3
if (chrome.storage && chrome.storage.session && chrome.storage.session.setAccessLevel) {
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" }).catch(() => {});
}

/**
 * Probes Gmail accounts (u/0 to u/10) in parallel to find which account index matches user's email.
 */
async function detectGmailAccounts(targetEmail = "") {
  const normalizedTarget = targetEmail.trim().toLowerCase();

  const probeIndices = Array.from({ length: 11 }, (_, i) => i); // 0 to 10
  const results = await Promise.all(
    probeIndices.map(async (i) => {
      try {
        const url = `https://mail.google.com/mail/u/${i}/feed/atom`;
        const res = await fetch(url, { method: "GET", credentials: "include" });
        if (!res.ok) return null;

        const xml = await res.text();
        const titleMatch = xml.match(/<title>Gmail - Inbox for ([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          return { index: i, email: titleMatch[1].trim().toLowerCase() };
        }
      } catch (e) {
        // Safe ignore
      }
      return null;
    })
  );

  const accounts = results.filter(Boolean);

  let matchedIndex = 0;
  if (accounts.length > 0) {
    if (normalizedTarget) {
      const found = accounts.find((a) => a.email === normalizedTarget);
      matchedIndex = found ? found.index : accounts[0].index;
    } else {
      matchedIndex = accounts[0].index;
    }
  }

  return {
    success: accounts.length > 0,
    accounts,
    selectedIndex: matchedIndex,
  };
}

/**
 * Polls the Gmail Atom feed for an ERP OTP email.
 */
async function pollForOtp({ tabId, accountIndex = 0, startTime = Date.now(), timeoutMs = 90000 }) {
  const pollId = `${tabId}_${Date.now()}`;
  activePolls.set(tabId, { id: pollId, aborted: false });

  const url = `https://mail.google.com/mail/u/${accountIndex}/feed/atom`;
  const pollInterval = 2000;
  const deadline = Date.now() + timeoutMs;

  console.log(`[ERP Background] Starting OTP poll for tab ${tabId} on account u/${accountIndex}... Timeout: ${timeoutMs}ms`);

  while (Date.now() < deadline) {
    const job = activePolls.get(tabId);
    if (!job || job.aborted || job.id !== pollId) {
      console.log(`[ERP Background] Poll aborted or replaced for tab ${tabId}`);
      return { success: false, error: "ABORTED" };
    }

    try {
      const res = await fetch(url, { method: "GET", credentials: "include" });

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          error: "AUTH_REQUIRED",
          message: "Not signed in to Gmail. Please open and sign into Gmail in this browser.",
        };
      }

      if (res.ok) {
        const xml = await res.text();
        const otp = extractOtpFromAtomXml(xml, startTime);
        if (otp) {
          console.log(`[ERP Background] Successfully extracted OTP: ${otp}`);
          activePolls.delete(tabId);
          return { success: true, otp };
        }
      }
    } catch (err) {
      console.warn("[ERP Background] Feed fetch error:", err);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // 90s Timeout reached!
  activePolls.delete(tabId);
  console.log(`[ERP Background] Polling timed out after ${timeoutMs}ms for tab ${tabId}`);
  return {
    success: false,
    error: "TIMEOUT",
    message: "OTP not received within 90 seconds. Please check Gmail and fill manually.",
  };
}

/**
 * Parses Atom XML to find an ERP OTP email arrived after startTime.
 */
function extractOtpFromAtomXml(xml, startTime) {
  // Split into <entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entryXml = entryMatch[1];

    const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
    const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/i);
    const issuedMatch = entryXml.match(/<issued>([\s\S]*?)<\/issued>/i);
    const modifiedMatch = entryXml.match(/<modified>([\s\S]*?)<\/modified>/i);

    const title = titleMatch ? titleMatch[1] : "";
    const summary = summaryMatch ? summaryMatch[1] : "";

    // ERP Subject typically looks like:
    // "OTP for Sign In in ERP Portal of IIT Kharagpur is 123456"
    const isErpEmail = OTP_SUBJECT_REGEX.test(title) || OTP_SUBJECT_REGEX.test(summary);

    if (isErpEmail) {
      // Check entry timestamp with a tight 3s grace window for clock drift
      const timeStr = issuedMatch ? issuedMatch[1] : (modifiedMatch ? modifiedMatch[1] : null);
      if (timeStr) {
        const entryTime = new Date(timeStr).getTime();
        if (entryTime < startTime - 3000) {
          // Old email from a previous login attempt — reject
          continue;
        }
      }

      // Extract 6-digit OTP from title first, then summary
      let codeMatch = title.match(OTP_CODE_REGEX);
      if (!codeMatch) {
        codeMatch = summary.match(OTP_CODE_REGEX);
      }

      if (codeMatch && codeMatch[1]) {
        return codeMatch[1];
      }
    }
  }

  return null;
}

/**
 * Fetches the active security question for a given roll number from ERP.
 */
async function fetchSecurityQuestion(rollNumber) {
  if (!rollNumber || typeof rollNumber !== "string") {
    return { success: false, error: "MISSING_ROLL", message: "Roll number is required." };
  }

  const cleanRoll = rollNumber.trim();
  const url = "https://erp.iitkgp.ac.in/SSOAdministration/getSecurityQues.htm";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ user_id: cleanRoll }).toString(),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `HTTP_${res.status}`,
        message: `ERP server returned status ${res.status}.`,
      };
    }

    const question = (await res.text()).trim();

    if (!question || question === "FALSE" || question.includes("FALSE")) {
      return {
        success: false,
        error: "NOT_FOUND",
        message: "No question returned. Please verify that your Roll Number is correct.",
      };
    }

    return {
      success: true,
      question,
    };
  } catch (err) {
    console.warn("[ERP Background] fetchSecurityQuestion error:", err);
    return {
      success: false,
      error: "NETWORK_ERROR",
      message: err.message || "Failed to connect to ERP server.",
    };
  }
}

/**
 * Fetches all 3 security questions from ERP by polling getSecurityQues.htm
 * until 3 unique questions are discovered (or maxAttempts reached).
 */
async function fetchAllSecurityQuestions(rollNumber, maxAttempts = 15) {
  if (!rollNumber || typeof rollNumber !== "string") {
    return { success: false, error: "MISSING_ROLL", message: "Roll number is required." };
  }

  const cleanRoll = rollNumber.trim();
  const found = new Set();
  const url = "https://erp.iitkgp.ac.in/SSOAdministration/getSecurityQues.htm";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ user_id: cleanRoll }).toString(),
      });

      if (res.ok) {
        const text = (await res.text()).trim();
        if (text && text !== "FALSE" && !text.includes("FALSE")) {
          found.add(text);
        }
      }

      if (found.size >= 3) break;
    } catch (e) {
      // Safe ignore individual attempt failure
    }

    if (found.size < 3 && attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const questionsList = Array.from(found);

  if (questionsList.length === 0) {
    return {
      success: false,
      error: "NO_QUESTIONS_FOUND",
      message: "Could not fetch any security questions. Please verify your Roll Number.",
    };
  }

  return {
    success: true,
    questions: questionsList,
    count: questionsList.length,
  };
}

// Runtime Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : "popup";

  if (request.type === "DETECT_GMAIL") {
    detectGmailAccounts(request.targetEmail).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.type === "FETCH_SECURITY_QUESTION") {
    fetchSecurityQuestion(request.rollNumber).then(sendResponse);
    return true;
  }

  if (request.type === "FETCH_ALL_SECURITY_QUESTIONS") {
    fetchAllSecurityQuestions(request.rollNumber, request.maxAttempts || 15).then(sendResponse);
    return true;
  }

  if (request.type === "START_OTP_POLL") {
    pollForOtp({
      tabId,
      accountIndex: request.accountIndex ?? 0,
      startTime: request.startTime || Date.now(),
      timeoutMs: request.timeoutMs || 90000,
    }).then(sendResponse);
    return true;
  }

  if (request.type === "CANCEL_OTP_POLL") {
    if (activePolls.has(tabId)) {
      activePolls.get(tabId).aborted = true;
      activePolls.delete(tabId);
    }
    sendResponse({ success: true });
    return false;
  }
});

// Quick Launch Hotkey Command Handler (Alt+Shift+E / Cmd+Shift+E)
chrome.commands.onCommand.addListener((command) => {
  if (command === "quick_launch_erp") {
    chrome.storage.local.get(["hotkeyEnabled"], (data) => {
      if (data.hotkeyEnabled === false) return;

      const erpUrl = "https://erp.iitkgp.ac.in/IIT_ERP3/";

      chrome.tabs.query({ url: "*://erp.iitkgp.ac.in/*" }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const existingTab = tabs[0];
          // Always navigate to home — even if already on a different ERP page
          chrome.tabs.update(existingTab.id, { active: true, url: erpUrl });
          chrome.windows.update(existingTab.windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: erpUrl });
        }
      });
    });
  }

  // Alt+C — Jump straight to CDC Notice Board (always fresh)
  if (command === "quick_launch_cdc") {
    chrome.storage.local.get(["hotkeyEnabled"], (data) => {
      if (data.hotkeyEnabled === false) return;

      const cdcNoticeUrl = "https://erp.iitkgp.ac.in/TrainingPlacementSSO/Notice.jsp";

      chrome.tabs.query({ url: "*://erp.iitkgp.ac.in/*" }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const tab = tabs[0];
          chrome.tabs.update(tab.id, { active: true, url: cdcNoticeUrl });
          chrome.windows.update(tab.windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: cdcNoticeUrl });
        }
      });
    });
  }

  // Alt+Z — Jump to CDC Placement/Internship Applications (always fresh)
  if (command === "quick_launch_cdc_app") {
    chrome.storage.local.get(["hotkeyEnabled"], (data) => {
      if (data.hotkeyEnabled === false) return;

      const cdcAppUrl = "https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPStudent.jsp";

      chrome.tabs.query({ url: "*://erp.iitkgp.ac.in/*" }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const tab = tabs[0];
          chrome.tabs.update(tab.id, { active: true, url: cdcAppUrl });
          chrome.windows.update(tab.windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: cdcAppUrl });
        }
      });
    });
  }
});

// --- ERP Session Keep-Alive ---
// Registers a repeating alarm to prevent the ERP server from expiring
// an idle session. Only fires the ping when an ERP tab is actually open.
function registerKeepAliveAlarm() {
  chrome.alarms.get(SESSION_KEEPALIVE_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(SESSION_KEEPALIVE_ALARM, {
        delayInMinutes: KEEPALIVE_INTERVAL_MINUTES,
        periodInMinutes: KEEPALIVE_INTERVAL_MINUTES,
      });
    }
  });
}

chrome.runtime.onInstalled.addListener(registerKeepAliveAlarm);
chrome.runtime.onStartup.addListener(registerKeepAliveAlarm);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== SESSION_KEEPALIVE_ALARM) return;

  const erpTabs = await chrome.tabs.query({ url: "https://erp.iitkgp.ac.in/*" });
  if (!erpTabs.length) return; // No ERP tab open — nothing to keep alive

  try {
    const res = await fetch(KEEPALIVE_URL, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    console.log(`[ERP Background] Session ping OK (${res.status})`);
  } catch (err) {
    console.warn("[ERP Background] Session ping failed:", err.message);
  }
});
