import type { AppConfig } from "../../config/schema";   
import fs from "fs/promises";
import path from "path";
import writeFileAtomic from 'write-file-atomic';

import { paths } from "../../config/paths.js";
import {
  AppConfigSchema,
} from "../../config/schema.js";

import { ensureDir } from "../../utils/fs.js";

export class FileStorageService {
    private configPath: string;

    constructor() {
    this.configPath = path.join(paths.config, "config.json");
  }

  async saveConfig(config: AppConfig) {
    await ensureDir(paths.config);
   const json = JSON.stringify(config, null, 2);
  await writeFileAtomic(this.configPath, json);
  }

  async loadConfig(): Promise<AppConfig> {
  const raw = await fs.readFile(this.configPath, "utf-8");
  const parsed = JSON.parse(raw);
  return AppConfigSchema.parse(parsed);
}

  async hasConfig(): Promise<boolean> {
    try {
        await fs.access(this.configPath);
        return true;
    } catch (error) {
        return false;
    }
  }
  async clearConfig(): Promise<void> {
  await fs.rm(this.configPath, { force: true });
}
}