/**
 * Bulk demo auth: link every existing Employee to a User with generated email + Demo@123.
 *
 * Usage:
 *   cd server && npm run seed:demo-auth
 *   cd server && npm run seed:demo-auth -- --dry-run
 *
 * Requires MONGODB_URI in server/.env (or env).
 */
import "dotenv/config";
import mongoose from "mongoose";
import { runDemoAuthSeed, DEMO_AUTH_PASSWORD } from "../src/lib/demo-auth-seed.js";

const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("[seed] connected to MongoDB");
  if (dryRun) console.log("[seed] DRY RUN — no writes");

  const counts = await runDemoAuthSeed({ dryRun });

  await mongoose.disconnect();
  console.log("[seed] disconnected");

  if (!dryRun) {
    console.log("");
    console.log("Sample logins (password for all new users):", DEMO_AUTH_PASSWORD);
    console.log("  Admin-style job:     aarav.mehta@gharpayy.com (if name matches DB)");
    console.log("  Manager-style job:   priya.sharma@gharpayy.com (example)");
    console.log("  Employee-style job:  rohan.iyer@gharpayy.com (example)");
    console.log("Use exact emails from [seed] created lines above.");
  }

  if (counts.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
