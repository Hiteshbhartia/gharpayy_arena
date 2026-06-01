// DB-first boot: seed demo org into MongoDB, then hydrate all stores from API.
import { api, apiEnabled, getCachedUser, getToken } from "./api-client";
import { buildDemoPayload } from "@/data/demo-payload";
import { fetchEmployeeRoster } from "./employees-api";
import { hydrateTasks } from "./task-store";
import { hydrateLeaves } from "./leave-store";
import { hydrateKudos } from "./kudos-store";
import { hydrateCalendar } from "./calendar-store";
import { hydrateConsole } from "./console-store";
import { hydrateFly } from "./fly-store";
import { hydrateAttendance } from "./attendance-store";
import { hydratePulse } from "./pulse-store";
import { hydrateNotifications } from "./notification-store";
import { hydrateOneOnOnes } from "./oneonone-store";
import { hydrateRecruiting } from "./recruiting-store";
import { tierOf } from "./permissions";
import type { Employee } from "@/types/hr";
import type { ApiUser } from "./api-client";

let syncStarted = false;
let syncPromise: Promise<Employee[]> | null = null;

export type SyncArenaResult = {
  employees: Employee[];
};

/**
 * Seed Mongo + hydrate all module stores. Returns fresh employee roster.
 * Safe to call multiple times; only one run in flight.
 */
export async function syncArenaData(user?: ApiUser | null): Promise<SyncArenaResult> {
  if (typeof window === "undefined") return { employees: [] };
  if (!apiEnabled || !getToken()) return { employees: [] };

  if (syncPromise) {
    const employees = await syncPromise;
    return { employees };
  }

  syncStarted = true;
  const u = user ?? getCachedUser();

  syncPromise = (async () => {
    if (import.meta.env.DEV) {
      try {
        await api.post("/migrate/seed-demo-data", buildDemoPayload());
      } catch (err) {
        console.warn("[sync] demo seed failed (continuing with hydrate):", err);
      }

      try {
        await api.post("/migrate/seed-test-accounts");
      } catch (err) {
        console.warn("[sync] test accounts seed failed (continuing):", err);
      }
    } else {
      console.debug("[sync] Skipping auto-seed in production mode.");
    }

    let employees: Employee[] = [];
    if (u) {
      employees = await fetchEmployeeRoster(u);
    }

    // Determine if the current user has recruiting access (leadership, hr, or recruiter tier)
    const me = u?.employeeId ? employees.find((e) => e.id === u.employeeId) : null;
    const tier = me ? tierOf(me) : (u?.role === "admin" ? "leadership" : "teammate");
    const hasRecruiting = ["leadership", "hr", "recruiter"].includes(tier);

    await Promise.all([
      hydrateTasks(),
      hydrateLeaves(),
      hydrateKudos(),
      hydrateCalendar(),
      hydrateConsole(),
      hydrateFly(),
      hydrateAttendance(),
      hydratePulse(),
      hydrateNotifications(),
      hydrateOneOnOnes(),
      hasRecruiting ? hydrateRecruiting() : Promise.resolve(false),
    ]);

    return employees;
  })();

  try {
    const employees = await syncPromise;
    return { employees };
  } finally {
    syncPromise = null;
  }
}

export function resetSyncArenaData() {
  syncStarted = false;
  syncPromise = null;
}
