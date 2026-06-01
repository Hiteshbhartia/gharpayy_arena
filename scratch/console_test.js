const fetch = global.fetch || require('node-fetch');

async function signup() {
  const res = await fetch('http://localhost:4000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'Password123',
      name: 'Admin',
      employeeId: 'e1'
    })
  });
  // ignore response, could be 409 if already exists
  return res;
}

async function login() {
  const res = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Password123' })
  });
  const data = await res.json();
  return data.token;
}

async function getConsole(token) {
  const res = await fetch('http://localhost:4000/api/console', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response body:', text);
}

(async () => {
  try {
    await signup();
    const token = await login();
    console.log('TOKEN:', token);
    await getConsole(token);
  } catch (e) {
    console.error('Error:', e);
  }
})();
