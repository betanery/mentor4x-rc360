import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Play, FileText, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { toEmbedUrl, isDirectVideo } from "@/lib/video";

export default function University() {
  const { user } = useAuth();
  const { currentContract } = useContract();
  const [courses, setCourses] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, { completed: boolean; progress_pct: number }>>({});
  const [active, setActive] = useState<any>(null);

  const loadProgress = async () => {
    if (!user) return;
    const { data } = await supabase.from("lesson_progress").select("*").eq("user_id", user.id);
    const map: Record<string, any> = {};
    (data || []).forEach((p: any) => { map[p.lesson_id] = { completed: p.completed, progress_pct: p.progress_pct }; });
    setProgress(map);
  };

  useEffect(() => {
    const coursesQuery = supabase.from("courses").select("*").eq("published", true).order("order_index");
    if (currentContract) coursesQuery.eq("product_version_id", currentContract.product_version_id);
    Promise.all([coursesQuery, supabase.from("lessons").select("*").order("order_index")])
      .then(([c, l]) => {
        const courseRows = c.data || [];
        const allowed = new Set(courseRows.map((course: any) => course.id));
        setCourses(courseRows);
        setLessons((l.data || []).filter((lesson: any) => allowed.has(lesson.course_id)));
      });
    loadProgress();
  }, [user, currentContract]);

  const lessonsOf = (id: string) => lessons.filter((l) => l.course_id === id);
  const courseProgress = (id: string) => {
    const ls = lessonsOf(id);
    if (!ls.length) return 0;
    const done = ls.filter((l) => progress[l.id]?.completed).length;
    return Math.round((done / ls.length) * 100);
  };

  const toggleComplete = async (lessonId: string, completed: boolean) => {
    if (!user) return;
    const { error } = await supabase.from("lesson_progress").upsert(
      { user_id: user.id, lesson_id: lessonId, completed, progress_pct: completed ? 100 : 0 },
      { onConflict: "user_id,lesson_id" }
    );
    if (error) { toast.error(error.message); return; }
    toast.success(completed ? "Aula concluída" : "Aula reaberta");
    loadProgress();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Universidade 4X" subtitle="Recursos de apoio do SEE_4X — trilhas, aulas e materiais de implementação." />

      {courses.length === 0 && <Card className="p-12 text-center text-muted-foreground">Nenhum curso publicado ainda.</Card>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map((c) => {
          const ls = lessonsOf(c.id);
          const pct = courseProgress(c.id);
          return (
            <Card key={c.id} className="overflow-hidden shadow-card hover:shadow-elegant transition-all group">
              <div className="h-40 bg-gradient-brand relative flex items-center justify-center">
                <GraduationCap className="h-16 w-16 text-gold/60" />
                <Badge className="absolute top-3 left-3 bg-gold text-gold-foreground">{c.category}</Badge>
                {pct === 100 && <Badge className="absolute top-3 right-3 bg-success text-success-foreground">Concluído</Badge>}
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg">{c.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Play className="h-3.5 w-3.5" /> {ls.length} aulas · {pct}% concluído
                </div>
                <Progress value={pct} className="mt-2 h-1.5" />
                <div className="mt-4 space-y-1">
                  {ls.slice(0, 4).map((l) => {
                    const done = progress[l.id]?.completed;
                    return (
                      <button key={l.id} onClick={() => setActive(l)} className="w-full text-left flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors">
                        {done ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Play className="h-3 w-3 text-royal" />}
                        <span className={`flex-1 truncate ${done ? "line-through text-muted-foreground" : ""}`}>{l.title}</span>
                        <span className="text-[10px] text-muted-foreground"><Clock className="h-3 w-3 inline" /> {l.duration_min}min</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{active?.description}</p>
          {active?.video_url ? (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {isDirectVideo(active.video_url) ? (
                <video
                  src={active.video_url}
                  controls
                  className="w-full h-full"
                  onEnded={() => { if (!progress[active.id]?.completed) toggleComplete(active.id, true); }}
                />
              ) : (
                <iframe
                  src={toEmbedUrl(active.video_url)}
                  title={active.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          ) : (
            <div className="aspect-video bg-gradient-brand rounded-lg flex items-center justify-center text-primary-foreground">
              <Play className="h-16 w-16 text-gold" />
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            {active?.pdf_url && <Button variant="outline" asChild><a href={active.pdf_url} target="_blank"><FileText className="h-4 w-4 mr-2" /> Material PDF</a></Button>}
            {active && (
              <Button
                onClick={() => toggleComplete(active.id, !progress[active.id]?.completed)}
                className={progress[active.id]?.completed ? "" : "bg-gradient-brand"}
                variant={progress[active.id]?.completed ? "outline" : "default"}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {progress[active.id]?.completed ? "Marcar como não concluída" : "Marcar como concluída"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
