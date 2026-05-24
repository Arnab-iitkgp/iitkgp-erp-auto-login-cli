import type { AppConfig } from "../../config/schema";

export interface ConfigStorageService {
  hasConfig(): Promise<boolean>;

  loadConfig(): Promise<AppConfig>;

  saveConfig(config: AppConfig): Promise<void>;

  clearConfig(): Promise<void>;
}

export interface SecretStorageService {
  getSecret(key: string): Promise<string | null>;

  setSecret(
    key: string,
    value: string
  ): Promise<void>;

  deleteSecret(key: string): Promise<void>;

  isAvailable(): Promise<boolean>;
}