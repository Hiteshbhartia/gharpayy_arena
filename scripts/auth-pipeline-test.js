/**
 * Auth Pipeline Test — targeted JWT flow verification.
 *
 * 1. Signup a test user (first user = admin)
 * 2. Capture the JWT from signup response
 * 3. Hit GET /api/auth/me with that JWT
 * 4. Hit GET /api/employees with that JWT
 * 5. Report results
 */

const BASE = process.env.BASE_URL || "http://localhost:4000";
const ts = Date.now();

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function get(path, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function run() {
  console.log("=== AUTH PIPELINE TEST ===");
  console.log("Base URL:", BASE);
  console.log();

  // Step 0: Health check
  console.log("--- Step 0: Health check ---");
  try {
    const h = await get("/health");
    console.log("Health:", h.status, JSON.stringify(h.body));
    if (h.status !== 200) {
      console.error("FATAL: Server not responding. Aborting.");
      process.exit(1);
    }
  } catch (err) {
    console.error("FATAL: Cannot reach server:", err.message);
    process.exit(1);
  }

  // Step 1: Signup (first user = admin)
  console.log();
  console.log("--- Step 1: Signup ---");
  const signupPayload = {
    email: `authtest-${ts}@test.local`,
    password: "TestPass1234!",
    name: `AuthTest ${ts}`,
  };
  console.log("Request:", JSON.stringify(signupPayload));
  const signup = await post("/api/auth/signup", signupPayload);
  console.log("Response status:", signup.status);
  console.log("Response body:", JSON.stringify(signup.body, null, 2));

  const token = signup.body?.token;
  if (!token) {
    console.error("FATAL: No token in signup response. Auth pipeline broken at signup.");
    process.exit(1);
  }

  console.log("Token received:", token.substring(0, 30) + "...");
  console.log("Token length:", token.length);

  // Decode token payload (base64) without verification
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      console.log("Token payload (decoded):", JSON.stringify(payload, null, 2));
    } catch (e) {
      console.log("Could not decode token payload:", e.message);
    }
  }

  // Step 2: GET /api/auth/me with token
  console.log();
  console.log("--- Step 2: GET /api/auth/me ---");
  console.log("Authorization header: Bearer", token.substring(0, 20) + "...");
  const me = await get("/api/auth/me", token);
  console.log("Response status:", me.status);
  console.log("Response body:", JSON.stringify(me.body, null, 2));

  if (me.status === 401) {
    console.error("FAIL: /api/auth/me returned 401 — JWT verification is broken.");
    console.error("Check server logs for [auth:debug] output.");
  } else if (me.status === 200) {
    console.log("SUCCESS: /api/auth/me returned 200 — JWT auth is working!");
  }

  // Step 3: GET /api/employees with token
  console.log();
  console.log("--- Step 3: GET /api/employees ---");
  const employees = await get("/api/employees", token);
  console.log("Response status:", employees.status);
  console.log("Response body preview:", JSON.stringify(employees.body)?.substring(0, 200));

  if (employees.status === 401) {
    console.error("FAIL: /api/employees returned 401.");
  } else if (employees.status === 200) {
    console.log("SUCCESS: /api/employees returned 200.");
  } else {
    console.log("OTHER: /api/employees returned", employees.status);
  }

  // Step 4: Login with same credentials
  console.log();
  console.log("--- Step 4: Login ---");
  const login = await post("/api/auth/login", {
    email: signupPayload.email,
    password: signupPayload.password,
  });
  console.log("Response status:", login.status);
  console.log("Response body:", JSON.stringify(login.body, null, 2));

  const loginToken = login.body?.token;
  if (loginToken) {
    console.log("Login token received:", loginToken.substring(0, 30) + "...");

    // Use login token for another /me call
    console.log();
    console.log("--- Step 5: GET /api/auth/me with login token ---");
    const me2 = await get("/api/auth/me", loginToken);
    console.log("Response status:", me2.status);
    console.log("Response body:", JSON.stringify(me2.body, null, 2));
  }

  // Summary
  console.log();
  console.log("=== SUMMARY ===");
  console.log("Signup:", signup.status === 201 ? "PASS" : `FAIL (${signup.status})`);
  console.log("/api/auth/me:", me.status === 200 ? "PASS" : `FAIL (${me.status})`);
  console.log("/api/employees:", employees.status === 200 ? "PASS" : `FAIL (${employees.status})`);
  console.log("Login:", login.status === 200 ? "PASS" : `FAIL (${login.status})`);
}

run().catch((err) => {
  console.error("Test script error:", err);
  process.exit(1);
});
