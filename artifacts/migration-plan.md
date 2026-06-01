# Arena Workforce Migration Plan

**Status:** PLANNING ONLY — no database changes made  
**Date:** 2026-06-01  
**Target database:** `gharpayy-core-arena-dev` (Atlas cluster `gharpayy-core-arena-dev.i6refnu.mongodb.net`, db `test`)  
**Source:** 53 employees extracted from `gharpayy-attendance.gpattusers`  
**Awaiting approval before any execution.**

---

## 1. Collections Inventory

### Current Arena database (`test`)

| Collection | Docs | Purpose |
|---|---|---|
| `users` | 27 | Auth accounts — email, passwordHash, role, employeeId |
| `employees` | 24 | Employee directory — name, role, hubId, profile |
| `rolepermissions` | 4 | DB-level feature permission overrides per role |
| `auditlogs` | 14 | Security audit trail |
| `kpidefinitions` | 103 | KPI definitions seeded from playbooks |
| `kpitargets` | 181 | KPI targets per scope/employee |
| `attendanceevents` | 32 | Clock-in/out events with selfie + GPS |
| `attendances` | 1 | Daily attendance summaries |
| `tasks` | 14 | Task records |
| `leaves` | 4 | Leave requests |
| `kudos` | 6 | Kudos records |
| `notifications` | 22 | Notification records |
| `oneonones` | 5 | 1:1 meeting records |
| `calevents` | 7 | Calendar events |
| `candidates` | 8 | Recruiting pipeline |
| `consolestates` | 2 | Operator console daily state |
| `pulseentries` | 3 | Daily pulse submissions |
| `flyupdates` | 14 | Fly board daily updates |
| `flyretros` | 6 | Fly board retro items |
| `flyfeeds` | 29 | Fly board feed events |

---

## 2. Collections to PRESERVE (do not touch)

| Collection | Reason | Specific records |
|---|---|---|
| `rolepermissions` | Live permission overrides set by admin | All 4 records |
| `auditlogs` | Security audit trail | All 14 records |
| `kpidefinitions` | Seeded KPI definitions — valid for real org | All 103 records |
| `kpitargets` | KPI targets — will need re-scoping after import but structure is valid | All 181 records |
| `users` (partial) | Real admin accounts | See Section 4 |
| `employees` (partial) | Real admin employee record | See Section 4 |

**Preserve these specific `users` records by email:**

| Email | Role | Reason |
|---|---|---|
| `aarav.mehta@gharpayy.com` | admin | Real admin, linked to employee `e1` |
| `admin@gharpayy.com` | admin | Real admin, no employee link |

**All other `users` records are mock/demo/test and should be deleted.**

---

## 3. Collections to CLEAN (delete mock data)

### `users` — delete all except the 2 real admins above

Records to delete (25 of 27):

| Category | Count | Identifier pattern |
|---|---|---|
| Mock demo employees | 12 | `*.gharpayy.com` emails with `employeeId` e1–e30 |
| Test accounts | 2 | `manager@gharpayy.com`, `employee@gharpayy.com` |
| Test HR accounts | 2 | `acc.test@gharpayy.com`, `invite.test@gharpayy.com` |
| Pending/unlinked | 2 | `admin@example.com`, `hitesh.gharpayy@gmail.com` |
| Mock managers | 7 | `arjun.nair`, `divya.menon`, `jiya.khanna`, `megha.pillai`, `nithya.iyer`, `pooja.bhalla`, `priya.sharma`, `rehan.khan`, `sneha.kulkarni`, `sneha.reddy`, `tanya.bhatt`, `thanvi.kapoor` |

**Exact deletion query (do not run yet):**
```js
db.users.deleteMany({
  email: { $nin: ["aarav.mehta@gharpayy.com", "admin@gharpayy.com"] }
})
```

### `employees` — delete all mock records

All 24 current employee records are demo-seeded (IDs e1–e30, e-test-mgr, e-test-emp, etc.).  
The real admin `aarav.mehta@gharpayy.com` is linked to `e1` — this employee record is also demo data and will be replaced by the imported record for the real admin.

**Exact deletion query (do not run yet):**
```js
db.employees.deleteMany({})
```

### Operational data — delete all mock records

