import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currencyPrecise, dateFmt, numberFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { RiskBadge } from "@/components/agentx/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/products")({
  head: () => ({
    meta: [
      { title: "Products — AGENTX Commerce Intelligence" },
      { name: "description", content: "Catalogue view with pricing, cost, margin and stock health." },
      { property: "og:title", content: "Products — AGENTX" },
      { property: "og:description", content: "Catalogue view with pricing, cost, margin and stock health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("product_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const rows = (data ?? []).filter(
    (p) =>
      p.product_name.toLowerCase().includes(q.toLowerCase()) ||
      p.category.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Products" description="Pricing, margin and inventory position across your catalogue." />
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search products or categories…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState title="No products found." hint="Try a different search term." />
      ) : (
        <div className="panel overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Stock level</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const price = Number(p.price);
                const cost = Number(p.cost);
                const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
                const level = p.stock > 250 ? "High" : p.stock > 60 ? "Medium" : "Low";
                return (
                  <TableRow key={p.product_id}>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.category}</TableCell>
                    <TableCell className="text-right">{currencyPrecise(price)}</TableCell>
                    <TableCell className="text-right">{currencyPrecise(cost)}</TableCell>
                    <TableCell className="text-right font-semibold">{margin.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{numberFmt(p.stock)}</TableCell>
                    <TableCell><RiskBadge level={level} /></TableCell>
                    <TableCell className="text-muted-foreground">{dateFmt(p.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
