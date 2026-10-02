# IIT KGP ERP Auto-Login (Extension & CLI) (Beta)

[![npm version](https://img.shields.io/npm/v/kgp-erp-cli.svg?color=cb3837&label=npm)](https://www.npmjs.com/package/kgp-erp-cli)
[![downloads](https://img.shields.io/npm/dt/kgp-erp-cli.svg?color=blue)](https://www.npmjs.com/package/kgp-erp-cli)
[![license](https://img.shields.io/npm/l/kgp-erp-cli.svg?color=green)](./LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Coming_Soon-orange?logo=googlechrome&logoColor=white)](#browser-extension)
[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windowsterminal&logoColor=white)](#)
[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](#)
[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](#)
[![Android](https://img.shields.io/badge/Android-3DDC84?logo=android&logoColor=white)](#)

Auto-login for IIT Kharagpur ERP. Enters your roll number and password, answers the security question, grabs the OTP from Gmail, and signs you in.


> **Note**: Chrome Web Store release is coming soon. In the meantime, you can load the extension unpacked in under a minute via Developer Mode.

---

## Quick Index

- [Browser Extension](#browser-extension)
  - [Features](#extension-features)
  - [Install (Load Unpacked)](#extension-setup-load-unpacked)
  - [Shortcut](#extension-shortcut)
- [CLI Tool](#cli-tool)
  - [Features](#cli-features)
  - [Install](#cli-installation)
  - [Quick Start](#cli-quick-start)
  - [Commands](#cli-commands)
  - [Timetable Slots](#timetable-slots)
  - [Termux / Android](#running-on-android-termux--headless-linux)
- [How Session Caching Works](#how-session-caching-works)
- [Security & Privacy](#security--privacy)

---

<a id="browser-extension"></a>
## Browser Extension

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Coming_Soon-orange?logo=googlechrome&logoColor=white)](#browser-extension)

<p align="center">
  <img src="extension/icons/logo.png" width="155" alt="IIT KGP ERP Extension Logo" />
</p>

Works on Chrome, Brave, Edge, and other Chromium browsers.

<a id="extension-features"></a>
### Extension Features

- **Logs in automatically**: When you open ERP, it fills your credentials, answers the security question, reads the OTP from your signed-in Gmail tab, and submits. No Gmail app passwords or IMAP setup needed.
- **Dark mode**: A full dark theme for ERP that doesn't flash white on page loads. Covers menus, grade tables, CDC notices, and popups.
- **Quick launch shortcut**: Press `Alt + Shift + E` (`Cmd + Shift + E` on Mac) anywhere in your browser to open ERP or jump straight to your existing ERP tab.
- **Password-protect settings**: Lock your saved credentials behind your ERP password so friends using your laptop can't open your settings.
- **Doesn't get stuck**: If an OTP takes longer than 90s or Gmail isn't signed in, it highlights the OTP box and lets you enter it manually instead of refreshing endlessly.
- **Built-in FAQ**: Quick answers in the popup for multi-account Gmail setups and login issues. Still running into problems? [Open an issue on GitHub](https://github.com/Arnab-iitkgp/erp-auto-login-cli/issues).

<a id="extension-setup-load-unpacked"></a>
### Install (Load Unpacked)

1. Clone or download this repo:
   ```bash
   git clone https://github.com/Arnab-iitkgp/erp-auto-login-cli.git
   ```
2. Open your extensions page (`chrome://extensions`, `brave://extensions`, or `edge://extensions`).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `extension/` folder.
5. Click the extension icon in your toolbar:
   - Enter your Roll Number and ERP Password.
   - Click **Check / Link** to pick your signed-in Gmail account.
   - Enter your 3 security questions (or click **Fetch All 3 Questions**).
   - Click **Save**.

That's it. Next time you visit ERP, it logs in on its own.

<a id="extension-shortcut"></a>
### Extension Shortcut

| OS | Shortcut | Action |
| --- | --- | --- |
| **Windows / Linux** | `Alt + Shift + E` | Open ERP or switch to existing ERP tab |
| **macOS** | `Cmd + Shift + E` | Open ERP or switch to existing ERP tab |

*(You can customize this hotkey anytime at `chrome://extensions/shortcuts`)*

---

<a id="cli-tool"></a>
## CLI Tool

[![npm version](https://img.shields.io/npm/v/kgp-erp-cli.svg?color=cb3837&label=npm)](https://www.npmjs.com/package/kgp-erp-cli)

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

<a id="cli-features"></a>
### CLI Features

- **Fast logins with cached sessions**: Saves your login token so you don't need an OTP every time. Opens ERP in your browser in under a second if your session is still valid.
- **OS Keychain**: Passwords and security answers are encrypted in your system keychain (Windows Credential Manager, macOS Keychain, or Linux Secret Service).
- **IMAP OTP**: Reads the OTP email from Gmail over IMAP using a Gmail App Password.
- **Timetable tools**: Add your course slots, test electives for clashes, find free periods, and print a weekly schedule grid in your terminal.

<a id="cli-installation"></a>
### CLI Installation

#### Prerequisites
- **Node.js** (v18 or higher)
- **Gmail App Password**: For IMAP access. Generate one under Google Account > Security > 2-Step Verification > App passwords.

#### Install Globally
```bash
npm install -g kgp-erp-cli
```
*(Or run directly via `npx kgp-erp-cli`)*

<a id="cli-quick-start"></a>
### CLI Quick Start

1. **Configure credentials**:
   ```bash
   erp setup
   ```
   Follow the interactive prompt to set your Roll Number, Gmail address, ERP Password, Gmail App Password, and security answers.

2. **Log in**:
   ```bash
   erp login
   ```
   - If an active session exists, it skips the OTP and opens your browser immediately.
   - If the session expired, it fetches a fresh OTP over IMAP and logs you in.

3. **Check configuration**:
   ```bash
   erp status            # Shows saved roll number and email
   erp status --reveal   # Displays saved passwords and security answers (requires ERP password)
   ```

4. **Reset credentials**:
   ```bash
   erp reset             # Clears all stored configs and keychain secrets
   ```

<a id="cli-commands"></a>
### CLI Commands

Run `erp` with no arguments to bring up the interactive menu, or use the direct commands below:

| Command | Option | Description |
| --- | --- | --- |
| `erp login` | `--fresh` | Log in to ERP. `--fresh` forces a new OTP login, clearing the cached session. |
| `erp setup` | - | Interactive wizard to configure credentials and security questions. |
| `erp status` | `--reveal` | View configuration details. `--reveal` unmasks passwords after confirmation. |
| `erp reset` | - | Safely delete local configuration files and all keychain secrets. |
| `erp slot` | - | Manage timetable slots, check clashes, and visualize your week (see below). |
| `erp guide` | - | Comprehensive reference of all commands with practical examples. |
| `erp devnote` | - | Project notes, security summary, and feedback link. |

---

<a id="timetable-slots"></a>
## Timetable Slots

Save your enrolled course slots locally to test for clashes before registration, find open periods by credit count, and print your weekly schedule.

| Command | Description |
| --- | --- |
| `erp slot add <slots>` | Add one or more slots (e.g. `erp slot add D3=Algo U2=DSA q`). Prevents clashing entries. |
| `erp slot remove <slots>` | Remove one or more slots from your schedule. |
| `erp slot name <slot> [name]` | Label or rename a slot (e.g. `erp slot name D3 Algorithms`). |
| `erp slot reset` | Clear your entire timetable schedule. |
| `erp slot check <slot>` | Check whether a slot clashes with your existing schedule. |
| `erp slot free [credits\|lab]` | List completely free slots. Pass `2`, `3`, `4`, or `lab` to filter. |
| `erp slot week` | Render your schedule as a clean, color-coded 5×9 weekly grid. |
| `erp slot stats` | Summary of total credits, periods used, busiest days, and free blocks. |

**Quick Examples:**
```bash
erp slot add D3=Algorithms U2=DSA q     # Add 3 slots with course labels
erp slot check H3                        # Check if H3 fits without a clash
erp slot free 3                          # What 3-credit slots are free?
erp slot week                            # Render the 5x9 terminal grid
```

---

<a id="running-on-android-termux--headless-linux"></a>
## Running on Android (Termux) / Headless Linux

The CLI works on headless servers, WSL, and Android via Termux. When an OS keychain daemon is unavailable, it prompts for your consent and falls back to a user-restricted local file at `~/.config/erp-cli/secrets.json`.

**On Android via Termux:**
1. Install Termux from F-Droid (avoid the outdated Play Store version).
2. Install dependencies:
   ```bash
   pkg update && pkg install nodejs git
   ```
3. Install the CLI:
   ```bash
   npm install -g kgp-erp-cli
   ```
4. Run `erp setup` and accept the file-storage fallback prompt.
5. Run `erp login` — on Termux, it prints the authenticated SSO URL directly so you can paste it into Chrome.

---

<a id="how-session-caching-works"></a>
## How Session Caching Works

1. **Authentication**: After submitting your password and OTP, the server responds with a session token (`ssoToken`).
2. **Storage**: The CLI saves this token in `~/.config/erp-cli/session.json` along with its timestamp.
3. **Probe Verification**: Before requesting a new OTP, the CLI sends a lightweight probe request to ERP using `redirect: "manual"`:
   - If the server accepts the token, your browser opens immediately (**under 1 second**).
   - If the server redirects to `logout.htm`, the token is expired and the CLI triggers a fresh login.

---

<a id="security--privacy"></a>
## Security & Privacy

- **100% Local**: All credentials, tokens, and question answers stay on your machine. Nothing is sent to any third-party server or analytics service.
- **Keychain Protected**: The CLI stores secrets in your OS's native credential vault (`@napi-rs/keyring`). The extension keeps data in Chrome's isolated storage sandbox (`chrome.storage.local`).
- **Direct Communication**: Both tools talk only to `erp.iitkgp.ac.in` and `mail.google.com` / `imap.gmail.com`.
- **Open Source**: Every line of code is open for review. Inspect the repository anytime.

---

## License

Distributed under the [MIT License](./LICENSE). Built by students, for students.
