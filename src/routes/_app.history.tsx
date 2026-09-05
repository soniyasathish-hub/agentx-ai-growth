import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dateTimeFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { StatusBadge } from "@/components/agentx/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/history")({
  head: () => ({
    meta: [
      { title: "Action History — AGENTX" },
      {
        name: "description",
        content:
          "Full audit trail of every autonomous action approval, rejection, block and execution.",
      },
      { property: "og:title", content: "Action History — AGENTX" },
      {
        property: "og:description",
        content: "Audit trail of approvals, rejections, guardrail blocks and executions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const STATUSES = ["All", "Approved", "Executed", "Rejected", "Blocked"] as const;
const TYPES = ["All", "PRODUCT_PROMOTION", "CUSTOMER_RETENTION"] as const;

function HistoryPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [type, setType] = useState<string>("All");

  const { data, isLoading, error } = useQuery({
    queryKey: ["action-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_history")
        .select("*, autonomous_actions(action_type, products(product_name), customers(name))")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((h) => {
      const target =
        h.autonomous_actions?.products?.product_name ??
        h.autonomous_actions?.customers?.name ??
        "";
      const matchTerm =
        !term ||
        target.toLowerCase().includes(term) ||
        String(h.reason ?? "").toLowerCase().includes(term);
      const matchStatus = status === "All" || h.new_status === status;
      const matchType = type === "All" || h.autonomous_actions?.action_type === type;
      return matchTerm && matchStatus && matchType;
    });
  }, [data, q, status, type]);

  return (
    <div>
      <PageHeader
        title="Action History"
        description="Every state change recorded by the autonomous agent."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search by product, customer or note…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "All" ? "All outcomes" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Action type" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "All" ? "All action types" : t.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No history in this view."
          hint="Approve, reject or execute an action and it will be logged here."
        />
      ) : (
        <div className="panel overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow key={h.history_id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {dateTimeFmt(h.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {String(h.autonomous_actions?.action_type ?? "—").replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    {h.autonomous_actions?.products?.product_name ??
                      h.autonomous_actions?.customers?.name ??
                      "—"}
                  </TableCell>
                  <TableCell>
                    {h.previous_status ? <StatusBadge status={h.previous_status} /> : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={h.new_status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-sm text-sm">
                    {h.reason ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
