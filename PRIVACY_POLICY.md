# Privacy Policy for IIT KGP ERP Auto-Login

**Last Updated:** October 2026

This privacy policy applies to the **IIT KGP ERP Auto-Login** browser extension and CLI tool. 

The short version: **We don't collect, track, or share any of your personal data.** Everything runs locally in your browser. There are no remote servers, no analytics, and no third-party tracking.

---

## 1. What Data Is Stored and Where?

When you configure either the extension or the CLI, you provide:
* **IIT KGP Roll Number**
* **ERP Password**
* **Security Questions & Answers**
* **Gmail Account / Address** (for OTP detection)

### Browser Extension Storage
* All extension credentials and settings are saved exclusively inside your browser's isolated local storage (`chrome.storage.local`).
* The data never leaves your computer. We do not operate any backend server, database, or analytics endpoint.

### CLI Tool Storage
* Non-sensitive configuration (Roll Number, Gmail address, ERP URL) is saved locally in your user profile directory (`~/.config/kgp-erp-cli/` on Linux/macOS or `%APPDATA%\kgp-erp-cli\` on Windows).
* Sensitive credentials (ERP password and security answers) are stored in your operating system's native keychain vault (via `@napi-rs/keyring`).
* Active session tokens are temporarily cached in `session.json` to prevent unnecessary logins. Zero data is sent to external servers.

---

## 2. Why Does the Extension Request Permissions?

The extension asks for only the minimum permissions required to automate your login:

| Permission | Purpose |
| :--- | :--- |
| `https://erp.iitkgp.ac.in/*` | To auto-fill credentials, answer security questions, request OTP, apply dark mode styles, and auto-submit the login form. |
| `https://mail.google.com/*` | To read the incoming ERP OTP from your signed-in Gmail Atom feed (`feed/atom`) without needing an IMAP password. |
| `storage` | To save your roll number, password, security questions, and preferences locally in `chrome.storage.local`. |
| `tabs` | To focus an already-opened ERP tab or open a new one when you use keyboard shortcuts (`Alt+X`, `Alt+C`, `Alt+Z`). |
| `alarms` | Used to schedule lightweight session keep-alive pings to prevent your active ERP session from timing out. |

---

## 3. How We Handle Gmail Access

The extension requests access to `https://mail.google.com/*` strictly for 2-factor OTP detection:
* It queries the official read-only Atom feed (`https://mail.google.com/mail/u/{index}/feed/atom`) using your existing, active browser session.
* It only searches for recent email subjects containing IIT Kharagpur ERP OTP codes.
* **It does not read, index, or store personal emails.**
* **It does not send, delete, or modify any emails.**
* As soon as the 6-character OTP is extracted, the feed response is discarded from memory.

---

## 4. Third-Party Services and Analytics

* **Zero trackers:** We do not use Google Analytics, Sentry, Mixpanel, or any tracking/telemetry libraries.
* **Zero external network calls:** Network traffic from this extension goes strictly to two domains:
  1. `erp.iitkgp.ac.in` (IIT Kharagpur ERP portal)
  2. `mail.google.com` (Gmail Atom feed for OTP)

---

## 5. How to Delete Your Data

You are always in complete control of your data:
1. **From the extension:** 
   - Open popup ➔ Click the lock icon ➔ Enter your password ➔ Click **"Reset All Data"**. This instantly wipes all saved credentials, answers, and preferences from `chrome.storage.local`.
   - Or simply uninstall the extension from `chrome://extensions`, which removes all extension local storage.
2. **From the CLI:**
   - Delete your local configuration folder (`~/.config/kgp-erp-cli/` on Linux/macOS or `%APPDATA%\kgp-erp-cli\` on Windows) or run `erp logout` to clear session tokens.
   - Credentials stored in your OS keychain can also be cleared via your system credential manager.

---

## 6. Open Source Verification

The full source code of this extension and CLI is public and open-source under the MIT License:
[https://github.com/Arnab-iitkgp/erp-auto-login-cli](https://github.com/Arnab-iitkgp/erp-auto-login-cli)

You can inspect every single line of code to verify how your credentials and network requests are handled.

---

## 7. Contact & Support

If you have questions or concerns about this privacy policy, please open an issue on our GitHub repository:
[https://github.com/Arnab-iitkgp/erp-auto-login-cli/issues](https://github.com/Arnab-iitkgp/erp-auto-login-cli/issues)
