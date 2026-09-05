/**
 * AGENTX intelligence core.
 * Pure, dependency-free business logic shared by server functions.
 */

export const MAX_DISCOUNT_PERCENT = 15;
export const MAX_PRICE_CHANGE_PERCENT = 20;
export const MIN_MARGIN_PERCENT = 10;
export const DEFAULT_AI_DISCOUNT_PERCENT = 10;

export const ACTION_STATUS = {
  pending: "Pending Approval",
  approved: "Approved",
  executed: "Executed",
  rejected: "Rejected",
  blocked: "Blocked",
} as const;

export type ActionStatus = (typeof ACTION_STATUS)[keyof typeof ACTION_STATUS];

export type GuardrailInput = {
  discount_percent?: number | null;
  price_change_percent?: number | null;
  margin_percent?: number | null;
};

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

export function validateGuardrails(input: GuardrailInput): GuardrailResult {
  const discount = Number(input.discount_percent ?? 0);
  const priceChange = Number(input.price_change_percent ?? 0);
  const margin = Number(input.margin_percent ?? 0);

  if (discount > MAX_DISCOUNT_PERCENT) {
    return { ok: false, reason: "Discount cannot exceed 15%." };
  }
  if (Math.abs(priceChange) > MAX_PRICE_CHANGE_PERCENT) {
    return { ok: false, reason: "Price change cannot exceed 20%." };
  }
  if (margin < MIN_MARGIN_PERCENT) {
    return { ok: false, reason: "Margin cannot go below 10%." };
  }
  return { ok: true };
}

/* ---------------- data shapes ---------------- */

export type ProductRow = {
  product_id: string;
  product_name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
};

export type CustomerRow = {
  customer_id: string;
  name: string;
  email: string;
  total_spent: number;
  created_at: string;
};

export type SaleRow = {
  sale_id: string;
  product_id: string | null;
  customer_id: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  sale_date: string;
};

export type Snapshot = {
  products: ProductRow[];
  customers: CustomerRow[];
  sales: SaleRow[];
};

