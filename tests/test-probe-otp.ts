// Wider search: try different paths and also check if auth.htm itself triggers OTP
const base = "https://erp.iitkgp.ac.in";
const roll = "23ch10011";

const endpoints = [
  // Under SSOAdministration with different names
  "/SSOAdministration/getEmailOtp",
  "/SSOAdministration/email-otp",
  "/SSOAdministration/otp",
  "/SSOAdministration/sendOtp",
  // Under IIT_ERP3
  "/IIT_ERP3/getEmailOTP.htm",
  "/IIT_ERP3/getEmailOtp.htm",
  "/IIT_ERP3/sendOTP.htm",
  "/IIT_ERP3/otp.htm",
  // Without .htm extension
  "/SSOAdministration/getEmailOTP",
  "/SSOAdministration/sendEmailOTP",
  // auth.htm itself (maybe it triggers OTP when no otp field is provided)
  "/SSOAdministration/auth.htm",
];

for (const endpoint of endpoints) {
  const url = `${base}${endpoint}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `user_id=${roll}`,
    });
    const status = response.status;
    const text = (await response.text()).substring(0, 100);
    const notFound = text.includes("404");
    console.log(`${notFound ? "  " : "* "} ${status} ${endpoint} | ${text}`);
  } catch (e) {
    console.log(`  ERR ${endpoint} | ${e}`);
  }
}

export {};
