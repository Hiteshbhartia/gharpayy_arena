// launch-readiness-verify.js
// End‑to‑end verification of the six launch‑critical modules against the real
// Render‑connected backend (which talks to MongoDB Atlas). The script:
//   1️⃣ Logs in with a seeded test manager account.
//   2️⃣ Performs a create operation for each module.
//   3️⃣ Queries Atlas directly (via mongoose) to confirm the document exists.
//   4️⃣ Logs request/response details and DB verification.

import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load env from the server folder (contains MONGODB_URI & JWT_SECRET)
config({ path: path.resolve(__dirname, '../server/.env') });

const API = 'http://localhost:4000/api';

function hdr(title) {
  console.log('\n=== ' + title + ' ===');
}

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@gharpayy.com', password: 'Manager@123' }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Login failed: ' + JSON.stringify(json));
  console.log('Logged in, token acquired');
  return json.token;
}

async function verifyInAtlas(collectionName, filter) {
  const db = mongoose.connection.db;
  const coll = db.collection(collectionName);
  const doc = await coll.findOne(filter);
  return doc;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const token = await login();
  const auth = { Authorization: `Bearer ${token}` };

  // ---------- Selfie Attendance ----------
  hdr('Selfie Attendance');
  const attPayload = [{ employeeId: 'e-test-mgr', kind: 'clockIn', ts: Date.now() }];
  const attRes = await fetch(`${API}/attendance-events/bulk-upsert`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: attPayload }),
  });
  const attJson = await attRes.json();
  console.log('Response', attRes.status, attJson);
  const attId = attJson?.ids?.[0] || attJson?.created?.[0];
  console.log('Created ID', attId);
  const attDoc = await verifyInAtlas('attendanceevents', { _id: mongoose.Types.ObjectId(attId) });
  console.log('Atlas document', attDoc ? 'found' : 'missing');

  // ---------- Daily Pulse ----------
  hdr('Daily Pulse');
  const today = new Date().toISOString().split('T')[0];
  const pulsePayload = [{ employeeId: 'e-test-mgr', date: today, responses: { mood: 'good' } }];
  const pulseRes = await fetch(`${API}/pulse/bulk-upsert`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: pulsePayload }),
  });
  const pulseJson = await pulseRes.json();
  console.log('Response', pulseRes.status, pulseJson);
  const pulseId = pulseJson?.ids?.[0] || pulseJson?.created?.[0];
  const pulseDoc = await verifyInAtlas('pulseentries', { _id: mongoose.Types.ObjectId(pulseId) });
  console.log('Atlas pulse document', pulseDoc ? 'found' : 'missing');

  // ---------- Fly Board ----------
  hdr('Fly Board');
  const flyPayload = { authorId: 'e-test-mgr', content: 'Launch readiness post', ts: Date.now() };
  const flyCreateRes = await fetch(`${API}/fly`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(flyPayload),
  });
  const flyCreateJson = await flyCreateRes.json();
  console.log('Create response', flyCreateRes.status, flyCreateJson);
  const flyId = flyCreateJson?.id || flyCreateJson?.created?.[0];
  const flyDoc = await verifyInAtlas('flyupdates', { _id: mongoose.Types.ObjectId(flyId) });
  console.log('Atlas fly document', flyDoc ? 'found' : 'missing');

  // ---------- Tasks ----------
  hdr('Tasks');
  const taskPayload = { createdById: 'e-test-mgr', assigneeId: 'e-test-mgr', title: 'Readiness task', status: 'open' };
  const taskCreateRes = await fetch(`${API}/tasks`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(taskPayload),
  });
  const taskCreateJson = await taskCreateRes.json();
  console.log('Create response', taskCreateRes.status, taskCreateJson);
  const taskId = taskCreateJson?.id || taskCreateJson?.created?.[0];
  // Update status
  const taskUpdateRes = await fetch(`${API}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in-progress' }),
  });
  const taskUpdateJson = await taskUpdateRes.json();
  console.log('Update response', taskUpdateRes.status, taskUpdateJson);
  const taskDoc = await verifyInAtlas('tasks', { _id: mongoose.Types.ObjectId(taskId) });
  console.log('Atlas task document', taskDoc ? 'found' : 'missing');

  // ---------- Live Roster ----------
  hdr('Live Roster');
  const rosterRes = await fetch(`${API}/operator/live-roster`, { headers: auth });
  const rosterJson = await rosterRes.json();
  console.log('Roster response', rosterRes.status);
  console.log('Sample roster entry', JSON.stringify(rosterJson?.[0] || {}, null, 2).slice(0, 200), '...');

  // ---------- KPI Governance ----------
  hdr('KPI Governance');
  const defsRes = await fetch(`${API}/kpis/definitions`, { headers: auth });
  const defs = await defsRes.json();
  console.log('KPI definitions count', defs?.length || 0);
  const targetsRes = await fetch(`${API}/kpis/targets`, { headers: auth });
  const targets = await targetsRes.json();
  console.log('KPI targets count', targets?.length || 0);
  const assignRes = await fetch(`${API}/kpis/assignments?employeeId=e-test-mgr`, { headers: auth });
  const assign = await assignRes.json();
  console.log('KPI assignment sample', JSON.stringify(assign?.[0] || {}, null, 2));

  await mongoose.disconnect();
  console.log('\n=== VERIFICATION COMPLETE ===');
}

run().catch(err => { console.error('Verification script error:', err); process.exit(1); });