These collections contain demo-seeded data tied to mock employee IDs. All records reference `e1`–`e30` or test IDs that will no longer exist after migration.

| Collection | Action | Query |
|---|---|---|
| `attendanceevents` | Delete all | `db.attendanceevents.deleteMany({})` |
| `attendances` | Delete all | `db.attendances.deleteMany({})` |
| `tasks` | Delete all | `db.tasks.deleteMany({})` |
| `leaves` | Delete all | `db.leaves.deleteMany({})` |
| `kudos` | Delete all | `db.kudos.deleteMany({})` |
| `notifications` | Delete all | `db.notifications.deleteMany({})` |
| `oneonones` | Delete all | `db.oneonones.deleteMany({})` |
| `calevents` | Delete all | `db.calevents.deleteMany({})` |
| `candidates` | Delete all | `db.candidates.deleteMany({})` |
| `consolestates` | Delete all | `db.consolestates.deleteMany({})` |
| `pulseentries` | Delete all | `db.pulseentries.deleteMany({})` |
| `flyupdates` | Delete all | `db.flyupdates.deleteMany({})` |
| `flyretros` | Delete all | `db.flyretros.deleteMany({})` |
| `flyfeeds` | Delete all | `db.flyfeeds.deleteMany({})` |

**`kpitargets`** — do not delete. After employee import, re-scope individual targets from `e1`–`e30` to new employee IDs. Org-level and zone-level targets remain valid.

---

## 4. Exact Deletion Strategy

### Order of operations (when approved)

```
Step 1: Backup
  mongodump --uri="<arena-uri>" --db=test --out=backups/pre-migration-$(date +%Y%m%d)

Step 2: Delete operational data (no FK constraints in MongoDB, safe to do first)
  db.attendanceevents.deleteMany({})
  db.attendances.deleteMany({})
  db.tasks.deleteMany({})
  db.leaves.deleteMany({})
  db.kudos.deleteMany({})
  db.notifications.deleteMany({})
  db.oneonones.deleteMany({})
  db.calevents.deleteMany({})
  db.candidates.deleteMany({})
  db.consolestates.deleteMany({})
  db.pulseentries.deleteMany({})
  db.flyupdates.deleteMany({})
  db.flyretros.deleteMany({})
  db.flyfeeds.deleteMany({})

Step 3: Delete mock employees
  db.employees.deleteMany({})

Step 4: Delete mock users (preserve real admins)
  db.users.deleteMany({
    email: { $nin: ["aarav.mehta@gharpayy.com", "admin@gharpayy.com"] }
  })

Step 5: Verify preservation
  assert(db.users.countDocuments() === 2)
  assert(db.rolepermissions.countDocuments() === 4)
  assert(db.kpidefinitions.countDocuments() === 103)
```

---

## 5. Exact Import Strategy

### Source: `exports/legacy-employees-with-hierarchy.xlsx` — Sheet 1

### What gets imported

For each of the 53 legacy employees, create:

**A. One `employees` document** (Arena schema):
```js
{
  id:        generateArenaId(),          // new stable string ID e.g. "gp-<shortHash>"
  name:      row.fullName,
  role:      mapOperationalRole(row),    // see Section 6
  title:     row.jobRoleLegacy,
  email:     row.email,
  hubId:     row.teamName || "HQ",
  managerId: null,                       // resolved in post-import step
  profile: {
    id:           <same as above>,
    name:         row.fullName,
    role:         mapOperationalRole(row),
    appRole:      mapAppRole(row),
    experience:   "Mid",
    attendance:   85,
    performance:  70,
    consistency:  70,
    revenueImpact: 0,
    taskCompletion: 75,
    conversion:   15,
    callsToday:   0,
    callTarget:   30,
    leadsActive:  0,
    closedDeals:  0,
    lostDeals:    0,
    flags:        [],
    status:       row.status === "active" ? "Active" : "Offline",
    streakDays:   0,
    team:         row.teamName || "HQ",
    shift:        row.zoneShift || "10:00 - 19:00",
    avatarSeed:   row.fullName.split(" ")[0],
    zone:         row.zoneName || "All",
    managerId:    null,
  }
}
```

