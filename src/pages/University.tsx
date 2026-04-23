import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Play, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function University() {
  const [courses, setCourses] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("courses").select("*").eq("published", true).order("order_index"),
      supabase.from("lessons").select("*").order("order_index"),
    ]).then(([c, l]) => { setCourses(c.data || []); setLessons(l.data || []); });
  }, []);

  const lessonsOf = (id: string) => lessons.filter((l) => l.course_id === id);

  return (
    <div className="space-y-6">
      <PageHeader title="Universidade 4X" subtitle="Trilhas, aulas, playbooks e materiais do método." />

      {courses.length === 0 && <Card className="p-12 text-center text-muted-foreground">Nenhum curso publicado ainda.</Card>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map((c) => {
          const ls = lessonsOf(c.id);
          return (
            <Card key={c.id} className="overflow-hidden shadow-card hover:shadow-elegant transition-all group">
              <div className="h-40 bg-gradient-brand relative flex items-center justify-center">
                <GraduationCap className="h-16 w-16 text-gold/60" />
                <Badge className="absolute top-3 left-3 bg-gold text-gold-foreground">{c.category}</Badge>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg">{c.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Play className="h-3.5 w-3.5" /> {ls.length} aulas
                </div>
                <div className="mt-4 space-y-1">
                  {ls.slice(0, 3).map((l) => (
                    <button key={l.id} onClick={() => setActive(l)} className="w-full text-left flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors">
                      <Play className="h-3 w-3 text-royal" />
                      <span className="flex-1 truncate">{l.title}</span>
                      <span className="text-[10px] text-muted-foreground"><Clock className="h-3 w-3 inline" /> {l.duration_min}min</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{active?.description}</p>
          {active?.video_url ? (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <iframe src={active.video_url} className="w-full h-full" allowFullScreen />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-brand rounded-lg flex items-center justify-center text-primary-foreground">
              <Play className="h-16 w-16 text-gold" />
            </div>
          )}
          {active?.pdf_url && <Button variant="outline" asChild><a href={active.pdf_url} target="_blank"><FileText className="h-4 w-4 mr-2" /> Material PDF</a></Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
