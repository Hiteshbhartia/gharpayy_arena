import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

// __dirname polyfill for ESM — must be before config()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../.env") });

console.log("[boot] JWT_SECRET loaded:", process.env.JWT_SECRET ? "YES" : "MISSING");

import authRoutes from "./routes/auth.js";
import employeesRoutes from "./routes/employees.js";
import attendanceRoutes from "./routes/attendance.js";
import tasksRoutes from "./routes/tasks.js";
import leavesRoutes from "./routes/leaves.js";
import kudosRoutes from "./routes/kudos.js";
import calendarRoutes from "./routes/calendar.js";
import notificationsRoutes from "./routes/notifications.js";
import oneOnOnesRoutes from "./routes/oneonones.js";
import recruitingRoutes from "./routes/recruiting.js";
import consoleRoutes from "./routes/console.js";
import consoleStateRoutes from "./routes/console-state.js";
import attendanceEventsRoutes from "./routes/attendance-events.js";
import pulseRoutes from "./routes/pulse.js";
import flyRoutes from "./routes/fly.js";
import migrateRoutes from "./routes/migrate.js";
import workforceRoutes from "./routes/workforce.js";
import operatorRoutes from "./routes/operator.js";
import kpisRoutes from "./routes/kpis.js";
import permissionsRoutes from "./routes/permissions.js";
import { toHttpError } from "./lib/errors.js";

const app = express();

// --- security & middleware ---
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const origins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // mobile / curl / server-to-server
      if (origins.length === 0) return cb(null, true); // allow all if no list
      if (origins.includes(origin)) return cb(null, true);
      try {
        const url = new URL(origin);
        // Allow any origin on the dev frontend port (8080)
        if (url.port === "8080") return cb(null, true);
      } catch (e) {
        // ignore malformed URLs
      }
      return cb(null, false); // deny
    },
    credentials: true,
  })
);

app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// --- health ---
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    ts: Date.now(),
  }),
);

// --- routes ---
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/leaves", leavesRoutes);
app.use("/api/kudos", kudosRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/one-on-ones", oneOnOnesRoutes);
app.use("/api/recruiting", recruitingRoutes);
app.use("/api/console", consoleRoutes);
app.use("/api/console-state", consoleStateRoutes);
app.use("/api/attendance-events", attendanceEventsRoutes);
app.use("/api/pulse", pulseRoutes);
app.use("/api/fly", flyRoutes);
app.use("/api/migrate", migrateRoutes);
app.use("/api/admin/workforce", workforceRoutes);
app.use("/api/operator", operatorRoutes);
console.log("[routes] operator mounted");
app.use("/api", kpisRoutes);
app.use("/api/permissions", permissionsRoutes);

// --- error handler ---
app.use((err, req, res, _next) => {
  if (res.headersSent) {
    console.error("[api] error after headers sent:", {
      path: req.path,
      method: req.method,
      message: err?.message,
    });
    return;
  }

  const mapped = toHttpError(err);

  // express.json() invalid body
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const status = mapped.status && mapped.status >= 400 && mapped.status < 600 ? mapped.status : 500;
  const body = { error: mapped.message || "Internal error" };
  if (mapped.details) body.details = mapped.details;

  if (status >= 500) {
    console.error("[api] error:", {
      path: req.path,
      method: req.method,
      status,
      message: mapped.message,
      stack: mapped.stack,
    });
  }

  res.status(status).json(body);
});

// --- process-level safety nets ---
process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[api] uncaughtException:", err);
});

// --- boot ---
const PORT = Number(process.env.PORT || 4000);
const MONGO = process.env.MONGODB_URI;

if (!MONGO) {
  console.error("MONGODB_URI missing — set it in .env");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET missing — set it in .env");
  process.exit(1);
}

function startHttpServer() {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[api] listening on :${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[api] port ${PORT} is already in use — stop the other process or change PORT`);
    } else {
      console.error("[api] server listen error:", err);
    }
    process.exit(1);
  });

  return server;
}

import { runWorkforceMigrations } from "./lib/migrations.js";
import { seedKpis } from "./lib/seed-kpis.js";

// Added import for in‑memory DB
import { MongoMemoryServer } from "mongodb-memory-server";

// ... existing code unchanged until connectDb definition ...
let isDbConnected = false;
let memoryServer = null; // hold reference for cleanup

async function connectDb() {
  if (isDbConnected) return;
  try {
    await mongoose.connect(MONGO);
    isDbConnected = true;
    console.log("[api] mongo connected");
    await runWorkforceMigrations();
    try {
      await seedKpis();
    } catch (kpiErr) {
      console.error("[api] kpi seeding failed:", kpiErr);
    }
  } catch (err) {
    console.error("[api] mongo connection failed:", err.message);
    // Development fallback to in‑memory MongoDB
    const allowFallback =
      process.env.NODE_ENV !== "production" &&
      process.env.DISABLE_MONGODB_MEMORY_FALLBACK !== "true";
    if (allowFallback) {
      console.warn("[api] Starting in‑memory MongoDB for development fallback");
      try {
        memoryServer = await MongoMemoryServer.create();
        const uri = memoryServer.getUri();
        process.env.MONGODB_URI = uri;
        await mongoose.connect(uri);
        isDbConnected = true;
        console.log("[api] in‑memory MongoDB connected");
        await runWorkforceMigrations();
        try {
          await seedKpis();
        } catch (kpiErr) {
          console.error("[api] kpi seeding failed (in‑memory):", kpiErr);
        }
      } catch (memErr) {
        console.error("[api] Failed to start in‑memory MongoDB:", memErr);
        // Do not exit – allow server to continue (will fail on DB ops)
      }
    } else {
      // Production or fallback disabled – abort
      console.warn("[api] In‑memory MongoDB fallback disabled or production mode");
      process.exit(1);
    }
  }
  }




// In Vercel, we need to ensure DB is connected before handling requests
app.use(async (req, res, next) => {
  await connectDb();
  next();
});

// Start server if not running in Vercel serverless environment
if (!process.env.VERCEL) {
  connectDb().then(() => {
    startHttpServer();
  });
}

export default app;
