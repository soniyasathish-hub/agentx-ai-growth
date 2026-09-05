import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACTION_STATUS,
  computeCategoryMix,
  computeCustomerIntent,
  computeDemandForecast,
  computeOpportunities,
  computeRevenueTrend,
  computeSmartOffers,
  computeTotals,
  detectRevenueLeaks,
  generateAutonomousActions,
  simulatePriceChange,
  validateGuardrails,
  type Snapshot,
} from "./agentx-core";

type Ctx = { supabase: any; userId: string };

async function loadMembership(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("users")
    .select("user_id, business_id, name, email, role, businesses(business_name, owner_name, email)")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No business profile found for this account.");
  return data as {
    user_id: string;
    business_id: string;
    name: string;
    email: string;
    role: string;
    businesses: { business_name: string; owner_name: string; email: string } | null;
  };
}

async function loadSnapshot(ctx: Ctx, businessId: string): Promise<Snapshot> {
  const [products, customers, sales] = await Promise.all([
    ctx.supabase.from("products").select("*").eq("business_id", businessId),
    ctx.supabase.from("customers").select("*").eq("business_id", businessId),
    ctx.supabase
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .order("sale_date", { ascending: false })
      .limit(5000),
  ]);
  for (const r of [products, customers, sales]) {
    if (r.error) throw new Error(r.error.message);
  }
  return {
    products: (products.data ?? []).map((p: any) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      category: p.category,
      price: Number(p.price),
      cost: Number(p.cost),
      stock: Number(p.stock),
    })),
    customers: (customers.data ?? []).map((c: any) => ({
      customer_id: c.customer_id,
      name: c.name,
      email: c.email,
      total_spent: Number(c.total_spent),
      created_at: c.created_at,
    })),
    sales: (sales.data ?? []).map((s: any) => ({
      sale_id: s.sale_id,
      product_id: s.product_id,
      customer_id: s.customer_id,
      quantity: Number(s.quantity),
      unit_price: Number(s.unit_price),
      total_amount: Number(s.total_amount),
      sale_date: s.sale_date,
    })),
  };
}

/** GET /api/ai/* — read-only intelligence. Never writes to the database. */
export const getIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const membership = await loadMembership(ctx);
    const snap = await loadSnapshot(ctx, membership.business_id);

    return {
      business: {
        business_id: membership.business_id,
        business_name: membership.businesses?.business_name ?? "My business",
        owner_name: membership.businesses?.owner_name ?? membership.name,
      },
      user: { name: membership.name, email: membership.email, role: membership.role },
      totals: computeTotals(snap),
      trend: computeRevenueTrend(snap),
      categoryMix: computeCategoryMix(snap),
      opportunities: computeOpportunities(snap),
      revenueLeaks: detectRevenueLeaks(snap),
      customerIntent: computeCustomerIntent(snap),
      smartOffers: computeSmartOffers(snap),
      demandForecast: computeDemandForecast(snap),
      suggestedActions: generateAutonomousActions(snap),
    };
  });

/** POST — persists AI-generated actions, skipping duplicates of open actions. */
export const syncAutonomousActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const membership = await loadMembership(ctx);
    const businessId = membership.business_id;
    const snap = await loadSnapshot(ctx, businessId);
    const generated = generateAutonomousActions(snap);

    const { data: existing, error: exErr } = await ctx.supabase
      .from("autonomous_actions")
      .select("action_type, product_id, customer_id, status")
      .eq("business_id", businessId)
      .in("status", [ACTION_STATUS.pending, ACTION_STATUS.approved, ACTION_STATUS.blocked]);
    if (exErr) throw new Error(exErr.message);

    const key = (a: { action_type: string; product_id: string | null; customer_id: string | null }) =>
      `${a.action_type}|${a.product_id ?? "-"}|${a.customer_id ?? "-"}`;
    const seen = new Set((existing ?? []).map(key));

    const rows = generated
      .filter((a) => !seen.has(key(a)))
      .map((a) => ({
        business_id: businessId,
        action_type: a.action_type,
        product_id: a.product_id,
        customer_id: a.customer_id,
        priority: a.priority,
        reason: `${a.reason} Recommended: ${a.recommended_action}`,
        estimated_opportunity: a.estimated_opportunity,
        discount_percent: a.discount_percent,
        price_change_percent: a.price_change_percent,
        margin_percent: a.margin_percent,
        status: ACTION_STATUS.pending,
      }));

    if (rows.length === 0) return { created: 0 };

    const { error } = await ctx.supabase.from("autonomous_actions").insert(rows);
    if (error) throw new Error(error.message);
    return { created: rows.length };
  });

