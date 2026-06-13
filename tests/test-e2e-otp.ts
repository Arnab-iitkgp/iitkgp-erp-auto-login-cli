import { ErpClient } from "../src/services/erp/erp-client.js";
import { ImapOtpReader } from "../src/services/imap/otp-reader.js";

const roll = "Your roll number";
const password = "Your ERP password";
const email = "Your email address"; // personal or kgp mail
const appPassword = "Your Gmail app password"; // NOTE: not the actual Gmail password

const answers: Record<string, string> = {
  "question 1?": "answer 1",
  "question 2?": "answer 2",
  "question 3?": "answer 3",

};

async function run() {
  const erp = new ErpClient("https://erp.iitkgp.ac.in");
  const reader = new ImapOtpReader(email, appPassword);

  try {
    console.log("Step 1: Initiating ERP session...");
    const { sessionToken } = await erp.initiateSession();
    console.log("  sessionToken:", sessionToken);

    console.log("\nStep 2: Fetching security question...");
    const question = await erp.getSecurityQuestion(roll);
    console.log("  question:", question);

    const answer = answers[question.toLowerCase().trim()];
    if (!answer) {
      throw new Error(`Unknown security question: "${question}"`);
    }
    console.log("  answer:", answer);

    console.log("\nStep 3: Connecting to Gmail IMAP...");
    await reader.connect();
    console.log("  connected.");

    console.log("\nStep 4: Snapshotting latest email UID...");
    const beforeUid = await reader.snapshotLatestUid();
    console.log("  beforeUid:", beforeUid);

    console.log("\nStep 5: Triggering OTP via ERP...");
    const otpStartTime = Date.now();
    const otpResult = await erp.requestOtp(roll, password, answer);
    console.log("  ERP Response:", otpResult);

    console.log("\nStep 6: Waiting for OTP from Gmail...");
    const otp = await reader.waitForOtp(beforeUid);
    const otpElapsed = ((Date.now() - otpStartTime) / 1000).toFixed(1);
    console.log(`  OTP Received: ${otp} (took ${otpElapsed}s)`);

    // Disconnect IMAP before auth (we no longer need it)
    await reader.disconnect();
    console.log("  IMAP disconnected.");

    console.log("\nStep 7: Authenticating with OTP...");
    console.log("  cookies:", erp.getSession().getCookieHeader());
    console.log("  otp:", otp);
    try {
      const ssoToken = await erp.authenticate(roll, password, answer, otp);
      console.log("\n  ssoToken:", ssoToken);

      const loginUrl = `https://erp.iitkgp.ac.in/IIT_ERP3/home.htm?ssoToken=${ssoToken}`;
      console.log("\n SUCCESS! Open this URL in browser to login:");
      console.log(loginUrl);
    } catch (authErr: any) {
      console.error("  Auth error:", authErr.message?.substring(0, 300));
    }

  } catch (error) {
    console.error("\nFailed:", error);
  } finally {
    console.log("\nDisconnecting from IMAP...");
    await reader.disconnect();
    console.log("  disconnected.");
  }
}

run();
