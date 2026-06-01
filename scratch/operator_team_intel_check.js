import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const BASE = 'https://gharpayy-arena-api.onrender.com/api';

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@gharpayy.com', password: 'Manager@123' }),
  });
  const body = await res.json();
  console.log('Login status', res.status);
  return body.token;
}

async function fetchTeamIntel(token) {
  const res = await fetch(`${BASE}/operator/team-intelligence`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch (e) { console.error('Non‑JSON response'); }
  console.log('Team‑intelligence status', res.status);
  if (json) {
    console.log('Payload keys', Object.keys(json));
    console.log('Sample KPI definition', JSON.stringify(json.kpiDefinitions?.[0] || json.definitions?.[0], null, 2));
    console.log('Sample KPI target', JSON.stringify(json.kpiTargets?.[0] || json.targets?.[0], null, 2));
  }
}

(async () => {
  const token = await login();
  if (token) await fetchTeamIntel(token);
})();
