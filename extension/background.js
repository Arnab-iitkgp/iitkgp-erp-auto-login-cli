/**
 * KGP ERP Auto-Login - Service Worker (Manifest V3)
 * Handles Gmail Atom Feed polling, account index discovery, and OTP extraction.
 */

const OTP_SUBJECT_REGEX = /OTP for Sign In in ERP Portal of IIT Kharagpur/i;
const OTP_CODE_REGEX = /\b(\d{6})\b/;

// Session keep-alive: ping ERP every 5 min to prevent idle logout
const SESSION_KEEPALIVE_ALARM = "kgp_erp_session_ping";
const KEEPALIVE_INTERVAL_MINUTES = 5;
const KEEPALIVE_URL = "https://erp.iitkgp.ac.in/IIT_ERP3/home.htm";

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

// --- Feature Flag: Hybrid UID/Message-ID Snapshot Detection ---
// When enabled, snapshots existing email IDs before OTP dispatch and matches brand-new IDs
// like the CLI does, falling back to timestamp verification if snapshot is unavailable.
const ENABLE_UID_SNAPSHOT_DETECTION = true;

/**
 * Extracts all unique message IDs (<id>...</id>) from the Atom XML.
 */
function extractMessageIdsFromAtomXml(xml) {
  const ids = new Set();
  const idRegex = /<id>([\s\S]*?)<\/id>/gi;
  let match;
  while ((match = idRegex.exec(xml)) !== null) {
    if (match[1]) ids.add(match[1].trim());
  }
  return ids;
}

/**
 * Snapshots all current message IDs in the Gmail Atom feed before OTP is triggered.
 */
async function snapshotInboxIds(accountIndex = 0) {
  try {
    const url = `https://mail.google.com/mail/u/${accountIndex}/feed/atom`;
    const res = await fetch(url, { method: "GET", credentials: "include" });
    if (res.ok) {
      const xml = await res.text();
      const ids = Array.from(extractMessageIdsFromAtomXml(xml));
      console.log(`[ERP Background] Captured ${ids.length} inbox message IDs in pre-OTP snapshot`);
      return { success: true, ids };
    }
  } catch (e) {
    console.warn("[ERP Background] Snapshot inbox IDs error:", e);
  }
  return { success: false, ids: [] };
}

/**
 * UID/Message-ID based OTP extraction (CLI approach adapted for Atom feed).
 * Looks for an ERP OTP email whose unique <id> was NOT present in snapshotSet.
 */
function extractOtpUsingUidSnapshot(xml, snapshotSet) {
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entryXml = entryMatch[1];
    const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/i);
    const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
    const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/i);

    const title = titleMatch ? titleMatch[1] : "";
    const summary = summaryMatch ? summaryMatch[1] : "";
    const isErpEmail = OTP_SUBJECT_REGEX.test(title) || OTP_SUBJECT_REGEX.test(summary);

    if (isErpEmail && idMatch && idMatch[1]) {
      const entryId = idMatch[1].trim();

      // Check if this is a brand-new message ID that did NOT exist in pre-click snapshot
      if (!snapshotSet.has(entryId)) {
        console.log(`[ERP Background] [UID Mode] Detected fresh incoming email with new ID: ${entryId}`);

        let codeMatch = title.match(OTP_CODE_REGEX);
        if (!codeMatch) {
          codeMatch = summary.match(OTP_CODE_REGEX);
        }

        if (codeMatch && codeMatch[1]) {
          return codeMatch[1];
        }
      }
    }
  }

  return null;
}

/**
 * Polls the Gmail Atom feed for an ERP OTP email.
 */
