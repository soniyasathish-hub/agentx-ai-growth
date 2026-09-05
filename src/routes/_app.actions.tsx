import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, CheckCircle2, EyeOff, Loader2, PlayCircle, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  approveAction,
  dismissAction,
  executeAction,
  rejectAction,
  syncAutonomousActions,
} from "@/lib/agentx.functions";
import {
  MAX_DISCOUNT_PERCENT,
  MAX_PRICE_CHANGE_PERCENT,
  MIN_MARGIN_PERCENT,
} from "@/lib/agentx-core";
import { currency, currencyPrecise, dateTimeFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { PriorityBadge, StatusBadge } from "@/components/agentx/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/actions")({
  head: () => ({
    meta: [
      { title: "Autonomous Actions — AGENTX" },
      {
        name: "description",
        content:
          "Review, approve, reject and execute AI-generated commerce actions with discount, price and margin guardrails.",
      },
      { property: "og:title", content: "Autonomous Actions — AGENTX" },
      {
        property: "og:description",
        content: "Guardrailed approval queue for AI-generated promotions and retention offers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActionsPage,
});

const FILTERS = ["All", "Pending Approval", "Approved", "Executed", "Rejected", "Blocked"] as const;
type Filter = (typeof FILTERS)[number];

type Confirm =
  | { kind: "approve"; action: any; discount: number }
  | { kind: "reject"; action: any }
  | { kind: "execute"; action: any }
  | null;

function ActionsPage() {
  const queryClient = useQueryClient();
  const runSync = useServerFn(syncAutonomousActions);
  const runApprove = useServerFn(approveAction);
  const runReject = useServerFn(rejectAction);
  const runExecute = useServerFn(executeAction);
  const runDismiss = useServerFn(dismissAction);

  const [filter, setFilter] = useState<Filter>("All");
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autonomous_actions")
        .select("*, products(product_name, price), customers(name, email)")
        .eq("dismissed", false)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["actions"] });
    queryClient.invalidateQueries({ queryKey: ["action-history"] });
    queryClient.invalidateQueries({ queryKey: ["intelligence"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const sync = useMutation({
    mutationFn: () => runSync(),
    onSuccess: (res) => {
      toast.success(
        res.created > 0
          ? `${res.created} new action${res.created === 1 ? "" : "s"} queued.`
          : "No new actions to queue.",
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (vars: { action_id: string; discount_percent: number }) =>
      runApprove({
        data: {
          action_id: vars.action_id,
          discount_percent: vars.discount_percent,
          price_change_percent: -vars.discount_percent,
        },
      }),
    onSuccess: (res) => {
      if (res.blocked) toast.error(`Guardrail blocked: ${res.reason}`);
      else toast.success("Action approved and ready to execute.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) => runReject({ data: { action_id: id, reason: "Rejected by operator" } }),
    onSuccess: () => {
      toast.success("Action rejected.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const execute = useMutation({
    mutationFn: (id: string) => runExecute({ data: { action_id: id } }),
    onSuccess: (res) => {
      if (res.blocked) toast.error(`Guardrail blocked: ${res.reason}`);
      else toast.success(res.effect ?? "Action executed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => runDismiss({ data: { action_id: id } }),
    onSuccess: () => {
      toast.success("Action dismissed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const list = data ?? [];
    const map: Record<Filter, number> = {
      All: list.length,
      "Pending Approval": 0,
      Approved: 0,
      Executed: 0,
      Rejected: 0,
      Blocked: 0,
    };
    for (const a of list) if (a.status in map) map[a.status as Filter] += 1;
    return map;
  }, [data]);

  const rows = useMemo(
    () => (data ?? []).filter((a) => filter === "All" || a.status === filter),
    [data, filter],
  );

  const busy = approve.isPending || reject.isPending || execute.isPending || dismiss.isPending;

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "approve")
      approve.mutate({ action_id: confirm.action.action_id, discount_percent: confirm.discount });
    if (confirm.kind === "reject") reject.mutate(confirm.action.action_id);
    if (confirm.kind === "execute") execute.mutate(confirm.action.action_id);
    setConfirm(null);
  };

  const confirmCopy = () => {
    if (!confirm) return { title: "", body: "" };
    const name =
      confirm.action.products?.product_name ?? confirm.action.customers?.name ?? "this action";
    if (confirm.kind === "approve")
      return {
        title: "Approve this action?",
        body: `A ${confirm.discount}% discount will be locked in for ${name}. Guardrails are re-checked before anything changes.`,
      };
    if (confirm.kind === "reject")
      return {
        title: "Reject this action?",
        body: `${name} will be marked rejected and logged in the audit trail. It can be regenerated later.`,
      };
    return {
      title: "Execute this action?",
      body: confirm.action.product_id
        ? `The promotional price will be applied to ${name} immediately.`
        : `A win-back offer will be issued to ${name} with a 14-day expiry.`,
    };
  };

  return (
    <div>
      <PageHeader
        title="Autonomous Actions"
        description={`Guardrails: max ${MAX_DISCOUNT_PERCENT}% discount, max ${MAX_PRICE_CHANGE_PERCENT}% price change, min ${MIN_MARGIN_PERCENT}% margin.`}
        actions={
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
            Generate actions
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-5">
        <TabsList className="flex-wrap">
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f}>
              {f} ({counts[f]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No actions in this view."
          hint="Run the agent to scan your data for revenue opportunities."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((a) => {
            const name = a.products?.product_name ?? a.customers?.name ?? "Business-wide";
            const discount = discounts[a.action_id] ?? Number(a.discount_percent);
            const overLimit = discount > MAX_DISCOUNT_PERCENT;
            return (
              <article key={a.action_id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-primary text-xs font-semibold tracking-wide uppercase">
                      {String(a.action_type).replace("_", " ")}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{name}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={a.priority} />
                    <StatusBadge status={a.status} />
                  </div>
                </div>

                <p className="text-muted-foreground mt-3 text-sm">{a.reason}</p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground text-xs">Opportunity</dt>
                    <dd className="text-success font-semibold">{currency(a.estimated_opportunity)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Discount</dt>
                    <dd className="font-semibold">{Number(a.discount_percent)}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Price change</dt>
                    <dd className="font-semibold">{Number(a.price_change_percent)}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Margin</dt>
                    <dd className="font-semibold">{Number(a.margin_percent)}%</dd>
                  </div>
                </dl>

                {a.status === "Executed" && a.new_price ? (
                  <p className="text-success mt-3 text-sm">
                    Price applied: {currencyPrecise(a.previous_price)} →{" "}
                    {currencyPrecise(a.new_price)}
                  </p>
                ) : null}

                {a.status === "Blocked" ? (
                  <div className="border-destructive/40 bg-destructive/10 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Guardrail violation — execution disabled</p>
                      <p>{a.block_reason}</p>
                    </div>
                  </div>
                ) : null}

                <div className="text-muted-foreground mt-4 space-y-1 text-xs">
                  <p>Created {dateTimeFmt(a.created_at)}</p>
                  {a.approved_at ? <p>Approved {dateTimeFmt(a.approved_at)}</p> : null}
                  {a.executed_at ? <p>Executed {dateTimeFmt(a.executed_at)}</p> : null}
                  {a.rejected_at ? <p>Rejected {dateTimeFmt(a.rejected_at)}</p> : null}
                  {a.blocked_at ? <p>Blocked {dateTimeFmt(a.blocked_at)}</p> : null}
                </div>

                {a.status === "Pending Approval" ? (
                  <div className="border-border mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
                    <div className="w-32 space-y-1">
                      <Label htmlFor={`d-${a.action_id}`} className="text-xs">
                        Discount %
                      </Label>
                      <Input
                        id={`d-${a.action_id}`}
                        type="number"
                        value={discount}
                        onChange={(e) =>
                          setDiscounts((prev) => ({ ...prev, [a.action_id]: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <Button
                      onClick={() => setConfirm({ kind: "approve", action: a, discount })}
                      disabled={busy}
                    >
                      <CheckCircle2 className="size-4" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setConfirm({ kind: "reject", action: a })}
                      disabled={busy}
                    >
                      <XCircle className="size-4" /> Reject
                    </Button>
                    {overLimit ? (
                      <p className="text-destructive w-full text-xs">
                        Above the {MAX_DISCOUNT_PERCENT}% guardrail — approving will block this action.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {a.status === "Approved" ? (
                  <div className="border-border mt-4 flex flex-wrap gap-3 border-t pt-4">
                    <Button
                      onClick={() => setConfirm({ kind: "execute", action: a })}
                      disabled={busy}
                    >
                      <PlayCircle className="size-4" /> Execute
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setConfirm({ kind: "reject", action: a })}
                      disabled={busy}
                    >
                      <XCircle className="size-4" /> Reject
                    </Button>
                  </div>
                ) : null}

                {a.status === "Blocked" || a.status === "Rejected" ? (
                  <div className="border-border mt-4 flex flex-wrap gap-3 border-t pt-4">
                    <Button
                      variant="outline"
                      onClick={() => dismiss.mutate(a.action_id)}
                      disabled={busy}
                    >
                      <EyeOff className="size-4" /> Dismiss
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy().title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy().body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
