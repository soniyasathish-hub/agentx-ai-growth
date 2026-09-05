import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createCustomer,
  deleteCustomer,
  getCustomerDetail,
  updateCustomer,
} from "@/lib/catalog.functions";
import { currency, currencyPrecise, dateFmt, numberFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { IntentBadge } from "@/components/agentx/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export const Route = createFileRoute("/_app/customers")({
  head: () => ({
    meta: [
      { title: "Customers — AGENTX Commerce Intelligence" },
      {
        name: "description",
        content:
          "Customer accounts with lifetime value, purchase intent scoring and AI retention recommendations.",
      },
      { property: "og:title", content: "Customers — AGENTX" },
      {
        property: "og:description",
        content: "Lifetime value, intent scoring and AI retention recommendations per customer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

type CustomerRow = {
  customer_id: string;
  name: string;
  email: string;
  phone: string | null;
  total_spent: number | string;
  created_at: string;
};

type FormState = { name: string; email: string; phone: string };
const EMPTY_FORM: FormState = { name: "", email: "", phone: "" };

function CustomersPage() {
  const queryClient = useQueryClient();
  const runCreate = useServerFn(createCustomer);
  const runUpdate = useServerFn(updateCustomer);
  const runDelete = useServerFn(deleteCustomer);
  const runDetail = useServerFn(getCustomerDetail);

  const [q, setQ] = useState("");
  const [tier, setTier] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("total_spent", { ascending: false });
      if (error) throw new Error(error.message);
      return data as CustomerRow[];
    },
  });

  const detail = useQuery({
    queryKey: ["customer-detail", detailId],
    enabled: detailId !== null,
    queryFn: () => runDetail({ data: { customer_id: detailId! } }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["intelligence"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      };
      if (!payload.name) throw new Error("Enter a customer name.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email))
        throw new Error("Enter a valid email address.");
      return editing
        ? runUpdate({ data: { ...payload, customer_id: editing.customer_id } })
        : runCreate({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Customer updated." : "Customer added.");
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormError(null);
      refresh();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => runDelete({ data: { customer_id: id } }),
    onSuccess: () => {
      toast.success("Customer deleted.");
      setDeleteTarget(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const maxSpend = Math.max(1, ...(data ?? []).map((c) => Number(c.total_spent)));
  const tierOf = (c: CustomerRow) => {
    const share = Number(c.total_spent) / maxSpend;
    return share >= 0.6 ? "High" : share >= 0.25 ? "Medium" : "Low";
  };

  const rows = useMemo(
    () =>
      (data ?? []).filter((c) => {
        const term = q.trim().toLowerCase();
        const matchTerm =
          !term || c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
        return matchTerm && (tier === "all" || tierOf(c) === tier);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, q, tier],
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (c: CustomerRow) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email, phone: c.phone ?? "" });
    setFormError(null);
    setDialogOpen(true);
  };

  const d = detail.data;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Lifetime value, spend tier and AI intelligence for every buyer."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" /> Add customer
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search customers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Spend tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All spend tiers</SelectItem>
            <SelectItem value="High">Top spenders</SelectItem>
            <SelectItem value="Medium">Mid spenders</SelectItem>
            <SelectItem value="Low">Low spenders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState title="No customers found." hint="Adjust your filters or add a customer." />
      ) : (
        <div className="panel overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Total spent</TableHead>
                <TableHead>Spend tier</TableHead>
                <TableHead>Customer since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.customer_id}>
                  <TableCell>
                    <button
                      className="text-primary font-medium hover:underline"
                      onClick={() => setDetailId(c.customer_id)}
                    >
                      {c.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {currency(c.total_spent)}
                  </TableCell>
                  <TableCell>
                    <IntentBadge level={tierOf(c)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dateFmt(c.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={detailId !== null} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{d?.customer.name ?? "Customer"}</SheetTitle>
            <SheetDescription>{d?.customer.email ?? "Loading customer 360…"}</SheetDescription>
          </SheetHeader>

          {detail.isLoading ? (
            <div className="space-y-3 px-4 pb-6">
              <Skeleton className="h-24" />
              <Skeleton className="h-40" />
            </div>
          ) : detail.error ? (
            <div className="px-4 pb-6">
              <ErrorState message={(detail.error as Error).message} />
            </div>
          ) : d ? (
            <div className="space-y-5 px-4 pb-8">
              <div className="grid grid-cols-2 gap-3">
                <div className="panel p-3">
                  <p className="text-muted-foreground text-xs">Lifetime value</p>
                  <p className="mt-1 font-semibold">{currency(d.lifetimeValue)}</p>
                </div>
                <div className="panel p-3">
                  <p className="text-muted-foreground text-xs">Orders</p>
                  <p className="mt-1 font-semibold">{numberFmt(d.totalOrders)}</p>
                </div>
                <div className="panel p-3">
                  <p className="text-muted-foreground text-xs">Average order</p>
                  <p className="mt-1 font-semibold">{currencyPrecise(d.averageOrderValue)}</p>
                </div>
                <div className="panel p-3">
                  <p className="text-muted-foreground text-xs">Last order</p>
                  <p className="mt-1 font-semibold">
                    {d.lastOrderDays === null ? "Never" : `${d.lastOrderDays} days ago`}
                  </p>
                </div>
              </div>

              <div className="panel p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Purchase intent</p>
                  <IntentBadge level={d.intentLevel} />
                </div>
                <p className="text-primary mt-2 text-2xl font-semibold">{d.intentScore}/100</p>
                <p className="text-muted-foreground mt-2 text-sm">{d.recommendation}</p>
              </div>

              <div className="panel p-4">
                <p className="text-sm font-semibold">Smart offer</p>
                <p className="mt-2 text-sm">
                  {d.smartOffer.productName} —{" "}
                  <span className="text-muted-foreground line-through">
                    {currencyPrecise(d.smartOffer.originalPrice)}
                  </span>{" "}
                  <span className="text-success font-semibold">
                    {currencyPrecise(d.smartOffer.finalPrice)}
                  </span>{" "}
                  ({d.smartOffer.discountPercent}% off)
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Purchase history</p>
                {d.purchases.length === 0 ? (
                  <EmptyState title="No orders yet." />
                ) : (
                  <div className="panel overflow-x-auto p-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.purchases.map((s) => (
                          <TableRow key={s.sale_id}>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {dateFmt(s.sale_date)}
                            </TableCell>
                            <TableCell>{s.productName}</TableCell>
                            <TableCell className="text-right">{s.quantity}</TableCell>
                            <TableCell className="text-right font-medium">
                              {currencyPrecise(s.total_amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle>
            <DialogDescription>
              Lifetime value updates automatically as orders are recorded.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone (optional)</Label>
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The account is removed from your customer list. Past orders are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove.mutate(deleteTarget.customer_id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
