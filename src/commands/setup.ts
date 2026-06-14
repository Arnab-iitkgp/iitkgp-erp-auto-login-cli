import prompts from "prompts";

import { ErpClient } from "../services/erp/erp-client.js";
import { ImapOtpReader } from "../services/imap/otp-reader.js";
import { FileStorageService } from "../services/storage/file-storage.js";
import { KeychainService } from "../services/storage/keychain.js";
import { SECRET_KEYS } from "../services/storage/secrets.js";

// If user presses Ctrl+C during any prompt, exit cleanly
// Without this, prompts() returns {} and we'd store undefined values
function onCancel() {
  console.log("\nSetup cancelled.");
  process.exit(0);
}

export const setupCommand = async function () {
  const fileStorage = new FileStorageService();
  const keychain = new KeychainService();

  // --- Check keychain availability ---
  const available = await keychain.isAvailable();
  if (!available) {
    console.log("Secure credential storage unavailable on this system.");
    //TODO: linux fallback later
    return;
  }

  // --- Check for existing config ---
  const hasExisting = await fileStorage.hasConfig();
  if (hasExisting) {
    const { overwrite } = await prompts(
      {
        type: "confirm",
        name: "overwrite",
        message: "Existing config found. Overwrite?",
        initial: false,
      },
      { onCancel }
    );

    if (!overwrite) {
      console.log("Setup cancelled. Existing config kept.");
      return;
    }
  }

  // Collect credentials
  const rollRes = await prompts(
    {
      type: "text",
      name: "erpRoll",
      message: "ERP Roll Number:",
      validate: (v: string) =>
        v.trim().length > 0 ? true : "Roll number cannot be empty",
    },
    { onCancel }
  );
  
  const erpRoll = rollRes.erpRoll.trim();

  //fetch seq questiona
  console.log(`\nFetching your security questions from ERP...`);
  const erpClient = new ErpClient("https://erp.iitkgp.ac.in");
  const fetchedQuestions = await erpClient.fetchAllSecurityQuestions(erpRoll);
  
  if (fetchedQuestions.length === 0) {
    console.error("could not fetch security questions. Is the roll number correct?");
    process.exit(1);
  }

  console.log(`Found ${fetchedQuestions.length} questions!\n`);

  // ERP password
  const { erpPassword } = await prompts(
    {
      type: "password",
      name: "erpPassword",
      message: "ERP Password:",
      validate: (v: string) =>
        v.length > 0 ? true : "Password cannot be empty",
    },
    { onCancel }
  );

  // Security question answers
  const securityQuestions: Record<string, string> = {};
  
  console.log("\nPlease provide answers to your security questions:");
  
  for (let i = 0; i < fetchedQuestions.length; i++) {
    const q = fetchedQuestions[i] as string;
    const qa = await prompts(
      {
        type: "password",
        name: "answer",
        message: `Q: ${q}\nAnswer:`,
        validate: (v: string) =>
          v.trim().length > 0 ? true : "Answer cannot be empty",
      },
      { onCancel }
    );

    const keychainKey = `${SECRET_KEYS.SECURITY_ANSWER_PREFIX}-${i}`;
    const normalizedQuestion = q.toLowerCase().trim();
    
    securityQuestions[normalizedQuestion] = keychainKey;
    await keychain.setSecret(keychainKey, qa.answer);
  }

  // Gmail setup with guidance
  console.log("\n──────────────────────────────────────────────");
  console.log("  Gmail Setup (for auto-reading OTP emails)");
  console.log("──────────────────────────────────────────────");
  console.log("\n  We need a Gmail App Password to read your OTP emails.");
  console.log("  This is NOT your regular Gmail password.\n");
  console.log("  How to get one:");
  console.log("  1. Go to https://myaccount.google.com/apppasswords");
  console.log("  2. Select 'Other' → name it 'erp-cli'");
  console.log("  3. Copy the 16-character password\n");
  console.log("  Your App Password is stored securely in your OS keychain");
  console.log("  (Windows Credential Manager / macOS Keychain).");
  console.log("  It never leaves your machine.\n");

  const gmailResponse = await prompts(
    [
      {
        type: "text",
        name: "gmailEmail",
        message: "Gmail email (registered with ERP):",
        validate: (v: string) => {
          if (v.trim().length === 0) return "Email cannot be empty";
          if (!v.includes("@")) return "Enter a valid email address";
          return true;
        },
      },
      {
        type: "password",
        name: "gmailAppPassword",
        message: "Gmail App Password (16 chars):",
        validate: (v: string) =>
          v.length > 0 ? true : "App password cannot be empty",
      },
    ],
    { onCancel }
  );

  // Verify Gmail credentials before saving
  console.log("\n  Verifying Gmail connection...");
  const testReader = new ImapOtpReader(
    gmailResponse.gmailEmail.trim(),
    gmailResponse.gmailAppPassword
  );

  try {
    await testReader.connect();
    await testReader.disconnect();
    console.log("  Gmail connection verified!\n");
  } catch {
    console.error("  Failed to connect to Gmail.");
    console.error("  Check your email and app password and try again.");
    process.exit(1);
  }

  // Save config
  await fileStorage.saveConfig({
    erpRoll,
    gmailEmail: gmailResponse.gmailEmail.trim(),
    erpUrl: "https://erp.iitkgp.ac.in",
    securityQuestions,
  });

  //Save secrets to keychain
  await keychain.setSecret(SECRET_KEYS.ERP_PASSWORD, erpPassword);
  await keychain.setSecret(
    SECRET_KEYS.GMAIL_APP_PASSWORD,
    gmailResponse.gmailAppPassword
  );

  console.log(
    `Setup complete! ${fetchedQuestions.length} security question(s) saved.`
  );
  console.log("Run `erp login` to auto-login to ERP.");
};