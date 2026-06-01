// READ-ONLY deep dive into the two main databases
// mongosh <uri/gharpayy-attendance> --file scratch/legacy-deep.js --norc

const SEP = "═".repeat(72);
const sep = "─".repeat(72);
function pad(s, n) { return String(s ?? "").slice(0, n-1).padEnd(n); }

// ── gharpayy-attendance: gpattusers (53 employees) ────────────────────────
print("\n" + SEP);
print("  gharpayy-attendance.gpattusers  (EMPLOYEES)");
print(SEP);

const attDb = db.getSiblingDB("gharpayy-attendance");
const empDocs = attDb.gpattusers.find({}, { password: 0, passwordHash: 0, pinHash: 0 }).toArray();
print("Total: " + empDocs.length);

if (empDocs.length > 0) {
  print("Schema keys: " + Object.keys(empDocs[0]).join(", "));
  print("\nSample doc:");
  printjson(empDocs[0]);
}

// Role breakdown
const roleCount = {};
for (const e of empDocs) { const r = e.role ?? e.jobRole ?? "unknown"; roleCount[r] = (roleCount[r]??0)+1; }
print("\nRole breakdown:");
for (const [r,n] of Object.entries(roleCount).sort((a,b)=>b[1]-a[1])) print("  " + pad(r,30) + n);

// Zone breakdown
const zoneCount = {};
for (const e of empDocs) { const z = e.officeZoneId ?? e.zoneId ?? e.zone ?? "unknown"; zoneCount[String(z)] = (zoneCount[String(z)]??0)+1; }
print("\nZone/officeZoneId breakdown:");
for (const [z,n] of Object.entries(zoneCount).sort((a,b)=>b[1]-a[1])) print("  " + pad(z,30) + n);

// Approval
const approved   = empDocs.filter(e => e.isApproved === true).length;
const unapproved = empDocs.filter(e => e.isApproved === false).length;
print("\nisApproved=true:  " + approved);
print("isApproved=false: " + unapproved);

// Hierarchy — check for managerId / reportingTo
const withMgr = empDocs.filter(e => e.managerId || e.reportingTo || e.reportsTo).length;
print("With managerId/reportingTo: " + withMgr);

// gp_teams
print("\n\n" + SEP);
print("  gharpayy-attendance.gp_teams");
print(SEP);
const teams = attDb.gp_teams.find({}).toArray();
print("Total: " + teams.length);
for (const t of teams) {
  print("  " + pad(t.name ?? t.slug, 30) + " managerId: " + (t.managerId ?? "none") + "  parent: " + (t.parentTeamId ?? "none"));
}

// gp_hierarchy_roles
print("\n\n" + SEP);
print("  gharpayy-attendance.gp_hierarchy_roles");
print(SEP);
const hroles = attDb.gp_hierarchy_roles.find({}).toArray();
print("Total: " + hroles.length);
for (const r of hroles) {
  print("  level:" + pad(r.level,4) + " " + pad(r.name ?? r.slug,25) + " systemRole:" + (r.systemRole ?? "none") + "  canManageTeam:" + r.canManageTeam);
}

// gpofficezones
print("\n\n" + SEP);
print("  gharpayy-attendance.gpofficezones");
print(SEP);
const zones = attDb.gpofficezones.find({}).toArray();
print("Total: " + zones.length);
for (const z of zones) {
  print("  " + pad(String(z._id),28) + " " + pad(z.name,25) + " shift:" + z.shiftStart + "-" + z.shiftEnd);
}

// ── gharpayy: users (10) ──────────────────────────────────────────────────
print("\n\n" + SEP);
print("  gharpayy.users  (AUTH USERS)");
print(SEP);
const ghDb = db.getSiblingDB("gharpayy");
const ghUsers = ghDb.users.find({}, { password: 0, passwordHash: 0 }).toArray();
print("Total: " + ghUsers.length);
if (ghUsers.length > 0) print("Schema keys: " + Object.keys(ghUsers[0]).join(", "));
for (const u of ghUsers) {
  print("  " + pad(u.email ?? u.fullName, 30) + " role:" + pad(u.role,15) + " status:" + (u.status ?? "n/a"));
}

// gharpayy: gpattusers (5)
print("\n\n" + SEP);
print("  gharpayy.gpattusers");
print(SEP);
const ghEmp = ghDb.gpattusers.find({}, { password: 0, passwordHash: 0 }).toArray();
print("Total: " + ghEmp.length);
for (const e of ghEmp) {
  print("  " + pad(e.fullName ?? e.email, 30) + " role:" + pad(e.role,15));
}

// gharpayy: zones (5)
print("\n\n" + SEP);
print("  gharpayy.zones");
print(SEP);
const ghZones = ghDb.zones.find({}).toArray();
print("Total: " + ghZones.length);
for (const z of ghZones) {
  print("  " + pad(z.zoneName,25) + " manager:" + (z.zoneManager ?? "none") + "  status:" + (z.status ?? "n/a") + "  areas:" + JSON.stringify(z.areas ?? []));
}

// test: users (31)
print("\n\n" + SEP);
print("  test.users  (31 docs)");
print(SEP);
const testDb = db.getSiblingDB("test");
const testUsers = testDb.users.find({}, { password: 0, passwordHash: 0, pinHash: 0 }).toArray();
print("Total: " + testUsers.length);
if (testUsers.length > 0) print("Schema keys: " + Object.keys(testUsers[0]).join(", "));
const testRoles = {};
for (const u of testUsers) { const r = u.role ?? "unknown"; testRoles[r] = (testRoles[r]??0)+1; }
print("Role breakdown:");
for (const [r,n] of Object.entries(testRoles).sort((a,b)=>b[1]-a[1])) print("  " + pad(r,25) + n);
for (const u of testUsers) {
  print("  " + pad(u.username ?? u.email ?? u.employeeName, 30) + " role:" + pad(u.role,15) + " zone:" + (u.zoneId ?? "n/a") + " status:" + (u.status ?? "n/a"));
}

// test: zones (6)
print("\n\n" + SEP);
print("  test.zones  (6 docs)");
print(SEP);
const testZones = testDb.zones.find({}).toArray();
for (const z of testZones) {
  print("  " + pad(z.zoneName,25) + " manager:" + (z.zoneManager ?? "none") + "  areas:" + JSON.stringify(z.areas ?? []));
}

// ── FULL MIGRATION INVENTORY ──────────────────────────────────────────────
print("\n\n" + SEP);
print("  FULL MIGRATION INVENTORY — gpattusers (gharpayy-attendance)");
print(SEP);

const H = ["#","ID","Name","Email","Role","JobRole","ZoneId","isApproved","Status"];
print(H.map((h,i) => i===0 ? h.padEnd(4) : h.padEnd(26)).join(" | "));
print("─".repeat(240));

empDocs.forEach((e, i) => {
  const row = [
    String(i+1).padEnd(4),
    pad(String(e._id),26),
    pad(e.fullName ?? e.name,26),
    pad(e.email,26),
    pad(e.role,26),
    pad(e.jobRole,26),
    pad(String(e.officeZoneId ?? e.zoneId ?? ""),26),
    pad(String(e.isApproved ?? ""),26),
    pad(e.status ?? "",26),
  ];
  print(row.join(" | "));
});

print("\n\n" + SEP);
print("  ✅ READ-ONLY — NO DATA MODIFIED");
print("  ⏸  AWAITING APPROVAL BEFORE MIGRATION");
print(SEP + "\n");
