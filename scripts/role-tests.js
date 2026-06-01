/**
 * Role‑based runtime verification script.
 *
 * 1️⃣ Invite four test users (employee, manager, HR, admin) via the admin endpoint.
 * 2️⃣ Login each user and obtain a JWT.
 * 3️⃣ Perform a set of protected requests per role.
 * 4️⃣ Log the HTTP status and a short payload summary.
 *
 * NOTE: This script assumes the server is already running on http://localhost:4000
 */

const BASE = process.env.BASE_URL || "http://localhost:4000";
const ts = Date.now();

/** Helper fetch wrapper */
async function doFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, body: json };
}

/** Invite a user via admin route – returns {email, password, role, token?} */
async function inviteUser({ name, email, role, appRole, managerId = null }) {
  // admin token already available via env variable for this script
  const adminToken = process.env.ADMIN_TOKEN; // set manually if needed
  const headers = { "Content-Type": "application/json" };
  if (adminToken) headers["Authorization"] = `Bearer ${adminToken}`;

  const payload = {
    name,
    email,
    operationalRole: role, // e.g. "Operator", "Manager", "HR", "Admin"
    appRole,
    team: "HQ",
    zone: "All",
    managerId,
  };
  const resp = await doFetch("/api/admin/workforce/invite", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (resp.status !== 201) {
    console.error("Invite failed for", email, resp);
    return null;
  }
  const { temporaryPassword, user } = resp.body;
  return { email, password: temporaryPassword, role: appRole };
}

/** Login a user – returns JWT */
async function login(email, password) {
  const resp = await doFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (resp.status !== 200) {
    console.error("Login failed for", email, resp);
    return null;
  }
  return resp.body.token;
}

/** Perform a request with a JWT */
async function authGet(path, token) {
  return await doFetch(path, { headers: { Authorization: `Bearer ${token}` } });
}

async function run() {
  console.log("=== ROLE‑BASED VERIFICATION ===");

  // ---------------------------------------------------
  // 1️⃣ Invite test users (admin already exists from signup)
  // ---------------------------------------------------
  const users = [];

  // Employee (basic)
  users.push(
    await inviteUser({
      name: `Emp ${ts}`,
      email: `emp-${ts}@test.local`,
      role: "Operator",
      appRole: "employee",
    })
  );

  // Manager (operational role Manager, app role manager)
  users.push(
    await inviteUser({
      name: `Mgr ${ts}`,
      email: `mgr-${ts}@test.local`,
      role: "Manager",
      appRole: "manager",
    })
  );

  // HR
  users.push(
    await inviteUser({
      name: `HR ${ts}`,
      email: `hr-${ts}@test.local`,
      role: "HR",
      appRole: "hr",
    })
  );

  // Admin – we already have the admin from the initial signup in the auth test.
  // Use the admin token directly (already stored in env variable for convenience).
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    console.error("Please set ADMIN_TOKEN env var to the admin JWT from the earlier test.");
    process.exit(1);
  }

  // ---------------------------------------------------
  // 2️⃣ Login each newly created user to obtain JWTs
  // ---------------------------------------------------
  const logged = [];
  for (const u of users) {
    if (!u) continue;
    const token = await login(u.email, u.password);
    if (token) logged.push({ ...u, token });
  }

  // ---------------------------------------------------
  // 3️⃣ Define verification matrix
  // ---------------------------------------------------
  const matrix = [
    {
      role: "employee",
      token: logged.find((x) => x.role === "employee")?.token,
      checks: [
        { path: "/api/employees", expect: 200 }, // can read own list (actually empty now)
        { path: "/api/admin/workforce", expect: 403 }, // admin only
      ],
    },
    {
      role: "manager",
      token: logged.find((x) => x.role === "manager")?.token,
      checks: [
        { path: "/api/employees", expect: 200 }, // should see hierarchy (still empty but allowed)
        { path: "/api/admin/workforce", expect: 403 },
      ],
    },
    {
      role: "hr",
      token: logged.find((x) => x.role === "hr")?.token,
      checks: [
        { path: "/api/employees", expect: 200 },
        { path: "/api/admin/workforce", expect: 403 }, // HR not admin in this API
      ],
    },
    {
      role: "admin",
      token: adminToken,
      checks: [
        { path: "/api/employees", expect: 200 },
        { path: "/api/admin/workforce", expect: 200 },
      ],
    },
  ];

  // ---------------------------------------------------
  // 4️⃣ Execute checks and report
  // ---------------------------------------------------
  for (const entry of matrix) {
    console.log(`\n--- ${entry.role.toUpperCase()} checks ---`);
    if (!entry.token) {
      console.warn(`No token for ${entry.role} – skipping`);
      continue;
    }
    for (const chk of entry.checks) {
      const resp = await authGet(chk.path, entry.token);
      const status = resp.status;
      const verdict = status === chk.expect ? "PASS" : `FAIL (got ${status})`;
      console.log(` ${chk.path.padEnd(30)} → expected ${chk.expect}, got ${status} → ${verdict}`);
    }
  }

  console.log("\n=== VERIFICATION COMPLETE ===");
}

run().catch((e) => {
  console.error("Unexpected error", e);
  process.exit(1);
});
