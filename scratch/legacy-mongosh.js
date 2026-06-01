/**
 * READ-ONLY legacy Atlas investigation — runs inside mongosh.
 * Zero writes. Zero updates. Zero deletes.
 * mongosh <uri> --file scratch/legacy-mongosh.js --norc
 */

// ── helpers ────────────────────────────────────────────────────────────────
const SEP  = "═".repeat(72);
const sep  = "─".repeat(72);
const REDACTED_KEYS = ["password","passwordhash","hash","secret","token","salt"];

function safeKeys(doc) {
  if (!doc) return [];
  return Object.keys(doc).filter(k => !REDACTED_KEYS.includes(k.toLowerCase()));
}

function countBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = String(keyFn(item) ?? "null");
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function sortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

function pad(s, n) { return String(s ?? "").slice(0, n).padEnd(n); }

// ── 1. Discover databases ──────────────────────────────────────────────────
print("\n" + SEP);
print("  LEGACY ATLAS MIGRATION AUDIT — READ ONLY");
print("  Cluster: cluster0.iibqlyr.mongodb.net");
print(SEP);

let dbNames = [];
try {
  const result = db.adminCommand({ listDatabases: 1 });
  dbNames = result.databases
    .map(d => d.name)
    .filter(n => !["admin","local","config"].includes(n));
} catch(e) {
  print("listDatabases restricted: " + e.message);
  dbNames = ["test","gharpayy","ghpayy","arena","production","prod","dev"];
}

print("\nDatabases found: " + dbNames.join(", "));

// ── 2. Enumerate collections in every database ─────────────────────────────
const PEOPLE_KW = ["employee","user","staff","member","auth","account","role","team","zone","hub","manager","org","department","person"];
function isPeople(name) {
  const l = name.toLowerCase();
  return PEOPLE_KW.some(k => l.includes(k));
}

const allDbs = [];

for (const dbName of dbNames) {
  let cols = [];
  try {
    cols = db.getSiblingDB(dbName).getCollectionNames();
  } catch(e) {
    continue;
  }
  if (cols.length === 0) continue;

  print("\n\n" + SEP);
  print("  DATABASE: " + dbName + "  (" + cols.length + " collections)");
  print(SEP);

  const dbEntry = { name: dbName, collections: [] };

  for (const colName of cols.sort()) {
    const col = db.getSiblingDB(dbName).getCollection(colName);
    let count = 0;
    try { count = col.estimatedDocumentCount(); } catch(_) {}

    let sampleKeys = [];
    try {
      const s = col.findOne();
      if (s) sampleKeys = safeKeys(s).slice(0, 10);
    } catch(_) {}

    const flag = isPeople(colName) ? "⭐" : "  ";
    print(flag + " " + pad(colName, 32) + pad(count + " docs", 12) + "keys: " + sampleKeys.join(", "));
    dbEntry.collections.push({ name: colName, count, sampleKeys, isPeople: isPeople(colName) });
  }
  allDbs.push(dbEntry);
}

// ── 3. Deep-dive people collections ───────────────────────────────────────
print("\n\n" + SEP);
print("  DEEP DIVE — PEOPLE COLLECTIONS");
print(SEP);

// Collect all employee-like and user-like docs across all dbs
let allEmployees = [];
let allUsers     = [];

