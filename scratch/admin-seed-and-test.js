// admin-seed-and-test.js
// This script creates an admin account (first signup becomes admin), logs in, and invokes the
// /api/migrate/seed-test-accounts endpoint to seed manager & employee test users.
// Adjust BASE_URL if the server runs on a different host/port.

// Node v24 provides global fetch.

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const SIGNUP_ENDPOINT = `${BASE_URL}/api/auth/signup`;
const LOGIN_ENDPOINT = `${BASE_URL}/api/auth/login`;
const SEED_ENDPOINT = `${BASE_URL}/api/migrate/seed-test-accounts`;

const ADMIN_EMAIL = 'admin@gharpayy.com';
const ADMIN_PASSWORD = 'Admin@123';
const ADMIN_NAME = 'Admin User';

async function signup() {
  const res = await fetch(SIGNUP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME }),
  });
  const data = await res.json();
  console.log('Signup status:', res.status);
  console.log('Signup response:', data);
  return data;
}

async function login() {
  const res = await fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed ${res.status} ${JSON.stringify(data)}`);
  console.log('Login successful');
  return data.token;
}

async function seedTestAccounts(token) {
  const res = await fetch(SEED_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  console.log('Seed endpoint status:', res.status);
  console.log('Seed response:', data);
}

(async () => {
  try {
    await signup();
    const token = await login();
    await seedTestAccounts(token);
  } catch (err) {
    console.error('Error:', err);
  }
})();
