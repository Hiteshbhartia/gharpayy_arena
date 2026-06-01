import mongoose from "mongoose";
import { User, Employee } from "../server/src/models/index.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const MONGO = process.env.MONGODB_URI;

async function createUser({ email, password, name, role, employeeId }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = new User({
    email,
    passwordHash,
    name,
    role,
    isApproved: true,
    status: "active",
    employeeId,
  });
  await user.save();
  // also create Employee stub if not exists
  if (employeeId) {
    const existing = await Employee.findOne({ id: employeeId });
    if (!existing) {
      await Employee.create({ id: employeeId, name, role, managerId: null, hubId: "hub1" });
    }
  }
  return user;
}

async function main() {
  await mongoose.connect(MONGO);
  // clean any previous test users
  await User.deleteMany({ email: /@test\.com$/ });
  await Employee.deleteMany({ email: /@test\.com$/ });

  // admin (first user, will be admin by boot logic)
  await createUser({ email: "admin@test.com", password: "Passw0rd!", name: "Admin User", role: "admin", employeeId: "e0" });
  // HR
  await createUser({ email: "hr@test.com", password: "Passw0rd!", name: "HR User", role: "hr", employeeId: "e1" });
  // Manager (manager of e2 and e3)
  await createUser({ email: "mgr@test.com", password: "Passw0rd!", name: "Mgr User", role: "manager", employeeId: "e2" });
  // Employee (reportee of manager)
  await createUser({ email: "emp@test.com", password: "Passw0rd!", name: "Emp User", role: "employee", employeeId: "e3" });

  console.log("Test users created");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