for (const dbEntry of allDbs) {
  const targetDb = db.getSiblingDB(dbEntry.name);
  for (const col of dbEntry.collections) {
    if (!col.isPeople) continue;
    const lower = col.name.toLowerCase();
    let docs = [];
    try { docs = targetDb.getCollection(col.name).find({}).limit(2000).toArray(); } catch(_) { continue; }
    if (docs.length === 0) continue;

    const firstDoc = docs[0];
    const keys = Object.keys(firstDoc).map(k => k.toLowerCase());

    const looksLikeEmployee = keys.includes("name") &&
      (keys.includes("role") || keys.includes("designation")) &&
      (keys.includes("managerid") || keys.includes("hubid") || keys.includes("team") || keys.includes("zone"));

    const looksLikeUser = keys.includes("email") &&
      (keys.includes("role") || keys.includes("passwordhash") || keys.includes("password"));

    if (looksLikeEmployee) {
      print("\n  📋 Employee-like: " + dbEntry.name + "." + col.name + " (" + docs.length + " docs)");
      print("     Keys: " + safeKeys(firstDoc).join(", "));
      if (firstDoc.profile) print("     profile keys: " + safeKeys(firstDoc.profile).join(", "));
      allEmployees = allEmployees.concat(docs.map(d => ({ ...d, _db: dbEntry.name, _col: col.name })));
    }

    if (looksLikeUser) {
      print("\n  🔐 User-like:     " + dbEntry.name + "." + col.name + " (" + docs.length + " docs)");
      print("     Keys: " + safeKeys(firstDoc).join(", "));
      allUsers = allUsers.concat(docs.map(d => ({ ...d, _db: dbEntry.name, _col: col.name })));
    }
  }
}

// ── 4. Employee analytics ──────────────────────────────────────────────────
print("\n\n" + SEP);
print("  EMPLOYEE ANALYTICS  (" + allEmployees.length + " total)");
print(SEP);

const roleBreakdown    = countBy(allEmployees, e => e.role ?? e.designation ?? "unknown");
const appRoleBreakdown = countBy(allEmployees, e => e.profile?.appRole ?? e.appRole ?? "unknown");
const zoneBreakdown    = countBy(allEmployees, e => e.profile?.zone ?? e.zone ?? e.hubId ?? "unknown");
const teamBreakdown    = countBy(allEmployees, e => e.profile?.team ?? e.team ?? e.hubId ?? "unknown");
const statusBreakdown  = countBy(allEmployees, e => e.profile?.status ?? e.status ?? "unknown");

print("\nOperational role breakdown:");
for (const [r, n] of sortedEntries(roleBreakdown)) print("  " + pad(r, 28) + n);

print("\nApp role breakdown (profile.appRole):");
for (const [r, n] of sortedEntries(appRoleBreakdown)) print("  " + pad(r, 28) + n);

print("\nZone breakdown:");
for (const [z, n] of sortedEntries(zoneBreakdown)) print("  " + pad(z, 28) + n);

print("\nTeam/Hub breakdown:");
for (const [t, n] of sortedEntries(teamBreakdown)) print("  " + pad(t, 28) + n);

print("\nStatus breakdown:");
for (const [s, n] of sortedEntries(statusBreakdown)) print("  " + pad(s, 28) + n);

// Hierarchy
const withMgr    = allEmployees.filter(e => e.managerId && e.managerId !== "").length;
const withoutMgr = allEmployees.length - withMgr;
print("\nHierarchy:");
print("  With managerId:    " + withMgr);
print("  Without managerId: " + withoutMgr);

// ── 5. User analytics ──────────────────────────────────────────────────────
print("\n\n" + SEP);
print("  USER / AUTH ANALYTICS  (" + allUsers.length + " total)");
print(SEP);

const authRoleBreakdown   = countBy(allUsers, u => u.role ?? "unknown");
const authStatusBreakdown = countBy(allUsers, u => u.status ?? "unknown");
const approvedCount   = allUsers.filter(u => u.isApproved === true).length;
const unapprovedCount = allUsers.filter(u => u.isApproved === false).length;
const suspendedCount  = allUsers.filter(u => u.isSuspended === true).length;

print("\nAuth role breakdown:");
for (const [r, n] of sortedEntries(authRoleBreakdown)) print("  " + pad(r, 28) + n);

print("\nStatus breakdown:");
for (const [s, n] of sortedEntries(authStatusBreakdown)) print("  " + pad(s, 28) + n);

print("\n  isApproved=true:  " + approvedCount);
print("  isApproved=false: " + unapprovedCount);
print("  isSuspended=true: " + suspendedCount);

