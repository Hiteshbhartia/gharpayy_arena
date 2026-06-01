/**
 * READ-ONLY legacy Atlas migration audit.
 * Connects to the LEGACY cluster only.
 * Zero writes, zero updates, zero deletes.
 *
 * Outputs:
 *   artifacts/migration-audit.json
 *   artifacts/migration-summary.md
 *
 * Run: node scratch/legacy-audit.mjs
 */

import { MongoClient } from "mongodb";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ARTIFACTS = join(ROOT, "artifacts");

const LEGACY_URI =
  "mongodb+srv://hitesh:gharpayy123@cluster0.iibqlyr.mongodb.net/?appName=Cluster0";

// Keywords that suggest a collection is relevant to people/auth/hierarchy
const PEOPLE_KEYWORDS = [
  "employee", "user", "staff", "member", "person", "people",
  "auth", "account", "login", "role", "team", "zone", "hub",
  "manager", "hierarchy", "org", "department",
];

function isPeopleCollection(name) {
  const lower = name.toLowerCase();
  return PEOPLE_KEYWORDS.some((k) => lower.includes(k));
}

// Safe field extractor — never logs credential-like values
function safeKeys(doc) {
  if (!doc) return [];
  return Object.keys(doc).filter((k) => {
    const lower = k.toLowerCase();
    return !["password", "passwordhash", "hash", "secret", "token", "salt"].includes(lower);
  });
}

function safeValue(key, val) {
  const lower = key.toLowerCase();
  if (["password", "passwordhash", "hash", "secret", "token", "salt"].includes(lower)) {
    return "[REDACTED]";
  }
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && val.constructor?.name === "ObjectId") return val.toString();
  if (typeof val === "object" && !Array.isArray(val)) return "{object}";
  if (Array.isArray(val)) return `[array:${val.length}]`;
  return val;
}

function sanitiseDoc(doc) {
  if (!doc) return {};
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    out[k] = safeValue(k, v);
  }
  return out;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  LEGACY ATLAS MIGRATION AUDIT — READ ONLY               ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  mkdirSync(ARTIFACTS, { recursive: true });

  const client = new MongoClient(LEGACY_URI, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  });

  const audit = {
    generatedAt: new Date().toISOString(),
    legacyCluster: "cluster0.iibqlyr.mongodb.net",
    databases: [],
    peopleSummary: {
      employeeCount: 0,
      userCount: 0,
      roleBreakdown: {},
      appRoleBreakdown: {},
      statusBreakdown: {},
      zoneBreakdown: {},
      teamBreakdown: {},
      managerHierarchy: [],
      topLevelEmployees: [],
    },
    migrationInventory: [],
  };

  try {
    await client.connect();
    console.log("✅ Connected to legacy cluster\n");

    // ── 1. List all databases ──────────────────────────────────────────────
    let dbList = [];
    try {
      const result = await client.db("admin").admin().listDatabases();
      dbList = result.databases.filter(
        (d) => !["admin", "local", "config"].includes(d.name)
      );
    } catch (e) {
      console.warn("listDatabases restricted:", e.message);
      // Probe common names
      for (const name of [
        "gharpayy", "ghpayy", "arena", "core", "test",
        "production", "prod", "dev", "staging",
      ]) {
        try {
          const cols = await client.db(name).listCollections().toArray();
          if (cols.length > 0) dbList.push({ name });
        } catch (_) {}
      }
    }

    console.log(`Found ${dbList.length} user database(s):\n`);

    // ── 2. Enumerate every database and collection ─────────────────────────
    for (const { name: dbName } of dbList) {
      console.log(`\n📦 Database: ${dbName}`);
      const db = client.db(dbName);

      let collections = [];
      try {
        collections = await db.listCollections().toArray();
      } catch (e) {
        console.warn(`  Cannot list collections in ${dbName}:`, e.message);
        continue;
      }

      const dbEntry = { name: dbName, collections: [] };

      for (const colMeta of collections) {
        const colName = colMeta.name;
        const col = db.collection(colName);

        let count = 0;
        try {
          count = await col.estimatedDocumentCount();
        } catch (_) {}

        // Sample one doc for schema
        let sampleKeys = [];
        let sampleDoc = null;
        try {
          sampleDoc = await col.findOne({});
          sampleKeys = safeKeys(sampleDoc);
        } catch (_) {}

        const relevant = isPeopleCollection(colName);
        console.log(
          `  ${relevant ? "⭐" : "  "} ${colName.padEnd(35)} ${String(count).padStart(6)} docs   keys: ${sampleKeys.slice(0, 8).join(", ")}`
        );

        dbEntry.collections.push({
          name: colName,
          documentCount: count,
          sampleKeys,
          likelyPeopleCollection: relevant,
        });

        // ── Deep-dive people collections ──────────────────────────────────
        if (relevant && count > 0) {
          await deepDive(col, colName, dbName, audit);
        }
      }

      audit.databases.push(dbEntry);
    }

    // ── 3. Build migration inventory ──────────────────────────────────────
    console.log("\n\n══════════════════════════════════════════════════════════");
    console.log("  BUILDING MIGRATION INVENTORY");
    console.log("══════════════════════════════════════════════════════════");

    // Already populated by deepDive — just report
    console.log(`\n  Employees found: ${audit.peopleSummary.employeeCount}`);
    console.log(`  Users found:     ${audit.peopleSummary.userCount}`);

    // ── 4. Write outputs ───────────────────────────────────────────────────
    const jsonPath = join(ARTIFACTS, "migration-audit.json");
    writeFileSync(jsonPath, JSON.stringify(audit, null, 2), "utf8");
    console.log(`\n✅ Written: ${jsonPath}`);

    const md = buildMarkdown(audit);
    const mdPath = join(ARTIFACTS, "migration-summary.md");
    writeFileSync(mdPath, md, "utf8");
    console.log(`✅ Written: ${mdPath}`);

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║  AUDIT COMPLETE — AWAITING APPROVAL BEFORE MIGRATION    ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

  } catch (err) {
    console.error("\n❌ Fatal error:", err.message);
    if (err.code) console.error("   Code:", err.code);
    // Still write whatever we collected
    try {
      writeFileSync(join(ARTIFACTS, "migration-audit.json"), JSON.stringify({ error: err.message, partial: audit }, null, 2));
    } catch (_) {}
  } finally {
    await client.close();
  }
}

