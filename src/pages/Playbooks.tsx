import { useState } from "react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookOpen, Plus, Trash2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Playbook = Tables<"playbooks">;

export default function Playbooks() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "Processos", file_url: "" });

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playbooks").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Playbook[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["playbooks"] });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("playbooks").insert({
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        file_url: form.file_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Playbook publicado");
      setOpen(false);
      setForm({ title: "", description: "", category: "Processos", file_url: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playbooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Playbook removido"); invalidate(); },
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

  const openFile = async (pb: Playbook) => {
    if (!pb.file_url) return;
    window.open(pb.file_url, "_blank", "noopener");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biblioteca de Playbooks"
        subtitle="Recursos de apoio do SEE_4X — modelos, checklists e processos prontos."
        action={isStaff ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-brand"><Plus className="h-4 w-4 mr-1" /> Novo playbook</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo playbook</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Playbook de Reunião Semanal" /></div>
                <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <div>
                  <Label>Arquivo (PDF, DOC, XLS)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} disabled={uploading} />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  {form.file_url && <p className="text-xs text-success mt-1">Arquivo pronto para publicar.</p>}
                </div>
              </div>
              <DialogFooter><Button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending}>Publicar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      {isLoading && <Card className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando playbooks...</Card>}
      {!isLoading && playbooks.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nenhum playbook publicado ainda.
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {playbooks.map((pb) => (
          <Card key={pb.id} className="p-5 shadow-card hover:shadow-elegant transition-all group">
            <div className="flex items-start justify-between gap-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-gold" />
              </div>
              {isStaff && (
                <button
                  onClick={() => { if (confirm("Excluir playbook?")) removeMut.mutate(pb.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Excluir playbook"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              )}
            </div>
            {pb.category && <Badge variant="secondary" className="mt-3">{pb.category}</Badge>}
            <h3 className="font-bold mt-2">{pb.title}</h3>
            {pb.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{pb.description}</p>}
            {pb.file_url && (
              <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => openFile(pb)}>
                <Download className="h-4 w-4 mr-2" /> Abrir material
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
