import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Bot,
  DollarSign,
  Gauge,
  Loader2,
  Package,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { getIntelligence, simulate, syncAutonomousActions } from "@/lib/agentx.functions";
import { currency, currencyPrecise, numberFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { IntentBadge, PriorityBadge, RiskBadge } from "@/components/agentx/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MAX_PRICE_CHANGE_PERCENT } from "@/lib/agentx-core";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AGENTX Commerce Intelligence" },
      {
        name: "description",
        content:
          "Revenue, opportunity radar, revenue leaks, customer intent, smart offers and demand forecasts for your business.",
      },
      { property: "og:title", content: "Dashboard — AGENTX" },
      {
        property: "og:description",
        content: "Live commerce intelligence: opportunities, leaks, intent, offers and forecasts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  sub?: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{label}</span>
        <Icon className="text-primary size-4" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="text-muted-foreground mt-1 text-xs">{sub}</p> : null}
    </div>
  );
}

function ScoreCard({ label, score, hint }: { label: string; score: number; hint: string }) {
  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-primary text-xl font-semibold">{score}</span>
      </div>
      <Progress value={score} className="mt-3" />
      <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
    </div>
  );
}

function DashboardPage() {
  const fetchIntel = useServerFn(getIntelligence);
  const runSync = useServerFn(syncAutonomousActions);
  const runSimulate = useServerFn(simulate);
  const queryClient = useQueryClient();
  const [priceChange, setPriceChange] = useState(5);

  const { data, isLoading, error } = useQuery({
    queryKey: ["intelligence"],
    queryFn: () => fetchIntel(),
  });

  const sync = useMutation({
    mutationFn: () => runSync(),
    onSuccess: (res) => {
      toast.success(
        res.created > 0
          ? `${res.created} new autonomous action${res.created === 1 ? "" : "s"} queued for approval.`
          : "No new actions — the agent has already queued everything it found.",
      );
      queryClient.invalidateQueries({ queryKey: ["actions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sim = useMutation({
    mutationFn: (pct: number) => runSimulate({ data: { price_change_percent: pct } }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error) return <ErrorState message={(error as Error).message} />;
  if (!data) return <EmptyState title="No intelligence available yet." />;

  const { totals, opportunities, trend, categoryMix, revenueLeaks, customerIntent, smartOffers, demandForecast, suggestedActions } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={data.business.business_name}
        description="Autonomous commerce intelligence across sales, inventory and customers."
        actions={
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
            Run AI agent
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={currency(totals.totalRevenue)}
          icon={DollarSign}
          sub={`${opportunities.growthPercent >= 0 ? "+" : ""}${opportunities.growthPercent}% vs previous 30 days`}
        />
        <StatCard label="Total Orders" value={numberFmt(totals.totalOrders)} icon={Receipt} sub={`Avg order ${currency(totals.averageOrderValue)}`} />
        <StatCard label="Total Products" value={numberFmt(totals.totalProducts)} icon={Package} />
        <StatCard label="Total Customers" value={numberFmt(totals.totalCustomers)} icon={Users} />
      </section>

      {/* Autonomous Action Agent — most prominent AI section */}
      <section className="panel border-primary/40 shadow-glow p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 rounded-lg p-2">
              <Bot className="text-primary size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Autonomous Action Agent</h2>
              <p className="text-muted-foreground text-sm">
                {suggestedActions.length} opportunit{suggestedActions.length === 1 ? "y" : "ies"} detected ·
                every approval and execution passes guardrail validation.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <a href="/actions">Open action queue</a>
          </Button>
        </div>

        {suggestedActions.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="No autonomous actions recommended right now." hint="Your inventory and customer base look healthy." />
          </div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {suggestedActions.slice(0, 4).map((a) => (
              <div key={`${a.action_type}-${a.product_id ?? a.customer_id}`} className="border-border bg-secondary/40 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-primary text-xs font-semibold tracking-wide uppercase">
                    {a.action_type.replace("_", " ")}
                  </span>
                  <PriorityBadge priority={a.priority} />
                </div>
                <p className="mt-2 font-medium">{a.entityName}</p>
                <p className="text-muted-foreground mt-1 text-sm">{a.reason}</p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    Discount <span className="font-semibold">{a.discount_percent}%</span>
                  </span>
                  <span>
                    Margin <span className="font-semibold">{a.margin_percent}%</span>
                  </span>
                  <span className="text-success">
                    Opportunity <span className="font-semibold">{currency(a.estimated_opportunity)}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Opportunity radar */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Gauge className="text-primary size-5" /> Opportunity Radar
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreCard label="Sales Growth" score={opportunities.salesGrowth} hint={`${currency(opportunities.revenueLast30)} in the last 30 days`} />
          <ScoreCard label="Customer Opportunity" score={opportunities.customerOpportunity} hint="Untapped or lapsing customer value" />
          <ScoreCard label="Product Opportunity" score={opportunities.productOpportunity} hint="Idle catalogue and overstock potential" />
          <ScoreCard label="Revenue Risk" score={opportunities.revenueRisk} hint="Exposure from detected revenue leaks" />
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <TrendingUp className="text-primary size-4" /> Revenue, last 12 months
          </h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => currency(v)} width={70} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(v: number) => currency(v)}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-5">
          <h3 className="font-semibold">Revenue by category</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryMix} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="category" stroke="var(--color-muted-foreground)" fontSize={12} width={90} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(v: number) => currency(v)}
                />
                <Bar dataKey="revenue" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Revenue leaks */}
      <section className="panel p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="text-warning size-5" /> Revenue Leak Detection
        </h2>
        {revenueLeaks.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No revenue leaks detected." />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product / Customer</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="text-right">Potential loss</TableHead>
                  <TableHead>Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueLeaks.slice(0, 8).map((leak) => (
                  <TableRow key={leak.id}>
                    <TableCell className="font-medium">
                      {leak.entity}
                      <span className="text-muted-foreground block text-xs">{leak.entityType}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{leak.issue}</TableCell>
                    <TableCell><RiskBadge level={leak.riskLevel} /></TableCell>
                    <TableCell className="text-destructive text-right font-semibold">
                      {currency(leak.potentialLoss)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs text-sm">{leak.recommendation}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Intent + offers */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="text-primary size-5" /> Customer Intent
          </h2>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Intent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerIntent.map((c) => (
                  <TableRow key={c.customer_id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.orders}</TableCell>
                    <TableCell className="text-right">{currency(c.totalSpent)}</TableCell>
                    <TableCell className="text-right font-semibold">{c.intentScore}</TableCell>
                    <TableCell><IntentBadge level={c.intentLevel} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="text-primary size-5" /> Smart Offers
          </h2>
          <div className="mt-4 space-y-3">
            {smartOffers.map((o) => (
              <div key={o.id} className="border-border bg-secondary/40 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{o.customerName}</p>
                  <span className="text-primary text-sm font-semibold">{o.discountPercent}% off</span>
                </div>
                <p className="text-muted-foreground text-sm">{o.productName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 text-sm">
                  <span className="text-muted-foreground line-through">{currencyPrecise(o.originalPrice)}</span>
                  <span className="text-success font-semibold">{currencyPrecise(o.finalPrice)}</span>
                  <span className="text-muted-foreground text-xs">margin {o.marginPercent}%</span>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">{o.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Forecast + simulator */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Demand Forecast</h2>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Current stock</TableHead>
                  <TableHead className="text-right">Sold (90d)</TableHead>
                  <TableHead className="text-right">Forecast (30d)</TableHead>
                  <TableHead className="text-right">Recommended stock</TableHead>
                  <TableHead>Demand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demandForecast.map((f) => (
                  <TableRow key={f.product_id}>
                    <TableCell className="font-medium">{f.productName}</TableCell>
                    <TableCell className="text-right">{numberFmt(f.currentStock)}</TableCell>
                    <TableCell className="text-right">{numberFmt(f.historicalSales)}</TableCell>
                    <TableCell className="text-right font-semibold">{numberFmt(f.forecastDemand)}</TableCell>
                    <TableCell className="text-right">{numberFmt(f.recommendedStock)}</TableCell>
                    <TableCell><RiskBadge level={f.demandLevel} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-lg font-semibold">What-If Simulator</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Model a catalogue-wide price change. Guardrail: max {MAX_PRICE_CHANGE_PERCENT}%.
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="pc">Price change (%)</Label>
              <Input
                id="pc"
                type="number"
                step="1"
                value={priceChange}
                onChange={(e) => setPriceChange(Number(e.target.value))}
              />
            </div>
            <Button className="w-full" onClick={() => sim.mutate(priceChange)} disabled={sim.isPending}>
              {sim.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Simulate
            </Button>
          </div>

          {sim.data ? (
            sim.data.blocked ? (
              <div className="border-destructive/40 bg-destructive/10 text-destructive mt-4 rounded-xl border p-4 text-sm">
                <p className="font-semibold">Guardrail blocked this simulation</p>
                <p className="mt-1">{sim.data.blockReason}</p>
              </div>
            ) : (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Current revenue (90d)</dt>
                  <dd className="font-medium">{currency(sim.data.currentRevenue)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Estimated revenue</dt>
                  <dd className="font-medium">{currency(sim.data.estimatedRevenue)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Revenue impact</dt>
                  <dd className={sim.data.revenueImpact >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                    {currency(sim.data.revenueImpact)} ({sim.data.revenueImpactPercent}%)
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Estimated orders</dt>
                  <dd className="font-medium">
                    {numberFmt(sim.data.estimatedOrders)}{" "}
                    <span className="text-muted-foreground">from {numberFmt(sim.data.currentOrders)}</span>
                  </dd>
                </div>
              </dl>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
