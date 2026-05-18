import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "./async-handler.js";

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

  router.post(
    "/bulk-upsert",
    asyncHandler(async (req, res) => {
      const items = req.body?.items;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items array required" });
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

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const filter = {};
      for (const f of filterFields) {
        if (req.query[f]) filter[f] = req.query[f];
      }
      const limit = Math.min(Number(req.query.limit) || 1000, 5000);
      const docs = await Model.find(filter).sort(sort).limit(limit).lean();
      res.json({ items: docs });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const doc = await Model.findOne({ id: req.params.id }).lean();
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json({ item: doc });
    }),
  );

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
      try {
        const doc = await Model.create(payload);
        res.status(201).json({ item: doc.toObject() });
      } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "Duplicate id" });
        throw err;
      }
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const doc = await Model.findOneAndUpdate(
        { id: req.params.id },
        { $set: req.body },
        { new: true },
      ).lean();
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json({ item: doc });
    }),
  );

  if (allowDelete) {
    router.delete(
      "/:id",
      asyncHandler(async (req, res) => {
        const r = await Model.deleteOne({ id: req.params.id });
        if (r.deletedCount === 0) return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
      }),
    );
  }

  return router;
}
