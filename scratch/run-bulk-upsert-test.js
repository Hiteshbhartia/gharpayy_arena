// run-bulk-upsert-test.js
// This script logs in as a test employee, then attempts two bulk-upsert operations:
// 1. Permitted: records with the employee's own employeeId.
// 2. Blocked: records with a different employeeId.
// Adjust BASE_URL if the server runs on a different host/port.

// Node v24 provides a global fetch API; no need for node-fetch.
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000'; // server base URL
const LOGIN_ENDPOINT = `${BASE_URL}/api/auth/login`;
const BULK_UPSERT_ENDPOINT = `${BASE_URL}/api/attendance-events/bulk-upsert`;

// Test employee credentials (from seed-test-accounts)
const EMAIL = 'employee@gharpayy.com';
const PASSWORD = 'Employee@123';

async function login() {
  const res = await fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function bulkUpsert(token, items) {
  const res = await fetch(BULK_UPSERT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', data);
}

(async () => {
  try {
    console.log('Logging in as employee...');
    const loginData = await login();
    const token = loginData.token;
    const employeeId = loginData.user.employeeId;
    console.log('Logged in, employeeId:', employeeId);

    console.log('\n--- Permitted bulk-upsert (own employeeId) ---');
    await bulkUpsert(token, [{
      id: 'temp-' + Date.now(),
      employeeId,
      // add other required fields for AttendanceEvent if any (placeholder)
    }]);

    console.log('\n--- Blocked bulk-upsert (different employeeId) ---');
    await bulkUpsert(token, [{
      id: 'temp-' + Date.now(),
      employeeId: 'e-test-mgr', // manager employeeId, should be rejected
    }]);
  } catch (err) {
    console.error('Error during test:', err);
  }
})();
