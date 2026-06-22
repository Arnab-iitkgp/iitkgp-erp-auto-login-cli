import { Entry } from "@napi-rs/keyring";
import fs from "fs/promises";
import path from "path";
import { paths } from "../../config/paths.js";
import { ensureDir } from "../../utils/fs.js";
import type { SecretStorageService } from "./types.js";

const SERVICE_NAME = "erp-cli";
export const FALLBACK_FILE = path.join(paths.config, "secrets.json");

// Set ERP_FORCE_FILE_STORAGE=1 to bypass the native keychain entirely.
// Useful for testing the fallback path on a machine that has a working keychain.
const forceFile = (): boolean =>
  process.env.ERP_FORCE_FILE_STORAGE === "1" ||
  process.env.ERP_FORCE_FILE_STORAGE === "true";

export class KeychainService implements SecretStorageService {
  private async getFallbackSecrets(): Promise<Record<string, string>> {
    try {
      const data = await fs.readFile(FALLBACK_FILE, "utf-8");
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async saveFallbackSecrets(secrets: Record<string, string>): Promise<void> {
    await ensureDir(paths.config);
    // mode 0o600 — owner read/write only. Best-effort on Windows (ACL inherits).
    await fs.writeFile(FALLBACK_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  }

  async setSecret(key: string, value: string): Promise<void> {
    if (!forceFile()) {
      try {
        const entry = new Entry(SERVICE_NAME, key);
        entry.setPassword(value);
        return;
      } catch {
        // fall through to file
      }
    }
    const secrets = await this.getFallbackSecrets();
    secrets[key] = value;
    await this.saveFallbackSecrets(secrets);
  }

  async getSecret(key: string): Promise<string | null> {
    if (!forceFile()) {
      try {
        const entry = new Entry(SERVICE_NAME, key);
        const val = entry.getPassword();
        if (val) return val;
      } catch {
        // fall through to file
      }
    }
    const secrets = await this.getFallbackSecrets();
    return secrets[key] || null;
  }

  async deleteSecret(key: string): Promise<void> {
    if (!forceFile()) {
      try {
        const entry = new Entry(SERVICE_NAME, key);
        entry.deletePassword();
      } catch {
        // fall through to file
      }
    }
    const secrets = await this.getFallbackSecrets();
    if (secrets[key]) {
      delete secrets[key];
      await this.saveFallbackSecrets(secrets);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (forceFile()) return false;
    try {
      const entry = new Entry(SERVICE_NAME, "__erp_cli_probe__");
      entry.setPassword("probe");
      try { entry.deletePassword(); } catch { /* leftover probe is harmless */ }
      return true;
    } catch {
      return false;
    }
  }

  // True when subsequent calls will hit the JSON file instead of the OS keychain.
  async usesFallback(): Promise<boolean> {
    return !(await this.isAvailable());
  }
}