async function pollForOtp({ tabId, accountIndex = 0, startTime = Date.now(), preSnapshotIds = [], timeoutMs = 90000 }) {
  const pollId = `${tabId}_${Date.now()}`;
  activePolls.set(tabId, { id: pollId, aborted: false });

  const url = `https://mail.google.com/mail/u/${accountIndex}/feed/atom`;
  const pollInterval = 2000;
  const deadline = Date.now() + timeoutMs;
  const snapshotSet = new Set(preSnapshotIds || []);

  const storedConfig = await chrome.storage.local.get(["enableUidSnapshot"]);
  const isUidFeatureEnabled = storedConfig.enableUidSnapshot !== undefined
    ? Boolean(storedConfig.enableUidSnapshot)
    : ENABLE_UID_SNAPSHOT_DETECTION;

  console.log(`[ERP Background] Starting OTP poll for tab ${tabId} on account u/${accountIndex}... Timeout: ${timeoutMs}ms (UID feature flag: ${isUidFeatureEnabled}, snapshot: ${snapshotSet.size} items)`);

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
        let otp = null;

        // 1. If feature flag enabled and snapshot available, check UID approach first
        if (isUidFeatureEnabled && snapshotSet.size > 0) {
          otp = extractOtpUsingUidSnapshot(xml, snapshotSet);
        }

        // 2. Existing logic (preserved completely as fallback / default)
        if (!otp) {
          otp = extractOtpFromAtomXml(xml, startTime);
        }

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

  if (request.type === "SNAPSHOT_OTP_INBOX") {
    snapshotInboxIds(request.accountIndex ?? 0).then(sendResponse);
    return true;
  }

  if (request.type === "START_OTP_POLL") {
    pollForOtp({
      tabId,
      accountIndex: request.accountIndex ?? 0,
      startTime: request.startTime || Date.now(),
      preSnapshotIds: request.preSnapshotIds || [],
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

  if (request.type === "CHECK_SESSION") {
    isSessionAlive().then((alive) => sendResponse({ alive }));
    return true;
  }

  if (request.type === "LAUNCH_ERP_HOME") {
    launchErpHome().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.type === "LAUNCH_CDC") {
    launchCdcPage(request.url).then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.type === "FORCE_RELOGIN") {
    const targetTabId = sender.tab ? sender.tab.id : null;
    forceReLogin(targetTabId).then(() => sendResponse({ success: true }));
    return true;
  }
});

/**
 * Exact CLI sessionAlive check:
 * Uses the saved latestSsoToken (or live cookie) and probes:
 *   GET /IIT_ERP3/home.htm?ssoToken=${ssoToken}
 * If ERP redirects to logout.htm or login.htm -> DEAD!
 * If not -> ALIVE!
 */
async function isSessionAlive() {
  try {
    // 1. Check if JSESSIONID cookie exists for ERP domain
    let hasJSession = false;
    if (chrome.cookies) {
      const cookies = await chrome.cookies.getAll({ domain: "erp.iitkgp.ac.in" });
      hasJSession = cookies.some((c) => c.name === "JSESSIONID" && c.value);
    }

    // 2. Retrieve ssoToken if available (from cookie or storage)
    let ssoToken = "";
    if (chrome.cookies) {
      const ssoCookie = await chrome.cookies.get({
        url: "https://erp.iitkgp.ac.in/IIT_ERP3/",
        name: "ssoToken",
      });
      if (ssoCookie && ssoCookie.value) {
        ssoToken = ssoCookie.value;
      }
    }

    if (!ssoToken) {
      const stored = await chrome.storage.local.get(["latestSsoToken"]);
      if (stored && stored.latestSsoToken) {
        ssoToken = stored.latestSsoToken;
      }
    }

    // If neither JSESSIONID nor ssoToken exists, session is definitely dead
    if (!hasJSession && !ssoToken) {
      return false;
    }

    // 3. Probe ERP home page:
    // If ssoToken is available, include it; otherwise let browser send live cookies
    const testUrl = ssoToken
      ? `https://erp.iitkgp.ac.in/IIT_ERP3/home.htm?ssoToken=${encodeURIComponent(ssoToken)}`
      : `https://erp.iitkgp.ac.in/IIT_ERP3/home.htm`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(testUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const finalUrl = res.url || "";
    if (
      !res.ok ||
      finalUrl.includes("logout") ||
      finalUrl.includes("login") ||
      finalUrl.includes("SSOAdministration")
    ) {
      chrome.storage.local.remove(["latestSsoToken"]);
      return false;
    }

    const text = await res.text();
    if (
      text.includes("Some system error occurred") ||
      text.includes("loginForm") ||
      text.includes("Session Expired")
    ) {
      chrome.storage.local.remove(["latestSsoToken"]);
      return false;
    }

    return true;
  } catch (e) {
    // On temporary timeout or network glitch, do NOT falsely declare session dead
    return true;
  }
}

// Navigation helper: activate existing tab or create new one
function navigateOrOpenTab(url) {
  chrome.tabs.query({ url: "*://erp.iitkgp.ac.in/*" }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      chrome.windows.update(tab.windowId, { focused: true });
      if (tab.url === url) {
        chrome.tabs.update(tab.id, { active: true }, () => {
          chrome.tabs.reload(tab.id);
        });
      } else {
        chrome.tabs.update(tab.id, { active: true, url });
      }
    } else {
      chrome.tabs.create({ url });
    }
  });
}

/**
 * Completely purges stale ERP session, cookies, and local cache.
 * 1. Pings /SSOAdministration/logout.htm so the server invalidates session.
 * 2. Uses chrome.cookies.remove to delete JSESSIONID, ssoToken, and LAST_ACCESS_TIME.
 * 3. Removes stored tokens from storage.
 */
async function forceLogoutAndPurge() {
  console.log("[ERP Background] Purging stale ERP session, cookies, and cache...");

  // 1. Tell ERP server to invalidate session on its end
  try {
    await fetch("https://erp.iitkgp.ac.in/SSOAdministration/logout.htm", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch (e) {}

  // 2. Remove all ERP cookies (including HttpOnly JSESSIONID, ssoToken, LAST_ACCESS_TIME)
  try {
    if (chrome.cookies) {
      const cookies = await chrome.cookies.getAll({ domain: "erp.iitkgp.ac.in" });
      for (const c of cookies) {
        const domain = c.domain.startsWith(".") ? c.domain.substring(1) : c.domain;
        const cookieUrl = `https://${domain}${c.path || "/"}`;
        await chrome.cookies.remove({
          url: cookieUrl,
          name: c.name,
        });
      }
    }
  } catch (e) {
    console.warn("[ERP Background] Error removing cookies:", e);
  }

  // 3. Clear stored tokens
  try {
    await chrome.storage.local.remove(["latestSsoToken"]);
    if (chrome.storage && chrome.storage.session) {
      await chrome.storage.session.remove(["latestSsoToken", "postLoginRedirect"]);
    }
  } catch (e) {}
}

/**
 * Purges stale session and forcefully opens the fresh login page.
 * Without cookies, /IIT_ERP3/ is guaranteed to 302 redirect to /SSOAdministration/login.htm.
 */
async function forceReLogin(tabId = null) {
  await forceLogoutAndPurge();

  const loginUrl = "https://erp.iitkgp.ac.in/IIT_ERP3/";

  if (tabId) {
    chrome.tabs.update(tabId, { active: true, url: loginUrl });
  } else {
    chrome.tabs.query({ url: "*://erp.iitkgp.ac.in/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true, url: loginUrl });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: loginUrl });
      }
    });
  }
}

/**
 * Alt+X Handler:
 * - If session is alive: opens/switches to ERP Home (showmenu.htm).
 * - If session is dead: purges cookies and opens login page to auto-login.
 */
async function launchErpHome() {
  const alive = await isSessionAlive();
  console.log(`[ERP Background] Alt+X sessionAlive: ${alive}`);
  if (alive) {
    navigateOrOpenTab("https://erp.iitkgp.ac.in/IIT_ERP3/showmenu.htm");
  } else {
    await forceReLogin();
  }
}

/**
 * Ensures the ssoToken cookie exists on erp.iitkgp.ac.in.
 * After browser restart, Edge may not restore session cookies (ssoToken has no Expires).
 * The IIT_ERP3 JSESSIONID alone keeps the ERP session alive, but CDC pages
 * (TrainingPlacementSSO) require ssoToken for SSO handshake to create their own session.
 * This restores the ssoToken cookie from our saved copy in chrome.storage.local.
 */
async function ensureSsoTokenCookie() {
  if (!chrome.cookies) return null;

  // 1. Check if ssoToken cookie already exists
  try {
    const existing = await chrome.cookies.get({
      url: "https://erp.iitkgp.ac.in/",
      name: "ssoToken",
    });
    if (existing && existing.value) {
      console.log("[ERP Background] ssoToken cookie already present");
      return existing.value;
    }
  } catch (e) {}

  // 2. Cookie is missing — restore from our saved copy
  const stored = await chrome.storage.local.get(["latestSsoToken"]);
  if (stored && stored.latestSsoToken) {
    try {
      await chrome.cookies.set({
        url: "https://erp.iitkgp.ac.in/",
        name: "ssoToken",
        value: stored.latestSsoToken,
        domain: "erp.iitkgp.ac.in",
        path: "/",
        secure: true,
        sameSite: "lax",
      });
      console.log("[ERP Background] Restored ssoToken cookie from storage");
      return stored.latestSsoToken;
    } catch (e) {
      console.warn("[ERP Background] Failed to restore ssoToken cookie:", e);
    }
  }

  return null;
}

/**
 * Smart CDC page launcher (Alt+C / Alt+Z):
 * 1. Checks if ERP session is alive.
 * 2. If alive, ensures ssoToken cookie is present (restores if Edge cleared it).
 * 3. Navigates to the CDC page — server can now do the SSO handshake.
 * 4. If session is dead, forces re-login.
 */
async function launchCdcPage(targetUrl) {
  const alive = await isSessionAlive();
  console.log(`[ERP Background] CDC launch sessionAlive: ${alive}, target: ${targetUrl}`);

  if (!alive) {
    await forceReLogin();
    return;
  }

  // Session alive but ssoToken cookie may be missing after browser restart
  await ensureSsoTokenCookie();

  navigateOrOpenTab(targetUrl);
}

// Quick Launch Hotkey Command Handler (Alt+X / Alt+C / Alt+Z)
chrome.commands.onCommand.addListener((command) => {
  chrome.storage.local.get(["hotkeyEnabled"], (data) => {
    if (data.hotkeyEnabled === false) return;

    if (command === "quick_launch_erp") {
      launchErpHome();
    } else if (command === "quick_launch_cdc") {
      launchCdcPage("https://erp.iitkgp.ac.in/TrainingPlacementSSO/Notice.jsp");
    } else if (command === "quick_launch_cdc_app") {
      launchCdcPage("https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPStudent.jsp");
    }
  });
});

// --- ERP Session Keep-Alive ---
// Registers a repeating alarm to prevent the ERP server from expiring
// an idle session. Only fires the ping when an ERP tab is actually open.
function registerKeepAliveAlarm() {
  chrome.alarms.create(SESSION_KEEPALIVE_ALARM, {
    delayInMinutes: KEEPALIVE_INTERVAL_MINUTES,
    periodInMinutes: KEEPALIVE_INTERVAL_MINUTES,
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
    const finalUrl = res.url || "";
    if (
      finalUrl.includes("logout") ||
      finalUrl.includes("login") ||
      finalUrl.includes("SSOAdministration")
    ) {
      console.warn("[ERP Background] Keep-alive detected session has expired on server.");
    } else {
      console.log(`[ERP Background] Session keep-alive ping OK (${res.status})`);
    }
  } catch (err) {
    console.warn("[ERP Background] Session ping failed:", err.message);
  }
});
