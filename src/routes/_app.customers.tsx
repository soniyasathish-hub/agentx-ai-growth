import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { currency, dateFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({
    meta: [
      { title: "Customers — AGENTX Commerce Intelligence" },
      { name: "description", content: "Customer accounts, lifetime spend and contact details." },
      { property: "og:title", content: "Customers — AGENTX" },
      { property: "og:description", content: "Customer accounts, lifetime spend and contact details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("total_spent", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const rows = (data ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.email.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Customers" description="Lifetime value and account details for every buyer." />
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState title="No customers found." />
      ) : (
        <div className="panel overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Total spent</TableHead>
                <TableHead>Customer since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.customer_id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{currency(c.total_spent)}</TableCell>
                  <TableCell className="text-muted-foreground">{dateFmt(c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