**B. One `users` document** (Arena auth schema):
```js
{
  email:             row.email,
  passwordHash:      bcrypt("<temporaryPassword>", 12),  // generated per employee
  employeeId:        <employee.id from above>,
  role:              mapAuthRole(row),                   // see Section 6
  isApproved:        true,
  isSuspended:       false,
  status:            "active",
  mustChangePassword: true,                              // forces password reset on first login
  name:              row.fullName,
}
```

**C. One `notifications` document** (welcome notification):
```js
{
  id:          crypto.randomUUID(),
  kind:        "system",
  toId:        <employee.id>,
  title:       "Welcome to Gharpayy Arena",
  body:        "Your account is ready. Please set your password on first login.",
  ts:          Date.now(),
  read:        false,
}
```

### What does NOT get imported
- Passwords (new temporary password generated per employee)
- Sessions / tokens
- Attendance history (starts fresh)
- Legacy KPI values
- Legacy leave records

### Import execution order
```
1. Read XLSX Sheet 1 (53 rows)
2. Validate: no duplicate emails, all required fields present
3. Generate new Arena employee IDs (format: gp-<6charHash>)
4. Insert employees (bulk)
5. Insert users (bulk, with mustChangePassword: true)
6. Post-import: resolve managerId links using email cross-reference
7. Insert welcome notifications (bulk)
8. Verify: employees.count === 53, users.count === 55 (53 + 2 admins)
```

---

## 6. Role Mapping Strategy

### Legacy → Arena Operational Role

| Legacy `role` | Legacy `jobRole` | Legacy `playbookRole` | → Arena `role` (Employee.role) |
|---|---|---|---|
| `manager` | any | any | `Floor Lead` |
| `employee` | `intern` | `recruiter` | `Recruiter` |
| `employee` | `intern` | `hr` | `HR` |
| `employee` | `intern` | `sde` | `Operator` |
| `employee` | `intern` | (blank/other) | `Operator` |
| `employee` | `full-time` | any | `Operator` |
| `employee` | (blank) | any | `Operator` |

**Special cases from the data:**
- `MWB MORE` (role=manager, systemRole=manager) → `Floor Lead`
- `Nithya MNG 2`, `SNEHA MNG 1`, `Test manager` → `Floor Lead` (but `isApproved=false` → import as `pending` status)
- `Hitesh` (playbookRole=sde) → `Operator`
- `Nithyashree Nagaraju`, `Sneha Gupta` (playbookRole=hr) → `HR`

### Legacy → Arena Auth Role (User.role)

| Legacy `role` | Legacy `systemRole` | → Arena `User.role` |
|---|---|---|
| `manager` | `manager` | `manager` |
| `employee` | `hr` | `hr` |
| `employee` | `employee` | `employee` |
| `employee` | (blank) | `employee` |

### Legacy → Arena App Role (Employee.profile.appRole)

| Arena `User.role` | → `profile.appRole` |
|---|---|
| `admin` | `admin` |
| `manager` | `manager` |
| `hr` | `manager` |
| `employee` | `employee` |

---

## 7. Invite / Onboarding Strategy

### Temporary password generation
- Each imported employee receives a unique temporary password: `Gp<8randomChars>!`
- `mustChangePassword: true` is set on every imported user
- On first login, Arena forces a password reset via the existing `/force-password-reset` route

### Communication
The importer script will produce `exports/onboarding-credentials.csv` containing:

| Full Name | Email | Temporary Password | Arena Role |
|---|---|---|---|
| ... | ... | ... | ... |

This file must be distributed securely (not committed to git, not emailed in plaintext).

### First-login flow (existing Arena behaviour)
1. Employee receives email with temporary password (manual distribution)
2. Employee logs in at Arena URL
3. `AuthGate` detects `mustChangePassword: true`
4. Redirects to `/force-password-reset`
5. Employee sets permanent password
6. `mustChangePassword` set to `false`
7. Employee lands on their role-appropriate home page

### Accounts with `isApproved: false` in legacy
4 employees in the legacy data have `isApproved: false`:
- `MWB MORE` (mwbmore@gmail.com)
- `Nithya MNG 2` (nnithyashree667@gmail.com)
- `SNEHA MNG 1` (snehaa2721@gmail.com)
- `Test manager` (testmanager@gmail.com)

These are imported with `isApproved: false` and `status: "pending"`. They will see the "Pending Approval" screen in Arena until an admin approves them via Workforce management.

