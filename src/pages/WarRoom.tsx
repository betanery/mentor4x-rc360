import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, Save, CalendarPlus, Video, MapPin, MessageSquarePlus, Lock } from "lucide-react";
import { toast } from "sonner";

const BLOCKS = [
  { key: "done", label: "1. O que foi feito", color: "border-success/30 bg-success/5" },
  { key: "blocked", label: "2. O que travou", color: "border-destructive/30 bg-destructive/5" },
  { key: "indicators", label: "3. Indicadores", color: "border-info/30 bg-info/5" },
  { key: "next_steps", label: "4. Próximos passos", color: "border-gold/30 bg-gold/5" },
  { key: "decisions", label: "5. Decisões tomadas", color: "border-primary/30 bg-primary/5" },
];

const MEETING_TYPES = [
  { value: "mentoria", label: "Mentoria" },
  { value: "estrategia", label: "Estratégia" },
  { value: "sala_guerra", label: "Sala de Guerra" },
  { value: "checkin", label: "Check-in" },
];

export default function WarRoom() {
  const { current } = useCompany();
  const { user, isStaff } = useAuth();
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [review, setReview] = useState<any>({ done: "", blocked: "", indicators: "", next_steps: "", decisions: "", ai_summary: "" });
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [meetings, setMeetings] = useState<any[]>([]);
  const [notesByMeeting, setNotesByMeeting] = useState<Record<string, any[]>>({});
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: "", scheduled_at: "", meeting_type: "mentoria", meeting_url: "", location: "", duration_min: 60 });
  const [noteOpen, setNoteOpen] = useState<{ id: string; title: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [notePrivate, setNotePrivate] = useState(false);

  const loadReviews = async () => {
    if (!current) return;
    const { data: h } = await supabase.from("weekly_reviews").select("*").eq("company_id", current.id).order("week_start", { ascending: false });
    setHistory(h || []);
    const found = (h || []).find((w) => w.week_start === weekStart);
    if (found) setReview(found);
    else setReview({ done: "", blocked: "", indicators: "", next_steps: "", decisions: "", ai_summary: "" });
  };

  const loadMeetings = async () => {
    if (!current) return;
    const { data: m } = await supabase.from("meetings").select("*").eq("company_id", current.id).order("scheduled_at", { ascending: false });
    setMeetings(m || []);
    if (m?.length) {
      const { data: notes } = await supabase.from("meeting_notes").select("*").in("meeting_id", m.map((x) => x.id)).order("created_at", { ascending: false });
      const grouped: Record<string, any[]> = {};
      (notes || []).forEach((n: any) => {
        grouped[n.meeting_id] = grouped[n.meeting_id] || [];
        grouped[n.meeting_id].push(n);
      });
      setNotesByMeeting(grouped);
    } else {
      setNotesByMeeting({});
    }
  };

  useEffect(() => { loadReviews(); }, [current, weekStart]);
  useEffect(() => { loadMeetings(); }, [current]);

  const save = async () => {
    if (!current || !user) return;
    setSaving(true);
    const payload = { company_id: current.id, week_start: weekStart, ...review, created_by: user.id };
    const { error } = await supabase.from("weekly_reviews").upsert(payload, { onConflict: "company_id,week_start" });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Sala de Guerra salva"); loadReviews(); }
  };

  const generateAta = async () => {
    if (!current) return;
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("ai-action", {
      body: { action: "weekly_summary", company_id: current.id, payload: review },
    });
    setAiLoading(false);
    if (error) { toast.error("Erro ao gerar ata"); return; }
    setReview((r: any) => ({ ...r, ai_summary: data.text }));
    toast.success("Ata gerada pela IA");
  };

  const createMeeting = async () => {
    if (!current || !user || !newMeeting.title || !newMeeting.scheduled_at) {
      toast.error("Título e data são obrigatórios"); return;
    }
    const { error } = await supabase.from("meetings").insert({
      company_id: current.id,
      title: newMeeting.title,
      scheduled_at: new Date(newMeeting.scheduled_at).toISOString(),
      meeting_type: newMeeting.meeting_type as any,
      meeting_url: newMeeting.meeting_url || null,
      location: newMeeting.location || null,
      duration_min: Number(newMeeting.duration_min) || 60,
      created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Reunião agendada");
    setNewMeetingOpen(false);
    setNewMeeting({ title: "", scheduled_at: "", meeting_type: "mentoria", meeting_url: "", location: "", duration_min: 60 });
    loadMeetings();
  };

  const addNote = async () => {
    if (!noteOpen || !user || !noteText.trim()) return;
    const { error } = await supabase.from("meeting_notes").insert({
      meeting_id: noteOpen.id, author_id: user.id, content: noteText, is_private: notePrivate,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Nota adicionada");
    setNoteOpen(null); setNoteText(""); setNotePrivate(false);
    loadMeetings();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sala de Guerra"
        subtitle="Cadência semanal e reuniões. Tudo registrado, com ata e notas."
      />

      <Tabs defaultValue="semanal">
        <TabsList>
          <TabsTrigger value="semanal">Cadência semanal</TabsTrigger>
          <TabsTrigger value="reunioes">Reuniões ({meetings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="semanal" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-44" />
            <Button onClick={save} disabled={saving} className="bg-gradient-brand"><Save className="h-4 w-4 mr-1" /> Salvar</Button>
            <p className="text-sm text-muted-foreground ml-2">Semana de {format(new Date(weekStart), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BLOCKS.map((b) => (
              <Card key={b.key} className={`p-5 shadow-card border-l-4 ${b.color}`}>
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{b.label}</Label>
                <Textarea
                  className="mt-2 min-h-[140px] resize-none border-0 bg-transparent focus-visible:ring-0 px-0"
                  placeholder="Liste aqui..."
                  value={(review as any)[b.key] || ""}
                  onChange={(e) => setReview({ ...review, [b.key]: e.target.value })}
                />
              </Card>
            ))}
            <Card className="p-5 shadow-card border-l-4 border-gold/40 bg-gradient-to-br from-gold/5 to-transparent">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-widest text-gold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Ata gerada pela IA</Label>
                <Button size="sm" variant="outline" onClick={generateAta} disabled={aiLoading}>
                  {aiLoading ? "Gerando..." : "Gerar ata"}
                </Button>
              </div>
              <Textarea
                className="mt-2 min-h-[140px] resize-none border-0 bg-transparent focus-visible:ring-0 px-0"
                placeholder="A ata da reunião aparece aqui após geração pela IA."
                value={review.ai_summary || ""}
                onChange={(e) => setReview({ ...review, ai_summary: e.target.value })}
              />
            </Card>
          </div>

          {history.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mt-8 mb-3">Histórico semanal</h3>
              <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {history.map((h) => (
                  <button key={h.id} onClick={() => setWeekStart(h.week_start)}
                    className={`p-3 rounded-lg text-left text-xs border transition-all hover:border-gold ${h.week_start === weekStart ? "border-gold bg-gold/10" : "border-border bg-card"}`}>
                    <div className="font-bold">{format(new Date(h.week_start), "dd MMM", { locale: ptBR })}</div>
                    <div className="text-muted-foreground mt-1">Semana</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reunioes" className="space-y-4 mt-4">
          {isStaff && (
            <Button onClick={() => setNewMeetingOpen(true)} className="bg-gradient-brand">
              <CalendarPlus className="h-4 w-4 mr-1" /> Agendar reunião
            </Button>
          )}

          {meetings.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              Nenhuma reunião agendada ainda.
            </Card>
          )}

          <div className="space-y-3">
            {meetings.map((m) => {
              const notes = notesByMeeting[m.id] || [];
              const upcoming = new Date(m.scheduled_at) > new Date();
              return (
                <Card key={m.id} className="p-5 shadow-card">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold">{m.title}</h3>
                        <Badge variant={upcoming ? "default" : "secondary"} className={upcoming ? "bg-gradient-brand text-primary-foreground" : ""}>
                          {MEETING_TYPES.find((t) => t.value === m.meeting_type)?.label || m.meeting_type}
                        </Badge>
                        {upcoming && <Badge variant="outline" className="border-gold text-gold">Próxima</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(m.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {m.duration_min}min
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        {m.meeting_url && <a href={m.meeting_url} target="_blank" className="text-royal hover:underline flex items-center gap-1"><Video className="h-3 w-3" /> Entrar</a>}
                        {m.location && <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.location}</span>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setNoteOpen({ id: m.id, title: m.title }); setNoteText(""); setNotePrivate(false); }}>
                      <MessageSquarePlus className="h-4 w-4 mr-1" /> Nota
                    </Button>
                  </div>
                  {notes.length > 0 && (
                    <div className="mt-4 space-y-2 border-t pt-3">
                      {notes.map((n) => (
                        <div key={n.id} className="text-sm bg-muted/40 p-3 rounded">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold mb-1">
                            {n.is_private && <Lock className="h-3 w-3 text-gold" />}
                            {n.is_private ? "Privada (apenas staff)" : "Pública"} · {format(new Date(n.created_at), "dd/MM HH:mm")}
                          </div>
                          <p className="whitespace-pre-wrap">{n.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={newMeetingOpen} onOpenChange={setNewMeetingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar reunião</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={newMeeting.title} onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })} placeholder="Mentoria semanal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data e hora *</Label>
                <Input type="datetime-local" value={newMeeting.scheduled_at} onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_at: e.target.value })} />
              </div>
              <div>
                <Label>Duração (min)</Label>
                <Input type="number" min={15} value={newMeeting.duration_min} onChange={(e) => setNewMeeting({ ...newMeeting, duration_min: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newMeeting.meeting_type} onValueChange={(v) => setNewMeeting({ ...newMeeting, meeting_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MEETING_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Link da reunião</Label>
              <Input value={newMeeting.meeting_url} onChange={(e) => setNewMeeting({ ...newMeeting, meeting_url: e.target.value })} placeholder="https://meet.google.com/..." />
            </div>
            <div>
              <Label>Local (se presencial)</Label>
              <Input value={newMeeting.location} onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewMeetingOpen(false)}>Cancelar</Button>
            <Button onClick={createMeeting} className="bg-gradient-brand">Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteOpen} onOpenChange={(o) => !o && setNoteOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar nota — {noteOpen?.title}</DialogTitle></DialogHeader>
          <Textarea rows={6} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Anote decisões, próximos passos, observações..." />
          {isStaff && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notePrivate} onChange={(e) => setNotePrivate(e.target.checked)} />
              Nota privada (visível apenas para staff)
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(null)}>Cancelar</Button>
            <Button onClick={addNote} className="bg-gradient-brand">Salvar nota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
