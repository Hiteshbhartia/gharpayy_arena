/**
 * Seed role-based test accounts (manager + employee).
 * Run: npm run seed:test-accounts  (from server/)
 */
import "dotenv/config";
import mongoose from "mongoose";
import { seedTestAccounts } from "../src/lib/seed-test-accounts.js";

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI missing — set it in server/.env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("[seed-test-accounts] connected");

  const result = await seedTestAccounts();
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
  console.log("[seed-test-accounts] done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
