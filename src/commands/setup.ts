import prompts from "prompts";

import { FileStorageService } from "../services/storage/file-storage.js";
import { KeychainService } from "../services/storage/keychain.js";

import { SECRET_KEYS } from "../services/storage/secrets.js";


export const setupCommand = async function(){
    const fileStorage = new FileStorageService();

    const keychain = new KeychainService();

    const available = await keychain.isAvailable();
    if (!available) {
      console.log("Secure credential storage unavailable on this system.");

      //TODO: linux fallback later
      return;          
    }

    // collecting inputs
    const response = await prompts([
  {
    type: "text",
    name: "erpRoll",
    message: "ERP Roll:",
  },

  {
    type: "password",
    name: "erpPassword",
    message: "ERP password:",
  },

  {
    type: "text",
    name: "gmailEmail",
    message: "Gmail email:",
  },

  {
    type: "password",
    name: "gmailAppPassword",
    message: "Gmail app password:",
  },
]);

const securityQuestions = [];

for(let i=1;i<=3;i++){
    const qa = await prompts([
  {
    type: "text",
    name: "question",
    message: `Security question ${i}:`,
  },

  {
    type: "password",
    name: "answer",
    message: `Answer ${i}:`,
  },
]);
    const id = `q${i}`;
    securityQuestions.push({
    id,
    question: qa.question,
    });
    await keychain.setSecret(
  `${SECRET_KEYS.SECURITY_ANSWER_PREFIX}-${id}`,
  qa.answer
    );

}

await fileStorage.saveConfig({
  erpRoll: response.erpRoll,

  gmailEmail: response.gmailEmail,

  erpUrl: "https://erp.iitkgp.ac.in",

  securityQuestions,
});

await keychain.setSecret(
  SECRET_KEYS.ERP_PASSWORD,
  response.erpPassword
);

await keychain.setSecret(
  SECRET_KEYS.GMAIL_APP_PASSWORD,
  response.gmailAppPassword
);
console.log("Setup complete.");
}