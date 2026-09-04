import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  GraduationCap, Plus, Pencil, Trash2, Upload, Loader2, Play, FileText,
  Clock, Eye, EyeOff, Image as ImageIcon, ChevronUp, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

type Course = {
  id: string; title: string; category: string; description: string | null;
  cover_url: string | null; published: boolean; order_index: number | null;
};
type Lesson = {
  id: string; course_id: string; title: string; description: string | null;
  video_url: string | null; pdf_url: string | null;
  duration_min: number | null; order_index: number | null;
};

const emptyCourse: Partial<Course> = { title: "", category: "", description: "", cover_url: "", published: true, order_index: 0 };
const emptyLesson = (course_id = ""): Partial<Lesson> => ({
  course_id, title: "", description: "", video_url: "", pdf_url: "", duration_min: 0, order_index: 0,
});

export default function AdminUniversity() {
  const { isStaff } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const [courseDialog, setCourseDialog] = useState(false);
  const [courseForm, setCourseForm] = useState<Partial<Course>>(emptyCourse);
  const [courseUploading, setCourseUploading] = useState(false);
  const courseFileRef = useRef<HTMLInputElement>(null);

  const [lessonDialog, setLessonDialog] = useState(false);
  const [lessonForm, setLessonForm] = useState<Partial<Lesson>>(emptyLesson());
  const [videoUploading, setVideoUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const videoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [deleting, setDeleting] = useState<{ type: "course" | "lesson"; id: string; title: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from("courses").select("*").order("order_index", { ascending: true }),
      supabase.from("lessons").select("*").order("order_index", { ascending: true }),
    ]);
    setCourses((c as Course[]) || []);
    setLessons((l as Lesson[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (!isStaff) return <Navigate to="/" replace />;

  const lessonsOf = (cid: string) => lessons.filter((l) => l.course_id === cid);

  // ----- Course handlers -----
  const openNewCourse = () => { setCourseForm({ ...emptyCourse, order_index: courses.length + 1 }); setCourseDialog(true); };
  const openEditCourse = (c: Course) => { setCourseForm(c); setCourseDialog(true); };

  const saveCourse = async () => {
    if (!courseForm.title?.trim() || !courseForm.category?.trim()) {
      toast.error("Título e categoria são obrigatórios"); return;
    }
    const payload = {
      title: courseForm.title!.trim(),
      category: courseForm.category!.trim(),
      description: courseForm.description || null,
      cover_url: courseForm.cover_url || null,
      published: !!courseForm.published,
      order_index: Number(courseForm.order_index) || 0,
    };
    const { error } = courseForm.id
      ? await supabase.from("courses").update(payload).eq("id", courseForm.id)
      : await supabase.from("courses").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(courseForm.id ? "Curso atualizado" : "Curso criado");
    setCourseDialog(false);
    load();
  };

  const uploadCover = async (file: File) => {
    setCourseUploading(true);
    const ext = file.name.split(".").pop();
    const path = `courses/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setCourseUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    setCourseForm((f) => ({ ...f, cover_url: pub.publicUrl }));
    setCourseUploading(false);
    toast.success("Capa enviada");
  };

  const togglePublish = async (c: Course) => {
    const { error } = await supabase.from("courses").update({ published: !c.published }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    setCourses((arr) => arr.map((x) => x.id === c.id ? { ...x, published: !c.published } : x));
  };

  const moveCourse = async (c: Course, dir: -1 | 1) => {
    const sorted = [...courses].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const idx = sorted.findIndex((x) => x.id === c.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("courses").update({ order_index: swap.order_index }).eq("id", c.id),
      supabase.from("courses").update({ order_index: c.order_index }).eq("id", swap.id),
    ]);
    load();
  };

  // ----- Lesson handlers -----
  const openNewLesson = (cid: string) => {
    const ord = lessonsOf(cid).length + 1;
    setLessonForm({ ...emptyLesson(cid), order_index: ord });
    setLessonDialog(true);
  };
  const openEditLesson = (l: Lesson) => { setLessonForm(l); setLessonDialog(true); };

  const saveLesson = async () => {
    if (!lessonForm.title?.trim() || !lessonForm.course_id) {
      toast.error("Título é obrigatório"); return;
    }
    const payload = {
      course_id: lessonForm.course_id,
      title: lessonForm.title!.trim(),
      description: lessonForm.description || null,
      video_url: lessonForm.video_url || null,
      pdf_url: lessonForm.pdf_url || null,
      duration_min: Number(lessonForm.duration_min) || 0,
      order_index: Number(lessonForm.order_index) || 0,
    };
    const { error } = lessonForm.id
      ? await supabase.from("lessons").update(payload).eq("id", lessonForm.id)
      : await supabase.from("lessons").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(lessonForm.id ? "Aula atualizada" : "Aula criada");
    setLessonDialog(false);
    load();
  };

  const uploadToLessons = async (file: File, kind: "video" | "pdf") => {
    const setUp = kind === "video" ? setVideoUploading : setPdfUploading;
    setUp(true);
    const ext = file.name.split(".").pop();
    const path = `${lessonForm.course_id || "misc"}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lessons").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); setUp(false); return; }
    // Fase 6c — guarda o caminho no bucket; o player gera link assinado curto ao abrir a aula.
    const url = path;

    setLessonForm((f) => kind === "video" ? { ...f, video_url: url } : { ...f, pdf_url: url });
    setUp(false);
    toast.success(`${kind === "video" ? "Vídeo" : "PDF"} enviado`);
  };

  const moveLesson = async (l: Lesson, dir: -1 | 1) => {
    const arr = lessonsOf(l.course_id).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const idx = arr.findIndex((x) => x.id === l.id);
    const swap = arr[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("lessons").update({ order_index: swap.order_index }).eq("id", l.id),
      supabase.from("lessons").update({ order_index: l.order_index }).eq("id", swap.id),
    ]);
    load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (deleting.type === "course") {
      await supabase.from("lessons").delete().eq("course_id", deleting.id);
      const { error } = await supabase.from("courses").delete().eq("id", deleting.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("lessons").delete().eq("id", deleting.id);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Removido");
    setDeleting(null);
    load();
  };

  const stats = ({
    courses: courses.length,
    published: courses.filter((c) => c.published).length,
    lessons: lessons.length,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universidade 4X (Admin)"
        subtitle="Cadastre cursos e aulas, faça upload de vídeos, PDFs e capas."
        action={<Button onClick={openNewCourse} className="bg-gradient-brand"><Plus className="h-4 w-4 mr-1" /> Novo curso</Button>}
      />

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 shadow-card"><div className="text-xs text-muted-foreground">Cursos</div><div className="text-2xl font-bold">{stats.courses}</div></Card>
        <Card className="p-4 shadow-card"><div className="text-xs text-muted-foreground">Publicados</div><div className="text-2xl font-bold">{stats.published}</div></Card>
        <Card className="p-4 shadow-card"><div className="text-xs text-muted-foreground">Aulas</div><div className="text-2xl font-bold">{stats.lessons}</div></Card>
      </div>

      {loading ? (
        <Card className="p-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>
      ) : courses.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-50" />
          Nenhum curso ainda. Clique em "Novo curso" para começar.
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {courses.map((c) => {
            const ls = lessonsOf(c.id).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
            return (
              <AccordionItem key={c.id} value={c.id} className="border rounded-lg bg-card shadow-card">
                <div className="flex items-center gap-2 px-4">
                  <AccordionTrigger className="flex-1 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div className="h-12 w-12 rounded-lg overflow-hidden bg-gradient-brand flex items-center justify-center shrink-0">
                        {c.cover_url
                          ? <img src={c.cover_url} alt="" className="h-full w-full object-cover" />
                          : <GraduationCap className="h-6 w-6 text-gold/70" />}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {c.title}
                          {c.published
                            ? <Badge variant="default" className="text-[10px]">Publicado</Badge>
                            : <Badge variant="secondary" className="text-[10px]">Rascunho</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.category} · {ls.length} aula(s) · ordem {c.order_index ?? 0}</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); moveCourse(c, -1); }} aria-label="Mover curso para cima"><ChevronUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); moveCourse(c, 1); }} aria-label="Mover curso para baixo"><ChevronDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); togglePublish(c); }} aria-label={c.published ? "Despublicar curso" : "Publicar curso"} title={c.published ? "Despublicar" : "Publicar"}>
                      {c.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditCourse(c); }} aria-label="Editar curso"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleting({ type: "course", id: c.id, title: c.title }); }} aria-label="Excluir curso">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <AccordionContent className="px-4 pb-4">
                  {c.description && <p className="text-sm text-muted-foreground mb-3">{c.description}</p>}
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Aulas</h4>
                    <Button size="sm" variant="outline" onClick={() => openNewLesson(c.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Nova aula
                    </Button>
                  </div>
                  {ls.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">Sem aulas ainda.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {ls.map((l) => (
                        <div key={l.id} className="flex items-center gap-2 p-2 rounded border bg-background/50">
                          <span className="text-xs text-muted-foreground w-6 text-center">{l.order_index ?? 0}</span>
                          <Play className="h-3.5 w-3.5 text-royal shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{l.title}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                              <Clock className="h-3 w-3" /> {l.duration_min || 0}min
                              {l.video_url && <span>· vídeo</span>}
                              {l.pdf_url && <span>· PDF</span>}
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => moveLesson(l, -1)} aria-label="Mover aula para cima"><ChevronUp className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => moveLesson(l, 1)} aria-label="Mover aula para baixo"><ChevronDown className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => openEditLesson(l)} aria-label="Editar aula"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting({ type: "lesson", id: l.id, title: l.title })} aria-label="Excluir aula">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Course Dialog */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{courseForm.id ? "Editar curso" : "Novo curso"}</DialogTitle>
            <DialogDescription>Defina título, categoria, capa e ordem de exibição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={courseForm.title || ""} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} /></div>
            <div><Label>Categoria *</Label><Input value={courseForm.category || ""} onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })} placeholder="Ex: Estratégia, Pessoas, Finanças" /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={courseForm.description || ""} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={courseForm.order_index ?? 0} onChange={(e) => setCourseForm({ ...courseForm, order_index: Number(e.target.value) })} />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={!!courseForm.published} onCheckedChange={(v) => setCourseForm({ ...courseForm, published: v })} />
                <Label className="mb-2">Publicado</Label>
              </div>
            </div>
            <div>
              <Label>Capa</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="h-16 w-24 rounded bg-muted overflow-hidden flex items-center justify-center">
                  {courseForm.cover_url
                    ? <img src={courseForm.cover_url} alt="" className="h-full w-full object-cover" />
                    : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => courseFileRef.current?.click()} disabled={courseUploading}>
                  {courseUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Enviar capa
                </Button>
                <input ref={courseFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
              </div>
              <Input className="mt-2" placeholder="ou cole uma URL" value={courseForm.cover_url || ""} onChange={(e) => setCourseForm({ ...courseForm, cover_url: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCourseDialog(false)}>Cancelar</Button>
            <Button onClick={saveCourse} className="bg-gradient-brand">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lessonForm.id ? "Editar aula" : "Nova aula"}</DialogTitle>
            <DialogDescription>Faça upload do vídeo (bucket privado) ou cole uma URL (YouTube/Vimeo).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={lessonForm.title || ""} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={lessonForm.description || ""} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Duração (min)</Label><Input type="number" value={lessonForm.duration_min ?? 0} onChange={(e) => setLessonForm({ ...lessonForm, duration_min: Number(e.target.value) })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={lessonForm.order_index ?? 0} onChange={(e) => setLessonForm({ ...lessonForm, order_index: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label>Vídeo</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => videoRef.current?.click()} disabled={videoUploading}>
                  {videoUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Upload
                </Button>
                <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadToLessons(e.target.files[0], "video")} />
                <span className="text-xs text-muted-foreground truncate">{lessonForm.video_url ? "vídeo definido" : "sem vídeo"}</span>
              </div>
              <Input className="mt-2" placeholder="ou cole uma URL embed" value={lessonForm.video_url || ""} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} />
            </div>
            <div>
              <Label>PDF / Material</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => pdfRef.current?.click()} disabled={pdfUploading}>
                  {pdfUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                  Upload PDF
                </Button>
                <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadToLessons(e.target.files[0], "pdf")} />
                <span className="text-xs text-muted-foreground truncate">{lessonForm.pdf_url ? "PDF definido" : "sem PDF"}</span>
              </div>
              <Input className="mt-2" placeholder="ou cole uma URL" value={lessonForm.pdf_url || ""} onChange={(e) => setLessonForm({ ...lessonForm, pdf_url: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLessonDialog(false)}>Cancelar</Button>
            <Button onClick={saveLesson} className="bg-gradient-brand">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {deleting?.type === "course" ? "curso" : "aula"}?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" será removido{deleting?.type === "course" ? " junto com todas as aulas vinculadas" : ""}. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
