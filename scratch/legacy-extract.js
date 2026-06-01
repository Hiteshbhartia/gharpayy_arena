// READ-ONLY extraction from accessible databases
// mongosh <uri> --file scratch/legacy-extract.js --norc

const SEP = "═".repeat(72);
function pad(s, n) { return String(s ?? "").slice(0, n-1).padEnd(n); }
function countBy(arr, fn) {
  const o = {};
  for (const x of arr) { const k = String(fn(x) ?? "null"); o[k] = (o[k]??0)+1; }
  return o;
}

// ── gharpayy database ─────────────────────────────────────────────────────
print("\n" + SEP);
print("  DATABASE: gharpayy");
print(SEP);

const gh = db.getSiblingDB("gharpayy");

// users
const ghUsers = gh.users.find({}, { password:0, passwordHash:0 }).toArray();
print("\ngharpayy.users (" + ghUsers.length + ")");
print("Keys: " + Object.keys(ghUsers[0] ?? {}).join(", "));
for (const u of ghUsers) {
  print("  " + pad(u.email ?? u.fullName, 32) + " role:" + pad(u.role,15) + " status:" + (u.status ?? "n/a"));
}

// gpattusers
const ghEmp = gh.gpattusers.find({}, { password:0, passwordHash:0 }).toArray();
print("\ngharpayy.gpattusers (" + ghEmp.length + ")");
if (ghEmp[0]) print("Keys: " + Object.keys(ghEmp[0]).join(", "));
for (const e of ghEmp) {
  print("  " + pad(e.fullName ?? e.email, 32) + " role:" + pad(e.role,15));
}

// zones
const ghZones = gh.zones.find({}).toArray();
print("\ngharpayy.zones (" + ghZones.length + ")");
for (const z of ghZones) {
  print("  " + pad(z.zoneName,25) + " manager:" + pad(z.zoneManager ?? "none",20) + " areas:" + JSON.stringify(z.areas ?? []));
}

// ── test database ─────────────────────────────────────────────────────────
print("\n\n" + SEP);
print("  DATABASE: test");
print(SEP);

const testDb = db.getSiblingDB("test");

// users (31)
const testUsers = testDb.users.find({}, { password:0, passwordHash:0, pinHash:0 }).toArray();
print("\ntest.users (" + testUsers.length + ")");
if (testUsers[0]) print("Keys: " + Object.keys(testUsers[0]).join(", "));
const testRoles = countBy(testUsers, u => u.role);
print("Role breakdown: " + JSON.stringify(testRoles));
for (const u of testUsers) {
  print("  " + pad(u.username ?? u.employeeName ?? u.email, 30) + " role:" + pad(u.role,15) + " zone:" + pad(String(u.zoneId ?? ""),20) + " status:" + (u.status ?? "n/a"));
}

// zones (6)
const testZones = testDb.zones.find({}).toArray();
print("\ntest.zones (" + testZones.length + ")");
for (const z of testZones) {
  print("  " + pad(z.zoneName,25) + " manager:" + pad(z.zoneManager ?? "none",20) + " areas:" + JSON.stringify(z.areas ?? []));
}

// teammates (1)
const teammates = testDb.teammates.find({}, { pinHash:0 }).toArray();
print("\ntest.teammates (" + teammates.length + ")");
for (const t of teammates) {
  print("  " + pad(t.name ?? t.email, 30) + " role:" + pad(t.role,15) + " zone:" + (t.zoneId ?? "n/a"));
}

// ── FULL INVENTORY TABLE ──────────────────────────────────────────────────
print("\n\n" + SEP);
print("  MIGRATION INVENTORY — ALL ACCESSIBLE PEOPLE RECORDS");
print(SEP);

// Combine gharpayy.users + test.users + test.teammates
const inventory = [];

for (const u of ghUsers) {
  inventory.push({
    source: "gharpayy.users",
    id: String(u._id),
    name: u.fullName ?? u.name ?? "",
    email: u.email ?? "",
    role: u.role ?? "",
    jobRole: "",
    managerId: "",
    zone: "",
    team: "",
    status: u.status ?? "",
    isApproved: "",
  });
}

for (const e of ghEmp) {
  inventory.push({
    source: "gharpayy.gpattusers",
    id: String(e._id),
    name: e.fullName ?? e.name ?? "",
    email: e.email ?? "",
    role: e.role ?? "",
    jobRole: "",
    managerId: "",
    zone: "",
    team: "",
    status: "",
    isApproved: "",
  });
}

for (const u of testUsers) {
  inventory.push({
    source: "test.users",
    id: String(u._id),
    name: u.employeeName ?? u.username ?? u.email ?? "",
    email: u.email ?? "",
    role: u.role ?? "",
    jobRole: "",
    managerId: String(u.managerIds?.[0] ?? ""),
    zone: String(u.zoneId ?? ""),
    team: "",
    status: u.status ?? "",
    isApproved: "",
  });
}

for (const t of teammates) {
  inventory.push({
    source: "test.teammates",
    id: String(t._id),
    name: t.name ?? "",
    email: t.email ?? "",
    role: t.role ?? "",
    jobRole: "",
    managerId: "",
    zone: String(t.zoneId ?? ""),
    team: "",
    status: t.isActive ? "active" : "inactive",
    isApproved: "",
  });
}

const H = ["#","Source","ID","Name","Email","Role","ManagerId","Zone","Status"];
print(H.map((h,i) => i===0 ? h.padEnd(4) : h.padEnd(26)).join(" | "));
print("─".repeat(240));
inventory.forEach((r, i) => {
  const row = [
    String(i+1).padEnd(4),
    pad(r.source,26),
    pad(r.id,26),
    pad(r.name,26),
    pad(r.email,26),
    pad(r.role,26),
    pad(r.managerId,26),
    pad(r.zone,26),
    pad(r.status,26),
  ];
  print(row.join(" | "));
});

// ── SUMMARY ───────────────────────────────────────────────────────────────
print("\n\n" + SEP);
print("  SUMMARY");
print(SEP);
print("  gharpayy.users:       " + ghUsers.length);
print("  gharpayy.gpattusers:  " + ghEmp.length);
print("  test.users:           " + testUsers.length);
print("  test.zones:           " + testZones.length);
print("  test.teammates:       " + teammates.length);
print("  Total inventory rows: " + inventory.length);
print("\n  NOTE: gharpayy-attendance database (53 employees) timed out.");
print("  The primary employee store is gharpayy-attendance.gpattusers.");
print("  Recommend running audit from a machine with unrestricted Atlas access.");
print("\n  ✅ READ-ONLY — NO DATA MODIFIED");
print("  ⏸  AWAITING APPROVAL BEFORE MIGRATION");
print(SEP + "\n");
