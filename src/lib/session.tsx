import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

/** Ensures the signed-in account has a business membership row. */
export async function ensureMembership(params: { userId: string; name: string; email: string }) {
  const { data: existing } = await supabase
    .from("users")
    .select("user_id")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (existing) return;

  await supabase.from("users").insert({
    user_id: params.userId,
    business_id: DEMO_BUSINESS_ID,
    name: params.name,
    email: params.email,
    role: "owner",
  });
}
