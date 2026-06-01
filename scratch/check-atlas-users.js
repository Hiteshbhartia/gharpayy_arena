import mongoose from "mongoose";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server/.env
config({ path: path.resolve(__dirname, "../server/.env") });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in server/.env");
    process.exit(1);
  }
  
  // Clean URI for logging
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  console.log("Connecting to MongoDB:", maskedUri);

  await mongoose.connect(uri);
  console.log("Connected successfully!");

  // Query raw database collection to bypass any mongoose schema limitations or validations
  const db = mongoose.connection.db;
  const usersCollection = db.collection("users");
  const users = await usersCollection.find({}).toArray();

  console.log(`Found ${users.length} total users in the database.`);
  
  const roleCounts = {};
  const legacyUsers = [];

  for (const user of users) {
    const role = user.role;
    roleCounts[role] = (roleCounts[role] || 0) + 1;
    if (["Admin", "HR", "Manager", "Employee"].includes(role)) {
      legacyUsers.push({ id: user._id, email: user.email, role: user.role });
    }
  }

  console.log("Role counts in DB:", JSON.stringify(roleCounts, null, 2));
  if (legacyUsers.length > 0) {
    console.log(`Found ${legacyUsers.length} legacy role users.`);
    console.log("Migration IS REQUIRED.");
  } else {
    console.log("No legacy role users found.");
    console.log("Migration IS NOT REQUIRED.");
  }

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch(err => {
  console.error("Error checking database:", err);
  process.exit(1);
});
