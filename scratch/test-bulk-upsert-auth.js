// test-bulk-upsert-auth.js
// This script verifies the new ownership-based bulk-upsert authorization.
// It performs two HTTP POST requests to the /api/<model>/bulk-upsert endpoint:
// 1. A permitted request (employee updates own records)
// 2. A blocked request (attempt to upsert a record belonging to another employee)
// Adjust BASE_URL, MODEL_NAME, and JWT_TOKEN as needed for your environment.

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'; // adjust if server runs elsewhere
const MODEL_NAME = 'AttendanceEvent'; // change to model you wish to test
// Replace with a valid JWT for a non-admin employee user.
const JWT_TOKEN = process.env.TEST_JWT || 'YOUR_EMPLOYEE_JWT_HERE';

async function bulkUpsert(items) {
  const response = await fetch(`${BASE_URL}/api/${MODEL_NAME}/bulk-upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
    body: JSON.stringify({ items }),
  });
  const data = await response.json();
  console.log(`Status: ${response.status}`);
  console.log('Response:', data);
}

(async () => {
  console.log('--- Permitted request (own employeeId) ---');
  await bulkUpsert([
    {
      id: 'temp-' + Date.now(),
      employeeId: 'EMPLOYEE_ID_OF_JWT_USER', // replace with your employeeId
      // other required fields for AttendanceEvent
    },
  ]);

  console.log('\n--- Blocked request (other employeeId) ---');
  await bulkUpsert([
    {
      id: 'temp-' + Date.now(),
      employeeId: 'OTHER_EMPLOYEE_ID', // different from JWT user
    },
  ]);
})();
