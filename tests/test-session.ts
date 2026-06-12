import { ErpSession } from "../src/services/erp/session.js";

const session = new ErpSession();

// Simulate a server response with Set-Cookie headers
const fakeResponse = new Response("OK", {
  headers: [
    ["Set-Cookie", "JSESSIONID=ABC123.node7; Path=/SSOAdministration; Secure; HttpOnly"],
    ["Set-Cookie", "ssoToken=LONG_TOKEN_HERE; Path=/"],
  ],
});

session.setCookiesFromResponse(fakeResponse);

// Test getCookieHeader
console.log("Cookie header:", session.getCookieHeader());
// Expected: "JSESSIONID=ABC123.node7; ssoToken=LONG_TOKEN_HERE"

// Test get()
console.log("JSESSIONID:", session.get("JSESSIONID"));
// Expected: "ABC123.node7"

console.log("ssoToken:", session.get("ssoToken"));
// Expected: "LONG_TOKEN_HERE"

console.log("missing:", session.get("nonexistent"));
// Expected: undefined