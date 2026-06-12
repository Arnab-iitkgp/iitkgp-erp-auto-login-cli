import prompts from "prompts";

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

  // --- Collect credentials ---
  // validate: returns true if valid, or an error message string if invalid
  const response = await prompts(
    [
      {
        type: "text",
        name: "erpRoll",
        message: "ERP Roll Number:",
        validate: (v: string) =>
          v.trim().length > 0 ? true : "Roll number cannot be empty",
      },
      {
        type: "password",
        name: "erpPassword",
        message: "ERP Password:",
        validate: (v: string) =>
          v.length > 0 ? true : "Password cannot be empty",
      },
      {
        type: "text",
        name: "gmailEmail",
        message: "Gmail email:",
        validate: (v: string) => {
          if (v.trim().length === 0) return "Email cannot be empty";
          // Basic email format check — Zod will do strict validation on load
          if (!v.includes("@")) return "Enter a valid email address";
          return true;
        },
      },
      {
        type: "password",
        name: "gmailAppPassword",
        message: "Gmail App Password:",
        validate: (v: string) =>
          v.length > 0 ? true : "App password cannot be empty",
      },
    ],
    { onCancel }
  );

  // --- Collect security questions ---
  // Dynamic count — loop until user says "no more"
  const securityQuestions: Record<string, string> = {};
  let questionIndex = 0;

  console.log("\nEnter your ERP security questions and answers.");
  console.log("Type the question EXACTLY as it appears on ERP.\n");

  while (true) {
    const qa = await prompts(
      [
        {
          type: "text",
          name: "question",
          message: `Security question ${questionIndex + 1}:`,
          validate: (v: string) =>
            v.trim().length > 0 ? true : "Question cannot be empty",
        },
        {
          type: "password",
          name: "answer",
          message: `Answer:`,
          validate: (v: string) =>
            v.trim().length > 0 ? true : "Answer cannot be empty",
        },
      ],
      { onCancel }
    );

    // Store: question text → keychain key in config
    // Store: actual answer → in keychain under that key
    const keychainKey = `${SECRET_KEYS.SECURITY_ANSWER_PREFIX}-${questionIndex}`;
    const normalizedQuestion = qa.question.trim().toLowerCase();
    securityQuestions[normalizedQuestion] = keychainKey;
    await keychain.setSecret(keychainKey, qa.answer);

    questionIndex++;

    const { addMore } = await prompts(
      {
        type: "confirm",
        name: "addMore",
        message: "Add another security question?",
        initial: questionIndex < 3, // Default "yes" for first 3
      },
      { onCancel }
    );

    if (!addMore) break;
  }

  // --- Save config (non-secret data) ---
  await fileStorage.saveConfig({
    erpRoll: response.erpRoll.trim(),
    gmailEmail: response.gmailEmail.trim(),
    erpUrl: "https://erp.iitkgp.ac.in",
    securityQuestions,
  });

  // --- Save secrets to keychain ---
  await keychain.setSecret(SECRET_KEYS.ERP_PASSWORD, response.erpPassword);
  await keychain.setSecret(
    SECRET_KEYS.GMAIL_APP_PASSWORD,
    response.gmailAppPassword
  );

  console.log(
    `\n✓ Setup complete. ${questionIndex} security question(s) saved.`
  );
};