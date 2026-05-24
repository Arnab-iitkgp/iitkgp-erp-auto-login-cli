import type { AppConfig } from "../../config/schema";   
import fs from "fs/promises";
import path from "path";
import writeFileAtomic from 'write-file-atomic';
import {ZodError} from 'zod'
import { paths } from "../../config/paths.js";
import {AppConfigSchema} from "../../config/schema.js";

import { ensureDir } from "../../utils/fs.js";
import { ConfigNotFoundError, InvalidConfigError } from "../../errors/config.js";
import type { ConfigStorageService } from "./types";

export class FileStorageService implements ConfigStorageService {
    private configPath: string;

    constructor() {
    this.configPath = path.join(paths.config, "config.json");
  }

  async saveConfig(config: AppConfig):Promise<void> {
    await ensureDir(paths.config);
   const json = JSON.stringify(config, null, 2);
   await writeFileAtomic(this.configPath, json);
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      const raw = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      return AppConfigSchema.parse(parsed);

    } catch (error) {
      
      if((error as NodeJS.ErrnoException).code === "ENOENT"){ // file missing 
        throw new ConfigNotFoundError();
      }
      if(error instanceof ZodError){
        throw new InvalidConfigError(error.message);
      }

      if (error instanceof SyntaxError) {
      throw new InvalidConfigError("Config file contains invalid JSON.");
    }
      throw error;  // rethrow unexpected errors

    }
  

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