async function transition(
  ctx: Ctx,
  actionId: string,
  opts: {
    allowedFrom: string[];
    nextStatus: string;
    stamp: "approved_at" | "executed_at" | "rejected_at" | null;
    runGuardrails: boolean;
    overrides?: { discount_percent?: number; price_change_percent?: number };
    reason?: string;
  },
) {
  const membership = await loadMembership(ctx);
  const { data: action, error } = await ctx.supabase
    .from("autonomous_actions")
    .select("*")
    .eq("action_id", actionId)
    .eq("business_id", membership.business_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!action) throw new Error("Action not found.");

  if (action.status === ACTION_STATUS.blocked && opts.nextStatus !== ACTION_STATUS.rejected) {
    throw new Error(`Blocked action cannot be ${opts.nextStatus.toLowerCase()}: ${action.block_reason ?? "guardrail violation"}`);
  }
  if (!opts.allowedFrom.includes(action.status)) {
    throw new Error(`Cannot move an action from "${action.status}" to "${opts.nextStatus}".`);
  }

  const discount = opts.overrides?.discount_percent ?? Number(action.discount_percent);
  const priceChange = opts.overrides?.price_change_percent ?? Number(action.price_change_percent);

  // Margin is always recomputed server-side from live catalogue data — never trusted from the client.
  let product: { product_id: string; product_name: string; price: number; cost: number } | null = null;
  if (action.product_id) {
    const { data: p, error: pErr } = await ctx.supabase
      .from("products")
      .select("product_id, product_name, price, cost")
      .eq("product_id", action.product_id)
      .eq("business_id", membership.business_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (p) product = { ...p, price: Number(p.price), cost: Number(p.cost) };
  }

  let margin = Number(action.margin_percent);
  let offerPrice: number | null = null;
  if (product) {
    offerPrice = Number((product.price * (1 - discount / 100)).toFixed(2));
    margin = offerPrice > 0 ? Number((((offerPrice - product.cost) / offerPrice) * 100).toFixed(1)) : 0;
  }

  if (opts.runGuardrails) {
    const guard = validateGuardrails({
      discount_percent: discount,
      price_change_percent: priceChange,
      margin_percent: margin,
    });
    if (!guard.ok) {
      await ctx.supabase
        .from("autonomous_actions")
        .update({
          status: ACTION_STATUS.blocked,
          block_reason: guard.reason,
          blocked_at: new Date().toISOString(),
          performed_by: ctx.userId,
          discount_percent: discount,
          price_change_percent: priceChange,
          margin_percent: margin,
          dismissed: false,
        })
        .eq("action_id", actionId)
        .eq("business_id", membership.business_id);
      await ctx.supabase.from("action_history").insert({
        action_id: actionId,
        business_id: membership.business_id,
        previous_status: action.status,
        new_status: ACTION_STATUS.blocked,
        performed_by: ctx.userId,
        reason: guard.reason,
      });
      return { ok: false as const, blocked: true as const, reason: guard.reason };
    }
  }

  const patch: Record<string, unknown> = {
    status: opts.nextStatus,
    block_reason: null,
    blocked_at: null,
    performed_by: ctx.userId,
    discount_percent: discount,
    price_change_percent: priceChange,
    margin_percent: margin,
  };
  if (opts.stamp) patch[opts.stamp] = new Date().toISOString();

  let effect = "";

  // Execution side effects — the action actually changes the business data.
  if (opts.nextStatus === ACTION_STATUS.executed) {
    if (product && offerPrice !== null) {
      const { error: prErr } = await ctx.supabase
        .from("products")
        .update({ price: offerPrice })
        .eq("product_id", product.product_id)
        .eq("business_id", membership.business_id);
      if (prErr) throw new Error(prErr.message);
      patch["previous_price"] = product.price;
      patch["new_price"] = offerPrice;
      effect = ` Promotional price applied to ${product.product_name}: ${product.price} → ${offerPrice} (−${discount}%).`;
    } else if (action.customer_id) {
      const { error: offErr } = await ctx.supabase.from("retention_offers").upsert(
        {
          business_id: membership.business_id,
          action_id: actionId,
          customer_id: action.customer_id,
          discount_percent: discount,
          estimated_opportunity: Number(action.estimated_opportunity),
        },
        { onConflict: "action_id" },
      );
      if (offErr) throw new Error(offErr.message);
      effect = ` Retention offer of ${discount}% issued with a 14-day expiry.`;
    }
  }

  const { error: upErr } = await ctx.supabase
    .from("autonomous_actions")
    .update(patch)
    .eq("action_id", actionId)
    .eq("business_id", membership.business_id);
  if (upErr) throw new Error(upErr.message);

  await ctx.supabase.from("action_history").insert({
    action_id: actionId,
    business_id: membership.business_id,
    previous_status: action.status,
    new_status: opts.nextStatus,
    performed_by: ctx.userId,
    reason: `${opts.reason ?? `${opts.nextStatus} by ${membership.name}`}${effect}`,
  });

  return {
    ok: true as const,
    blocked: false as const,
    status: opts.nextStatus,
    margin_percent: margin,
    effect: effect.trim() || null,
  };
}

/** Hides a blocked or rejected action from the queue without deleting the audit trail. */
export const dismissAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ action_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const membership = await loadMembership(ctx);
    const { error } = await ctx.supabase
      .from("autonomous_actions")
      .update({ dismissed: true })
      .eq("action_id", data.action_id)
      .eq("business_id", membership.business_id)
      .in("status", [ACTION_STATUS.blocked, ACTION_STATUS.rejected]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


const ApproveInput = z.object({
  action_id: z.string().uuid(),
  discount_percent: z.number().min(0).max(100).optional(),
  price_change_percent: z.number().min(-100).max(100).optional(),
});

export const approveAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApproveInput.parse(input))
  .handler(async ({ data, context }) =>
    transition(context as unknown as Ctx, data.action_id, {
      allowedFrom: [ACTION_STATUS.pending],
      nextStatus: ACTION_STATUS.approved,
      stamp: "approved_at",
      runGuardrails: true,
      overrides: {
        ...(data.discount_percent !== undefined ? { discount_percent: data.discount_percent } : {}),
        ...(data.price_change_percent !== undefined
          ? { price_change_percent: data.price_change_percent }
          : {}),
      },
    }),
  );

export const rejectAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ action_id: z.string().uuid(), reason: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) =>
    transition(context as unknown as Ctx, data.action_id, {
      allowedFrom: [ACTION_STATUS.pending, ACTION_STATUS.approved, ACTION_STATUS.blocked],
      nextStatus: ACTION_STATUS.rejected,
      stamp: "rejected_at",
      runGuardrails: false,
      ...(data.reason ? { reason: data.reason } : {}),
    }),
  );

export const executeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ action_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    transition(context as unknown as Ctx, data.action_id, {
      allowedFrom: [ACTION_STATUS.approved],
      nextStatus: ACTION_STATUS.executed,
      stamp: "executed_at",
      runGuardrails: true,
    }),
  );

export const simulate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ price_change_percent: z.number().min(-100).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const membership = await loadMembership(ctx);
    const snap = await loadSnapshot(ctx, membership.business_id);
    return simulatePriceChange(snap, data.price_change_percent);
  });
