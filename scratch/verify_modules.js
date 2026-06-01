import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const BASE = 'https://gharpayy-arena-api.onrender.com/api';

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@gharpayy.com', password: 'Manager@123' })
  });
  const body = await res.json();
  console.log('--- LOGIN ---', 'status', res.status);
  return { token: body.token, employeeId: body.user?.employeeId };
}

async function api({ method, endpoint, token, payload }) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: payload ? JSON.stringify(payload) : undefined,
  };
  const res = await fetch(`${BASE}${endpoint}`, opts);
  const json = await res.json();
  console.log(`--- ${method} ${endpoint} ---`);
  console.log('status', res.status);
  console.log('response', JSON.stringify(json, null, 2));
  return { status: res.status, body: json };
}

async function verify() {
  const { token, employeeId } = await login();
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Helper to fetch latest document
  async function latest(col) {
    const doc = await db.collection(col).find({}).sort({ _id: -1 }).limit(1).next();
    console.log(`--- Atlas ${col} latest document ---`);
    console.log(JSON.stringify(doc, null, 2));
    return doc;
  }

  // 1️⃣ Selfie Attendance
  const attPayload = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    employeeId,
    date: new Date().toISOString().split('T')[0],
    checkInAt: Date.now(),
    checkOutAt: Date.now() + 8 * 60 * 60 * 1000,
    status: 'present',
  };
  const attRes = await api({ method: 'POST', endpoint: '/attendance', token, payload: attPayload });
  const attDocId = attRes.body._id || attRes.body.id;
  if (attDocId) await db.collection('attendance').findOne({ _id: attDocId }).then(d => console.log('--- Atlas attendance proof ---', JSON.stringify(d, null, 2)));

  // 2️⃣ Daily Pulse
  const pulsePayload = {
    id: `pulse-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    employeeId,
    date: new Date().toISOString().split('T')[0],
    slot: 'slot1',
    mood: 'great',
    notes: 'Launch test pulse',
  };
  const pulseRes = await api({ method: 'POST', endpoint: '/pulse', token, payload: pulsePayload });
  const pulseDocId = pulseRes.body._id || pulseRes.body.id;
  if (pulseDocId) await db.collection('pulseentries').findOne({ _id: pulseDocId }).then(d => console.log('--- Atlas pulse proof ---', JSON.stringify(d, null, 2)));

  // 3️⃣ Tasks (status = todo)
  const taskPayload = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: 'Launch test task',
    assigneeId: employeeId,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'todo',
  };
  const taskRes = await api({ method: 'POST', endpoint: '/tasks', token, payload: taskPayload });
  const taskDocId = taskRes.body._id || taskRes.body.id;
  if (taskDocId) await db.collection('tasks').findOne({ _id: taskDocId }).then(d => console.log('--- Atlas task proof ---', JSON.stringify(d, null, 2)));

  // Additional sanity checks for other modules (not required for this run)
  await client.close();
  console.log('--- VERIFICATION COMPLETE ---');
}

verify().catch(e => { console.error('Error', e); process.exit(1); });
