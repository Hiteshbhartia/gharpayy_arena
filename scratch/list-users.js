import mongoose from "mongoose";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, "../server/.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const users = await db.collection("users").find({}).toArray();
  
  console.log("=== Active Users in live Atlas DB ===");
  for (const u of users) {
    console.log(`Email: ${u.email} | Role: ${u.role} | Linked Employee ID: ${u.employeeId || "none"}`);
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
