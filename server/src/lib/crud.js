import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "./async-handler.js";
import {
  isAdmin,
  isHR,
  isManager,
  canManageEmployee,
  canAccessEmployeeResource,
  getManagerHierarchyIds,
  logSecurityAudit,
} from "./auth-helpers.js";

/**
 * Builds a generic REST router for a Mongoose model:
 *   GET    /            list (with optional ?employeeId=&date=&limit=)
 *   GET    /:id         get one (by `id` field, not _id)
 *   POST   /            create (auto-fills `id` if missing)
 *   PATCH  /:id         partial update
 *   DELETE /:id         delete
 *
 * `filterFields` whitelist which query params can be used to filter list().
 */
export function crudRouter(
  Model,
  { filterFields = [], sort = { createdAt: -1 }, allowDelete = true } = {},
) {
  const router = Router();
  router.use(requireAuth);

  const modelName = Model.modelName;

  // 1. bulk-upsert protection
  router.post(
    "/bulk-upsert",
    asyncHandler(async (req, res) => {
      // Role-based check: Admins and HR have full bulk-upsert authorization
      const isPrivileged = isAdmin(req.user) || isHR(req.user);
      const items = req.body?.items;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items array required" });
      }

      if (!isPrivileged) {
        const empId = req.user.employeeId;
        const userId = req.user.id;

        if (!empId) {
          logSecurityAudit(req, "BULK_UPSERT_BLOCKED_NO_EMPLOYEE_LINK", { model: modelName });
          return res.status(403).json({ error: "Your account must be linked to an employee profile to record operational data" });
        }

        // Validate that each item belongs to the authenticated user
        for (const item of items) {
          let isOwner = false;
          switch (modelName) {
            case "AttendanceEvent":
            case "PulseEntry":
            case "Leave":
            case "Attendance":
              isOwner = item.employeeId === empId;
              break;
            case "ConsoleState":
              isOwner = item.actorId === empId;
              break;
            case "FlyUpdate":
            case "FlyRetro":
            case "FlyFeed":
              isOwner = item.authorId === empId;
              break;
            case "Task":
              isOwner = item.createdById === userId || item.assigneeId === empId;
              break;
            case "Notification":
              isOwner = item.toId === empId;
              break;
            case "OneOnOne":
              isOwner = item.managerId === empId;
              break;
            default:
              isOwner = false;
          }
          if (!isOwner) {
            logSecurityAudit(req, "BULK_UPSERT_OWNERSHIP_VIOLATION", {
              model: modelName,
              itemId: item.id,
              expectedEmployeeId: empId,
            });
            return res.status(403).json({
              error: `Forbidden: You are not authorized to bulk-upsert records for other users on collection '${modelName}'`,
            });
          }
        }
      }

      // Safe validation before write limit to 1000 items per request
      if (items.length > 1000) {
        return res.status(400).json({ error: "Request payload too large (max 1000 items)" });
      }

      let upserted = 0;
      for (const raw of items) {
        if (!raw?.id) continue;
        await Model.updateOne({ id: raw.id }, { $set: raw }, { upsert: true });
        upserted += 1;
      }
      res.json({ ok: true, upserted });
    }),
  );

  // 2. list retrieval with DB-level ownership/hierarchy query injection
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      // Recruiting pipeline security check
      if (modelName === "Candidate") {
        if (!isAdmin(req.user) && !isHR(req.user) && !isManager(req.user)) {
          logSecurityAudit(req, "RECRUITING_LIST_BLOCKED");
          return res.status(403).json({ error: "Forbidden: Recruiting access restricted to Admin, HR, and Managers" });
        }
      }

      const filter = {};
      for (const f of filterFields) {
        if (req.query[f]) filter[f] = req.query[f];
      }

      // Dynamic database query injection based on roles and resource ownership
      if (!isAdmin(req.user) && !isHR(req.user)) {
        const empId = req.user.employeeId;

        // If the database has no employee linked for this user, fallback safely
        if (!empId) {
          if (["Employee", "OneOnOne", "Leave", "Attendance", "AttendanceEvent", "ConsoleState", "PulseEntry", "Notification", "Kudo"].includes(modelName)) {
            return res.json({ items: [] });
          }
        } else {
          const reportIds = isManager(req.user) ? await getManagerHierarchyIds(empId) : new Set();

          if (modelName === "OneOnOne") {
            // Employees see only where reportId is self. Managers see their direct/indirect reports' 1-1s and their own.
            if (isManager(req.user)) {
              filter.$or = [
                { reportId: empId },
                { managerId: empId },
                { reportId: { $in: Array.from(reportIds) } },
                { managerId: { $in: Array.from(reportIds) } },
              ];
            } else {
              filter.reportId = empId;
            }
          } else if (modelName === "Employee") {
            // Standard employee sees themselves and members of hierarchy
            if (isManager(req.user)) {
              filter.$or = [
                { id: empId },
                { id: { $in: Array.from(reportIds) } },
              ];
            } else {
              filter.id = empId;
            }
          } else if (["Leave", "Attendance", "AttendanceEvent", "PulseEntry"].includes(modelName)) {
            // Restrict views to self or reporting tree for managers
            if (isManager(req.user)) {
              filter.$or = [
                { employeeId: empId },
                { employeeId: { $in: Array.from(reportIds) } },
              ];
            } else {
              filter.employeeId = empId;
            }
          } else if (modelName === "ConsoleState") {
            if (isManager(req.user)) {
              filter.$or = [
                { actorId: empId },
                { actorId: { $in: Array.from(reportIds) } },
              ];
            } else {
              filter.actorId = empId;
            }
          } else if (modelName === "Notification") {
            filter.toId = empId;
          }
        }
      }

      const limit = Math.min(Number(req.query.limit) || 1000, 5000);
      let docs = await Model.find(filter).sort(sort).limit(limit).lean();

      // Field scrubbing server-side before serialization (One-on-One Privacy)
      if (modelName === "OneOnOne") {
        docs = docs.map((doc) => {
          const isUserReport = doc.reportId === req.user.employeeId;
          const userIsManager = doc.managerId === req.user.employeeId;
          // Standard employees or reports must NEVER get privateNotes
          if (isUserReport && !userIsManager && !isAdmin(req.user) && !isHR(req.user)) {
            const { privateNotes, ...cleanDoc } = doc;
            return cleanDoc;
          }
          return doc;
        });
      }

      res.json({ items: docs });
    }),
  );

  // 3. Single Document Reads
  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      // Recruiting pipeline security check
      if (modelName === "Candidate") {
        if (!isAdmin(req.user) && !isHR(req.user) && !isManager(req.user)) {
          logSecurityAudit(req, "RECRUITING_READ_BLOCKED", { id: req.params.id });
          return res.status(403).json({ error: "Forbidden: Recruiting access restricted" });
        }
      }

      const doc = await Model.findOne({ id: req.params.id }).lean();
      if (!doc) return res.status(404).json({ error: "Not found" });

      // Ownership authorization checks
      if (!isAdmin(req.user) && !isHR(req.user)) {
        let employeeId = null;
        if (modelName === "Employee") employeeId = doc.id;
        else if (modelName === "OneOnOne") {
          // Allow both report and manager access
          const isAllowedReport = doc.reportId === req.user.employeeId;
          const isAllowedManager = doc.managerId === req.user.employeeId;
          const managerReports = isManager(req.user) ? await getManagerHierarchyIds(req.user.employeeId) : new Set();
          const inManagerTree = managerReports.has(doc.reportId) || managerReports.has(doc.managerId);

          if (!isAllowedReport && !isAllowedManager && !inManagerTree) {
            logSecurityAudit(req, "DOCUMENT_READ_UNAUTHORIZED", { model: modelName, id: req.params.id });
            return res.status(403).json({ error: "Forbidden: You are not authorized to view this OneOnOne record" });
          }
        } else if (["Leave", "Attendance", "AttendanceEvent", "PulseEntry"].includes(modelName)) {
          employeeId = doc.employeeId;
        } else if (modelName === "ConsoleState") {
          employeeId = doc.actorId;
        } else if (modelName === "Notification") {
          employeeId = doc.toId;
        }

        if (employeeId) {
          const allowed = await canAccessEmployeeResource(req.user, employeeId);
          if (!allowed) {
            logSecurityAudit(req, "DOCUMENT_READ_UNAUTHORIZED", { model: modelName, id: req.params.id });
            return res.status(403).json({ error: "Forbidden: Access to this document is restricted" });
          }
        }
      }

      // Field scrubbing (One-on-One Privacy)
      if (modelName === "OneOnOne") {
        const isUserReport = doc.reportId === req.user.employeeId;
        const userIsManager = doc.managerId === req.user.employeeId;
        if (isUserReport && !userIsManager && !isAdmin(req.user) && !isHR(req.user)) {
          delete doc.privateNotes;
        }
      }

      res.json({ item: doc });
    }),
  );

  // 4. Create Document Reads
  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const payload = { ...req.body };
      if (!payload.id) {
        payload.id =
          globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      if (req.user?.id && !payload.createdById) payload.createdById = req.user.id;

      // Ownership validation logic before inserting
      if (!isAdmin(req.user) && !isHR(req.user)) {
        if (modelName === "Employee") {
          logSecurityAudit(req, "EMPLOYEE_CREATE_BLOCKED");
          return res.status(403).json({ error: "Only Admin or HR can create employees" });
        }

        if (modelName === "Candidate") {
          logSecurityAudit(req, "RECRUITING_CREATE_BLOCKED");
          return res.status(403).json({ error: "Restricted recruiting creation action" });
        }

        let targetEmployeeId = null;
        if (["Leave", "Attendance", "AttendanceEvent", "PulseEntry"].includes(modelName)) {
          targetEmployeeId = payload.employeeId;
        } else if (modelName === "ConsoleState") {
          targetEmployeeId = payload.actorId;
        }

        // Validate: cannot submit records under other employee identities
        if (targetEmployeeId && targetEmployeeId !== req.user.employeeId) {
          logSecurityAudit(req, "DOCUMENT_CREATE_IDENTITY_MISMATCH", { model: modelName, targetEmployeeId });
          return res.status(403).json({ error: "Forbidden: You can only create records under your own employee profile" });
        }

        // Enforce basic constraints on leaves (can only create pending leaves)
        if (modelName === "Leave" && payload.status && payload.status !== "pending") {
          logSecurityAudit(req, "LEAVE_CREATE_UNAUTHORIZED_STATUS", { status: payload.status });
          return res.status(403).json({ error: "Forbidden: Newly applied leaves must start as pending" });
        }
      }

      try {
        const doc = await Model.create(payload);
        res.status(201).json({ item: doc.toObject() });
      } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "Duplicate id" });
        throw err;
      }
    }),
  );

  // 5. Update Documents
  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const existingDoc = await Model.findOne({ id: req.params.id }).lean();
      if (!existingDoc) return res.status(404).json({ error: "Not found" });

      if (!isAdmin(req.user) && !isHR(req.user)) {
        if (modelName === "Employee") {
          logSecurityAudit(req, "EMPLOYEE_UPDATE_BLOCKED", { id: req.params.id });
          return res.status(403).json({ error: "Only Admin or HR can update employee directory profiles" });
        }

        if (modelName === "Candidate") {
          logSecurityAudit(req, "RECRUITING_UPDATE_BLOCKED", { id: req.params.id });
          return res.status(403).json({ error: "Forbidden: Access restricted" });
        }

        // Manager / Employee Resource validations
        let targetEmployeeId = null;
        if (["Leave", "Attendance", "AttendanceEvent", "PulseEntry"].includes(modelName)) {
          targetEmployeeId = existingDoc.employeeId;
        } else if (modelName === "ConsoleState") {
          targetEmployeeId = existingDoc.actorId;
        } else if (modelName === "OneOnOne") {
          // Allow if manager or reports are in manager tree
          const isAllowedReport = existingDoc.reportId === req.user.employeeId;
          const isAllowedManager = existingDoc.managerId === req.user.employeeId;
          const managerReports = isManager(req.user) ? await getManagerHierarchyIds(req.user.employeeId) : new Set();
          const inManagerTree = managerReports.has(existingDoc.reportId) || managerReports.has(existingDoc.managerId);

          if (!isAllowedReport && !isAllowedManager && !inManagerTree) {
            logSecurityAudit(req, "ONEONONE_UPDATE_BLOCKED", { id: req.params.id });
            return res.status(403).json({ error: "Forbidden: You are not authorized to edit this OneOnOne" });
          }
        }

        if (targetEmployeeId) {
          const allowed = await canManageEmployee(req.user, targetEmployeeId);
          if (!allowed) {
            logSecurityAudit(req, "DOCUMENT_UPDATE_UNAUTHORIZED", { model: modelName, id: req.params.id });
            return res.status(403).json({ error: "Forbidden: Access to modify this record is restricted" });
          }
        }

        // Critical status checking for leaves
        if (modelName === "Leave") {
          const isSelf = existingDoc.employeeId === req.user.employeeId;

          // Non-managers/non-HR/non-admins cannot approve their own leaves or others'
          if (req.body.status && req.body.status !== existingDoc.status) {
            if (isSelf) {
              logSecurityAudit(req, "LEAVE_SELF_APPROVAL_BLOCKED", { id: req.params.id, status: req.body.status });
              return res.status(403).json({ error: "Forbidden: You cannot approve or reject your own leave requests" });
            } else if (!isManager(req.user)) {
              logSecurityAudit(req, "LEAVE_APPROVAL_FORBIDDEN_ROLE", { id: req.params.id, status: req.body.status });
              return res.status(403).json({ error: "Forbidden: Insufficient permissions to review leaves" });
            }
          }

          // Employees can only update leaves when status is pending
          if (isSelf && existingDoc.status !== "pending") {
            logSecurityAudit(req, "LEAVE_UPDATE_BLOCKED_NON_PENDING", { id: req.params.id });
            return res.status(403).json({ error: "Forbidden: You can only update pending leave requests" });
          }
        }
      }

      const doc = await Model.findOneAndUpdate(
        { id: req.params.id },
        { $set: req.body },
        { new: true },
      ).lean();

      if (!doc) return res.status(404).json({ error: "Not found" });

      // Clean OneOnOne response updates
      if (modelName === "OneOnOne") {
        const isUserReport = doc.reportId === req.user.employeeId;
        const userIsManager = doc.managerId === req.user.employeeId;
        if (isUserReport && !userIsManager && !isAdmin(req.user) && !isHR(req.user)) {
          delete doc.privateNotes;
        }
      }

      res.json({ item: doc });
    }),
  );

  // 6. Delete Documents
  if (allowDelete) {
    router.delete(
      "/:id",
      asyncHandler(async (req, res) => {
        const existingDoc = await Model.findOne({ id: req.params.id }).lean();
        if (!existingDoc) return res.status(404).json({ error: "Not found" });

        if (!isAdmin(req.user) && !isHR(req.user)) {
          if (modelName === "Employee") {
            logSecurityAudit(req, "EMPLOYEE_DELETE_BLOCKED", { id: req.params.id });
            return res.status(403).json({ error: "Only Admin or HR can remove employee accounts" });
          }

          if (modelName === "Candidate") {
            logSecurityAudit(req, "RECRUITING_DELETE_BLOCKED", { id: req.params.id });
            return res.status(403).json({ error: "Forbidden: Access restricted" });
          }

          let targetEmployeeId = null;
          if (["Leave", "Attendance", "AttendanceEvent", "PulseEntry"].includes(modelName)) {
            targetEmployeeId = existingDoc.employeeId;
          } else if (modelName === "ConsoleState") {
            targetEmployeeId = existingDoc.actorId;
          } else if (modelName === "OneOnOne") {
            targetEmployeeId = existingDoc.managerId;
          }

          if (targetEmployeeId) {
            const allowed = await canManageEmployee(req.user, targetEmployeeId);
            if (!allowed) {
              logSecurityAudit(req, "DOCUMENT_DELETE_UNAUTHORIZED", { model: modelName, id: req.params.id });
              return res.status(403).json({ error: "Forbidden: Access to delete this record is restricted" });
            }
          }

          // Leave constraints: can't delete non-pending leaves
          if (modelName === "Leave" && existingDoc.status !== "pending") {
            logSecurityAudit(req, "LEAVE_DELETE_BLOCKED_NON_PENDING", { id: req.params.id });
            return res.status(403).json({ error: "Forbidden: You can only delete pending leave requests" });
          }
        }

        const r = await Model.deleteOne({ id: req.params.id });
        if (r.deletedCount === 0) return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
      }),
    );
  }

  return router;
}