// ── Deep-dive a single collection ─────────────────────────────────────────
async function deepDive(col, colName, dbName, audit) {
  const lower = colName.toLowerCase();
  const isEmployee = lower.includes("employee") || lower.includes("staff") || lower.includes("member");
  const isUser = lower.includes("user") || lower.includes("auth") || lower.includes("account") || lower.includes("login");

  // Pull all docs (capped at 2000 for safety)
  let docs = [];
  try {
    docs = await col.find({}).limit(2000).toArray();
  } catch (e) {
    console.warn(`    Could not read ${colName}:`, e.message);
    return;
  }

  if (isEmployee || (!isUser && docs.length > 0 && hasEmployeeShape(docs[0]))) {
    audit.peopleSummary.employeeCount += docs.length;
    processEmployees(docs, audit);
  }

  if (isUser || (!isEmployee && docs.length > 0 && hasUserShape(docs[0]))) {
    audit.peopleSummary.userCount += docs.length;
    processUsers(docs, audit);
  }
}

function hasEmployeeShape(doc) {
  if (!doc) return false;
  const keys = Object.keys(doc).map((k) => k.toLowerCase());
  return (
    keys.includes("name") &&
    (keys.includes("role") || keys.includes("designation") || keys.includes("position")) &&
    (keys.includes("managerid") || keys.includes("manager") || keys.includes("hubid") || keys.includes("team") || keys.includes("zone"))
  );
}

function hasUserShape(doc) {
  if (!doc) return false;
  const keys = Object.keys(doc).map((k) => k.toLowerCase());
  return keys.includes("email") && (keys.includes("role") || keys.includes("password") || keys.includes("passwordhash"));
}

