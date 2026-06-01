# Legacy Atlas Migration Audit

**Generated:** 2026-06-01  
**Source cluster:** `cluster0.iibqlyr.mongodb.net`  
**Status:** ✅ READ-ONLY investigation — no data modified  

> ⚠️ **Awaiting approval before any migration is performed.**  
> No data has been written, modified, or deleted in any database.

---

## Databases Discovered

| Database | Collections | Notes |
|---|---|---|
| `gharpayy` | 25 | Lead management + early employee records |
| `gharpayy-attendance` | 57 | **Primary employee store** — 53 employees, attendance, Arena KPIs, trackers |
| `test` | 42 | Zone-based role system — 31 users across 5 zones |
| `sample_mflix` | 6 | MongoDB sample dataset — not relevant |
| `truststomp` | 4 | Separate product — not relevant |

---

## Summary Counts

| Metric | Count | Source |
|---|---|---|
| Employees (accessible) | 15 | `gharpayy.users` + `gharpayy.gpattusers` |
| Employees (timed out) | 53 | `gharpayy-attendance.gpattusers` |
| **Total estimated employees** | **~68** | Combined |
| Zone-role users | 31 | `test.users` |
| Teammates | 1 | `test.teammates` |
| **Total people records** | **~99** | All sources |
| Zones | 5–6 | `gharpayy.zones` + `test.zones` |

---

## Role Breakdown

### `gharpayy.users` (10 records)
| Role | Count |
|---|---|
| employee | 10 |

### `gharpayy-attendance.gpattusers` (53 records — timed out, schema known)
Schema keys: `_id`, `fullName`, `email`, `role`, `dateOfBirth`, `jobRole`, `profilePhoto`, `officeZoneId`, `isApproved`, `createdAt`

### `test.users` (31 records — zone-based role system)
| Role | Count | Description |
|---|---|---|
| `zone_admin` | 5 | One per zone — zone manager level |
| `alpha` | 5 | Senior operator per zone |
| `beta` | 5 | Mid-level operator per zone |
| `gamma` | 5 | Junior operator per zone |
| `fire` | 5 | Field/sales role per zone |
| `water` | 5 | Support role per zone |
| `super_admin` | 1 | Platform admin |

---

## Zone Breakdown

| Zone | Manager | Areas |
|---|---|---|
| Indiranagar | Ravi Kumar | Indiranagar, HAL Airport Road |
| Domlur | Sneha Iyer | Domlur, Ejipura, CV Raman Nagar |
| Murugeshpalya | Amit Shah | Murugeshpalya, Old Airport Road |
| EGL | Priya Nair | EGL, Bellandur, Sarjapur Road |
| Electronic City | Kiran Rao | Electronic City, Bommasandra, Hosur Road |

---

## How Reporting Hierarchy Is Stored

The legacy system uses **two different hierarchy models** depending on the database:

### `gharpayy-attendance` (primary employee store)
- `gpattusers.officeZoneId` → references `gpofficezones._id`
- `gp_teams.managerId` → references `gpattusers._id`
- `gp_teams.parentTeamId` → self-referential team hierarchy
- `gp_hierarchy_roles` → defines 5 named levels with `level` (integer), `canManageTeam`, `canBeReportedTo` flags

### `test` database (zone-role system)
- `users.zoneId` → references `zones._id`
- `users.managerIds[]` → array of manager `_id` references (parent-pointer, supports multiple managers)
- `users.adminIds[]` → array of admin references
- Roles are zone-scoped: `zone_admin` > `alpha` > `beta`/`gamma`/`fire`/`water`

### `gharpayy` database
- No explicit hierarchy fields — flat employee list with zone names as strings

---

## `gharpayy-attendance` — Key Collections for Migration

| Collection | Docs | Migration Relevance |
|---|---|---|
| `gpattusers` | 53 | **Primary employee records** — name, email, role, zone, approval status |
| `gp_teams` | 3 | Team definitions with managerId |
| `gp_hierarchy_roles` | 5 | Role level definitions |
| `gpofficezones` | 6 | Zone definitions with shift times |
| `arenadailystates` | 47 | Arena KPI/sprint state per user — migratable to `consolestates` |
| `arenakpidefinitions` | 15 | KPI definitions — migratable to `kpidefinitions` |
| `arenasprintplans` | 8 | Sprint plans per role — migratable to playbooks |
| `arenacommwindows` | 3 | Communication window schedules |
| `gpleaves` | 26 | Leave records — migratable to `leaves` |
| `gpleavebalances` | 66 | Leave balances per employee |
| `gpcoachingsessions` | 9 | 1:1 coaching sessions — migratable to `oneonones` |
| `kudos` | 5 | Kudos records — migratable to `kudos` |
| `gptrackers` | 1016 | Daily performance trackers |
| `gpattendances` | 1098 | Attendance records — migratable to `attendanceevents` |

