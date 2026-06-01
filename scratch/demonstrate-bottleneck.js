import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server/.env
config({ path: path.resolve(__dirname, "../server/.env") });

async function run() {
  const BASE_URL = "http://localhost:4000";
  
  // 1. Boot local server
  console.log("Starting Express server locally...");
  await import("../server/src/index.js");
  
  // Wait a short time for DB connection and server listen
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log("\n--- STEP 1: Employee Login ---");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "employee@gharpayy.com",
      password: "Employee@123"
    })
  });
  
  const loginData = await loginRes.json();
  console.log("Login Response Status:", loginRes.status);
  if (loginRes.status !== 200) {
    console.error("Login failed!", loginData);
    process.exit(1);
  }
  
  const token = loginData.token;
  console.log("Extracted JWT Token (first 25 chars):", token.substring(0, 25) + "...");
  console.log("Employee Profile ID:", loginData.user.employeeId);
  
  console.log("\n--- STEP 2: Launch-Critical Action (Punch-In Attendance) ---");
  const eventPayload = {
    items: [
      {
        id: `test-punch-${Date.now()}`,
        employeeId: loginData.user.employeeId,
        kind: "clock_in",
        ts: Date.now(),
        lat: 12.9716,
        lng: 77.5946,
        accuracy: 10,
        address: "MG Road, Bangalore, Karnataka, India",
        selfie: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      }
    ]
  };
  
  console.log("Payload containing AttendanceEvent model data:", JSON.stringify(eventPayload, null, 2));
  
  console.log("\n--- STEP 3: Request to /api/attendance-events/bulk-upsert ---");
  const upsertRes = await fetch(`${BASE_URL}/api/attendance-events/bulk-upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(eventPayload)
  });
  
  const upsertData = await upsertRes.json();
  console.log("\n--- STEP 4: Response Status & Error Details ---");
  console.log("HTTP Response Status:", upsertRes.status);
  console.log("Response Body:", JSON.stringify(upsertData, null, 2));
  console.log("Model Involved: AttendanceEvent");
  
  console.log("\n--- VERIFICATION COMPLETE ---");
  process.exit(0);
}

run().catch(err => {
  console.error("Failure running demonstration:", err);
  process.exit(1);
});