function processEmployees(docs, audit) {
  const ps = audit.peopleSummary;

  for (const doc of docs) {
    // Role breakdown
    const role = doc.role ?? doc.designation ?? doc.position ?? "unknown";
    ps.roleBreakdown[role] = (ps.roleBreakdown[role] ?? 0) + 1;

    // App role
    const appRole = doc.profile?.appRole ?? doc.appRole ?? doc.accessRole ?? "unknown";
    ps.appRoleBreakdown[appRole] = (ps.appRoleBreakdown[appRole] ?? 0) + 1;

    // Status
    const status = doc.profile?.status ?? doc.status ?? "unknown";
    ps.statusBreakdown[status] = (ps.statusBreakdown[status] ?? 0) + 1;

    // Zone
    const zone = doc.profile?.zone ?? doc.zone ?? doc.hubId ?? "unknown";
    ps.zoneBreakdown[zone] = (ps.zoneBreakdown[zone] ?? 0) + 1;

    // Team
    const team = doc.profile?.team ?? doc.team ?? doc.hubId ?? doc.squad ?? "unknown";
    ps.teamBreakdown[team] = (ps.teamBreakdown[team] ?? 0) + 1;

    // Hierarchy
    const managerId = doc.managerId ?? doc.profile?.managerId ?? doc.reportsTo ?? null;
    if (!managerId) {
      ps.topLevelEmployees.push({
        id: doc.id ?? String(doc._id),
        name: doc.name ?? "unknown",
        role,
      });
    }

    // Migration inventory row
    audit.migrationInventory.push({
      employeeId: doc.id ?? String(doc._id),
      name: doc.name ?? null,
      email: doc.email ?? doc.profile?.email ?? null,
      operationalRole: role,
      appRole,
      managerId,
      zone: doc.profile?.zone ?? doc.zone ?? doc.hubId ?? null,
      team: doc.profile?.team ?? doc.team ?? doc.hubId ?? doc.squad ?? null,
      status: doc.profile?.status ?? doc.status ?? null,
      // Extra fields for reference
      title: doc.title ?? null,
      hubId: doc.hubId ?? null,
      _source: "employees",
    });
  }

  // Build manager → reports map
  const byManager = {};
  for (const doc of docs) {
    const managerId = doc.managerId ?? doc.profile?.managerId ?? doc.reportsTo ?? null;
    if (managerId) {
      if (!byManager[managerId]) byManager[managerId] = [];
      byManager[managerId].push({
        id: doc.id ?? String(doc._id),
        name: doc.name ?? "unknown",
        role: doc.role ?? "unknown",
      });
    }
  }

  // Resolve manager names
  const idToName = {};
  for (const doc of docs) {
    idToName[doc.id ?? String(doc._id)] = doc.name ?? "unknown";
  }

  for (const [mgId, reports] of Object.entries(byManager)) {
    ps.managerHierarchy.push({
      managerId: mgId,
      managerName: idToName[mgId] ?? mgId,
      directReports: reports,
    });
  }
}

function processUsers(docs, audit) {
  const ps = audit.peopleSummary;
  for (const doc of docs) {
    const role = doc.role ?? "unknown";
    // Merge into roleBreakdown only if not already counted from employees
    // Use a separate userRoleBreakdown key to avoid double-counting
    if (!ps.userRoleBreakdown) ps.userRoleBreakdown = {};
    ps.userRoleBreakdown[role] = (ps.userRoleBreakdown[role] ?? 0) + 1;

    // Enrich existing inventory rows with email/auth data where employeeId matches
    const empId = doc.employeeId ?? doc.employee_id ?? null;
    if (empId) {
      const row = audit.migrationInventory.find((r) => r.employeeId === empId);
      if (row) {
        row.email = row.email ?? doc.email;
        row.authRole = doc.role;
        row.isApproved = doc.isApproved;
        row.isSuspended = doc.isSuspended;
        row.accountStatus = doc.status;
      }
    }
  }
}

