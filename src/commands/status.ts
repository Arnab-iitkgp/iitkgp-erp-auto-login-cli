import { FileStorageService } from "../services/storage/file-storage.js";
import { KeychainService } from "../services/storage/keychain.js";
import { SECRET_KEYS } from "../services/storage/secrets.js";

export const statusCommand = async function () {
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

    // Check secrets availability (without revealing them)
    const hasErpPass = !!(await keychain.getSecret(SECRET_KEYS.ERP_PASSWORD));
    const hasGmailPass = !!(await keychain.getSecret(SECRET_KEYS.GMAIL_APP_PASSWORD));

    console.log(`  ERP Password:   ${hasErpPass ? "✓ saved" : "✗ missing"}`);
    console.log(`  Gmail App Pass: ${hasGmailPass ? "✓ saved" : "✗ missing"}`);

    // Check security questions
    const questions = Object.keys(config.securityQuestions);
    console.log(`\n  Security Questions: ${questions.length}`);
    for (const q of questions) {
      const keychainKey = config.securityQuestions[q]!;
      const hasAnswer = !!(await keychain.getSecret(keychainKey));
      console.log(`    • ${q} ${hasAnswer ? "✓" : "✗ answer missing"}`);
    }

    console.log();
  } catch (error: any) {
    console.error("Config is corrupted:", error.message);
    console.log("Run `erp reset` then `erp setup` to fix.");
  }
};