---

## Migration Inventory — Accessible Records (47 rows)

| # | Source | Name | Email | Role | Zone | Status |
|---|---|---|---|---|---|---|
| 1 | gharpayy.users | Satvik Sharma | satvik.gharpayy@gmail.com | employee | — | — |
| 2 | gharpayy.users | Pulkit Gupta | pulkit.gharpayy@gmail.com | employee | — | — |
| 3 | gharpayy.users | Sidhant Verma | siddhant.gharpayy@gmail.com | employee | — | — |
| 4 | gharpayy.users | Nayana Pillai | nayana.gharpayy@gmail.com | employee | — | — |
| 5 | gharpayy.users | Rahul Mehta | rahul.gharpayy@gmail.com | employee | — | — |
| 6 | gharpayy.users | Priya Singh | priya.gharpayy@gmail.com | employee | — | — |
| 7 | gharpayy.users | Amit Kumar | amit.gharpayy@gmail.com | employee | — | — |
| 8 | gharpayy.users | Sneha Joshi | sneha.gharpayy@gmail.com | employee | — | — |
| 9 | gharpayy.users | Karan Patel | karan.gharpayy@gmail.com | employee | — | — |
| 10 | gharpayy.users | Divya Nair | divya.gharpayy@gmail.com | employee | — | — |
| 11 | gharpayy.gpattusers | Satvik Sharma | satvik.gharpayy@gmail.com | employee | — | — |
| 12 | gharpayy.gpattusers | Pulkit Gupta | pulkit.gharpayy@gmail.com | employee | — | — |
| 13 | gharpayy.gpattusers | Sidhant Verma | siddhant.gharpayy@gmail.com | employee | — | — |
| 14 | gharpayy.gpattusers | Nayana Pillai | nayana.gharpayy@gmail.com | employee | — | — |
| 15 | gharpayy.gpattusers | Employee Name | email@gharpayy.com | employee | — | — |
| 16–46 | test.users | zone_admin / alpha / beta / gamma / fire / water | — | zone roles | Indiranagar / Domlur / Murugeshpalya / EGL / Electronic City | active |
| 47 | test.teammates | Ammar Logade | — | superadmin | — | active |

> Full detail in `migration-audit.json`

---

## Key Findings

1. **Primary employee store is `gharpayy-attendance.gpattusers`** (53 records). This database timed out from the current network — access it via Atlas UI or a machine with unrestricted outbound connectivity.

2. **Two separate role systems exist:**
   - `gharpayy-attendance`: named roles (`jobRole` field) with a `gp_hierarchy_roles` level system
   - `test`: zone-scoped coded roles (`alpha`, `beta`, `gamma`, `fire`, `water`, `zone_admin`)

3. **Zone structure is consistent** across both databases — 5 zones (Indiranagar, Domlur, Murugeshpalya, EGL, Electronic City) each with a named manager.

4. **Arena KPI/sprint data exists** in `gharpayy-attendance` (`arenadailystates`, `arenakpidefinitions`, `arenasprintplans`) and is directly mappable to the Arena schema.

5. **`gharpayy.users` and `gharpayy.gpattusers` overlap** — same 4 people appear in both. Deduplication needed before migration.

6. **No password hashes were read or logged** at any point in this investigation.

---

## Recommended Next Steps (pending approval)

1. Access `gharpayy-attendance.gpattusers` from Atlas UI to complete the 53-employee inventory
2. Map legacy `jobRole` values → Arena `role` (operational) + `appRole` (auth)
3. Map legacy `officeZoneId` → Arena `zone` + `hubId`
4. Deduplicate `gharpayy.users` vs `gharpayy.gpattusers` (same emails, different `_id`)
5. Map `test.users` zone-roles → Arena tier system
6. Migrate Arena KPI/sprint data from `arenadailystates` → `consolestates`

---

> **No migration has been performed. Awaiting explicit approval.**
