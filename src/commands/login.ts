import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import { ErpClient } from "../services/erp/erp-client.js";
import { ImapOtpReader } from "../services/imap/otp-reader.js";
import { FileStorageService } from "../services/storage/file-storage.js";
import { FileSessionStorage } from "../services/storage/session-storage.js";
import { KeychainService } from "../services/storage/keychain.js";
import { SECRET_KEYS } from "../services/storage/secrets.js";
import { openBrowser } from "../utils/browser.js";

export const loginAction = async function (options: { fresh?: boolean; debug?: boolean } = {}) {
  const fileStorage = new FileStorageService();
  const sessionStorage = new FileSessionStorage();
  const keychain = new KeychainService();

  // Flip debug on before any service call so the runtime dbg() checks pick it up.
  if (options.debug) {
    process.env.ERP_DEBUG = "1";
    console.log(pc.dim("  --debug: verbose request/response logging enabled"));
  }

  if (options.fresh) {
    console.log(pc.dim("  --fresh: cached session will be ignored"));
  }

  const startTime = Date.now();
  const spinner = ora("Loading config...").start();

  const hasConfig = await fileStorage.hasConfig();
  if (!hasConfig) {
    spinner.fail(pc.red("No config found. Run `erp setup` first."));
    process.exit(1);
  }

  const config = await fileStorage.loadConfig();
  spinner.succeed();

  if (await keychain.usesFallback()) {
    console.log(pc.dim("  (using fallback file storage — keychain unavailable)"));
  }

  // Skip cache if --fresh flag is passed
  if (!options.fresh) {
    const cached = await sessionStorage.loadSession();

    if (cached && cached.erpUrl === config.erpUrl) {
      spinner.text = pc.cyan("Verifying cached session...");

      const isAlive = await ErpClient.sessionAlive(cached.erpUrl, cached.ssoToken);

      if (isAlive) {
        const loginUrl = `${cached.erpUrl}/IIT_ERP3/home.htm?ssoToken=${cached.ssoToken}`;
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        spinner.succeed(pc.green(`Session alive — skipping OTP! ${pc.dim(`(${duration}s)`)}`));
        console.log(pc.dim("  Opening browser..."));
        await openBrowser(loginUrl);
        return;
      }

      // Token is dead — clear and do fresh login
      spinner.warn(pc.yellow("Cached session expired"));
      await sessionStorage.clearSession();
    }
  } else {
    await sessionStorage.clearSession();
  }

  // Full login flow wit otp
 
  const spinner2 = ora("Loading credentials...").start();

  // Load secrets from keychain
  const erpPassword = await keychain.getSecret(SECRET_KEYS.ERP_PASSWORD);
  const gmailAppPassword = await keychain.getSecret(
    SECRET_KEYS.GMAIL_APP_PASSWORD
  );

  if (!erpPassword || !gmailAppPassword) {
    spinner2.fail(pc.red("Missing credentials in keychain. Run `erp setup` again."));
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
    spinner2.fail(pc.red("No security answers found. Run `erp setup` again."));
    process.exit(1);
  }
  spinner2.succeed();

  //ERP login flow
  const erp = new ErpClient(config.erpUrl);
  const reader = new ImapOtpReader(config.gmailEmail, gmailAppPassword);
  const spinner3 = ora();

  try {
    // ERP session + Gmail connect- parallel
    spinner3.start(pc.cyan("[1/4]") + " Connecting to ERP & Gmail...");
    const [_, gmailReady] = await Promise.all([
      erp.initiateSession(),
      reader.connect().then(() => reader.snapshotLatestUid()),
    ]);
    const beforeUid = gmailReady;
    spinner3.succeed();

    spinner3.start(pc.cyan("[2/4]") + " Fetching security question...");
    const question = await erp.getSecurityQuestion(config.erpRoll);

    const answer = answers[question.toLowerCase().trim()];
    if (!answer) {
      spinner3.fail(pc.red(`Unknown security question: "${question}"`));
      console.log(pc.dim("Run `erp setup` to add this question."));
      process.exit(1);
    }
    spinner3.succeed();

    spinner3.start(pc.cyan("[3/4]") + " Requesting OTP & waiting...");
    await erp.requestOtp(config.erpRoll, erpPassword, answer);
    const otp = await reader.waitForOtp(beforeUid);
    await reader.disconnect();
    spinner3.succeed();
    console.log(`  OTP: ${pc.cyan(pc.bold(otp))}`);

    spinner3.start(pc.cyan("[4/4]") + " Authenticating...");
    const ssoToken = await erp.authenticate(
      config.erpRoll,
      erpPassword,
      answer,
      otp
    );
    spinner3.succeed();

    // Save session for next time (caching)
    await sessionStorage.saveSession({
      ssoToken,
      erpUrl: config.erpUrl,
      createdAt: Date.now(),
    });

    const loginUrl = `${config.erpUrl}/IIT_ERP3/home.htm?ssoToken=${ssoToken}`;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${pc.green("✓")} ${pc.bold("Login successful!")} ${pc.dim(`(${duration}s)`)}`);
    console.log(pc.dim("Opening browser..."));
    await openBrowser(loginUrl);
  } catch (error: any) {
    spinner3.fail(pc.red("Login failed"));
    
    // Better error recovery hints
    if (error.message.includes("Timed out waiting for OTP email")) {
      console.log(`\n${pc.red("✗ OTP not received within 60s")}`);
      console.log(`\nPossible causes:`);
      console.log(`  • ${pc.bold("Wrong security answer")} → run \`erp status --reveal\` to check for typos`);
      console.log(`  • ${pc.bold("Slow mobile network")} → Gmail-to-IMAP delivery can take >60s on weak signal; retry`);
      console.log(`  • ${pc.bold("ERP rate limiting")} → check erp.iitkgp.ac.in manually to see if OTPs are still sending`);
    } else {
      console.error(pc.red(`\nError details: ${error.message}`));
    }
    process.exit(1);
  } finally {
    await reader.disconnect();
  }
};
export const loginCommand = new Command("login")
  .description("Auto-login to ERP and open browser")
  .option("--fresh", "Skip cached session, force fresh OTP login")
  .option("--debug", "Print verbose request/response and OTP-extraction diagnostics")
  .action(loginAction);