// ── 6. Hierarchy tree ─────────────────────────────────────────────────────
print("\n\n" + SEP);
print("  REPORTING HIERARCHY");
print(SEP);

const idToName = {};
for (const e of allEmployees) {
  const id = e.id ?? String(e._id);
  idToName[id] = e.name ?? "unknown";
}

const byManager = {};
for (const e of allEmployees) {
  const mgId = e.managerId ?? e.profile?.managerId ?? null;
  if (mgId && mgId !== "") {
    if (!byManager[mgId]) byManager[mgId] = [];
    byManager[mgId].push({ id: e.id ?? String(e._id), name: e.name ?? "unknown", role: e.role ?? "unknown" });
  }
}

print("\nTop-level (no managerId):");
for (const e of allEmployees.filter(e => !e.managerId || e.managerId === "")) {
  print("  " + pad(e.name ?? "unknown", 28) + pad(e.role ?? "unknown", 22) + (e.id ?? String(e._id)));
}

print("\nManager → direct reports:");
for (const [mgId, reports] of Object.entries(byManager).sort((a,b) => b[1].length - a[1].length)) {
  print("\n  " + (idToName[mgId] ?? mgId) + " (" + mgId + ")");
  for (const r of reports) print("    └─ " + r.name + " [" + r.role + "] " + r.id);
}

// ── 7. Migration inventory table ──────────────────────────────────────────
print("\n\n" + SEP);
print("  MIGRATION INVENTORY — ALL EMPLOYEES");
print(SEP);

const H = ["#","EmpID","Name","Email","Op.Role","AppRole","ManagerID","Zone","Team","Status"];
print(H.map((h,i) => i===0 ? h.padEnd(4) : h.padEnd(22)).join(" | "));
print("─".repeat(220));

allEmployees.forEach((e, i) => {
  const p = e.profile ?? {};
  const row = [
    String(i+1).padEnd(4),
    pad(e.id ?? String(e._id), 22),
    pad(e.name, 22),
    pad(e.email ?? p.email, 22),
    pad(e.role ?? e.designation, 22),
    pad(p.appRole ?? e.appRole, 22),
    pad(e.managerId ?? p.managerId, 22),
    pad(p.zone ?? e.zone ?? e.hubId, 22),
    pad(p.team ?? e.team ?? e.hubId, 22),
    pad(p.status ?? e.status, 22),
  ];
  print(row.join(" | "));
});

// ── 8. User inventory table ───────────────────────────────────────────────
print("\n\n" + SEP);
print("  USER INVENTORY (no password hashes)");
print(SEP);

const UH = ["#","Email","AuthRole","EmployeeId","Status","Approved","Suspended"];
print(UH.map((h,i) => i===0 ? h.padEnd(4) : h.padEnd(28)).join(" | "));
print("─".repeat(200));

allUsers.forEach((u, i) => {
  const row = [
    String(i+1).padEnd(4),
    pad(u.email, 28),
    pad(u.role, 28),
    pad(u.employeeId, 28),
    pad(u.status, 28),
    pad(u.isApproved, 28),
    pad(u.isSuspended, 28),
  ];
  print(row.join(" | "));
});

// ── 9. Summary ────────────────────────────────────────────────────────────
print("\n\n" + SEP);
print("  SUMMARY");
print(SEP);
print("  Employees found:   " + allEmployees.length);
print("  Users found:       " + allUsers.length);
print("  Admins:            " + (authRoleBreakdown["admin"] ?? 0));
print("  HR:                " + (authRoleBreakdown["hr"] ?? 0));
print("  Managers:          " + (authRoleBreakdown["manager"] ?? 0));
print("  Employees (auth):  " + (authRoleBreakdown["employee"] ?? 0));
print("\n  ✅ READ-ONLY — NO DATA MODIFIED");
print("  ⏸  AWAITING APPROVAL BEFORE MIGRATION");
print(SEP + "\n");
