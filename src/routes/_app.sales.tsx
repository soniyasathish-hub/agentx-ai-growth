import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currency, currencyPrecise, dateFmt, numberFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/sales")({
  head: () => ({
    meta: [
      { title: "Sales — AGENTX Commerce Intelligence" },
      { name: "description", content: "Recent orders with product, customer, quantity and order value." },
      { property: "og:title", content: "Sales — AGENTX" },
      { property: "og:description", content: "Recent orders with product, customer, quantity and order value." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, products(product_name), customers(name)")
        .order("sale_date", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const total = (data ?? []).reduce((a, s) => a + Number(s.total_amount), 0);

  return (
    <div>
      <PageHeader
        title="Sales"
        description={
          data ? `${numberFmt(data.length)} most recent orders · ${currency(total)} in value` : "Recent orders"
        }
      />

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No sales recorded yet." />
      ) : (
        <div className="panel overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((s: any) => (
                <TableRow key={s.sale_id}>
                  <TableCell className="text-muted-foreground">{dateFmt(s.sale_date)}</TableCell>
                  <TableCell className="font-medium">{s.products?.product_name ?? "—"}</TableCell>
                  <TableCell>{s.customers?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">{s.quantity}</TableCell>
                  <TableCell className="text-right">{currencyPrecise(s.unit_price)}</TableCell>
                  <TableCell className="text-right font-semibold">{currencyPrecise(s.total_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