---

## 8. Rollback Strategy

### Pre-migration backup (mandatory before execution)
```bash
mongodump \
  --uri="mongodb+srv://..." \
  --db=test \
  --out="backups/pre-migration-$(date +%Y%m%d-%H%M%S)"
```

This creates a complete snapshot of all 20 collections before any change.

### Rollback procedure
If migration fails or produces incorrect results:

```bash
# 1. Drop the current state
mongosh <uri> --eval "db.dropDatabase()"

# 2. Restore from backup
mongorestore \
  --uri="mongodb+srv://..." \
  --db=test \
  "backups/pre-migration-<timestamp>/test"
```

Estimated restore time: < 2 minutes (database is ~5.5 MB).

### Partial rollback (if only import step fails)
If deletion succeeded but import failed:
```js
// Remove all imported employees (identified by id prefix "gp-")
db.employees.deleteMany({ id: /^gp-/ })
// Remove all imported users (identified by mustChangePassword: true)
db.users.deleteMany({ mustChangePassword: true })
// Restore from backup selectively
mongorestore --uri=... --db=test --collection=employees backups/.../test/employees.bson
mongorestore --uri=... --db=test --collection=users backups/.../test/users.bson
```

---

## 9. Risks and Validation Checks

### Pre-migration validation (run before any deletion)

| Check | Query | Expected |
|---|---|---|
| Admin accounts exist | `db.users.countDocuments({role:"admin"})` | ≥ 1 |
| Permissions preserved | `db.rolepermissions.countDocuments()` | 4 |
| KPI definitions intact | `db.kpidefinitions.countDocuments()` | 103 |
| Backup exists | `ls backups/pre-migration-*` | Non-empty |

### Post-deletion validation

| Check | Query | Expected |
|---|---|---|
| Only admins remain | `db.users.countDocuments()` | 2 |
| Employees cleared | `db.employees.countDocuments()` | 0 |
| Permissions intact | `db.rolepermissions.countDocuments()` | 4 |
| KPIs intact | `db.kpidefinitions.countDocuments()` | 103 |

### Post-import validation

| Check | Query | Expected |
|---|---|---|
| All employees imported | `db.employees.countDocuments()` | 53 |
| All users created | `db.users.countDocuments()` | 55 (53 + 2 admins) |
| No duplicate emails | `db.users.aggregate([{$group:{_id:"$email",n:{$sum:1}}},{$match:{n:{$gt:1}}}])` | Empty |
| No duplicate employee IDs | `db.employees.aggregate([{$group:{_id:"$id",n:{$sum:1}}},{$match:{n:{$gt:1}}}])` | Empty |
| All users have mustChangePassword | `db.users.countDocuments({mustChangePassword:true})` | 53 |
| Admins preserved | `db.users.countDocuments({role:"admin"})` | 2 |
| Permissions intact | `db.rolepermissions.countDocuments()` | 4 |

### Known risks

| Risk | Severity | Mitigation |
|---|---|---|
| Legacy `officeZoneId` not matching Arena zones | Medium | 47/53 employees have no zone — assign manually post-import via Workforce UI |
| Legacy manager IDs don't resolve to Arena IDs | Medium | `managerId` set to null on import; resolve via Workforce UI after import |
| 4 employees with `isApproved: false` | Low | Imported as pending; admin approves via Workforce UI |
| `John doe` (john@gmail.com) — likely test account | Low | Include in import but flag for HR review |
| `demo` (demo@gmail.com) — likely test account | Low | Include in import but flag for HR review |
| `Test manager` (testmanager@gmail.com) — test account | Low | Include in import but flag for HR review |
| Temporary passwords distributed insecurely | High | Use secure channel (WhatsApp/Signal/in-person) — never email in plaintext |
| `data-sync.ts` auto-seeds demo data on dev boot | High | Set `ENABLE_DEV_SEEDING=false` in `.env` before first boot after migration |

### Critical: disable auto-seeding before first boot
`data-sync.ts` calls `POST /api/migrate/seed-demo-data` on every dev boot when `ENABLE_DEV_SEEDING=true`. This will re-insert demo employees after migration.

**Before first boot after migration:**
```env
# .env
ENABLE_DEV_SEEDING=false
```

