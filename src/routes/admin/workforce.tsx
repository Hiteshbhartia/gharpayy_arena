import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Loader2,
  Search,
  UserPlus,
  ShieldCheck,
  MoreHorizontal,
  KeyRound,
  Ban,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/AdminGate";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABEL } from "@/lib/permissions";
import {
  OPERATIONAL_ROLES,
  approveUser,
  fetchWorkforce,
  inviteEmployee,
  patchEmployeeOrg,
  reactivateUser,
  rejectUser,
  resetUserPassword,
  suspendUser,
  type WorkforceRow,
} from "@/lib/workforce-api";
import { ZONES } from "@/data/zones";
import type { AppRole, Role } from "@/types/hr";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/admin/workforce")({
  component: () => (
    <AdminGate>
      <WorkforcePage />
    </AdminGate>
  ),
});

const APP_ROLES: AppRole[] = ["admin", "manager", "employee"];
const EXPERIENCE = ["New", "Mid", "Core"] as const;

const STATUS_TONE: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  suspended: "bg-destructive/10 text-destructive border-destructive/30",
  pending: "bg-warning/10 text-warning border-warning/30",
  no_account: "bg-muted text-muted-foreground border-border",
};

function WorkforcePage() {
  const { refreshOrgData } = useAuth();
  const [rows, setRows] = useState<WorkforceRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editRow, setEditRow] = useState<WorkforceRow | null>(null);
  const [approveRow, setApproveRow] = useState<WorkforceRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWorkforce();
      setRows(res.items);
      setMeta(res.meta);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load workforce");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const teams = useMemo(() => {
    const set = new Set(rows.map((r) => r.team).filter(Boolean));
    ["HQ", "Bandra Hub", "Andheri Hub", "Powai Hub"].forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [rows]);

  const managers = useMemo(
    () =>
      rows.filter(
        (r) =>
          ["Admin", "Zone Leader", "Floor Lead", "Coach", "HR"].includes(r.operationalRole) ||
          r.appRole === "admin" ||
          r.appRole === "manager",
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStatus !== "all" && r.accountStatus !== filterStatus) return false;
      if (!needle) return true;
      const hay = [
        r.name,
        r.operationalRole,
        r.appRole,
        r.team,
        r.zone,
        r.user?.email,
        r.managerName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, filterStatus]);

  const afterMutation = async () => {
    await load();
    await refreshOrgData();
  };

  const runAction = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      await afterMutation();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1500px] mx-auto">
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Organizational Access
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
            Workforce Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Operational roles, app access, zones, squads, and reporting hierarchy — without
            flattening the arena model.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Invite employee
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Workforce" value={meta.total} />
        <Stat label="Pending approval" value={meta.pendingCount} tone="warning" />
        <Stat
          label="Active accounts"
          value={rows.filter((r) => r.accountStatus === "active").length}
          tone="success"
        />
        <Stat
          label="Suspended"
          value={rows.filter((r) => r.accountStatus === "suspended").length}
          tone="destructive"
        />
      </section>

      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-4">
        <div className="p-3 md:p-4 flex flex-col md:flex-row gap-3 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, role, zone, team, email…"
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Account status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="no_account">No account</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Operational</th>
              <th className="px-4 py-3">App access</th>
              <th className="px-4 py-3">Zone / Squad</th>
              <th className="px-4 py-3">Reports to</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((row) => (
              <tr key={row.employeeId} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar id={row.employeeId} name={row.name} size={32} />
                    <div>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.experience} · {row.shift}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="font-normal">
                    {row.operationalRole}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`font-normal ${roleTone(row.appRole)}`}>
                    {ROLE_LABEL[row.appRole]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{row.zone}</div>
                  <div className="text-xs">{row.team}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.managerName ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {row.user?.email ?? row.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STATUS_TONE[row.accountStatus]}`}
                  >
                    {row.accountStatus.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    row={row}
                    busy={busy}
                    onEdit={() => setEditRow(row)}
                    onApprove={(r) => setApproveRow(r)}
                    onConfirm={setConfirm}
                    runAction={runAction}
                    onPassword={(pw) => setTempPassword(pw)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No matches.</div>
        )}
      </div>

      {editRow && (
        <EditEmployeeDialog
          row={editRow}
          teams={teams}
          managers={managers}
          open={!!editRow}
          onOpenChange={(o) => !o && setEditRow(null)}
          busy={busy}
          mode="edit"
          onSave={async (patch) => {
            setBusy(true);
            try {
              await patchEmployeeOrg(editRow.employeeId, patch);
              toast.success("Organization updated");
              setEditRow(null);
              await afterMutation();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Update failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {approveRow && (
        <EditEmployeeDialog
          row={approveRow}
          teams={teams}
          managers={managers}
          open={!!approveRow}
          onOpenChange={(o) => !o && setApproveRow(null)}
          busy={busy}
          mode="approve"
          onSave={async (patch) => {
            setBusy(true);
            try {
              if (approveRow.user?.id) {
                await approveUser(approveRow.user.id, patch);
                toast.success("User approved and activated");
              }
              setApproveRow(null);
              await afterMutation();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Approval failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        teams={teams}
        managers={managers}
        busy={busy}
        onSubmit={async (data) => {
          setBusy(true);
          try {
            const res = await inviteEmployee(data);
            setInviteOpen(false);
            setTempPassword(res.temporaryPassword);
            toast.success(`Invited ${data.name}`);
            await afterMutation();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Invite failed");
          } finally {
            setBusy(false);
          }
        }}
      />

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => confirm && void runAction(confirm.action, "Done")}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tempPassword} onOpenChange={(o) => !o && setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Share securely with the employee. They should change it after first login.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 font-mono text-center text-lg select-all">
            {tempPassword}
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "success" | "destructive";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/30"
      : tone === "success"
        ? "border-success/30"
        : tone === "destructive"
          ? "border-destructive/30"
          : "";
  return (
    <div className={`rounded-2xl border bg-card p-4 ${toneClass}`}>
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function roleTone(appRole: AppRole) {
  if (appRole === "admin") return "border-destructive/30 text-destructive";
  if (appRole === "manager") return "border-primary/30 text-primary";
  return "border-info/30 text-info";
}

function RowActions({
  row,
  busy,
  onEdit,
  onApprove,
  onConfirm,
  runAction,
  onPassword,
}: {
  row: WorkforceRow;
  busy: boolean;
  onEdit: () => void;
  onApprove: (row: WorkforceRow) => void;
  onConfirm: (c: { title: string; description: string; action: () => Promise<void> }) => void;
  runAction: (fn: () => Promise<void>, msg: string) => Promise<void>;
  onPassword: (pw: string) => void;
}) {
  const uid = row.user?.id;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit org & access</DropdownMenuItem>
        {uid && (
          <>
            <DropdownMenuSeparator />
            {row.accountStatus === "pending" && (
              <DropdownMenuItem onClick={() => onApprove(row)}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Approve & Configure
              </DropdownMenuItem>
            )}
            {row.user?.isApproved && row.accountStatus !== "suspended" && (
              <DropdownMenuItem
                onClick={() =>
                  onConfirm({
                    title: "Reject access?",
                    description: `Revoke approval for ${row.name}. They cannot sign in until re-approved.`,
                    action: () => rejectUser(uid).then(() => {}),
                  })
                }
              >
                <XCircle className="h-4 w-4 mr-2" /> Reject approval
              </DropdownMenuItem>
            )}
            {row.accountStatus === "suspended" ? (
              <DropdownMenuItem
                onClick={() =>
                  void runAction(() => reactivateUser(uid).then(() => {}), "Account reactivated")
                }
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Reactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() =>
                  onConfirm({
                    title: "Suspend account?",
                    description: `Block ${row.name} from signing in. Operational data is preserved.`,
                    action: () => suspendUser(uid).then(() => {}),
                  })
                }
              >
                <Ban className="h-4 w-4 mr-2" /> Suspend
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                onConfirm({
                  title: "Reset password?",
                  description: `Generate a new temporary password for ${row.user?.email}.`,
                  action: async () => {
                    const res = await resetUserPassword(uid);
                    onPassword(res.temporaryPassword);
                  },
                })
              }
            >
              <KeyRound className="h-4 w-4 mr-2" /> Reset password
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditEmployeeDialog({
  row,
  teams,
  managers,
  open,
  onOpenChange,
  busy,
  mode = "edit",
  onSave,
}: {
  row: WorkforceRow;
  teams: string[];
  managers: WorkforceRow[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  mode?: "edit" | "approve";
  onSave: (patch: {
    operationalRole: Role;
    appRole: AppRole;
    team: string;
    zone: string;
    managerId: string | null;
    experience: "New" | "Mid" | "Core";
    shift: string;
  }) => Promise<void>;
}) {
  const [operationalRole, setOperationalRole] = useState<Role>(row.operationalRole);
  const [appRole, setAppRole] = useState<AppRole>(row.appRole);
  const [team, setTeam] = useState(row.team);
  const [zone, setZone] = useState(row.zone);
  const [managerId, setManagerId] = useState(row.managerId ?? "none");
  const [experience, setExperience] = useState(row.experience);
  const [shift, setShift] = useState(row.shift);

  const isTopLevel = ["Admin", "Zone Leader", "Owner", "HR"].includes(operationalRole);
  const isValid = Boolean(
    operationalRole &&
    appRole &&
    team &&
    zone &&
    experience &&
    shift &&
    (isTopLevel || managerId !== "none"),
  );
  const disableSave = busy || (mode === "approve" && !isValid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {row.name}
          </DialogTitle>
          <DialogDescription>
            Update operational role, app access, zone, squad, and reporting line.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Operational role">
            <Select value={operationalRole} onValueChange={(v) => setOperationalRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONAL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="App access role">
            <Select value={appRole} onValueChange={(v) => setAppRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zone">
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => (
                    <SelectItem key={z.id} value={z.name}>
                      {z.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="All">All</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Team / squad">
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Reporting manager">
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {managers
                  .filter((m) => m.employeeId !== row.employeeId)
                  .map((m) => (
                    <SelectItem key={m.employeeId} value={m.employeeId}>
                      {m.name} · {m.operationalRole}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Experience">
              <Select
                value={experience}
                onValueChange={(v) => setExperience(v as typeof experience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Shift">
              <Input value={shift} onChange={(e) => setShift(e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={disableSave}
            onClick={() =>
              void onSave({
                operationalRole,
                appRole,
                team,
                zone,
                managerId: managerId === "none" ? null : managerId,
                experience,
                shift,
              })
            }
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "approve" ? (
              "Approve & Activate"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  teams,
  managers,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teams: string[];
  managers: WorkforceRow[];
  busy: boolean;
  onSubmit: (data: {
    name: string;
    email: string;
    operationalRole: Role;
    appRole: AppRole;
    team: string;
    zone: string;
    managerId?: string | null;
    experience: "New" | "Mid" | "Core";
    shift: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [operationalRole, setOperationalRole] = useState<Role>("Operator");
  const [appRole, setAppRole] = useState<AppRole>("employee");
  const [team, setTeam] = useState(teams[0] ?? "HQ");
  const [zone, setZone] = useState("All");
  const [managerId, setManagerId] = useState("none");

  const reset = () => {
    setName("");
    setEmail("");
    setOperationalRole("Operator");
    setAppRole("employee");
    setTeam(teams[0] ?? "HQ");
    setZone("All");
    setManagerId("none");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite employee</DialogTitle>
          <DialogDescription>
            Creates employee profile + auth account with an auto-generated onboarding password.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Work email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Operational role">
            <Select value={operationalRole} onValueChange={(v) => setOperationalRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONAL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="App access role">
            <Select value={appRole} onValueChange={(v) => setAppRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zone">
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => (
                    <SelectItem key={z.id} value={z.name}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Team / squad">
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Reporting manager">
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.employeeId} value={m.employeeId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !name.trim() || !email.trim()}
            onClick={() =>
              void onSubmit({
                name: name.trim(),
                email: email.trim(),
                operationalRole,
                appRole,
                team,
                zone,
                managerId: managerId === "none" ? null : managerId,
                experience: "Mid",
                shift: "10:00 - 19:00",
              })
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
