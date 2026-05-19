import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Activity,
  Flame,
  Clock4,
  ClipboardList,
  Calendar,
  CheckSquare,
  Trophy,
  Heart,
  Inbox,
  PlaneTakeoff,
  Bell,
  Search,
  Sparkles,
  Award,
  Settings,
  ShieldCheck,
  Menu,
  X,
  MessageSquareText,
  UserPlus,
  UserCog,
  Zap,
  Shield,
  Map as MapIcon,
  Building2,
  Wallet,
  Radio,
  LogOut,
  Target,
} from "lucide-react";
import { playbookFor } from "@/data/playbooks";
import { shieldNow } from "@/lib/console-store";
import { useAttendanceState } from "@/hooks/useAttendance";
import { liveStatusFor } from "@/lib/attendance-store";
import { unreadCount } from "@/lib/notification-store";
import { bootArena } from "@/lib/seed-init";
import { can, tierOf, TIER_LABEL, type Tier } from "@/lib/permissions";
import { NotificationDropdown } from "./NotificationDropdown";
import { CalendarPeek } from "./CalendarPeek";
import { CommandPalette } from "./CommandPalette";
import { GiveKudoModal } from "./GiveKudoModal";
import { Avatar } from "./Avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  tiers: Tier[];
  /** Requires platform admin auth + manage_users capability */
  adminOnly?: boolean;
};

const ALL: Tier[] = [
  "leadership",
  "zone_leader",
  "hr",
  "leader",
  "recruiter",
  "teammate",
  "partner",
];
const INTERNAL: Tier[] = ["leadership", "zone_leader", "hr", "leader", "recruiter", "teammate"];

const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard, tiers: ALL },
  // Partner-only surface
  { to: "/partner", label: "My Properties", icon: Building2, tiers: ["partner"] },
  // Internal staff
  { to: "/pulse", label: "Daily Pulse", icon: Radio, tiers: INTERNAL },
  { to: "/fly", label: "Fly Board", icon: PlaneTakeoff, tiers: INTERNAL },
  { to: "/zones", label: "Zones", icon: MapIcon, tiers: ["leadership", "zone_leader", "hr"] },
  {
    to: "/console",
    label: "Operator Console",
    icon: Zap,
    tiers: ["leadership", "zone_leader", "hr", "leader", "recruiter"],
  },
  { to: "/score", label: "My Score", icon: Trophy, tiers: INTERNAL },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, tiers: INTERNAL },
  { to: "/achievements", label: "Achievements", icon: Award, tiers: INTERNAL },
  { to: "/calendar", label: "Calendar", icon: Calendar, tiers: INTERNAL },
  { to: "/leaves", label: "Leaves", icon: PlaneTakeoff, tiers: INTERNAL },
  { to: "/kudos", label: "Kudos", icon: Heart, tiers: INTERNAL },
  { to: "/inbox", label: "Inbox", icon: Inbox, tiers: ALL },
  { to: "/attendance", label: "Attendance", icon: Clock4, tiers: INTERNAL },
  {
    to: "/one-on-ones",
    label: "1:1 Notes",
    icon: MessageSquareText,
    tiers: ["leadership", "zone_leader", "hr", "leader", "recruiter"],
  },
  {
    to: "/people",
    label: "People",
    icon: Users,
    tiers: ["leadership", "zone_leader", "hr", "leader"],
  },
  {
    to: "/roster",
    label: "Live Roster",
    icon: ClipboardList,
    tiers: ["leadership", "zone_leader", "hr", "leader"],
  },
  {
    to: "/war-room",
    label: "War Room",
    icon: Activity,
    tiers: ["leadership", "zone_leader", "leader"],
  },
  {
    to: "/command",
    label: "Coaching",
    icon: MessageSquare,
    tiers: ["leadership", "zone_leader", "hr", "leader"],
  },
  {
    to: "/recruiting",
    label: "Recruiting",
    icon: UserPlus,
    tiers: ["leadership", "hr", "recruiter"],
  },
  { to: "/hrms", label: "HRMS", icon: ShieldCheck, tiers: ["leadership", "hr"] },
  {
    to: "/admin/workforce",
    label: "Workforce",
    icon: UserCog,
    tiers: ["leadership"],
    adminOnly: true,
  },
  {
    to: "/admin/kpis",
    label: "KPI Governance",
    icon: Target,
    tiers: ["leadership", "zone_leader", "hr", "leader"],
  },
];

