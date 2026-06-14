import prompts from "prompts";

import { FileStorageService } from "../services/storage/file-storage.js";
import { KeychainService } from "../services/storage/keychain.js";
import { SECRET_KEYS } from "../services/storage/secrets.js";

export const resetCommand = async function () {
  const fileStorage = new FileStorageService();
  const keychain = new KeychainService();

  const hasConfig = await fileStorage.hasConfig();
  if (!hasConfig) {
    console.log("No config found. Nothing to reset.");
    return;
  }

  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: "This will delete ALL saved credentials. Are you sure?",
    initial: false,
  });

  if (!confirm) {
    console.log("Reset cancelled.");
    return;
  }

  // Load config to find all security answer keychain keys
  try {
    const config = await fileStorage.loadConfig();

    // Delete all security answer secrets
    for (const keychainKey of Object.values(config.securityQuestions)) {
      try {
        await keychain.deleteSecret(keychainKey);
      } catch {
        //safe to ignore
      }
    }
  } catch {
    
  }

  // Delete pswd secrets
  try { await keychain.deleteSecret(SECRET_KEYS.ERP_PASSWORD); } catch {}
  try { await keychain.deleteSecret(SECRET_KEYS.GMAIL_APP_PASSWORD); } catch {}

  // Delete config file
  await fileStorage.clearConfig();

  console.log("All credentials and config have been removed.");
};
