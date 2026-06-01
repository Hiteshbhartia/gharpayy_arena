/**
 * READ-ONLY Atlas investigation script.
 * No writes, no deletes, no modifications.
 * Run: node scratch/atlas-investigate.mjs
 */

import { MongoClient } from "mongodb";

const URI =
  "mongodb+srv://migration_reader:migration@gharpayy-core-arena-dev.i6refnu.mongodb.net/?appName=gharpayy-core-arena-dev";

async function main() {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 });

  try {
    await client.connect();
    console.log("\n✅ Connected to Atlas\n");

    const adminDb = client.db("admin");

    // ── 1. List all databases ──────────────────────────────────────────────
    let dbList = [];
    try {
      const result = await adminDb.admin().listDatabases();
      dbList = result.databases;
    } catch (e) {
      // migration_reader may not have listDatabases on admin — try known names
      console.warn("listDatabases restricted, probing known names:", e.message);
      dbList = [
        { name: "ghpayy" },
        { name: "gharpayy" },
        { name: "arena" },
        { name: "core-arena" },
        { name: "gharpayy-core-arena-dev" },
        { name: "test" },
      ].map((d) => ({ name: d.name }));
    }

    console.log("═══════════════════════════════════════════════════════");
    console.log("  DATABASES FOUND");
    console.log("═══════════════════════════════════════════════════════");

    const accessibleDbs = [];
    for (const { name } of dbList) {
      try {
        const db = client.db(name);
        const collections = await db.listCollections().toArray();
        if (collections.length > 0) {
          accessibleDbs.push({ name, collections: collections.map((c) => c.name) });
          console.log(`\n📦 ${name}  (${collections.length} collections)`);
          for (const c of collections) {
            const count = await db.collection(c.name).estimatedDocumentCount();
            console.log(`   • ${c.name.padEnd(30)} ${count} docs`);
          }
        }
      } catch (e) {
        // no access to this db
      }
    }

    if (accessibleDbs.length === 0) {
      console.log("No accessible databases found with those names.");
      console.log("Trying to read directly from the default db in the connection string...");
      // The connection string has no dbName — try common ones
      for (const name of ["ghpayy", "gharpayy", "arena", "test", "admin"]) {
        try {
          const db = client.db(name);
          const cols = await db.listCollections().toArray();
          if (cols.length > 0) {
            accessibleDbs.push({ name, collections: cols.map((c) => c.name) });
            console.log(`\n📦 ${name}  (${cols.length} collections)`);
            for (const c of cols) {
              const count = await db.collection(c.name).estimatedDocumentCount();
              console.log(`   • ${c.name.padEnd(30)} ${count} docs`);
            }
          }
        } catch (_) {}
      }
    }

    // ── 2. Deep-dive each accessible db ───────────────────────────────────
    for (const { name: dbName, collections } of accessibleDbs) {
      const db = client.db(dbName);

      console.log("\n");
      console.log("═══════════════════════════════════════════════════════");
      console.log(`  DEEP DIVE: ${dbName}`);
      console.log("═══════════════════════════════════════════════════════");

      // ── Employees ────────────────────────────────────────────────────────
      const empColName = collections.find((c) =>
        /^employee/i.test(c)
      );
      if (empColName) {
        const empCol = db.collection(empColName);
        const empCount = await empCol.countDocuments();
        console.log(`\n👥 ${empColName}  (${empCount} total)`);

        // Sample 3 docs to understand schema
        const samples = await empCol.find({}).limit(3).toArray();
        if (samples.length > 0) {
          console.log("\n  Schema keys:", Object.keys(samples[0]).join(", "));
          console.log("\n  Sample records:");
          for (const s of samples) {
            console.log(JSON.stringify({
              id: s.id,
              name: s.name,
              role: s.role,
              title: s.title,
              managerId: s.managerId,
              hubId: s.hubId,
              email: s.email,
              profile_appRole: s.profile?.appRole,
              profile_zone: s.profile?.zone,
              profile_team: s.profile?.team,
              profile_status: s.profile?.status,
            }, null, 2));
          }
        }

        // Role breakdown
        const roleBreakdown = await empCol.aggregate([
          { $group: { _id: "$role", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray();
        console.log("\n  Role breakdown:");
        for (const r of roleBreakdown) {
          console.log(`    ${String(r._id ?? "null").padEnd(25)} ${r.count}`);
        }

        // Zone breakdown
        const zoneBreakdown = await empCol.aggregate([
          { $group: { _id: "$profile.zone", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray();
        console.log("\n  Zone breakdown (profile.zone):");
        for (const z of zoneBreakdown) {
          console.log(`    ${String(z._id ?? "null").padEnd(25)} ${z.count}`);
        }

        // Hub/team breakdown
        const hubBreakdown = await empCol.aggregate([
          { $group: { _id: "$hubId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray();
        console.log("\n  Hub/Team breakdown (hubId):");
        for (const h of hubBreakdown) {
          console.log(`    ${String(h._id ?? "null").padEnd(25)} ${h.count}`);
        }

        // Hierarchy: who has a managerId set
        const withManager = await empCol.countDocuments({ managerId: { $exists: true, $ne: null, $ne: "" } });
        const withoutManager = await empCol.countDocuments({
          $or: [{ managerId: { $exists: false } }, { managerId: null }, { managerId: "" }],
        });
        console.log(`\n  Hierarchy:`);
        console.log(`    With managerId:    ${withManager}`);
        console.log(`    Without managerId: ${withoutManager}`);

        // Full migration inventory
        console.log("\n  ── MIGRATION INVENTORY (all employees) ──");
        console.log(
          "  " +
          ["Name", "Email", "Op.Role", "AppRole", "ManagerId", "Zone", "Team", "Status"]
            .map((h) => h.padEnd(22))
            .join(" | ")
        );
        console.log("  " + "─".repeat(200));

        const allEmps = await empCol.find({}).sort({ name: 1 }).toArray();
        for (const e of allEmps) {
          const row = [
            (e.name ?? "").slice(0, 20).padEnd(22),
            (e.email ?? "").slice(0, 20).padEnd(22),
            (e.role ?? "").slice(0, 20).padEnd(22),
            (e.profile?.appRole ?? "").slice(0, 10).padEnd(22),
            (e.managerId ?? "").slice(0, 20).padEnd(22),
            (e.profile?.zone ?? e.hubId ?? "").slice(0, 20).padEnd(22),
            (e.profile?.team ?? e.hubId ?? "").slice(0, 20).padEnd(22),
            (e.profile?.status ?? "").slice(0, 10).padEnd(22),
          ];
          console.log("  " + row.join(" | "));
        }
      }

      // ── Users ─────────────────────────────────────────────────────────────
      const userColName = collections.find((c) => /^user/i.test(c));
      if (userColName) {
        const userCol = db.collection(userColName);
        const userCount = await userCol.countDocuments();
        console.log(`\n\n🔐 ${userColName}  (${userCount} total)`);

        const samples = await userCol.find({}).limit(3).toArray();
        if (samples.length > 0) {
          console.log("\n  Schema keys:", Object.keys(samples[0]).join(", "));
        }

        // Role breakdown
        const roleBreakdown = await userCol.aggregate([
          { $group: { _id: "$role", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray();
        console.log("\n  Auth role breakdown:");
        for (const r of roleBreakdown) {
          console.log(`    ${String(r._id ?? "null").padEnd(20)} ${r.count}`);
        }

        // Status breakdown
        const statusBreakdown = await userCol.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray();
        console.log("\n  Status breakdown:");
        for (const s of statusBreakdown) {
          console.log(`    ${String(s._id ?? "null").padEnd(20)} ${s.count}`);
        }

        // Approval breakdown
        const approvedCount = await userCol.countDocuments({ isApproved: true });
        const pendingCount  = await userCol.countDocuments({ isApproved: false });
        const suspendedCount = await userCol.countDocuments({ isSuspended: true });
        console.log(`\n  isApproved=true:   ${approvedCount}`);
        console.log(`  isApproved=false:  ${pendingCount}`);
        console.log(`  isSuspended=true:  ${suspendedCount}`);

        // Counts by role
        const adminCount   = await userCol.countDocuments({ role: "admin" });
        const hrCount      = await userCol.countDocuments({ role: "hr" });
        const managerCount = await userCol.countDocuments({ role: "manager" });
        const empCount2    = await userCol.countDocuments({ role: "employee" });
        console.log(`\n  Admins:    ${adminCount}`);
        console.log(`  HR:        ${hrCount}`);
        console.log(`  Managers:  ${managerCount}`);
        console.log(`  Employees: ${empCount2}`);

        // User inventory (no password hashes)
        console.log("\n  ── USER INVENTORY ──");
        console.log(
          "  " +
          ["Email", "Role", "EmployeeId", "Status", "Approved", "Suspended"]
            .map((h) => h.padEnd(25))
            .join(" | ")
        );
        console.log("  " + "─".repeat(160));

        const allUsers = await userCol.find({}, {
          projection: { passwordHash: 0, __v: 0 }
        }).sort({ email: 1 }).toArray();

        for (const u of allUsers) {
          const row = [
            (u.email ?? "").slice(0, 23).padEnd(25),
            (u.role ?? "").padEnd(25),
            (u.employeeId ?? "").padEnd(25),
            (u.status ?? "").padEnd(25),
            String(u.isApproved ?? "").padEnd(25),
            String(u.isSuspended ?? "").padEnd(25),
          ];
          console.log("  " + row.join(" | "));
        }
      }

      // ── Other relevant collections ────────────────────────────────────────
      const interesting = ["attendanceevents", "attendance", "tasks", "leaves", "candidates"];
      for (const colName of collections) {
        if (interesting.some((i) => colName.toLowerCase().includes(i))) {
          const count = await db.collection(colName).estimatedDocumentCount();
          console.log(`\n📋 ${colName}: ${count} docs`);
        }
      }
    }

    console.log("\n\n═══════════════════════════════════════════════════════");
    console.log("  INVESTIGATION COMPLETE — NO DATA MODIFIED");
    console.log("═══════════════════════════════════════════════════════\n");

  } catch (err) {
    console.error("Connection or query error:", err.message);
    if (err.code) console.error("Error code:", err.code);
  } finally {
    await client.close();
  }
}

main();
