# KGP ERP CLI (beta)

[![npm version](https://img.shields.io/npm/v/kgp-erp-cli.svg?color=cb3837&label=npm)](https://www.npmjs.com/package/kgp-erp-cli)
[![downloads](https://img.shields.io/npm/dt/kgp-erp-cli.svg?color=blue)](https://www.npmjs.com/package/kgp-erp-cli)
[![license](https://img.shields.io/npm/l/kgp-erp-cli.svg?color=green)](./LICENSE)
[![node](https://img.shields.io/node/v/kgp-erp-cli.svg?color=brightgreen)](https://nodejs.org)
[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windowsterminal&logoColor=white)](#)
[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](#)
[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](#)
[![Android](https://img.shields.io/badge/Android-3DDC84?logo=android&logoColor=white)](#)

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
- **Secure Credentials**: Saves passwords and answers to security questions in your system's native keychain (Windows Credential Manager / macOS Keychain) using `@napi-rs/keyring`. Falls back to a local file with consent when a keychain is unavailable (Termux, headless Linux, WSL).
- **Automated OTP Fetching**: Connects to your Gmail inbox via IMAP to automatically fetch the OTP requested during the ERP login flow.
- **Parallel Optimization**: Connects to the ERP portal and Gmail concurrently to authenticate as fast as possible.
- **Cross-Platform Browser Integration**: Automatically launches your default browser with your authenticated session token.
- **Timetable Management**: Save your enrolled slots, check clashes, find free slots by credit count, render your week as a color-coded grid, and get a health-check summary before registration.

---

## Installation

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **Gmail App Password**: For security reasons, Gmail requires an App Password to authenticate over IMAP. You can create one in your Google Account settings (Security > 2-Step Verification > App passwords). **2-Step Verification must be enabled** first — without it, App Passwords aren't available.

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

If you run `erp` with no arguments, an interactive menu will guide you. For a full reference run `erp guide` (alias: `erp commands`).

| Command       | Option     | Description                                                                   |
| ------------- | ---------- | ----------------------------------------------------------------------------- |
| `erp login`   | `--fresh`  | Log in to ERP. The `--fresh` flag forces a new OTP login, clearing the cache. |
| `erp setup`   | -          | Configure credentials and security questions.                                 |
| `erp status`  | `--reveal` | View configuration details. `--reveal` displays the passwords/answers.        |
| `erp reset`   | -          | Safely delete configuration file and all keychain secrets.                    |
| `erp slot`    | -          | List your saved timetable slots. Sub-commands manage the schedule (see below).|
| `erp guide`   | -          | Show every command grouped by intent, with examples.                          |
| `erp devnote` | -          | A short note from the dev — repo link, safety info, where to drop feedback.   |

---

## Timetable Slots

Save your enrolled ERP slots locally and use the CLI to check clashes, plan registration, and view your week. Lab slots accept either the bare letter (e.g. `q`) or canonical form (`LAB:Q`).

| Command                            | Description                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `erp slot add <slots>`             | Add one or more slots. Use `slot=name` to attach a course name. Refuses any clashing combo.          |
| `erp slot remove <slots>`          | Remove slots from your saved timetable.                                                              |
| `erp slot name <slot> [name...]`   | Attach or update a course name on a saved slot. Omit the name to clear it.                           |
| `erp slot reset`                   | Clear every saved slot at once.                                                                      |
| `erp slot check <slot>`            | Check whether a slot fits your schedule. Reports which slots it clashes with if not.                 |
| `erp slot free [credits\|lab]`     | List completely free slots. No argument shows 2 / 3 / 4-credit and lab summary; or pass a filter.    |
| `erp slot week`                    | Render your saved schedule as a color-coded 5×9 week grid with time-of-day headers.                  |
| `erp slot stats`                   | Health-check summary: total credits, periods used, busiest day, free days, longest stretch.          |

**Examples:**

```bash
erp slot add D3=Algorithms U2=DSA q             # add three slots with names
erp slot check H3                                # does H3 fit my schedule?
erp slot free 3                                  # what 3-credit slots are open?
erp slot week                                    # visualize the week
erp slot stats                                   # sanity-check credits & day load
```

---

## Running on Android (Termux) / Headless Linux

The CLI runs on any platform with Node.js, including Termux on Android and minimal Linux installs without a desktop keychain daemon. When no OS keychain is available, the CLI prompts for consent and falls back to a plain-text file at `~/.config/erp-cli/secrets.json` (visible to your user account only).

**On Termux (Android):**

1. Install Termux from F-Droid (not Play Store — the Play Store build is outdated).
2. `pkg install nodejs git`
3. `npm install -g kgp-erp-cli`
4. `erp setup` — accept the keychain-fallback prompt when shown.

On Termux, the `erp login` step will print the SSO URL but won't auto-open a browser. Copy the URL into Chrome manually.

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
