import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createProduct, deleteProduct, updateProduct } from "@/lib/catalog.functions";
import { currencyPrecise, dateFmt, numberFmt } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/agentx/page-header";
import { RiskBadge } from "@/components/agentx/status-badge";
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

export const Route = createFileRoute("/_app/products")({
  head: () => ({
    meta: [
      { title: "Products — AGENTX Commerce Intelligence" },
      {
        name: "description",
        content:
          "Manage your catalogue with live margin, stock-level intelligence, search and filters.",
      },
      { property: "og:title", content: "Products — AGENTX" },
      {
        property: "og:description",
        content: "Manage your catalogue with live margin and stock-level intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

type ProductRow = {
  product_id: string;
  product_name: string;
  category: string;
  price: number | string;
  cost: number | string;
  stock: number;
  created_at: string;
};

type FormState = {
  product_name: string;
  category: string;
  price: string;
  cost: string;
  stock: string;
};

const EMPTY_FORM: FormState = { product_name: "", category: "", price: "", cost: "", stock: "" };

const stockLevel = (stock: number) => (stock > 250 ? "High" : stock > 60 ? "Medium" : "Low");
const marginOf = (price: number, cost: number) => (price > 0 ? ((price - cost) / price) * 100 : 0);

function ProductsPage() {
  const queryClient = useQueryClient();
  const runCreate = useServerFn(createProduct);
  const runUpdate = useServerFn(updateProduct);
  const runDelete = useServerFn(deleteProduct);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("product_name");
      if (error) throw new Error(error.message);
      return data as ProductRow[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["intelligence"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        product_name: form.product_name.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        cost: Number(form.cost),
        stock: Number(form.stock),
      };
      if (Number.isNaN(payload.price) || payload.price <= 0) throw new Error("Enter a price above 0.");
      if (Number.isNaN(payload.cost) || payload.cost < 0) throw new Error("Enter a valid cost.");
      if (payload.cost >= payload.price) throw new Error("Cost must be lower than price.");
      if (!Number.isInteger(payload.stock) || payload.stock < 0)
        throw new Error("Stock must be a whole number of units.");
      return editing
        ? runUpdate({ data: { ...payload, product_id: editing.product_id } })
        : runCreate({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated." : "Product added.");
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormError(null);
      refresh();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => runDelete({ data: { product_id: id } }),
    onSuccess: () => {
      toast.success("Product deleted.");
      setDeleteTarget(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categories = useMemo(
    () => [...new Set((data ?? []).map((p) => p.category))].sort(),
    [data],
  );

  const rows = useMemo(
    () =>
      (data ?? []).filter((p) => {
        const term = q.trim().toLowerCase();
        const matchTerm =
          !term ||
          p.product_name.toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term);
        const matchCat = category === "all" || p.category === category;
        const matchLevel = level === "all" || stockLevel(p.stock) === level;
        return matchTerm && matchCat && matchLevel;
      }),
    [data, q, category, level],
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setForm({
      product_name: p.product_name,
      category: p.category,
      price: String(Number(p.price)),
      cost: String(Number(p.cost)),
      stock: String(p.stock),
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const totals = useMemo(() => {
    const stockValue = rows.reduce((a, p) => a + Number(p.cost) * p.stock, 0);
    const avgMargin = rows.length
      ? rows.reduce((a, p) => a + marginOf(Number(p.price), Number(p.cost)), 0) / rows.length
      : 0;
    const lowStock = rows.filter((p) => stockLevel(p.stock) === "Low").length;
    return { stockValue, avgMargin, lowStock };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Products"
        description="Pricing, margin and inventory position across your catalogue."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" /> Add product
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-muted-foreground text-xs">Products in view</p>
          <p className="mt-1 text-xl font-semibold">{numberFmt(rows.length)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-muted-foreground text-xs">Inventory value at cost</p>
          <p className="mt-1 text-xl font-semibold">{currencyPrecise(totals.stockValue)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-muted-foreground text-xs">Average margin · low stock</p>
          <p className="mt-1 text-xl font-semibold">
            {totals.avgMargin.toFixed(1)}% · {totals.lowStock}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search products or categories…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Stock level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock levels</SelectItem>
            <SelectItem value="High">High stock</SelectItem>
            <SelectItem value="Medium">Medium stock</SelectItem>
            <SelectItem value="Low">Low stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState title="No products found." hint="Adjust your filters or add a new product." />
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const price = Number(p.price);
                const cost = Number(p.cost);
                return (
                  <TableRow key={p.product_id}>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.category}</TableCell>
                    <TableCell className="text-right">{currencyPrecise(price)}</TableCell>
                    <TableCell className="text-right">{currencyPrecise(cost)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {marginOf(price, cost).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">{numberFmt(p.stock)}</TableCell>
                    <TableCell>
                      <RiskBadge level={stockLevel(p.stock)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dateFmt(p.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${p.product_name}`}
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${p.product_name}`}
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              Margin is calculated automatically from price and cost.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-name">Product name</Label>
              <Input
                id="p-name"
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-cat">Category</Label>
              <Input
                id="p-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Price</Label>
              <Input
                id="p-price"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">Cost</Label>
              <Input
                id="p-cost"
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">Stock units</Label>
              <Input
                id="p-stock"
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <p className="text-muted-foreground text-sm">
                Margin:{" "}
                <span className="text-foreground font-semibold">
                  {marginOf(Number(form.price) || 0, Number(form.cost) || 0).toFixed(1)}%
                </span>
              </p>
            </div>
          </div>

          {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.product_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product from your catalogue. Sales history for it is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove.mutate(deleteTarget.product_id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
