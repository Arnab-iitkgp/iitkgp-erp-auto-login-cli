import { FileStorageService } from "./services/storage/file-storage.js";

const storage = new FileStorageService();

await storage.saveConfig({
  erpRoll: "23CHXXXXX",
  erpUrl: "https://erp.iitkgp.ac.in",
  securityQuestions: [
    {
      id: "pet",
      question: "Pet name?",
    },
  ],
});

const config = await storage.loadConfig();

console.log(config);