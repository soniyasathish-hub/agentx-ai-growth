import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  "Pending Approval": "bg-warning/15 text-warning border-warning/40",
  Approved: "bg-info/15 text-info border-info/40",
  Executed: "bg-success/15 text-success border-success/40",
  Rejected: "bg-muted text-muted-foreground border-border",
  Blocked: "bg-destructive/15 text-destructive border-destructive/45",
};

const LEVEL_STYLES: Record<string, string> = {
  High: "bg-destructive/15 text-destructive border-destructive/40",
  Medium: "bg-warning/15 text-warning border-warning/40",
  Low: "bg-muted text-muted-foreground border-border",
};

const INTENT_STYLES: Record<string, string> = {
  High: "bg-success/15 text-success border-success/40",
  Medium: "bg-warning/15 text-warning border-warning/40",
  Low: "bg-muted text-muted-foreground border-border",
};

function Pill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Pill label={status} className={STATUS_STYLES[status] ?? STATUS_STYLES["Rejected"]} />;
}

export function RiskBadge({ level }: { level: string }) {
  return <Pill label={level} className={LEVEL_STYLES[level] ?? LEVEL_STYLES["Low"]} />;
}

export function IntentBadge({ level }: { level: string }) {
  return <Pill label={level} className={INTENT_STYLES[level] ?? INTENT_STYLES["Low"]} />;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Pill label={`${priority} priority`} className={LEVEL_STYLES[priority] ?? LEVEL_STYLES["Low"]} />;
}
