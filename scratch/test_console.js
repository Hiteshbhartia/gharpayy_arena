// Test script for /api/console endpoint
(async () => {
  const base = 'http://localhost:4000';
  // Sign up admin user (if not exists)
  try {
    await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'Password123',
        name: 'Admin',
        employeeId: 'e1'
      })
    });
  } catch (e) { /* ignore errors */ }

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('TOKEN', token);

  const consoleRes = await fetch(`${base}/api/console`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status', consoleRes.status);
  const consoleData = await consoleRes.json();
  console.log('Response', JSON.stringify(consoleData, null, 2));
})();
