"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Edit3, Package, Plus, Save, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type ExpenseCategory,
  type IncomeCategory,
  type Product,
  type ProductKind
} from "@/lib/finance-types";
import { cn, formatCRC } from "@/lib/utils";

type ProductCatalogProps = {
  products: Product[];
  onCreate: (payload: Record<string, unknown>) => Promise<Product>;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<Product>;
  onDelete: (id: string) => Promise<void>;
};

type ProductDraft = {
  name: string;
  kind: ProductKind;
  category: IncomeCategory | ExpenseCategory;
  subcategory: string;
  size: string;
  defaultPrice: string;
  active: boolean;
};

const defaultDraft: ProductDraft = {
  name: "",
  kind: "sell",
  category: "Ceviche",
  subcategory: "",
  size: "",
  defaultPrice: "",
  active: true
};

export function ProductCatalog({ products, onCreate, onUpdate, onDelete }: ProductCatalogProps) {
  const [kind, setKind] = React.useState<ProductKind>("sell");
  const [draft, setDraft] = React.useState<ProductDraft>(defaultDraft);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<ProductDraft | null>(null);
  const [saving, setSaving] = React.useState(false);

  const visibleProducts = products
    .filter((product) => (product.kind ?? "sell") === kind)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  function categoriesFor(productKind: ProductKind) {
    return productKind === "sell" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  }

  function setDraftKind(nextKind: ProductKind) {
    setDraft({
      ...draft,
      kind: nextKind,
      category: categoriesFor(nextKind)[0],
      subcategory: "",
      size: ""
    });
  }

  async function handleCreate() {
    const payload = buildProductPayload(draft);
    if (!payload.name) return;

    setSaving(true);
    try {
      await onCreate(payload);
      setDraft({ ...defaultDraft, kind, category: categoriesFor(kind)[0] });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(product: Product) {
    const productKind = product.kind ?? "sell";
    setEditingId(String(product._id));
    setEditDraft({
      name: product.name,
      kind: productKind,
      category: product.category,
      subcategory: product.subcategory ?? "",
      size: product.size ?? "",
      defaultPrice: String(product.defaultPrice),
      active: product.active
    });
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    const payload = buildProductPayload(editDraft);
    if (!payload.name) return;

    setSaving(true);
    try {
      await onUpdate(id, payload);
      setEditingId(null);
      setEditDraft(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Productos
            </CardTitle>
            <CardDescription>Administra lo que vendes y lo que compras.</CardDescription>
          </div>
          <div className="grid grid-cols-2 rounded-2xl bg-secondary p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("rounded-xl", kind === "sell" && "bg-card shadow-sm hover:bg-card")}
              onClick={() => {
                setKind("sell");
                setDraftKind("sell");
              }}
            >
              Vendo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("rounded-xl", kind === "buy" && "bg-card shadow-sm hover:bg-card")}
              onClick={() => {
                setKind("buy");
                setDraftKind("buy");
              }}
            >
              Compro
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border bg-muted/30 p-3">
          <div className="grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.9fr_0.8fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Producto</Label>
              <Input
                value={productDisplayName(draft)}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                disabled={usesStructuredSellOptions(draft)}
                placeholder={usesStructuredSellOptions(draft) ? "Se crea automatico" : kind === "sell" ? "Ej: Refresco natural" : "Ej: Pescado entero"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <CategorySelect
                kind={draft.kind}
                value={draft.category}
                onChange={(category) => setDraft({ ...draft, category, subcategory: "", size: "" })}
              />
            </div>
            <StructuredProductOptions draft={draft} products={products} onChange={setDraft} />
            <div className="space-y-1">
              <Label className="text-xs">{kind === "sell" ? "Precio venta" : "Costo ref."}</Label>
              <Input
                value={draft.defaultPrice}
                onChange={(event) => setDraft({ ...draft, defaultPrice: event.target.value })}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="₡0"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="h-12 w-full md:w-12 md:p-0"
                onClick={handleCreate}
                disabled={saving || !canSaveProductDraft(draft)}
                aria-label="Agregar producto"
              >
                <Plus className="h-5 w-5" />
                <span className="md:sr-only">Agregar</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {visibleProducts.length ? (
            visibleProducts.map((product) => {
              const id = String(product._id);
              const isEditing = editingId === id && editDraft;

              return (
                <motion.div
                  key={id}
                  layout
                  className="rounded-2xl border bg-background p-3"
                >
                  {isEditing ? (
                    <div className="grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.9fr_0.8fr_auto]">
                      <Input
                        value={productDisplayName(editDraft)}
                        onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                        disabled={usesStructuredSellOptions(editDraft)}
                        placeholder="Nombre"
                      />
                      <CategorySelect
                        kind={editDraft.kind}
                        value={editDraft.category}
                        onChange={(category) => setEditDraft({ ...editDraft, category, subcategory: "", size: "" })}
                      />
                      <StructuredProductOptions draft={editDraft} products={products} onChange={setEditDraft} />
                      <Input
                        value={editDraft.defaultPrice}
                        onChange={(event) => setEditDraft({ ...editDraft, defaultPrice: event.target.value })}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant={editDraft.active ? "success" : "secondary"}
                          size="icon"
                          onClick={() => setEditDraft({ ...editDraft, active: !editDraft.active })}
                          aria-label="Cambiar estado"
                        >
                          {editDraft.active ? "On" : "Off"}
                        </Button>
                        <Button type="button" size="icon" onClick={() => saveEdit(id)} disabled={saving} aria-label="Guardar producto">
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft(null);
                          }}
                          aria-label="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{product.name}</p>
                          <Badge variant={product.active ? "success" : "secondary"}>
                            {product.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {product.category}
                          {product.subcategory ? ` · ${product.subcategory}` : ""}
                          {product.size ? ` · ${product.size}` : ""} · {kind === "sell" ? "Precio" : "Costo ref."}{" "}
                          {formatCRC(product.defaultPrice)}
                        </p>
                      </div>
                      <Button type="button" variant="secondary" size="icon" onClick={() => startEdit(product)} aria-label="Editar producto">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="destructive" size="icon" onClick={() => onDelete(id)} aria-label="Eliminar producto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Agrega productos para tenerlos listos en ventas y compras.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StructuredProductOptions({
  draft,
  products,
  onChange
}: {
  draft: ProductDraft;
  products: Product[];
  onChange: (draft: ProductDraft) => void;
}) {
  if (!usesStructuredSellOptions(draft)) {
    return null;
  }

  const subcategories = optionValues(products, draft.category, "subcategory");
  const sizes = optionValues(products, draft.category, "size");

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">Subtipo</Label>
        <Input
          value={draft.subcategory}
          onChange={(event) => onChange({ ...draft, subcategory: event.target.value })}
          list={`subcategories-${draft.category}`}
          placeholder="Ej: Normal"
        />
        <datalist id={`subcategories-${draft.category}`}>
          {subcategories.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tamaño</Label>
        <Input
          value={draft.size}
          onChange={(event) => onChange({ ...draft, size: event.target.value })}
          list={`sizes-${draft.category}`}
          placeholder="Ej: 9oz"
        />
        <datalist id={`sizes-${draft.category}`}>
          {sizes.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

function usesStructuredSellOptions(draft: ProductDraft) {
  return draft.kind === "sell" && (draft.category === "Ceviche" || draft.category === "Caldosa");
}

function productDisplayName(draft: ProductDraft) {
  if (!usesStructuredSellOptions(draft)) return draft.name;
  return structuredProductName(draft);
}

function structuredProductName(draft: ProductDraft) {
  return [draft.category, draft.subcategory.trim(), normalizeProductSize(draft.size)].filter(Boolean).join(" ");
}

function canSaveProductDraft(draft: ProductDraft) {
  const hasName = usesStructuredSellOptions(draft)
    ? Boolean(draft.subcategory.trim() && draft.size.trim())
    : Boolean(draft.name.trim());

  return hasName && (draft.kind !== "sell" || Boolean(draft.defaultPrice));
}

function buildProductPayload(draft: ProductDraft) {
  const structured = usesStructuredSellOptions(draft);
  const subcategory = draft.subcategory.trim();
  const size = normalizeProductSize(draft.size);
  const name = structured ? structuredProductName(draft) : draft.name.trim();

  return {
    ...draft,
    name,
    subcategory: structured ? subcategory : undefined,
    size: structured ? size : undefined,
    defaultPrice: Number(draft.defaultPrice || 0)
  };
}

function optionValues(products: Product[], category: IncomeCategory | ExpenseCategory, field: "subcategory" | "size") {
  return Array.from(
    new Set(
      products
        .filter((product) => product.kind !== "buy" && product.category === category && product[field])
        .map((product) => String(product[field]))
    )
  ).sort((a, b) => (field === "size" ? compareProductSize(a, b) : a.localeCompare(b)));
}

function normalizeProductSize(value: string) {
  const match = value.trim().match(/^(\d{1,2})\s*o?z$/i);
  return match ? `${match[1]}oz` : value.trim();
}

function compareProductSize(a: string, b: string) {
  const aNumber = Number(a.match(/\d+/)?.[0] ?? 0);
  const bNumber = Number(b.match(/\d+/)?.[0] ?? 0);

  return aNumber - bNumber || a.localeCompare(b);
}

function CategorySelect({
  kind,
  value,
  onChange
}: {
  kind: ProductKind;
  value: IncomeCategory | ExpenseCategory;
  onChange: (value: IncomeCategory | ExpenseCategory) => void;
}) {
  const categories = kind === "sell" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as IncomeCategory | ExpenseCategory)}
      className="h-12 w-full rounded-2xl border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      {categories.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}
