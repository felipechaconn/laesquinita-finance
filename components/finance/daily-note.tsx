"use client";

import * as React from "react";
import { NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyNote } from "@/lib/finance-types";

type DailyNoteProps = {
  note?: DailyNote | null;
  onSave: (note: string) => Promise<void>;
};

export function DailyNote({ note, onSave }: DailyNoteProps) {
  const [value, setValue] = React.useState(note?.note ?? "");
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="h-5 w-5 text-sky-600" />
          Nota del dia
        </CardTitle>
        <CardDescription>Algo rapido: lluvia, evento, proveedor, promocion.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ej: viernes fuerte por pedidos de caldosa..."
          className="min-h-28 w-full resize-none rounded-2xl border bg-background p-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
        />
        <Button type="button" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar nota"}
        </Button>
      </CardContent>
    </Card>
  );
}