The `migrate.js` route already blocks seed endpoints when `ENABLE_DEV_SEEDING !== "true"`.

---

## 10. Bulk Importer Design

### Script: `scripts/import-legacy-workforce.js`

**Input:** `exports/legacy-employees-with-hierarchy.xlsx` (Sheet 1)  
**Output:**
- Creates `employees` + `users` documents in Arena MongoDB
- Writes `exports/onboarding-credentials.csv` (name, email, temp password)
- Writes `exports/import-report.md` (counts, errors, skipped)

**Does NOT:**
- Delete any existing data
- Migrate passwords
- Migrate attendance/tasks/leaves
- Touch `rolepermissions`, `kpidefinitions`, `kpitargets`

### Execution flow

```
1. Connect to Arena MongoDB (ARENA_MONGO_URI env var)
2. Read XLSX Sheet 1
3. Validate all rows (email format, required fields)
4. Abort if any validation fails — report errors
5. Check for email conflicts with existing users
6. For each employee:
   a. Generate Arena employee ID: "gp-" + randomBytes(3).toString("hex")
   b. Generate temporary password: "Gp" + randomBytes(6).toString("base64url") + "!"
   c. Hash password with bcrypt (12 rounds)
   d. Build Employee document
   e. Build User document (mustChangePassword: true)
7. Bulk insert employees (insertMany, ordered: false)
8. Bulk insert users (insertMany, ordered: false)
9. Post-import: resolve managerId by matching legacy manager email → new Arena employeeId
10. Write onboarding-credentials.csv
11. Write import-report.md
12. Print summary
```

### Role mapping function (pseudocode)

```js
function mapArenaRole(row) {
  const legacyRole   = row["Job Role (Legacy)"]?.toLowerCase() ?? "";
  const playbookRole = row["Playbook Role"]?.toLowerCase() ?? "";
  const systemRole   = row["System Role"]?.toLowerCase() ?? "";
  const baseRole     = row["Arena Operational Role"] ?? "";  // already computed in XLSX

  // Auth role
  let authRole = "employee";
  if (baseRole === "Floor Lead" || systemRole === "manager") authRole = "manager";
  if (playbookRole === "hr" || systemRole === "hr")          authRole = "hr";

  // Operational role (Arena Employee.role)
  let opRole = "Operator";
  if (baseRole === "Floor Lead")  opRole = "Floor Lead";
  if (baseRole === "HR")          opRole = "HR";
  if (baseRole === "Recruiter")   opRole = "Recruiter";
  if (baseRole === "Admin")       opRole = "Admin";

  // App role
  const appRole = authRole === "manager" || authRole === "hr" ? "manager" : "employee";

  return { authRole, opRole, appRole };
}
```

### Importer safety guards

```js
// Guard 1: Never run if mock data still exists
const mockCount = await Employee.countDocuments({ id: /^e\d+$/ });
if (mockCount > 0) {
  throw new Error("Mock employees still present. Run deletion step first.");
}

// Guard 2: Never overwrite existing users
const existingEmails = await User.distinct("email");
const conflicts = rows.filter(r => existingEmails.includes(r.email));
if (conflicts.length > 0) {
  throw new Error(`Email conflicts: ${conflicts.map(r => r.email).join(", ")}`);
}

// Guard 3: Require explicit confirmation flag
if (!process.env.CONFIRM_MIGRATION) {
  throw new Error("Set CONFIRM_MIGRATION=yes to proceed.");
}
```

---

## Summary

| Phase | Action | Collections affected | Reversible |
|---|---|---|---|
| 0. Backup | `mongodump` | All | N/A |
| 1. Delete operational data | `deleteMany({})` | 14 collections | ✅ via restore |
| 2. Delete mock employees | `deleteMany({})` | `employees` | ✅ via restore |
| 3. Delete mock users | `deleteMany({email: $nin admins})` | `users` | ✅ via restore |
| 4. Import employees | `insertMany` | `employees` | ✅ delete by id prefix |
| 5. Import users | `insertMany` | `users` | ✅ delete by mustChangePassword |
| 6. Resolve managers | `updateMany` | `employees` | ✅ set back to null |
| 7. Disable auto-seed | Edit `.env` | None | ✅ edit back |

**Awaiting approval before any step is executed.**
