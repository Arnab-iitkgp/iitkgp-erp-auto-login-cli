import fs from "fs/promises";
import path from "path";
import writeFileAtomic from "write-file-atomic";
import { paths } from "../../config/paths.js";
import { ensureDir } from "../../utils/fs.js";
import type { SessionData, SessionStorageService } from "./types.js";

export class FileSessionStorage implements SessionStorageService {
  private sessionPath: string;

  constructor() {
    this.sessionPath = path.join(paths.config, "session.json");
  }

  async saveSession(data: SessionData): Promise<void> {
    await ensureDir(paths.config);
    const json = JSON.stringify(data, null, 2);
    await writeFileAtomic(this.sessionPath, json);
  }

  async loadSession(): Promise<SessionData | null> {
    try {
      const raw = await fs.readFile(this.sessionPath, "utf-8");
      const parsed = JSON.parse(raw) as SessionData;

      if (!parsed.ssoToken || !parsed.erpUrl) {
        return null;
      }

      return parsed;
    } catch {
      // File missing or corrupted — treat as no session
      return null;
    }
  }

  async clearSession(): Promise<void> {
    await fs.rm(this.sessionPath, { force: true });
  }
}