const DAY = 86_400_000;

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const round = (n: number, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : 0;
const daysAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / DAY;

function within(sales: SaleRow[], from: number, to = 0) {
  return sales.filter((s) => {
    const d = daysAgo(s.sale_date);
    return d <= from && d >= to;
  });
}

const sum = (rows: SaleRow[], key: "total_amount" | "quantity") =>
  rows.reduce((acc, r) => acc + Number(r[key]), 0);

/* ---------------- totals & trend ---------------- */

export function computeTotals(snap: Snapshot) {
  return {
    totalRevenue: round(sum(snap.sales, "total_amount")),
    totalOrders: snap.sales.length,
    totalProducts: snap.products.length,
    totalCustomers: snap.customers.length,
    averageOrderValue: snap.sales.length
      ? round(sum(snap.sales, "total_amount") / snap.sales.length)
      : 0,
  };
}

export function computeRevenueTrend(snap: Snapshot) {
  const buckets = new Map<string, { revenue: number; orders: number }>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(d.toISOString().slice(0, 7), { revenue: 0, orders: 0 });
  }
  for (const s of snap.sales) {
    const key = new Date(s.sale_date).toISOString().slice(0, 7);
    const b = buckets.get(key);
    if (b) {
      b.revenue += Number(s.total_amount);
      b.orders += 1;
    }
  }
  return [...buckets.entries()].map(([month, v]) => ({
    month,
    label: new Date(`${month}-01T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    }),
    revenue: round(v.revenue),
    orders: v.orders,
  }));
}

export function computeCategoryMix(snap: Snapshot) {
  const byProduct = new Map(snap.products.map((p) => [p.product_id, p]));
  const mix = new Map<string, number>();
  for (const s of snap.sales) {
    const p = s.product_id ? byProduct.get(s.product_id) : undefined;
    if (!p) continue;
    mix.set(p.category, (mix.get(p.category) ?? 0) + Number(s.total_amount));
  }
  return [...mix.entries()]
    .map(([category, revenue]) => ({ category, revenue: round(revenue) }))
    .sort((a, b) => b.revenue - a.revenue);
}

/* ---------------- opportunity radar ---------------- */

export function computeOpportunities(snap: Snapshot) {
  const last30 = within(snap.sales, 30);
  const prev30 = within(snap.sales, 60, 30);
  const r1 = sum(last30, "total_amount");
  const r0 = sum(prev30, "total_amount");
  const growthPct = r0 > 0 ? ((r1 - r0) / r0) * 100 : r1 > 0 ? 100 : 0;
  const salesGrowth = clamp(50 + growthPct * 1.5);

  const activeCustomerIds = new Set(within(snap.sales, 60).map((s) => s.customer_id));
  const inactiveShare = snap.customers.length
    ? 1 - activeCustomerIds.size / snap.customers.length
    : 0;
  const customerOpportunity = clamp(inactiveShare * 100);

  const soldProductIds = new Set(within(snap.sales, 90).map((s) => s.product_id));
  const idleShare = snap.products.length
    ? 1 - soldProductIds.size / snap.products.length
    : 0;
  const stockValue = snap.products.reduce((a, p) => a + Number(p.cost) * p.stock, 0);
  const revenue90 = sum(within(snap.sales, 90), "total_amount");
  const overstockRatio = revenue90 > 0 ? clamp((stockValue / revenue90) * 40) : 60;
  const productOpportunity = clamp(idleShare * 60 + overstockRatio * 0.6);

  const leaks = detectRevenueLeaks(snap);
  const leakValue = leaks.reduce((a, l) => a + l.potentialLoss, 0);
  const annualRevenue = sum(snap.sales, "total_amount");
  const revenueRisk = clamp(
    annualRevenue > 0 ? (leakValue / annualRevenue) * 220 : leaks.length ? 60 : 0,
  );

  return {
    salesGrowth: Math.round(salesGrowth),
    customerOpportunity: Math.round(customerOpportunity),
    productOpportunity: Math.round(productOpportunity),
    revenueRisk: Math.round(revenueRisk),
    revenueLast30: round(r1),
    revenuePrev30: round(r0),
    growthPercent: round(growthPct, 1),
  };
}

/* ---------------- revenue leak detection ---------------- */

export type RevenueLeak = {
  id: string;
  entity: string;
  entityType: "Product" | "Customer";
  issue: string;
  riskLevel: "High" | "Medium" | "Low";
  potentialLoss: number;
  recommendation: string;
};

export function detectRevenueLeaks(snap: Snapshot): RevenueLeak[] {
  const leaks: RevenueLeak[] = [];
  const sales90 = within(snap.sales, 90);

  for (const p of snap.products) {
    const rows = sales90.filter((s) => s.product_id === p.product_id);
    const units = rows.reduce((a, r) => a + r.quantity, 0);
    const margin = Number(p.price) - Number(p.cost);
    const monthlyVelocity = units / 3;
    const stockMonths = monthlyVelocity > 0 ? p.stock / monthlyVelocity : Infinity;

    if (units === 0 && p.stock > 0) {
      leaks.push({
        id: `p-${p.product_id}`,
        entity: p.product_name,
        entityType: "Product",
        issue: "No sales in 90 days with stock on hand",
        riskLevel: "High",
        potentialLoss: round(margin * p.stock * 0.4),
        recommendation: "Run a targeted promotion or bundle to unlock dormant inventory.",
      });
    } else if (stockMonths > 6) {
      leaks.push({
        id: `p-${p.product_id}`,
        entity: p.product_name,
        entityType: "Product",
        issue: `Excess inventory — ${stockMonths.toFixed(1)} months of cover`,
        riskLevel: stockMonths > 12 ? "High" : "Medium",
        potentialLoss: round(Number(p.cost) * p.stock * 0.12),
        recommendation: "Discount within guardrails and pause replenishment this cycle.",
      });
    } else if (stockMonths < 1 && units > 0) {
      leaks.push({
        id: `p-${p.product_id}`,
        entity: p.product_name,
        entityType: "Product",
        issue: "Stock-out risk — under 1 month of cover",
        riskLevel: "Medium",
        potentialLoss: round(margin * monthlyVelocity * 2),
        recommendation: "Reorder now to avoid lost demand next month.",
      });
    }
  }

  for (const c of snap.customers) {
    const rows = snap.sales.filter((s) => s.customer_id === c.customer_id);
    if (rows.length === 0) continue;
    const last = Math.min(...rows.map((r) => daysAgo(r.sale_date)));
    if (last > 90) {
      const avg = Number(c.total_spent) / rows.length;
      leaks.push({
        id: `c-${c.customer_id}`,
        entity: c.name,
        entityType: "Customer",
        issue: `Inactive for ${Math.round(last)} days`,
        riskLevel: last > 180 ? "High" : "Medium",
        potentialLoss: round(avg * 2),
        recommendation: "Trigger a retention offer before the account fully churns.",
      });
    }
  }

  return leaks.sort((a, b) => b.potentialLoss - a.potentialLoss);
}

/* ---------------- customer intent ---------------- */

export type CustomerIntent = {
  customer_id: string;
  name: string;
  email: string;
  orders: number;
  totalSpent: number;
  lastOrderDays: number | null;
  intentScore: number;
  intentLevel: "High" | "Medium" | "Low";
};

export function computeCustomerIntent(snap: Snapshot): CustomerIntent[] {
  const maxSpend = Math.max(1, ...snap.customers.map((c) => Number(c.total_spent)));
  return snap.customers
    .map((c) => {
      const rows = snap.sales.filter((s) => s.customer_id === c.customer_id);
      const orders = rows.length;
      const last = rows.length ? Math.min(...rows.map((r) => daysAgo(r.sale_date))) : null;
      const frequencyScore = clamp((orders / 40) * 100);
      const spendScore = clamp((Number(c.total_spent) / maxSpend) * 100);
      const recencyScore = last === null ? 0 : clamp(100 - (last / 180) * 100);
      const intentScore = Math.round(
        frequencyScore * 0.3 + spendScore * 0.3 + recencyScore * 0.4,
      );
      return {
        customer_id: c.customer_id,
        name: c.name,
        email: c.email,
        orders,
        totalSpent: round(Number(c.total_spent)),
        lastOrderDays: last === null ? null : Math.round(last),
        intentScore,
        intentLevel: (intentScore >= 66 ? "High" : intentScore >= 33 ? "Medium" : "Low") as
          | "High"
          | "Medium"
          | "Low",
      };
    })
    .sort((a, b) => b.intentScore - a.intentScore);
}

/* ---------------- smart offers ---------------- */

export type SmartOffer = {
  id: string;
  customer_id: string;
  customerName: string;
  product_id: string;
  productName: string;
  originalPrice: number;
  discountPercent: number;
  finalPrice: number;
  marginPercent: number;
  reason: string;
};

export function computeSmartOffers(snap: Snapshot): SmartOffer[] {
  const intents = computeCustomerIntent(snap);
  const productById = new Map(snap.products.map((p) => [p.product_id, p]));

  return intents.slice(0, 6).map((intent) => {
    const rows = snap.sales.filter((s) => s.customer_id === intent.customer_id);
    const spendByProduct = new Map<string, number>();
    for (const r of rows) {
      if (!r.product_id) continue;
      spendByProduct.set(
        r.product_id,
        (spendByProduct.get(r.product_id) ?? 0) + Number(r.total_amount),
      );
    }
    const topProductId =
      [...spendByProduct.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      snap.products[0]?.product_id;
    const product = topProductId ? productById.get(topProductId) : undefined;
    const price = Number(product?.price ?? 0);
    const cost = Number(product?.cost ?? 0);
    const discountPercent =
      intent.intentLevel === "High"
        ? 5
        : intent.intentLevel === "Medium"
          ? DEFAULT_AI_DISCOUNT_PERCENT
          : MAX_DISCOUNT_PERCENT;
    const finalPrice = round(price * (1 - discountPercent / 100));
    const marginPercent = finalPrice > 0 ? round(((finalPrice - cost) / finalPrice) * 100, 1) : 0;

    return {
      id: `${intent.customer_id}-${topProductId}`,
      customer_id: intent.customer_id,
      customerName: intent.name,
      product_id: topProductId ?? "",
      productName: product?.product_name ?? "—",
      originalPrice: round(price),
      discountPercent,
      finalPrice,
      marginPercent,
      reason:
        intent.intentLevel === "High"
          ? `High intent (${intent.intentScore}/100) — small nudge protects margin.`
          : intent.intentLevel === "Medium"
            ? `Medium intent (${intent.intentScore}/100) — standard AI offer to accelerate the next order.`
            : `Low intent (${intent.intentScore}/100), last order ${intent.lastOrderDays ?? "—"} days ago — maximum allowed win-back offer.`,
    };
  });
}

/* ---------------- demand forecast ---------------- */

export type DemandForecast = {
  product_id: string;
  productName: string;
  currentStock: number;
  historicalSales: number;
  forecastDemand: number;
  recommendedStock: number;
  demandLevel: "High" | "Medium" | "Low";
};

export function computeDemandForecast(snap: Snapshot): DemandForecast[] {
  const sales90 = within(snap.sales, 90);
  const sales30 = within(snap.sales, 30);

  return snap.products
    .map((p) => {
      const units90 = sales90
        .filter((s) => s.product_id === p.product_id)
        .reduce((a, r) => a + r.quantity, 0);
      const units30 = sales30
        .filter((s) => s.product_id === p.product_id)
        .reduce((a, r) => a + r.quantity, 0);
      const baseline = units90 / 3;
      const momentum = baseline > 0 ? units30 / baseline : 1;
      const forecastDemand = Math.round(baseline * clamp(momentum, 0.5, 1.6));
      const recommendedStock = Math.round(forecastDemand * 1.5);
      const demandLevel: "High" | "Medium" | "Low" =
        forecastDemand >= 25 ? "High" : forecastDemand >= 8 ? "Medium" : "Low";
      return {
        product_id: p.product_id,
        productName: p.product_name,
        currentStock: p.stock,
        historicalSales: units90,
        forecastDemand,
        recommendedStock,
        demandLevel,
      };
    })
    .sort((a, b) => b.forecastDemand - a.forecastDemand);
}

/* ---------------- autonomous action generation ---------------- */

export type GeneratedAction = {
  action_type: "PRODUCT_PROMOTION" | "CUSTOMER_RETENTION";
  product_id: string | null;
  customer_id: string | null;
  entityName: string;
  priority: "High" | "Medium" | "Low";
  reason: string;
  estimated_opportunity: number;
  discount_percent: number;
  price_change_percent: number;
  margin_percent: number;
  recommended_action: string;
};

export function generateAutonomousActions(snap: Snapshot): GeneratedAction[] {
  const actions: GeneratedAction[] = [];
  const sales90 = within(snap.sales, 90);
  const discount = DEFAULT_AI_DISCOUNT_PERCENT;

  for (const p of snap.products) {
    const rows = sales90.filter((s) => s.product_id === p.product_id);
    const units = rows.reduce((a, r) => a + r.quantity, 0);
    const monthly = units / 3;
    const cover = monthly > 0 ? p.stock / monthly : Infinity;
    if (cover <= 5) continue;

    const price = Number(p.price);
    const cost = Number(p.cost);
    const offerPrice = price * (1 - discount / 100);
    const marginPercent = offerPrice > 0 ? ((offerPrice - cost) / offerPrice) * 100 : 0;
    const priority = units === 0 ? "High" : cover > 10 ? "High" : "Medium";
    const targetUnits = Math.max(1, Math.round(p.stock * 0.25));

    actions.push({
      action_type: "PRODUCT_PROMOTION",
      product_id: p.product_id,
      customer_id: null,
      entityName: p.product_name,
      priority,
      reason:
        units === 0
          ? `No sales in 90 days with ${p.stock} units in stock — capital is locked in dormant inventory.`
          : `${units} units sold in 90 days against ${p.stock} in stock (${cover.toFixed(1)} months of cover).`,
      estimated_opportunity: round(offerPrice * targetUnits),
      discount_percent: discount,
      price_change_percent: -discount,
      margin_percent: round(marginPercent, 1),
      recommended_action: `Launch a ${discount}% promotion on ${p.product_name} targeting ${targetUnits} units.`,
    });
  }

  const intents = computeCustomerIntent(snap);
  const avgMargin =
    snap.products.length > 0
      ? snap.products.reduce(
          (a, p) => a + ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100,
          0,
        ) / snap.products.length
      : 0;

  for (const c of intents) {
    if (c.orders === 0) continue;
    if (c.lastOrderDays !== null && c.lastOrderDays < 75) continue;
    const avgOrder = c.totalSpent / Math.max(1, c.orders);
    const marginPercent = avgMargin - discount;

    actions.push({
      action_type: "CUSTOMER_RETENTION",
      product_id: null,
      customer_id: c.customer_id,
      entityName: c.name,
      priority: c.totalSpent > 10_000 ? "High" : c.intentScore < 25 ? "High" : "Medium",
      reason: `Last order ${c.lastOrderDays ?? "—"} days ago with intent score ${c.intentScore}/100 and lifetime value of $${Math.round(c.totalSpent).toLocaleString()}.`,
      estimated_opportunity: round(avgOrder * 2),
      discount_percent: discount,
      price_change_percent: -discount,
      margin_percent: round(marginPercent, 1),
      recommended_action: `Send a ${discount}% win-back offer to ${c.name} with a 14-day expiry.`,
    });
  }

  return actions.sort((a, b) => b.estimated_opportunity - a.estimated_opportunity);
}

/* ---------------- what-if simulator ---------------- */

export function simulatePriceChange(snap: Snapshot, priceChangePercent: number) {
  const guard = validateGuardrails({ price_change_percent: priceChangePercent });
  const sales90 = within(snap.sales, 90);
  const currentRevenue = round(sum(sales90, "total_amount"));
  const currentOrders = sales90.length;

  // Simple constant-elasticity model: -1.4 units per 1% price increase.
  const elasticity = -1.4;
  const demandChange = (priceChangePercent * elasticity) / 100;
  const estimatedOrders = Math.max(0, Math.round(currentOrders * (1 + demandChange)));
  const estimatedRevenue = round(
    currentRevenue * (1 + priceChangePercent / 100) * (1 + demandChange),
  );

  return {
    priceChangePercent,
    currentRevenue,
    estimatedRevenue,
    revenueImpact: round(estimatedRevenue - currentRevenue),
    revenueImpactPercent: currentRevenue
      ? round(((estimatedRevenue - currentRevenue) / currentRevenue) * 100, 1)
      : 0,
    currentOrders,
    estimatedOrders,
    blocked: !guard.ok,
    blockReason: guard.ok ? null : guard.reason,
  };
}
