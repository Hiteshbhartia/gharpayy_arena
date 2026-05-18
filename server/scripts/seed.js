// Optional: seed the DB with the same demo data the frontend uses.
// Run inside the api container: `docker compose exec api node scripts/seed.js`
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Employee } from "../src/models/index.js";

const SEED_EMPLOYEES = [
  { id: "e1", name: "Aarav Mehta", role: "Admin", title: "Founder" },
  { id: "e2", name: "Priya Sharma", role: "Floor Lead", title: "Pod Lead" },
  { id: "e3", name: "Rahul Verma", role: "Operator", title: "Senior Operator" },
  { id: "e4", name: "Megha Reddy", role: "HR", title: "People Pulse" },
  { id: "e12", name: "Nithya", role: "Manager", title: "Communication Shield" },
  { id: "e13", name: "Sneha", role: "Manager", title: "Performance Enforcer" },
  { id: "e14", name: "Jiya", role: "Manager", title: "Training Architect" },
  { id: "e15", name: "Thanvi", role: "Manager", title: "Talent Engine" },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("connected");

  for (const e of SEED_EMPLOYEES) {
    await Employee.updateOne({ id: e.id }, { $set: e }, { upsert: true });
  }
  console.log(`seeded ${SEED_EMPLOYEES.length} employees`);

  // Bootstrap admin if no users exist
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const email = process.env.SEED_ADMIN_EMAIL || "admin@arena.local";
    const pw = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
    const hash = await bcrypt.hash(pw, 12);
    await User.create({
      email,
      passwordHash: hash,
      employeeId: "e1",
      role: "admin",
      isApproved: true,
    });
    console.log(`bootstrapped admin: ${email} / ${pw}  (CHANGE IMMEDIATELY)`);
  } else {
    console.log(`users already exist (${userCount}), skipping admin bootstrap`);
  }

  await mongoose.disconnect();
  console.log("done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
