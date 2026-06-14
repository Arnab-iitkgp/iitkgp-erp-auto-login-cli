# KGP ERP CLI (beta)

A sleek, state-of-the-art Command Line Interface (CLI) tool designed for auto-logging into the Indian Institute of Technology Kharagpur (IIT KGP) ERP system. Say goodbye to repeatedly typing roll numbers, solving security questions, and entering OTPs manually.

```
           .:...:
           ::...:.
           -     :
           :  K  .
           -  G  :    ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗  ╦ ╦ ╔═╗ ╦
           :  P  :    ╠═╝ ║╣  ╠═╣ ║   ║╣   ╠═╣ ╠═╣ ║
           :     :    ╩   ╚═╝ ╩ ╩ ╚═╝ ╚═╝  ╩ ╩ ╩ ╩ ╩
      .:......:  .
       :..=      :
       :---..    :
       :::..:....:..............:
       :::..:...:----:--:::--.:..
.......:::-.:.. :.---:.::.:.:-...
-.---.----..:..---.:.:--:.:-....:
```

## Features

- **Instant Session Caching**: Keeps your session active using secure token storage. Bypasses the OTP flow entirely on subsequent logins unless the session has expired.
- **Secure Credentials**: Saves passwords and answers to security questions in your system's native keychain (Windows Credential Manager / macOS Keychain) using `@napi-rs/keyring`.
- **Automated OTP Fetching**: Connects to your Gmail inbox via IMAP to automatically fetch the OTP requested during the ERP login flow.
- ** Parallel Optimization**: Connects to the ERP portal and Gmail concurrently to authenticate as fast as possible.
- **Cross-Platform Browser Integration**: Automatically launches your default browser with your authenticated session token.

---

## Installation

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **Gmail App Password**: For security reasons, Gmail requires an App Password to authenticate over IMAP. You can create one in your Google Account settings (Security > 2-Step Verification > App passwords).

### Global Installation (Recommended)

You can install this package globally using npm:

```bash
npm install -g kgp-erp-cli
```

_(Or build locally and link using `npm link`)_

---

## Getting Started
### 0. Try run `erp`

### 1. Setup Configuration
Run the setup command to configure your Roll Number, Gmail address, ERP Password, Gmail App Password, and answers to your security questions.

```bash
erp setup
```

Follow the interactive prompts. The security question answers and passwords will be stored securely in your system's keychain.

### 2. Login

To auto-login and launch your browser:

```bash
erp login
```
- If you have an active cached session, it will say `Session alive — skipping OTP!` and immediately open your browser in under **1 second**.
- If the session is expired or not found, it will trigger the full authentication flow (requires Gmail connectivity) and automatically renew the cache.

### 3. Check Configuration Status
To view your saved Roll Number and Gmail email:

```bash
erp status
```

To reveal the stored passwords and security question answers, use the `--reveal` flag:

```bash
erp status --reveal
```

_(Requires entering your ERP password for authorization)_

### 4. Clear/Reset Everything

To delete all local configurations and clear credentials from your system keychain:

```bash
erp reset
```

---

## CLI Commands

If you run `erp` with no arguments, an interactive menu will guide you:

| Command      | Option     | Description                                                                   |
| ------------ | ---------- | ----------------------------------------------------------------------------- |
| `erp login`  | `--fresh`  | Log in to ERP. The `--fresh` flag forces a new OTP login, clearing the cache. |
| `erp setup`  | -          | Configure credentials and security questions.                                 |
| `erp status` | `--reveal` | View configuration details. `--reveal` displays the passwords/answers.        |
| `erp reset`  | -          | Safely delete configuration file and all keychain secrets.                    |

---

## How Session Caching Works

1. **Authentication**: Upon a successful login using password and OTP, the server returns an `ssoToken`.
2. **Persistence**: The CLI securely saves this token inside `~/.config/erp-cli/session.json` along with its creation time.
3. **Live Probe Verification**: Before attempting to request a new OTP, the CLI sends a lightweight background request to the ERP server using `redirect: "manual"` to verify the token.
   - If the token is still valid, the browser is launched immediately, saving time and resources.
   - If the server redirects the request to `logout.htm`, the token is flagged as expired and the CLI falls back to the full OTP flow.

---

## Future Plan

- **Watch Mode**: A background service/daemon that monitors session state and automatically renews cookies/tokens to keep you logged in indefinitely.
- **CDC Integration**: Follow standard redirection chains automatically to authenticate into the Placement/Internship sub-portal directly.
- **Browser Extension Support**: Connect the CLI with a lightweight Chrome/Firefox browser extension to sync login states without launching new tabs manually.
