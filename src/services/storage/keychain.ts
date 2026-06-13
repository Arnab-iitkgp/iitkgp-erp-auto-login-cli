import { Entry } from "@napi-rs/keyring";
import type { SecretStorageService } from "./types.js";

const SERVICE_NAME = "erp-cli";

export class KeychainService implements SecretStorageService {

  async setSecret(
    key: string,
    value: string
  ): Promise<void> {

    const entry = new Entry(
      SERVICE_NAME,
      key
    );

    entry.setPassword(value);
  }

  async getSecret(
    key: string
  ): Promise<string | null> {

    const entry = new Entry(
      SERVICE_NAME,
      key
    );

    return entry.getPassword();
  }

  async deleteSecret(
    key: string
  ): Promise<void> {

    const entry = new Entry(
      SERVICE_NAME,
      key
    );

    entry.deletePassword();
  }

  // // checking, mainly for linux if keychain is functioning or not
    //TODO: if not avl -- alternative way
  async isAvailable(): Promise<boolean> {
    try {

      const entry = new Entry(
        SERVICE_NAME,
        "__test__"
      );

      entry.setPassword("test");
      entry.deletePassword();

      return true;

    } catch {
      return false;
    }
  }
}