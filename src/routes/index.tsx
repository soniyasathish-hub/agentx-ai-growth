import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Boxes, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AGENTX — Autonomous Commerce Intelligence" },
      {
        name: "description",
        content:
          "AGENTX analyzes sales, products, inventory and customers to detect revenue leaks, forecast demand and run guardrailed autonomous business actions.",
      },
      { property: "og:title", content: "AGENTX — Autonomous Commerce Intelligence" },
      {
        property: "og:description",
        content:
          "Detect revenue leaks, score customer intent, forecast demand and approve AI actions with built-in guardrails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Radar, title: "Opportunity Radar", body: "Growth, customer, product and risk scores in one view." },
  { icon: Activity, title: "Revenue Leak Detection", body: "Dormant stock, churn risk and stock-outs, priced in dollars." },
  { icon: Boxes, title: "Demand Forecast", body: "Forecast demand and recommended stock per product." },
  { icon: ShieldCheck, title: "Guardrailed Actions", body: "Discount, price-change and margin limits enforced server-side." },
];

function Landing() {
  return (
    <main className="grid-noise min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">AGENTX</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          Autonomous Commerce Intelligence
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-6xl">
          Your commerce data, turned into decisions that execute themselves.
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg">
          AGENTX reads your sales, inventory and customers, finds the revenue you are leaking, and
          proposes actions your team approves in one click — never outside your guardrails.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/register">Create your workspace</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="panel p-5">
            <f.icon className="text-primary size-5" />
            <h2 className="mt-3 font-semibold">{f.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
