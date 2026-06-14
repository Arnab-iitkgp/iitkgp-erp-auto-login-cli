import type { AppConfig } from "../../config/schema.js";

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

// Session data saved after a successful login
export interface SessionData {
  ssoToken: string;
  erpUrl: string;
  createdAt: number; // Unix timestamp (ms) — for display only, not validation
}

export interface SessionStorageService {
  saveSession(data: SessionData): Promise<void>;
  loadSession(): Promise<SessionData | null>;
  clearSession(): Promise<void>;
}