const MOBILE_NAV_BASE = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/fly", label: "Fly", icon: PlaneTakeoff },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/inbox", label: "Inbox", icon: Bell },
  { to: "/hrms", label: "More", icon: Menu },
];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { actor } = useAttendanceState();
  const { user, logout } = useAuth();
  const hasPlaybook = !!playbookFor(actor.id);
  const shield = hasPlaybook ? shieldNow(actor.id) : { active: false, label: "" };
  const status = liveStatusFor(actor.id);
  const [bellOpen, setBellOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [kudoOpen, setKudoOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unread = unreadCount(actor.id);
  const tier = tierOf(actor);
  const visibleNav = NAV.filter((n) => {
    if (!n.tiers.includes(tier)) return false;
    if (n.adminOnly && (user?.role !== "admin" || !can(actor.appRole, "manage_users"))) {
      return false;
    }
    return true;
  });
  const mobileNav =
    tier === "partner"
      ? [
          MOBILE_NAV_BASE[0],
          { to: "/partner", label: "Properties", icon: Building2 },
          { to: "/partner", label: "Payouts", icon: Wallet },
          MOBILE_NAV_BASE[3],
          MOBILE_NAV_BASE[4],
        ]
      : tier === "zone_leader"
        ? [
            MOBILE_NAV_BASE[0],
            { to: "/zones", label: "Zone", icon: MapIcon },
            { to: "/fly", label: "Fly", icon: PlaneTakeoff },
            MOBILE_NAV_BASE[3],
            MOBILE_NAV_BASE[4],
          ]
        : tier === "leadership" || tier === "leader"
          ? [
              MOBILE_NAV_BASE[0],
              MOBILE_NAV_BASE[1],
              { to: "/war-room", label: "War", icon: Activity },
              MOBILE_NAV_BASE[3],
              MOBILE_NAV_BASE[4],
            ]
          : tier === "hr"
            ? [
                MOBILE_NAV_BASE[0],
                { to: "/people", label: "People", icon: Users },
                { to: "/recruiting", label: "Hiring", icon: UserPlus },
                MOBILE_NAV_BASE[3],
                MOBILE_NAV_BASE[4],
              ]
            : tier === "recruiter"
              ? [
                  MOBILE_NAV_BASE[0],
                  { to: "/recruiting", label: "Pipeline", icon: UserPlus },
                  { to: "/one-on-ones", label: "1:1s", icon: MessageSquareText },
                  MOBILE_NAV_BASE[3],
                  MOBILE_NAV_BASE[4],
                ]
              : MOBILE_NAV_BASE;

  useEffect(() => {
    bootArena();
  }, []);
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusDot =
    status === "Clocked In"
      ? "bg-success"
      : status === "On Break"
        ? "bg-warning"
        : status === "In Field"
          ? "bg-primary"
          : "bg-muted-foreground/40";

  const Sidebar = (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full">
      <div className="px-5 py-4 border-b border-sidebar-border flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/" })}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Flame className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold text-white text-sm tracking-[0.18em]">
              GHARPAYY
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/70">
              Core Arena · v2026
            </div>
          </div>
        </button>
        <button
          onClick={() => setDrawerOpen(false)}
          className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded text-sidebar-foreground/70 hover:bg-sidebar-hover/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 py-3 border-b border-sidebar-border">
        <div className="text-[10px] uppercase tracking-widest font-mono text-sidebar-foreground/60 mb-1.5 px-1">
          Signed in
        </div>
        <div className="px-1">
          <div className="text-sm font-medium text-white truncate">{actor.name}</div>
          <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 font-mono truncate">
            {actor.role} · {actor.team}
          </div>
          {user?.email && (
            <div className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5">
              {user.email}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 mt-1 -ml-1 px-2 py-0 gap-1.5 text-[11px] font-medium text-sidebar-foreground/90 hover:bg-sidebar-hover hover:text-white [&_svg]:size-3.5"
            onClick={() => {
              logout();
              navigate({ to: "/login", replace: true });
              setDrawerOpen(false);
            }}
          >
            <LogOut className="shrink-0" />
            Sign out
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2 px-1 text-[10px] text-sidebar-foreground/70">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          <span className="font-mono uppercase tracking-widest">{status}</span>
          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded border border-primary/30 bg-primary/15 text-primary font-mono uppercase tracking-widest text-[9px]">
            {TIER_LABEL[tier]}
          </span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-hover text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => {
            setKudoOpen(true);
            setDrawerOpen(false);
          }}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary-foreground/90 text-xs font-medium py-2 rounded-md border border-primary/30"
        >
          <Award className="h-3.5 w-3.5" /> Give a kudo
        </button>
        <div className="flex items-center gap-2 px-2 py-2 mt-2 text-[10px] text-sidebar-foreground/60">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="font-mono uppercase tracking-widest">Gharpayy workspace</span>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{Sidebar}</div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-sidebar/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full max-w-[80vw] w-72 animate-in slide-in-from-left duration-200">
            {Sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md flex items-center px-3 md:px-6 gap-2 md:gap-4 sticky top-0 z-40">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex-1 max-w-md inline-flex items-center gap-2 h-9 px-3 rounded-md bg-secondary/80 border border-border text-sm text-muted-foreground hover:border-primary/40 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Search…</span>
            <kbd className="ml-auto hidden md:inline text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border border-border">
              ⌘K
            </kbd>
          </button>
          {shield.active && (
            <Link
              to="/console"
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/15 border border-primary/30 text-primary text-xs font-mono uppercase tracking-widest hover:bg-primary/25"
              title={shield.label}
            >
              <Shield className="h-3.5 w-3.5" /> Shield Mode
            </Link>
          )}
          <div className="ml-auto flex items-center gap-1 relative">
            <div className="relative hidden sm:block">
              <button
                onClick={() => {
                  setCalOpen((v) => !v);
                  setBellOpen(false);
                }}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
                title="Calendar peek"
              >
                <Calendar className="h-4 w-4" />
              </button>
              <CalendarPeek open={calOpen} onClose={() => setCalOpen(false)} />
            </div>
            <div className="relative">
              <button
                onClick={() => {
                  setBellOpen((v) => !v);
                  setCalOpen(false);
                }}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors relative"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-mono font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              <NotificationDropdown open={bellOpen} onClose={() => setBellOpen(false)} />
            </div>
            <Link
              to="/settings"
              className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <Link
              to="/score"
              className="ml-1 inline-flex items-center gap-2 px-1 sm:px-2 py-1 rounded-md hover:bg-secondary transition-colors"
            >
              <Avatar id={actor.id} size={28} />
              <div className="hidden lg:block">
                <div className="text-xs font-semibold leading-tight">
                  {actor.name.split(" ")[0]}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {actor.role}
                </div>
              </div>
            </Link>
          </div>
        </header>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-card border-t border-border flex">
        {mobileNav.map(({ to, label, icon: Icon }, i) => {
          const isMore = i === mobileNav.length - 1;
          const active = !isMore && location.pathname === to;
          if (isMore) {
            return (
              <button
                key={to}
                onClick={() => setDrawerOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          }
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {to === "/inbox" && unread > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-3.5 min-w-3.5 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-mono font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <GiveKudoModal open={kudoOpen} onClose={() => setKudoOpen(false)} />
    </div>
  );
}
