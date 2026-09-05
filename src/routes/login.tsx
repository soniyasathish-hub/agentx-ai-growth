import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureMembership } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — AGENTX Commerce Intelligence" },
      { name: "description", content: "Sign in to your AGENTX commerce intelligence workspace." },
      { property: "og:title", content: "Log in — AGENTX" },
      { property: "og:description", content: "Sign in to your AGENTX commerce intelligence workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    if (data.user) {
      await ensureMembership({
        userId: data.user.id,
        name: (data.user.user_metadata?.["name"] as string) ?? email.split("@")[0]!,
        email,
      });
    }
    toast.success("Welcome back.");
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="grid-noise flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <Sparkles className="text-primary size-5" />
          <span className="text-lg font-semibold tracking-tight">AGENTX</span>
        </Link>
        <div className="panel p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">Log in</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Access your commerce intelligence dashboard.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Log in
            </Button>
          </form>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            No account yet?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
