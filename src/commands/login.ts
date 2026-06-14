import { ErpClient } from "../services/erp/erp-client.js";
import { ImapOtpReader } from "../services/imap/otp-reader.js";
import { FileStorageService } from "../services/storage/file-storage.js";
import { KeychainService } from "../services/storage/keychain.js";
import { SECRET_KEYS } from "../services/storage/secrets.js";

export const loginCommand = async function () {
  const fileStorage = new FileStorageService();
  const keychain = new KeychainService();

  //Load saved config
  console.log("Loading config...");

  const hasConfig = await fileStorage.hasConfig();
  if (!hasConfig) {
    console.error("No config found. Run `erp setup` first.");
    process.exit(1);
  }

  const config = await fileStorage.loadConfig();

  // Load secrets from keychain
  const erpPassword = await keychain.getSecret(SECRET_KEYS.ERP_PASSWORD);
  const gmailAppPassword = await keychain.getSecret(
    SECRET_KEYS.GMAIL_APP_PASSWORD
  );

  if (!erpPassword || !gmailAppPassword) {
    console.error("Missing credentials in keychain. Run `erp setup` again.");
    process.exit(1);
  }

  // answers map
  const answers: Record<string, string> = {};
  for (const [question, keychainKey] of Object.entries(
    config.securityQuestions
  )) {
    const answer = await keychain.getSecret(keychainKey);
    if (answer) {
      answers[question] = answer;
    }
  }

  if (Object.keys(answers).length === 0) {
    console.error("No security answers found. Run `erp setup` again.");
    process.exit(1);
  }

  //ERP login flow
  const erp = new ErpClient(config.erpUrl);
  const reader = new ImapOtpReader(config.gmailEmail, gmailAppPassword);

  try {
    console.log("Initiating ERP session...");
    const { sessionToken } = await erp.initiateSession();

    console.log("Fetching security question...");
    const question = await erp.getSecurityQuestion(config.erpRoll);

    const answer = answers[question.toLowerCase().trim()];
    if (!answer) {
      console.error(
        `Unknown security question: "${question}"`,
        "\nRun `erp setup` to add this question."
      );
      process.exit(1);
    }

    console.log("Connecting to Gmail...");
    await reader.connect();

    const beforeUid = await reader.snapshotLatestUid();

    console.log("Requesting OTP...");
    await erp.requestOtp(config.erpRoll, erpPassword, answer);

    console.log("Waiting for OTP email...");
    const otp = await reader.waitForOtp(beforeUid);
    console.log(`OTP received: ${otp}`);

    await reader.disconnect();

    console.log("Authenticating...");
    const ssoToken = await erp.authenticate(
      config.erpRoll,
      erpPassword,
      answer,
      otp
    );

    const loginUrl = `${config.erpUrl}/IIT_ERP3/home.htm?ssoToken=${ssoToken}`;

    console.log("\n✓ Login successful!");
    console.log("\nOpening browser...");

    // Open browser (cross-platform)
    const { exec } = await import("child_process");
    const openCmd =
      process.platform === "win32"
        ? `start "" "${loginUrl}"`
        : process.platform === "darwin"
          ? `open "${loginUrl}"`
          : `xdg-open "${loginUrl}"`;

    exec(openCmd, (err) => {
      if (err) {
        console.log("Could not open browser. Open this URL manually:");
        console.log(loginUrl);
      }
    });
  } catch (error: any) {
    console.error("\nLogin failed:", error.message);
    process.exit(1);
  } finally {
    await reader.disconnect();
  }
};