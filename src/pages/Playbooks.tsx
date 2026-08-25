import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookOpen, Plus, Trash2, Download, Loader2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { BLINDSPOTS, blindspotByCode } from "@/lib/see4x";
import { MOTORES, PILLAR_LABEL } from "@/lib/labels";

type Playbook = Tables<"playbooks">;

const CATEGORIES = ["Processos", "Pessoas", "Finanças", "Comercial", "Governança", "Ferramentas"];

const emptyForm = {
  title: "",
  description: "",
  category: "Processos",
  file_url: "",
  pillar: "none",
  blindspot_code: "none",
  motor: "none",
  tags: "",
  order_index: 0,
};

export default function Playbooks() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [toDelete, setToDelete] = useState<Playbook | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [motorFilter, setMotorFilter] = useState("all");

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbooks")
        .select("*")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Playbook[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["playbooks"] });

  const payload = () => ({
    title: form.title,
    description: form.description || null,
    category: form.category || null,
    file_url: form.file_url || null,
    pillar: form.pillar === "none" ? null : (form.pillar as Playbook["pillar"]),
    blindspot_code: form.blindspot_code === "none" ? null : form.blindspot_code,
    motor: form.motor === "none" ? null : form.motor,
    tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
    order_index: Number(form.order_index) || 0,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("playbooks").update(payload()).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("playbooks").insert(payload());
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Playbook atualizado" : "Playbook publicado");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playbooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Playbook removido"); setToDelete(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) { toast.error("Máx 25MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `playbooks/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lessons").upload(path, file, { contentType: file.type });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data: signed } = await supabase.storage.from("lessons").createSignedUrl(path, 60 * 60 * 24 * 365);
    setForm((f) => ({ ...f, file_url: signed?.signedUrl || path }));
    setUploading(false);
    toast.success("Arquivo anexado");
  };

  const startCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (pb: Playbook) => {
    setEditing(pb);
    setForm({
      title: pb.title,
      description: pb.description || "",
      category: pb.category || "Processos",
      file_url: pb.file_url || "",
      pillar: pb.pillar || "none",
      blindspot_code: pb.blindspot_code || "none",
      motor: pb.motor || "none",
      tags: (pb.tags || []).join(", "),
      order_index: pb.order_index ?? 0,
    });
    setOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return playbooks.filter((pb) => {
      if (pillarFilter !== "all" && pb.pillar !== pillarFilter) return false;
      if (motorFilter !== "all" && pb.motor !== motorFilter) return false;
      if (!q) return true;
      const hay = [pb.title, pb.description, pb.category, (pb.tags || []).join(" "), pb.blindspot_code]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [playbooks, search, pillarFilter, motorFilter]);

  const blindspotOptions = form.pillar === "none" ? BLINDSPOTS : BLINDSPOTS.filter((b) => b.pillar === form.pillar);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biblioteca de Playbooks"
        subtitle="Recursos de apoio do SEE_4X — modelos, checklists e processos prontos por Pilar, BlindSpot e Motor."
        action={isStaff ? (
          <Button className="bg-gradient-brand" onClick={startCreate}><Plus className="h-4 w-4 mr-1" /> Novo playbook</Button>
        ) : undefined}
      />

      <Card className="p-4 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por título, tag ou BlindSpot" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={pillarFilter} onValueChange={setPillarFilter}>
            <SelectTrigger><SelectValue placeholder="Pilar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pilares</SelectItem>
              {Object.entries(PILLAR_LABEL).map(([key, v]) => <SelectItem key={key} value={key}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={motorFilter} onValueChange={setMotorFilter}>
            <SelectTrigger><SelectValue placeholder="Motor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motores</SelectItem>
              {MOTORES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading && <Card className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando playbooks...</Card>}
      {!isLoading && filtered.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          {playbooks.length === 0 ? "Nenhum playbook publicado ainda." : "Nenhum playbook encontrado com esses filtros."}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((pb) => {
          const bs = pb.blindspot_code ? blindspotByCode(pb.blindspot_code) : undefined;
          const motor = MOTORES.find((m) => m.key === pb.motor);
          return (
            <Card key={pb.id} className="p-5 shadow-card hover:shadow-elegant transition-all group flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="h-10 w-10 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-gold" />
                </div>
                {isStaff && (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(pb)} aria-label="Editar playbook">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => setToDelete(pb)} aria-label="Excluir playbook">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {pb.category && <Badge variant="secondary">{pb.category}</Badge>}
                {pb.pillar && <Badge variant="outline">{PILLAR_LABEL[pb.pillar]?.label}</Badge>}
                {motor && <Badge variant="outline">{motor.label}</Badge>}
              </div>
              <h3 className="font-bold mt-2">{pb.title}</h3>
              {bs && <p className="text-xs text-muted-foreground mt-1">BlindSpot {bs.code} · {bs.title}</p>}
              {pb.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{pb.description}</p>}
              {pb.tags && pb.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {pb.tags.map((t) => <span key={t} className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">{t}</span>)}
                </div>
              )}
              {pb.file_url && (
                <Button variant="outline" size="sm" className="mt-4 w-full mt-auto" onClick={() => window.open(pb.file_url!, "_blank", "noopener")}>
                  <Download className="h-4 w-4 mr-2" /> Abrir material
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar playbook" : "Novo playbook"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Playbook de Reunião Semanal" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ordem</Label><Input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pilar 4X</Label>
                <Select value={form.pillar} onValueChange={(v) => setForm({ ...form, pillar: v, blindspot_code: "none" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem pilar</SelectItem>
                    {Object.entries(PILLAR_LABEL).map(([key, v]) => <SelectItem key={key} value={key}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motor metodológico</Label>
                <Select value={form.motor} onValueChange={(v) => setForm({ ...form, motor: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem motor</SelectItem>
                    {MOTORES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>BlindSpot relacionado</Label>
              <Select value={form.blindspot_code} onValueChange={(v) => setForm({ ...form, blindspot_code: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {blindspotOptions.map((b) => <SelectItem key={b.code} value={b.code}>{b.code} · {b.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div><Label>Tags (separadas por vírgula)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="cadência, indicadores, ritual" /></div>
            <div>
              <Label>Arquivo (PDF, DOC, XLS)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} disabled={uploading} />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {form.file_url && <p className="text-xs text-success mt-1">Arquivo pronto.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMut.mutate()} disabled={!form.title || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir playbook?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.title}" será removido da biblioteca. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => toDelete && removeMut.mutate(toDelete.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