// ── Markdown report builder ────────────────────────────────────────────────
function buildMarkdown(audit) {
  const ps = audit.peopleSummary;
  const lines = [];

  lines.push("# Legacy Atlas Migration Audit");
  lines.push(`\n**Generated:** ${audit.generatedAt}`);
  lines.push(`**Source cluster:** \`${audit.legacyCluster}\``);
  lines.push(`**Status:** READ-ONLY investigation — no data modified`);
  lines.push(`\n> ⚠️ Awaiting approval before any migration is performed.\n`);

  // Databases
  lines.push("## Databases & Collections\n");
  for (const db of audit.databases) {
    lines.push(`### 📦 ${db.name}\n`);
    lines.push("| Collection | Docs | People? | Sample Keys |");
    lines.push("|---|---|---|---|");
    for (const c of db.collections) {
      lines.push(
        `| \`${c.name}\` | ${c.documentCount} | ${c.likelyPeopleCollection ? "⭐ Yes" : "No"} | ${c.sampleKeys.slice(0, 6).join(", ")} |`
      );
    }
    lines.push("");
  }

  // Summary counts
  lines.push("## Summary Counts\n");
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Total employees | ${ps.employeeCount} |`);
  lines.push(`| Total users (auth) | ${ps.userCount} |`);
  lines.push(`| Top-level (no manager) | ${ps.topLevelEmployees.length} |`);
  lines.push("");

  // Role breakdown
  lines.push("## Operational Role Breakdown\n");
  lines.push("| Role | Count |");
  lines.push("|---|---|");
  for (const [role, count] of Object.entries(ps.roleBreakdown).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${role} | ${count} |`);
  }
  lines.push("");

  // App role breakdown
  lines.push("## App Role Breakdown\n");
  lines.push("| App Role | Count |");
  lines.push("|---|---|");
  for (const [role, count] of Object.entries(ps.appRoleBreakdown).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${role} | ${count} |`);
  }
  lines.push("");

  // User auth role breakdown
  if (ps.userRoleBreakdown) {
    lines.push("## Auth Role Breakdown (users collection)\n");
    lines.push("| Auth Role | Count |");
    lines.push("|---|---|");
    for (const [role, count] of Object.entries(ps.userRoleBreakdown).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${role} | ${count} |`);
    }
    lines.push("");
  }

  // Zone breakdown
  lines.push("## Zone Breakdown\n");
  lines.push("| Zone | Count |");
  lines.push("|---|---|");
  for (const [zone, count] of Object.entries(ps.zoneBreakdown).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${zone} | ${count} |`);
  }
  lines.push("");

  // Team breakdown
  lines.push("## Team / Hub Breakdown\n");
  lines.push("| Team | Count |");
  lines.push("|---|---|");
  for (const [team, count] of Object.entries(ps.teamBreakdown).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${team} | ${count} |`);
  }
  lines.push("");

  // Hierarchy
  lines.push("## Reporting Hierarchy\n");
  lines.push("### Top-level employees (no manager)\n");
  lines.push("| ID | Name | Role |");
  lines.push("|---|---|---|");
  for (const e of ps.topLevelEmployees) {
    lines.push(`| ${e.id} | ${e.name} | ${e.role} |`);
  }
  lines.push("");

  lines.push("### Manager → Direct Reports\n");
  for (const mgr of ps.managerHierarchy.sort((a, b) => b.directReports.length - a.directReports.length)) {
    lines.push(`**${mgr.managerName}** (\`${mgr.managerId}\`) — ${mgr.directReports.length} direct report(s)\n`);
    for (const r of mgr.directReports) {
      lines.push(`- ${r.name} [${r.role}] \`${r.id}\``);
    }
    lines.push("");
  }

  // Migration inventory
  lines.push("## Migration Inventory\n");
  lines.push(
    "| # | Employee ID | Name | Email | Op. Role | App Role | Manager ID | Zone | Team | Status |"
  );
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  audit.migrationInventory.forEach((row, i) => {
    lines.push(
      `| ${i + 1} | \`${row.employeeId ?? ""}\` | ${row.name ?? ""} | ${row.email ?? ""} | ${row.operationalRole ?? ""} | ${row.appRole ?? ""} | \`${row.managerId ?? ""}\` | ${row.zone ?? ""} | ${row.team ?? ""} | ${row.status ?? ""} |`
    );
  });
  lines.push("");

  lines.push("---");
  lines.push("\n> **Next step:** Review this report and provide approval before any migration is executed.");
  lines.push("> No data has been written, modified, or deleted in any database.");

  return lines.join("\n");
}

main();
