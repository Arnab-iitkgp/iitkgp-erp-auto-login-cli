import { ErpClient } from "../src/services/erp/erp-client.js";

const client = new ErpClient("https://erp.iitkgp.ac.in");

try {
  console.log("Step 1: Initiating session...");
  const { sessionToken, requestedUrl } = await client.initiateSession();
  console.log("sessionToken:", sessionToken);

  console.log("\nStep 2: Fetching security question...");
  const question = await client.getSecurityQuestion("23ch10011");
  console.log("question:", question);
} catch (error) {
  console.error("Failed:", error);
}

export {}








// import { ErpClient } from "../src/services/erp/erp-client.js";

// const client = new ErpClient("https://erp.iitkgp.ac.in");

// try {
//   console.log("Initiating session...\n");
//   const { sessionToken, requestedUrl } = await client.initiateSession();

//   console.log("sessionToken:", sessionToken);
//   console.log("requestedUrl:", requestedUrl);
//   console.log("cookies:", client.getSession().getCookieHeader());
// } catch (error) {
//   console.error("Failed:", error);
// }

// export {}
