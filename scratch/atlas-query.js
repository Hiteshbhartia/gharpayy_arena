// READ-ONLY investigation — run via mongosh
// mongosh <uri> --file scratch/atlas-query.js --norc

const SEP = "═".repeat(70);
const sep = "─".repeat(70);

print("\n" + SEP);
print("  ATLAS INVESTIGATION — READ ONLY");
print(SEP);

// ── Collection counts ──────────────────────────────────────────────────────
print("\n📦 DATABASE: test");
print(sep);
const cols = db.getCollectionNames().sort();
for (const c of cols) {
  const n = db.getCollection(c).estimatedDocumentCount();
  print("  " + c.padEnd(30) + n + " docs");
}

// ── EMPLOYEES ─────────────────────────────────────────────────────────────
print("\n\n" + SEP);
print("  EMPLOYEES COLLECTION");
print(SEP);

const empTotal = db.employees.countDocuments();
print("Total employees: " + empTotal);

// Schema sample
const empSample = db.employees.findOne();
if (empSample) {
  print("\nTop-level keys: " + Object.keys(empSample).join(", "));
  if (empSample.profile) {
    print("profile keys:   " + Object.keys(empSample.profile).join(", "));
  }
}

// Role breakdown
print("\nOperational role breakdown:");
db.employees.aggregate([
  { $group: { _id: "$role", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(r => print("  " + String(r._id ?? "null").padEnd(25) + r.count));

// appRole breakdown (from profile)
print("\nApp role breakdown (profile.appRole):");
db.employees.aggregate([
  { $group: { _id: "$profile.appRole", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(r => print("  " + String(r._id ?? "null").padEnd(25) + r.count));

// Zone breakdown
print("\nZone breakdown (profile.zone):");
db.employees.aggregate([
  { $group: { _id: "$profile.zone", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(r => print("  " + String(r._id ?? "null").padEnd(25) + r.count));

// Team/Hub breakdown
print("\nTeam/Hub breakdown (hubId):");
db.employees.aggregate([
  { $group: { _id: "$hubId", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(r => print("  " + String(r._id ?? "null").padEnd(25) + r.count));

// Hierarchy
const withMgr    = db.employees.countDocuments({ managerId: { $exists: true, $nin: [null, ""] } });
const withoutMgr = db.employees.countDocuments({ $or: [{ managerId: { $exists: false } }, { managerId: null }, { managerId: "" }] });
print("\nHierarchy:");
print("  With managerId:    " + withMgr);
print("  Without managerId: " + withoutMgr);

// Full inventory table
print("\n" + sep);
print("MIGRATION INVENTORY — ALL EMPLOYEES");
print(sep);
const H = ["Name","Email","Op.Role","AppRole","ManagerId","Zone","Team","Status"];
print(H.map(h => h.padEnd(22)).join(" | "));
print("─".repeat(H.length * 24));

db.employees.find({}).sort({ name: 1 }).forEach(e => {
  const p = e.profile || {};
  const row = [
    String(e.name  ?? "").slice(0,20).padEnd(22),
    String(e.email ?? "").slice(0,20).padEnd(22),
    String(e.role  ?? "").slice(0,20).padEnd(22),
    String(p.appRole ?? "").slice(0,10).padEnd(22),
    String(e.managerId ?? "").slice(0,20).padEnd(22),
    String(p.zone  ?? e.hubId ?? "").slice(0,20).padEnd(22),
    String(p.team  ?? e.hubId ?? "").slice(0,20).padEnd(22),
    String(p.status ?? "").slice(0,10).padEnd(22),
  ];
  print(row.join(" | "));
});

// ── USERS ─────────────────────────────────────────────────────────────────
print("\n\n" + SEP);
print("  USERS COLLECTION");
print(SEP);

const userTotal = db.users.countDocuments();
print("Total users: " + userTotal);

const userSample = db.users.findOne({}, { passwordHash: 0 });
if (userSample) {
  print("Schema keys: " + Object.keys(userSample).join(", "));
}

print("\nAuth role breakdown:");
db.users.aggregate([
  { $group: { _id: "$role", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(r => print("  " + String(r._id ?? "null").padEnd(20) + r.count));

print("\nStatus breakdown:");
db.users.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(r => print("  " + String(r._id ?? "null").padEnd(20) + r.count));

const adminCount   = db.users.countDocuments({ role: "admin" });
const hrCount      = db.users.countDocuments({ role: "hr" });
const managerCount = db.users.countDocuments({ role: "manager" });
const empCount     = db.users.countDocuments({ role: "employee" });
const approvedCount   = db.users.countDocuments({ isApproved: true });
const unapprovedCount = db.users.countDocuments({ isApproved: false });
const suspendedCount  = db.users.countDocuments({ isSuspended: true });

print("\nCounts by role:");
print("  Admins:    " + adminCount);
print("  HR:        " + hrCount);
print("  Managers:  " + managerCount);
print("  Employees: " + empCount);
print("\nApproval:");
print("  isApproved=true:  " + approvedCount);
print("  isApproved=false: " + unapprovedCount);
print("  isSuspended=true: " + suspendedCount);

print("\n" + sep);
print("USER INVENTORY (no password hashes)");
print(sep);
const UH = ["Email","Role","EmployeeId","Status","Approved","Suspended"];
print(UH.map(h => h.padEnd(28)).join(" | "));
print("─".repeat(UH.length * 30));

db.users.find({}, { passwordHash: 0, __v: 0 }).sort({ email: 1 }).forEach(u => {
  const row = [
    String(u.email      ?? "").slice(0,26).padEnd(28),
    String(u.role       ?? "").padEnd(28),
    String(u.employeeId ?? "").padEnd(28),
    String(u.status     ?? "").padEnd(28),
    String(u.isApproved ?? "").padEnd(28),
    String(u.isSuspended ?? "").padEnd(28),
  ];
  print(row.join(" | "));
});

// ── HIERARCHY RESOLUTION ──────────────────────────────────────────────────
print("\n\n" + SEP);
print("  REPORTING HIERARCHY");
print(SEP);
print("\nHow hierarchy is stored:");
print("  employees.managerId  → references employees.id (string, not _id)");
print("  employees.hubId      → team/squad identifier");
print("  employees.profile.zone → zone assignment");
print("\nTop-level employees (no managerId = potential zone leaders / admins):");
db.employees.find(
  { $or: [{ managerId: { $exists: false } }, { managerId: null }, { managerId: "" }] },
  { id: 1, name: 1, role: 1, hubId: 1, "profile.zone": 1, "profile.appRole": 1 }
).sort({ role: 1 }).forEach(e => {
  print("  " + String(e.name ?? "").padEnd(25) + String(e.role ?? "").padEnd(20) + String(e.hubId ?? "").padEnd(15) + String(e.profile?.zone ?? ""));
});

print("\nManager → direct reports mapping:");
const managers = db.employees.find(
  { managerId: { $exists: true, $nin: [null, ""] } },
  { id: 1, name: 1, managerId: 1, role: 1 }
).toArray();

const byMgr = {};
for (const e of managers) {
  const mgr = db.employees.findOne({ id: e.managerId }, { name: 1 });
  const key = (mgr?.name ?? e.managerId) + " (" + e.managerId + ")";
  if (!byMgr[key]) byMgr[key] = [];
  byMgr[key].push(e.name + " [" + e.role + "]");
}
for (const [mgr, reports] of Object.entries(byMgr)) {
  print("\n  Manager: " + mgr);
  for (const r of reports) print("    └─ " + r);
}

print("\n\n" + SEP);
print("  INVESTIGATION COMPLETE — NO DATA MODIFIED");
print(SEP + "\n");
