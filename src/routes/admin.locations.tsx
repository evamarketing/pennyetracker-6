import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, ChevronRight, Trash2, Pencil, Check, X, MapPin, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/locations")({ component: Locations });

function Locations() {
  const [stateId, setStateId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [panchayathId, setPanchayathId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="mt-1 text-sm text-muted-foreground">State → District → Panchayath → Ward</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin/mapping/panchayath"><MapPin className="h-3.5 w-3.5" /> Map panchayaths</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin/mapping/ward"><MapIcon className="h-3.5 w-3.5" /> Map wards</Link>
          </Button>
        </div>
      </div>
      <Card className="mt-4 border-dashed bg-muted/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>
              Pin panchayaths and wards on Google Maps. Use device location or click the map. Pins are
              cached on this device for offline viewing.
            </span>
          </div>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/admin/settings">Set API key <ChevronRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <Column
          title="States"
          table="states"
          parentField={null}
          parentId={null}
          selectedId={stateId}
          onSelect={(id) => { setStateId(id); setDistrictId(null); setPanchayathId(null); }}
        />
        <Column
          title="Districts"
          table="districts"
          parentField="state_id"
          parentId={stateId}
          selectedId={districtId}
          onSelect={(id) => { setDistrictId(id); setPanchayathId(null); }}
        />
        <Column
          title="Panchayaths"
          table="panchayaths"
          parentField="district_id"
          parentId={districtId}
          selectedId={panchayathId}
          onSelect={setPanchayathId}
          extraField={{ key: "ward_count", label: "Ward count (e.g. 25)", type: "number" }}
        />
        <Column
          title="Wards"
          table="wards"
          parentField="panchayath_id"
          parentId={panchayathId}
          selectedId={null}
          onSelect={() => {}}
          extraField={{ key: "ward_number", label: "Ward #" }}
          bulkAdd={panchayathId ? { parentId: panchayathId } : undefined}
        />
      </div>
    </div>
  );
}

function Column({
  title, table, parentField, parentId, selectedId, onSelect, extraField, bulkAdd,
}: {
  title: string;
  table: "states" | "districts" | "panchayaths" | "wards";
  parentField: string | null;
  parentId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  extraField?: { key: string; label: string; type?: string };
  bulkAdd?: { parentId: string };
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const enabled = parentField === null || !!parentId;

  const { data = [] } = useQuery({
    queryKey: [table, parentId],
    queryFn: async () => {
      let q = supabase.from(table).select("*").order(table === "wards" ? "ward_number" : "name");
      if (parentField && parentId) q = q.eq(parentField, parentId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled,
  });

  const add = useMutation({
    mutationFn: async () => {
      // Special case: creating a panchayath also seeds wards 1..N
      if (table === "panchayaths") {
        const count = Math.max(0, Math.min(500, parseInt(extra || "0", 10) || 0));
        const payload: any = { name };
        if (parentField && parentId) payload[parentField] = parentId;
        const { data: pan, error } = await supabase.from("panchayaths").insert(payload).select("id").single();
        if (error) throw error;
        if (count > 0 && pan?.id) {
          const wards = Array.from({ length: count }, (_, i) => ({
            panchayath_id: pan.id,
            name: `Ward ${i + 1}`,
            ward_number: String(i + 1),
          }));
          const { error: wErr } = await supabase.from("wards").insert(wards);
          if (wErr) throw wErr;
        }
        return;
      }
      const payload: any = { name };
      if (parentField && parentId) payload[parentField] = parentId;
      if (extraField && extra) payload[extraField.key] = extra;
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table, parentId] });
      if (table === "panchayaths") qc.invalidateQueries({ queryKey: ["wards"] });
      setName(""); setExtra(""); toast.success("Added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table, parentId] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from(table).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table, parentId] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editExtra, setEditExtra] = useState("");

  const startEdit = (row: any) => {
    setEditingId(row.id);
    setEditName(row.name ?? "");
    setEditExtra(extraField ? String(row[extraField.key] ?? "") : "");
  };
  const cancelEdit = () => { setEditingId(null); setEditName(""); setEditExtra(""); };
  const saveEdit = (id: string) => {
    const patch: Record<string, any> = { name: editName };
    // Only allow editing ward_number on wards (not ward_count seed field on panchayaths)
    if (extraField && table === "wards") patch[extraField.key] = editExtra || null;
    update.mutate({ id, patch }, { onSuccess: () => cancelEdit() });
  };

  return (
    <Card className={!enabled ? "opacity-50" : ""}>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {enabled && (
          <div className="space-y-2">
            <Input placeholder={`New ${title.slice(0, -1).toLowerCase()}`} value={name} onChange={(e) => setName(e.target.value)} />
            {extraField && <Input type={extraField.type ?? "text"} placeholder={extraField.label} value={extra} onChange={(e) => setExtra(e.target.value)} />}
            <Button size="sm" className="w-full" onClick={() => add.mutate()} disabled={!name || add.isPending}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        )}
        {bulkAdd && <BulkAddWards panchayathId={bulkAdd.parentId} existingCount={data.length} />}
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {!enabled && <p className="text-xs text-muted-foreground">Select a {parentField?.replace("_id", "")} first</p>}
          {data.map((row: any) => {
            const active = row.id === selectedId;
            const isEditing = editingId === row.id;
            if (isEditing) {
              return (
                <div key={row.id} className="space-y-1 rounded-md border p-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className="h-8" />
                  {extraField && table === "wards" && (
                    <Input value={editExtra} onChange={(e) => setEditExtra(e.target.value)} placeholder={extraField.label} className="h-8" />
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 flex-1" onClick={() => saveEdit(row.id)} disabled={!editName || update.isPending}>
                      <Check className="h-3.5 w-3.5" /> Save
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={cancelEdit}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={row.id}
                onClick={() => onSelect(row.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                <span className="truncate">{row.name}{row.ward_number ? ` (#${row.ward_number})` : ""}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(row); }}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); del.mutate(row.id); }}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {table !== "wards" && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function BulkAddWards({ panchayathId, existingCount }: { panchayathId: string; existingCount: number }) {
  const qc = useQueryClient();
  const [count, setCount] = useState("");
  const bulk = useMutation({
    mutationFn: async () => {
      const n = Math.max(1, Math.min(500, parseInt(count, 10) || 0));
      const wards = Array.from({ length: n }, (_, i) => ({
        panchayath_id: panchayathId,
        name: `Ward ${existingCount + i + 1}`,
        ward_number: String(existingCount + i + 1),
      }));
      const { error } = await supabase.from("wards").insert(wards);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wards", panchayathId] });
      setCount("");
      toast.success("Wards added");
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <p className="text-xs text-muted-foreground">Bulk add wards</p>
      <div className="flex gap-1">
        <Input type="number" min={1} max={500} placeholder="How many?" value={count} onChange={(e) => setCount(e.target.value)} className="h-8" />
        <Button size="sm" className="h-8" onClick={() => bulk.mutate()} disabled={!count || bulk.isPending}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
