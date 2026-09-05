import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, CheckCircle2, Loader2, PlayCircle, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { approveAction, executeAction, rejectAction, syncAutonomousActions } from "@/lib/agentx.functions";
import {
  MAX_DISCOUNT_PERCENT,
  MAX_PRICE_CHANGE_PERCENT,
  MIN_MARGIN_PERCENT,
} from "@/lib/agentx-core";
import { currency, dateTimeFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { PriorityBadge, StatusBadge } from "@/components/agentx/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

function ActionsPage() {
  const queryClient = useQueryClient();
  const runSync = useServerFn(syncAutonomousActions);
  const runApprove = useServerFn(approveAction);
  const runReject = useServerFn(rejectAction);
  const runExecute = useServerFn(executeAction);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [discounts, setDiscounts] = useState<Record<string, number>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autonomous_actions")
        .select("*, products(product_name), customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["actions"] });
    queryClient.invalidateQueries({ queryKey: ["action-history"] });
    queryClient.invalidateQueries({ queryKey: ["intelligence"] });
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
      else toast.success("Action approved.");
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
      else toast.success("Action executed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(
    () => (data ?? []).filter((a) => filter === "All" || a.status === filter),
    [data, filter],
  );

  const busy = approve.isPending || reject.isPending || execute.isPending;

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

      <Tabs value={filter} onValueChange={(v) => setFilter(v as (typeof FILTERS)[number])} className="mb-5">
        <TabsList className="flex-wrap">
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f}>
              {f}
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
                      onClick={() => approve.mutate({ action_id: a.action_id, discount_percent: discount })}
                      disabled={busy}
                    >
                      <CheckCircle2 className="size-4" /> Approve
                    </Button>
                    <Button variant="outline" onClick={() => reject.mutate(a.action_id)} disabled={busy}>
                      <XCircle className="size-4" /> Reject
                    </Button>
                  </div>
                ) : null}

                {a.status === "Approved" ? (
                  <div className="border-border mt-4 flex flex-wrap gap-3 border-t pt-4">
                    <Button onClick={() => execute.mutate(a.action_id)} disabled={busy}>
                      <PlayCircle className="size-4" /> Execute
                    </Button>
                    <Button variant="outline" onClick={() => reject.mutate(a.action_id)} disabled={busy}>
                      <XCircle className="size-4" /> Reject
                    </Button>
                  </div>
                ) : null}

                {a.status === "Blocked" ? (
                  <div className="border-border mt-4 flex flex-wrap gap-3 border-t pt-4">
                    <Button variant="outline" onClick={() => reject.mutate(a.action_id)} disabled={busy}>
                      <XCircle className="size-4" /> Dismiss blocked action
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
