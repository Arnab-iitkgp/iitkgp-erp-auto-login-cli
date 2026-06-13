import { KeychainService } from "../src/services/storage/keychain.js";

const keychain = new KeychainService();

const available = await keychain.isAvailable();

console.log("Available:", available);

if (!available) {
  process.exit(1);
}

await keychain.setSecret(
  "test-key",
  "hello-world"
);

const secret = await keychain.getSecret(
  "test-key"
);

console.log("Retrieved:", secret);

await keychain.deleteSecret(
  "test-key"
);

console.log("Deleted.");