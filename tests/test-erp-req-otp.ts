import { ErpClient } from "../src/services/erp/erp-client.js";
import prompts from "prompts";

//for local testing
const client = new ErpClient("https://erp.iitkgp.ac.in");
const roll = "Your roll no";
const password = "*";

const answers: Record<string, string> = {
  "test":"test"
};

try {
  console.log("Step 1: Initiating session...");
  const { sessionToken } = await client.initiateSession();
  console.log("sessionToken:", sessionToken);

  console.log("\nStep 2: Fetching security question...");
  const question = await client.getSecurityQuestion(roll);
  console.log("question:", question);

  const answer = answers[question.toLowerCase().trim()];
  if (!answer) {
    console.error("Unknown question:", question);
    process.exit(1);
  }

  console.log("\nStep 3: Triggering OTP...");
  const otpResult = await client.requestOtp(roll, password, answer);
  console.log("Result:", otpResult);

  // Wait for user to check email and enter OTP
  const { otp } = await prompts({
    type: "text",
    name: "otp",
    message: "Enter OTP from your email:",
  });

  if (!otp) {
    console.log("Cancelled.");
    process.exit(0);
  }

  console.log("\nStep 4: Authenticating...");
  const ssoToken = await client.authenticate(roll, password, answer, otp);
  console.log("\nssoToken:", ssoToken);

  const loginUrl = `https://erp.iitkgp.ac.in/IIT_ERP3/home.htm?ssoToken=${ssoToken}`;
  console.log("\nOpen this URL in browser to login:");
  console.log(loginUrl);

} catch (error) {
  console.error("Failed:", error);
}

export {};
