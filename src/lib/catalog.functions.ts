import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_AI_DISCOUNT_PERCENT,
  MAX_DISCOUNT_PERCENT,
  computeCustomerIntent,
  type Snapshot,
} from "./agentx-core";

type Ctx = { supabase: any; userId: string };

async function businessId(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("users")
    .select("business_id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No business profile found for this account.");
  return data.business_id as string;
}

/* ============================ PRODUCTS ============================ */

const ProductInput = z.object({
  product_name: z.string().trim().min(1, "Product name is required."),
  category: z.string().trim().min(1, "Category is required."),
  price: z.number().positive("Price must be greater than 0."),
  cost: z.number().min(0, "Cost cannot be negative."),
  stock: z.number().int().min(0, "Stock cannot be negative."),
});

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProductInput.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const bid = await businessId(ctx);
    const { data: row, error } = await ctx.supabase
      .from("products")
      .insert({ ...data, business_id: bid })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    ProductInput.extend({ product_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const bid = await businessId(ctx);
    const { product_id, ...patch } = data;
    const { data: row, error } = await ctx.supabase
      .from("products")
      .update(patch)
      .eq("product_id", product_id)
      .eq("business_id", bid)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Product not found for this business.");
    return row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ product_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const bid = await businessId(ctx);
    const { error } = await ctx.supabase
      .from("products")
      .delete()
      .eq("product_id", data.product_id)
      .eq("business_id", bid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ CUSTOMERS ============================ */

const CustomerInput = z.object({
  name: z.string().trim().min(1, "Customer name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().optional().nullable(),
});

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CustomerInput.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const bid = await businessId(ctx);
    const { data: row, error } = await ctx.supabase
      .from("customers")
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        business_id: bid,
        total_spent: 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    CustomerInput.extend({ customer_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const bid = await businessId(ctx);
    const { data: row, error } = await ctx.supabase
      .from("customers")
      .update({ name: data.name, email: data.email, phone: data.phone || null })
      .eq("customer_id", data.customer_id)
      .eq("business_id", bid)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Customer not found for this business.");
    return row;
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ customer_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const bid = await businessId(ctx);
    const { error } = await ctx.supabase
      .from("customers")
      .delete()
      .eq("customer_id", data.customer_id)
      .eq("business_id", bid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Read-only customer 360: intent score, purchase history, AI recommendation, smart offer. */
export const getCustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ customer_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const bid = await businessId(ctx);

    const [customerRes, salesRes, productsRes] = await Promise.all([
      ctx.supabase
        .from("customers")
        .select("*")
        .eq("customer_id", data.customer_id)
        .eq("business_id", bid)
        .maybeSingle(),
      ctx.supabase
        .from("sales")
        .select("*, products(product_name, price, cost)")
        .eq("business_id", bid)
        .eq("customer_id", data.customer_id)
        .order("sale_date", { ascending: false }),
      ctx.supabase.from("products").select("*").eq("business_id", bid),
    ]);
    for (const r of [customerRes, salesRes, productsRes]) {
      if (r.error) throw new Error(r.error.message);
    }
    const customer = customerRes.data;
    if (!customer) throw new Error("Customer not found.");

    const sales = (salesRes.data ?? []).map((s: any) => ({
      sale_id: s.sale_id,
      product_id: s.product_id,
      customer_id: s.customer_id,
      productName: s.products?.product_name ?? "—",
      quantity: Number(s.quantity),
      unit_price: Number(s.unit_price),
      total_amount: Number(s.total_amount),
      sale_date: s.sale_date,
    }));

    const snap: Snapshot = {
      products: (productsRes.data ?? []).map((p: any) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        category: p.category,
        price: Number(p.price),
        cost: Number(p.cost),
        stock: Number(p.stock),
      })),
      customers: [
        {
          customer_id: customer.customer_id,
          name: customer.name,
          email: customer.email,
          total_spent: Number(customer.total_spent),
          created_at: customer.created_at,
        },
      ],
      sales,
    };

    const intent = computeCustomerIntent(snap)[0]!;
    const lifetimeValue = sales.reduce((a, s) => a + s.total_amount, 0);
    const totalOrders = sales.length;
    const averageOrderValue = totalOrders ? lifetimeValue / totalOrders : 0;

    // Top product by spend, fallback to highest-priced item in the catalogue.
    const spendByProduct = new Map<string, number>();
    for (const s of sales) {
      if (!s.product_id) continue;
      spendByProduct.set(s.product_id, (spendByProduct.get(s.product_id) ?? 0) + s.total_amount);
    }
    const topId = [...spendByProduct.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const product =
      snap.products.find((p) => p.product_id === topId) ??
      [...snap.products].sort((a, b) => b.price - a.price)[0];

    const discountPercent = Math.min(
      MAX_DISCOUNT_PERCENT,
      intent.intentLevel === "High"
        ? 5
        : intent.intentLevel === "Medium"
          ? DEFAULT_AI_DISCOUNT_PERCENT
          : MAX_DISCOUNT_PERCENT,
    );
    const originalPrice = product?.price ?? 0;
    const finalPrice = Number((originalPrice * (1 - discountPercent / 100)).toFixed(2));

    const recommendation =
      intent.intentLevel === "High"
        ? `Premium customer offer — ${intent.name} is highly engaged. Offer early access and a modest ${discountPercent}% incentive to protect margin.`
        : intent.lastOrderDays !== null && intent.lastOrderDays > 90
          ? `Re-engagement — no order in ${intent.lastOrderDays} days. Send a ${discountPercent}% win-back offer with a 14-day expiry.`
          : `Retention offer — steady but slowing. Recommend ${product?.product_name ?? "a best-seller"} at ${discountPercent}% off to accelerate the next order.`;

    return {
      customer: {
        customer_id: customer.customer_id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        created_at: customer.created_at,
      },
      lifetimeValue: Number(lifetimeValue.toFixed(2)) || Number(customer.total_spent),
      totalOrders,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
      intentScore: intent.intentScore,
      intentLevel: intent.intentLevel,
      lastOrderDays: intent.lastOrderDays,
      purchases: sales.slice(0, 25),
      recommendation,
      smartOffer: {
        customerName: customer.name,
        productName: product?.product_name ?? "—",
        originalPrice,
        discountPercent,
        finalPrice,
        reason: recommendation,
      },
    };
  });
