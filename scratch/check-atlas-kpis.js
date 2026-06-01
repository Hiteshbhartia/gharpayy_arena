import mongoose from "mongoose";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, "../server/.env") });

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log("Connected successfully!");

  const db = mongoose.connection.db;
  
  // List collections
  const collections = await db.listCollections().toArray();
  console.log("Collections in DB:", collections.map(c => c.name));

  for (const colName of ["kpidefinitions", "kpitargets", "employees", "tasks", "pulseentries", "flyupdates", "attendanceevents"]) {
    try {
      const col = db.collection(colName);
      const count = await col.countDocuments();
      console.log(`- Collection '${colName}': ${count} documents`);
      if (count > 0 && colName.startsWith("kpi")) {
        const sample = await col.findOne({});
        console.log(`  Sample ${colName}:`, JSON.stringify(sample).slice(0, 150));
      }
    } catch (e) {
      console.log(`- Collection '${colName}': error counting`, e.message);
    }
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
