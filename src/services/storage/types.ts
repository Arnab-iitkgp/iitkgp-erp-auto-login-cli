import type { AppConfig } from "../../config/schema";

export interface StorageService {
  hasConfig(): Promise<boolean>;

  loadConfig(): Promise<AppConfig>;

  saveConfig(config: AppConfig): Promise<void>;

  getSecret(key: SecretKey): Promise<string | null>;

  setSecret(key: SecretKey, value: string): Promise<void>;

  clearAll(): Promise<void>;
  
}