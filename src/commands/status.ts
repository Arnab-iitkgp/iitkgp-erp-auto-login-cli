import prompts from "prompts";
import { FileStorageService } from "../services/storage/file-storage.js";
import { KeychainService } from "../services/storage/keychain.js";
import { SECRET_KEYS } from "../services/storage/secrets.js";

export const statusCommand = async function (options: { reveal?: boolean }) {
  const fileStorage = new FileStorageService();
  const keychain = new KeychainService();

  const hasConfig = await fileStorage.hasConfig();
  if (!hasConfig) {
    console.log("Not configured. Run `erp setup` first.");
    return;
  }

  try {
    const config = await fileStorage.loadConfig();

    console.log("\n  ERP CLI Status");
    console.log("  ──────────────────────────");
    console.log(`  Roll Number:    ${config.erpRoll}`);
    console.log(`  ERP URL:        ${config.erpUrl}`);
    console.log(`  Gmail:          ${config.gmailEmail}`);

    const hasErpPass = !!(await keychain.getSecret(SECRET_KEYS.ERP_PASSWORD));
    const gmailAppPassSecret = await keychain.getSecret(SECRET_KEYS.GMAIL_APP_PASSWORD);
    const hasGmailPass = !!gmailAppPassSecret;

    let revealAnswers = false;
    
    if (options.reveal && hasErpPass) {
      const storedErpPass = await keychain.getSecret(SECRET_KEYS.ERP_PASSWORD);
      
      const { password } = await prompts({
        type: "password",
        name: "password",
        message: "Enter your ERP Password to reveal secrets",
      });
      
      if (password === storedErpPass) {
        revealAnswers = true;
        console.log("  (Authentication successful. Revealing secrets...)\n");
      } else {
        console.log("  (Authentication failed. Access denied.)\n");
      }
    } else if (options.reveal) {
      console.log("  (Cannot reveal: ERP password not set up.)\n");
    }

    console.log(`  ERP Password:   ${hasErpPass ? "✓ saved" : "✗ missing"}`);
    if (revealAnswers && hasGmailPass) {
      console.log(`  Gmail App Pass: → "${gmailAppPassSecret}"`);
    } else {
      console.log(`  Gmail App Pass: ${hasGmailPass ? "✓ saved" : "✗ missing"}`);
    }

    // Check security questions
    const questions = Object.keys(config.securityQuestions);
    console.log(`\n  Security Questions: ${questions.length}`);

    for (const q of questions) {
      const keychainKey = config.securityQuestions[q]!;
      const answer = await keychain.getSecret(keychainKey);
      const hasAnswer = !!answer;
      
      if (revealAnswers && hasAnswer) {
        console.log(`    • ${q} → "${answer}"`);
      } else {
        console.log(`    • ${q} ${hasAnswer ? "✓" : "✗ answer missing, please do erp setup"}`);
      }
    }

    console.log();
  } catch (error: any) {
    console.error("Config is corrupted:", error.message);
    console.log("Run `erp reset` then `erp setup` to fix.");
  }
};
