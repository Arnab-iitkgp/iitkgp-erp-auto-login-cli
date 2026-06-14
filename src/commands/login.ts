import pc from "picocolors";
import ora from "ora";
import { ErpClient } from "../services/erp/erp-client.js";
import { ImapOtpReader } from "../services/imap/otp-reader.js";
import { FileStorageService } from "../services/storage/file-storage.js";
import { KeychainService } from "../services/storage/keychain.js";
import { SECRET_KEYS } from "../services/storage/secrets.js";

export const loginCommand = async function () {
  const fileStorage = new FileStorageService();
  const keychain = new KeychainService();

  const startTime = Date.now();
  const spinner = ora("Loading config...").start();

  const hasConfig = await fileStorage.hasConfig();
  if (!hasConfig) {
    spinner.fail(pc.red("No config found. Run `erp setup` first."));
    process.exit(1);
  }

  const config = await fileStorage.loadConfig();

  // Load secrets from keychain
  const erpPassword = await keychain.getSecret(SECRET_KEYS.ERP_PASSWORD);
  const gmailAppPassword = await keychain.getSecret(
    SECRET_KEYS.GMAIL_APP_PASSWORD
  );

  if (!erpPassword || !gmailAppPassword) {
    spinner.fail(pc.red("Missing credentials in keychain. Run `erp setup` again."));
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
    spinner.fail(pc.red("No security answers found. Run `erp setup` again."));
    process.exit(1);
  }
  spinner.succeed();

  //ERP login flow
  const erp = new ErpClient(config.erpUrl);
  const reader = new ImapOtpReader(config.gmailEmail, gmailAppPassword);

  try {
    spinner.start(pc.cyan("[1/5]") + " Initiating ERP session...");
    const { sessionToken } = await erp.initiateSession();
    spinner.succeed();

    spinner.start(pc.cyan("[2/5]") + " Fetching security question...");
    const question = await erp.getSecurityQuestion(config.erpRoll);

    const answer = answers[question.toLowerCase().trim()];
    if (!answer) {
      spinner.fail(pc.red(`Unknown security question: "${question}"`));
      console.log(pc.dim("Run `erp setup` to add this question."));
      process.exit(1);
    }
    spinner.succeed();

    spinner.start(pc.cyan("[3/5]") + " Connecting to Gmail...");
    await reader.connect();
    const beforeUid = await reader.snapshotLatestUid();
    spinner.succeed();

    spinner.start(pc.cyan("[4/5]") + " Requesting OTP...");
    await erp.requestOtp(config.erpRoll, erpPassword, answer);
    spinner.succeed();

    spinner.start(pc.cyan("[4/5]") + " Waiting for OTP email...");
    const otp = await reader.waitForOtp(beforeUid);
    await reader.disconnect();
    spinner.succeed();

    spinner.start(pc.cyan("[5/5]") + " Authenticating...");
    const ssoToken = await erp.authenticate(
      config.erpRoll,
      erpPassword,
      answer,
      otp
    );
    spinner.succeed();

    const loginUrl = `${config.erpUrl}/IIT_ERP3/home.htm?ssoToken=${ssoToken}`;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${pc.green("✓")} ${pc.bold("Login successful!")} ${pc.dim(`(${duration}s)`)}`);
    
    console.log(pc.dim("Opening browser..."));

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
        console.log(pc.yellow("Could not open browser. Open this URL manually:"));
        console.log(loginUrl);
      }
    });
  } catch (error: any) {
    spinner.fail(pc.red("Login failed"));
    
    // Better error recovery hints
    if (error.message.includes("Timed out waiting for OTP email")) {
      console.log(`\n${pc.red("✗ OTP not received within 30s")}`);
      console.log(`\nPossible causes:`);
      console.log(`  • ${pc.bold("Wrong security answer")} → run \`erp status --reveal\` to check for typos`);
      console.log(`  • ${pc.bold("Gmail delay")} → try again in a minute`);
      console.log(`  • ${pc.bold("ERP rate limiting")} → check erp.iitkgp.ac.in manually to see if OTPs are still sending`);
    } else {
      console.error(pc.red(`\nError details: ${error.message}`));
    }
    process.exit(1);
  } finally {
    await reader.disconnect();
  }
};