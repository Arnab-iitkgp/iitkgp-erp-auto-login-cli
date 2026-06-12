import { FileStorageService } from "../src/services/storage/file-storage.js";

import {
  ConfigNotFoundError,
  InvalidConfigError,
} from "../src/errors/config.js";

const storage = new FileStorageService();

try {
  const config = await storage.loadConfig();

  console.log("Loaded config:");
  console.log(config);

} catch (error) {

  if (error instanceof ConfigNotFoundError) {
    console.log("No config found.");
  }

  else if (error instanceof InvalidConfigError) {
    console.log("Invalid config:");
    console.log(error.message);
  }

  else {
    console.log("Unexpected error:");
    console.log(error);
  }
}