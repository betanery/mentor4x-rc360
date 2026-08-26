import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
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
import { Sparkles, Save, CalendarPlus, Video, MapPin, MessageSquarePlus, Lock, Users, CalendarClock, CheckCircle2, XCircle, Send, Film } from "lucide-react";
import { toast } from "sonner";

const BLOCKS = [
  { key: "done", label: "1. O que foi feito", color: "border-success/30 bg-success/5" },
  { key: "blocked", label: "2. O que travou", color: "border-destructive/30 bg-destructive/5" },
  { key: "indicators", label: "3. Indicadores", color: "border-info/30 bg-info/5" },
  { key: "next_steps", label: "4. Próximos passos", color: "border-gold/30 bg-gold/5" },
  { key: "decisions", label: "5. Decisões tomadas", color: "border-primary/30 bg-primary/5" },
];

const MEETING_TYPES = [
  { value: "checkin_semanal", label: "Check-in semanal" },
  { value: "estrategia", label: "Estratégia" },
  { value: "sala_guerra", label: "Sala de Guerra (quinzenal)" },
  { value: "kickoff", label: "Kickoff" },
  { value: "review", label: "Review de ciclo" },
];

const RECURRENCES = [
  { value: "nenhuma", label: "Sem recorrência" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
];

const MEETING_STATUS: Record<string, { label: string; className: string }> = {
  agendada: { label: "Agendada", className: "bg-gradient-brand text-primary-foreground" },
  realizada: { label: "Realizada", className: "bg-success text-success-foreground" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
  reagendada: { label: "Reagendada", className: "bg-gold text-gold-foreground" },
};

const ATTENDANCE_STATUS = [
  { value: "presente", label: "Presente" },
  { value: "atrasado", label: "Atrasado" },
  { value: "justificado", label: "Falta justificada" },
  { value: "ausente", label: "Ausente" },
];

const ATA_STATUS: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  em_revisao: { label: "Em revisão do Consultor 4X", className: "bg-gold text-gold-foreground" },
  aprovada: { label: "Ata aprovada", className: "bg-success text-success-foreground" },
  ajustes_solicitados: { label: "Ajustes solicitados", className: "bg-destructive text-destructive-foreground" },
};

function addRecurrence(date: Date, recurrence: string) {
  const next = new Date(date);
  if (recurrence === "semanal") next.setDate(next.getDate() + 7);
  else if (recurrence === "quinzenal") next.setDate(next.getDate() + 14);
  else if (recurrence === "mensal") next.setMonth(next.getMonth() + 1);
  return next;
}

export default function WarRoom() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const { user, isStaff } = useAuth();
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [review, setReview] = useState<any>({ done: "", blocked: "", indicators: "", next_steps: "", decisions: "", ai_summary: "", ata_status: "rascunho" });
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [reviewComment, setReviewComment] = useState("");

  const [meetings, setMeetings] = useState<any[]>([]);
  const [notesByMeeting, setNotesByMeeting] = useState<Record<string, any[]>>({});
  const [attendanceByMeeting, setAttendanceByMeeting] = useState<Record<string, any[]>>({});
  const [members, setMembers] = useState<any[]>([]);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: "", scheduled_at: "", meeting_type: "checkin_semanal", meeting_url: "", location: "", duration_min: 60, agenda: "", recurrence: "nenhuma", recurrence_until: "" });
  const [noteOpen, setNoteOpen] = useState<{ id: string; title: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [notePrivate, setNotePrivate] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState<any | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ scheduled_at: "", reason: "" });
  const [attendanceOpen, setAttendanceOpen] = useState<any | null>(null);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, { status: string; note: string }>>({});
  const [recordingOpen, setRecordingOpen] = useState<any | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");

  const isAtaLocked = review.ata_status === "aprovada" && !isStaff;

  const loadReviews = async () => {
    if (!current) return;
    let query = supabase.from("weekly_reviews").select("*").eq("company_id", current.id).order("week_start", { ascending: false });
    query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
    const { data: h } = await query;
    setHistory(h || []);
    const found = (h || []).find((w) => w.week_start === weekStart);
    if (found) { setReview(found); setReviewComment(found.review_comment || ""); }
    else { setReview({ done: "", blocked: "", indicators: "", next_steps: "", decisions: "", ai_summary: "", ata_status: "rascunho" }); setReviewComment(""); }
  };

  const loadMembers = async () => {
    if (!current) { setMembers([]); return; }
    const { data } = await supabase.from("company_members").select("user_id, member_role").eq("company_id", current.id);
    const ids = (data || []).map((m) => m.user_id);
    if (!ids.length) { setMembers([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
    setMembers((data || []).map((m) => ({
      user_id: m.user_id,
      member_role: m.member_role,
      full_name: profiles?.find((p) => p.user_id === m.user_id)?.full_name || "Participante",
    })));
  };

  const loadMeetings = async () => {
    if (!current) return;
    let query = supabase.from("meetings").select("*").eq("company_id", current.id).order("scheduled_at", { ascending: false });
    query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
    const { data: m } = await query;
    setMeetings(m || []);
    if (m?.length) {
      const ids = m.map((x) => x.id);
      const [{ data: notes }, { data: attendance }] = await Promise.all([
        supabase.from("meeting_notes").select("*").in("meeting_id", ids).order("created_at", { ascending: false }),
        supabase.from("meeting_attendance").select("*").in("meeting_id", ids),
      ]);
      const groupedNotes: Record<string, any[]> = {};
      (notes || []).forEach((n: any) => { (groupedNotes[n.meeting_id] ||= []).push(n); });
      setNotesByMeeting(groupedNotes);
      const groupedAtt: Record<string, any[]> = {};
      (attendance || []).forEach((a: any) => { (groupedAtt[a.meeting_id] ||= []).push(a); });
      setAttendanceByMeeting(groupedAtt);
    } else {
      setNotesByMeeting({});
      setAttendanceByMeeting({});
    }
  };

  useEffect(() => { loadReviews(); }, [current, currentContract, weekStart]);
  useEffect(() => { loadMeetings(); loadMembers(); }, [current, currentContract]);

  const persistReview = async (extra: Record<string, any> = {}, message = "Sala de Guerra salva") => {
    if (!current || !user) return;
    setSaving(true);
    const { id, created_at, updated_at, ...rest } = review;
    const payload: any = { ...rest, company_id: current.id, contract_id: currentContract?.id ?? null, week_start: weekStart, created_by: review.created_by ?? user.id, ...extra };
    const { error } = await supabase.from("weekly_reviews").upsert(payload, { onConflict: currentContract ? "company_id,contract_id,week_start" : "company_id,week_start" });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(message); loadReviews(); }
  };

  const generateAta = async () => {
    if (!current) return;
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("ai-action", {
      body: { action: "weekly_summary", company_id: current.id, contract_id: currentContract?.id, payload: review },
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
    const seriesId = crypto.randomUUID();
    const base = {
      company_id: current.id,
      contract_id: currentContract?.id ?? null,
      title: newMeeting.title,
      meeting_type: newMeeting.meeting_type as any,
      meeting_url: newMeeting.meeting_url || null,
      location: newMeeting.location || null,
      agenda: newMeeting.agenda || null,
      duration_min: Number(newMeeting.duration_min) || 60,
      created_by: user.id,
      recurrence: newMeeting.recurrence,
      recurrence_until: newMeeting.recurrence !== "nenhuma" && newMeeting.recurrence_until ? newMeeting.recurrence_until : null,
      series_id: seriesId,
    };

    const rows: any[] = [];
    let date = new Date(newMeeting.scheduled_at);
    const until = newMeeting.recurrence !== "nenhuma" && newMeeting.recurrence_until
      ? new Date(`${newMeeting.recurrence_until}T23:59:59`)
      : null;
    rows.push({ ...base, scheduled_at: date.toISOString() });
    if (until) {
      let guard = 0;
      while (guard < 60) {
        date = addRecurrence(date, newMeeting.recurrence);
        if (date > until) break;
        rows.push({ ...base, scheduled_at: date.toISOString() });
        guard++;
      }
    }

    const { error } = await supabase.from("meetings").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(rows.length > 1 ? `${rows.length} encontros agendados` : "Reunião agendada");
    setNewMeetingOpen(false);
    setNewMeeting({ title: "", scheduled_at: "", meeting_type: "checkin_semanal", meeting_url: "", location: "", duration_min: 60, agenda: "", recurrence: "nenhuma", recurrence_until: "" });
    loadMeetings();
  };

  const updateMeeting = async (id: string, patch: Record<string, any>, message: string) => {
    const { error } = await supabase.from("meetings").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success(message);
    loadMeetings();
    return true;
  };

  const confirmReschedule = async () => {
    if (!rescheduleOpen || !rescheduleData.scheduled_at) { toast.error("Informe a nova data"); return; }
    const ok = await updateMeeting(rescheduleOpen.id, {
      scheduled_at: new Date(rescheduleData.scheduled_at).toISOString(),
      rescheduled_from: rescheduleOpen.scheduled_at,
      reschedule_reason: rescheduleData.reason || null,
      status: "reagendada",
    }, "Encontro reagendado");
    if (ok) { setRescheduleOpen(null); setRescheduleData({ scheduled_at: "", reason: "" }); }
  };

  const openAttendance = (meeting: any) => {
    const existing = attendanceByMeeting[meeting.id] || [];
    const draft: Record<string, { status: string; note: string }> = {};
    members.forEach((m) => {
      const found = existing.find((a) => a.user_id === m.user_id);
      draft[m.user_id] = { status: found?.status ?? "presente", note: found?.note ?? "" };
    });
    setAttendanceDraft(draft);
    setAttendanceOpen(meeting);
  };

  const saveAttendance = async () => {
    if (!attendanceOpen || !user) return;
    const rows = members.map((m) => ({
      meeting_id: attendanceOpen.id,
      user_id: m.user_id,
      participant_name: m.full_name,
      status: attendanceDraft[m.user_id]?.status ?? "presente",
      note: attendanceDraft[m.user_id]?.note || null,
      recorded_by: user.id,
    }));
    if (!rows.length) { toast.error("Nenhum participante vinculado à empresa"); return; }
    const { error } = await supabase.from("meeting_attendance").upsert(rows, { onConflict: "meeting_id,user_id" });
    if (error) { toast.error(error.message); return; }
    if (attendanceOpen.status === "agendada") {
      await supabase.from("meetings").update({ status: "realizada" }).eq("id", attendanceOpen.id);
    }
    toast.success("Presença registrada");
    setAttendanceOpen(null);
    loadMeetings();
  };

  const saveRecording = async () => {
    if (!recordingOpen) return;
    const ok = await updateMeeting(recordingOpen.id, { recording_url: recordingUrl || null, status: recordingUrl ? "realizada" : recordingOpen.status }, "Gravação salva");
    if (ok) { setRecordingOpen(null); setRecordingUrl(""); }
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

  const ataBadge = ATA_STATUS[review.ata_status || "rascunho"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sala de Guerra"
        subtitle="Check-in semanal e Sala de Guerra quinzenal, com presença, gravação, recorrência e ata aprovada pelo Consultor 4X."
      />

      <Tabs defaultValue="semanal">
        <TabsList>
          <TabsTrigger value="semanal">Cadência semanal</TabsTrigger>
          <TabsTrigger value="reunioes">Encontros ({meetings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="semanal" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-44" />
            <Button onClick={() => persistReview()} disabled={saving || isAtaLocked} className="bg-gradient-brand"><Save className="h-4 w-4 mr-1" /> Salvar</Button>
            <Badge className={ataBadge.className}>{ataBadge.label}</Badge>
            <p className="text-sm text-muted-foreground ml-2">Semana de {format(new Date(`${weekStart}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
          </div>

          {isAtaLocked && (
            <Card className="p-4 text-sm border-success/40 bg-success/5">
              Esta ata está aprovada e travada para edição. Fale com o Consultor 4X para reabrir.
            </Card>
          )}

          {review.ata_status === "ajustes_solicitados" && review.review_comment && (
            <Card className="p-4 text-sm border-destructive/40 bg-destructive/5">
              <span className="font-bold">Ajustes solicitados pelo Consultor 4X:</span> {review.review_comment}
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BLOCKS.map((b) => (
              <Card key={b.key} className={`p-5 shadow-card border-l-4 ${b.color}`}>
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{b.label}</Label>
                <Textarea
                  className="mt-2 min-h-[140px] resize-none border-0 bg-transparent focus-visible:ring-0 px-0"
                  placeholder="Liste aqui..."
                  disabled={isAtaLocked}
                  value={(review as any)[b.key] || ""}
                  onChange={(e) => setReview({ ...review, [b.key]: e.target.value })}
                />
              </Card>
            ))}
            <Card className="p-5 shadow-card border-l-4 border-gold/40 bg-gradient-to-br from-gold/5 to-transparent">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-widest text-gold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Ata gerada pela IA</Label>
                <Button size="sm" variant="outline" onClick={generateAta} disabled={aiLoading || isAtaLocked}>
                  {aiLoading ? "Gerando..." : "Gerar ata"}
                </Button>
              </div>
              <Textarea
                className="mt-2 min-h-[140px] resize-none border-0 bg-transparent focus-visible:ring-0 px-0"
                placeholder="A ata da reunião aparece aqui após geração pela IA."
                disabled={isAtaLocked}
                value={review.ai_summary || ""}
                onChange={(e) => setReview({ ...review, ai_summary: e.target.value })}
              />
            </Card>
          </div>

          <Card className="p-5 shadow-card space-y-3">
            <h3 className="font-bold">Fluxo de aprovação da ata</h3>
            <div className="text-xs text-muted-foreground">
              {review.submitted_at && <>Enviada para revisão em {format(new Date(review.submitted_at), "dd/MM/yyyy HH:mm")}. </>}
              {review.reviewed_at && <>Decisão registrada em {format(new Date(review.reviewed_at), "dd/MM/yyyy HH:mm")}.</>}
              {!review.submitted_at && !review.reviewed_at && "Preencha os cinco blocos, gere a ata e envie para revisão."}
            </div>
            <div className="flex flex-wrap gap-2">
              {["rascunho", "ajustes_solicitados"].includes(review.ata_status || "rascunho") && (
                <Button size="sm" variant="outline" disabled={saving} onClick={() => persistReview({ ata_status: "em_revisao" }, "Ata enviada para revisão")}>
                  <Send className="h-4 w-4 mr-1" /> Enviar para revisão
                </Button>
              )}
              {isStaff && (
                <>
                  <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" disabled={saving || review.ata_status === "aprovada"}
                    onClick={() => persistReview({ ata_status: "aprovada", review_comment: reviewComment || null }, "Ata aprovada")}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar ata
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving}
                    onClick={() => {
                      if (!reviewComment.trim()) { toast.error("Descreva os ajustes necessários no parecer"); return; }
                      persistReview({ ata_status: "ajustes_solicitados", review_comment: reviewComment }, "Ajustes solicitados");
                    }}>
                    <XCircle className="h-4 w-4 mr-1" /> Solicitar ajustes
                  </Button>
                </>
              )}
            </div>
            {isStaff && (
              <div>
                <Label className="text-xs">Parecer do Consultor 4X</Label>
                <Textarea rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Observações, ajustes ou validação da ata..." />
              </div>
            )}
            {!isStaff && review.review_comment && review.ata_status === "aprovada" && (
              <p className="text-sm text-muted-foreground"><span className="font-bold">Parecer:</span> {review.review_comment}</p>
            )}
          </Card>

          {history.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mt-8 mb-3">Histórico semanal</h3>
              <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {history.map((h) => (
                  <button key={h.id} onClick={() => setWeekStart(h.week_start)}
                    className={`p-3 rounded-lg text-left text-xs border transition-all hover:border-gold ${h.week_start === weekStart ? "border-gold bg-gold/10" : "border-border bg-card"}`}>
                    <div className="font-bold">{format(new Date(`${h.week_start}T12:00:00`), "dd MMM", { locale: ptBR })}</div>
                    <div className="text-muted-foreground mt-1">{ATA_STATUS[h.ata_status || "rascunho"].label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reunioes" className="space-y-4 mt-4">
          {isStaff && (
            <Button onClick={() => setNewMeetingOpen(true)} className="bg-gradient-brand">
              <CalendarPlus className="h-4 w-4 mr-1" /> Agendar encontro
            </Button>
          )}

          {meetings.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              Nenhum encontro agendado ainda.
            </Card>
          )}

          <div className="space-y-3">
            {meetings.map((m) => {
              const notes = notesByMeeting[m.id] || [];
              const attendance = attendanceByMeeting[m.id] || [];
              const presentCount = attendance.filter((a) => ["presente", "atrasado"].includes(a.status)).length;
              const upcoming = new Date(m.scheduled_at) > new Date() && m.status !== "cancelada";
              const status = MEETING_STATUS[m.status] ?? MEETING_STATUS.agendada;
              return (
                <Card key={m.id} className="p-5 shadow-card">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold">{m.title}</h3>
                        <Badge variant="secondary">
                          {MEETING_TYPES.find((t) => t.value === m.meeting_type)?.label || m.meeting_type}
                        </Badge>
                        <Badge className={status.className}>{status.label}</Badge>
                        {m.recurrence && m.recurrence !== "nenhuma" && (
                          <Badge variant="outline">{RECURRENCES.find((r) => r.value === m.recurrence)?.label}</Badge>
                        )}
                        {upcoming && <Badge variant="outline" className="border-gold text-gold">Próximo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(m.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {m.duration_min}min
                        {attendance.length > 0 && ` · presença ${presentCount}/${attendance.length}`}
                      </p>
                      {m.rescheduled_from && (
                        <p className="text-xs text-gold mt-1">
                          Reagendado de {format(new Date(m.rescheduled_from), "dd/MM/yyyy HH:mm")}
                          {m.reschedule_reason ? ` — ${m.reschedule_reason}` : ""}
                        </p>
                      )}
                      {m.agenda && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{m.agenda}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                        {m.meeting_url && <a href={m.meeting_url} target="_blank" rel="noreferrer" className="text-royal hover:underline flex items-center gap-1"><Video className="h-3 w-3" /> Entrar</a>}
                        {m.recording_url && <a href={m.recording_url} target="_blank" rel="noreferrer" className="text-gold hover:underline flex items-center gap-1"><Film className="h-3 w-3" /> Ver gravação</a>}
                        {m.location && <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.location}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isStaff && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openAttendance(m)}>
                            <Users className="h-4 w-4 mr-1" /> Presença
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setRecordingOpen(m); setRecordingUrl(m.recording_url || ""); }}>
                            <Film className="h-4 w-4 mr-1" /> Gravação
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setRescheduleOpen(m); setRescheduleData({ scheduled_at: "", reason: "" }); }}>
                            <CalendarClock className="h-4 w-4 mr-1" /> Reagendar
                          </Button>
                          {m.status !== "cancelada" && (
                            <Button variant="ghost" size="sm" onClick={() => updateMeeting(m.id, { status: "cancelada" }, "Encontro cancelado")}>
                              <XCircle className="h-4 w-4 mr-1 text-destructive" /> Cancelar
                            </Button>
                          )}
                        </>
                      )}
                      <Button variant="outline" size="sm" onClick={() => { setNoteOpen({ id: m.id, title: m.title }); setNoteText(""); setNotePrivate(false); }}>
                        <MessageSquarePlus className="h-4 w-4 mr-1" /> Nota
                      </Button>
                    </div>
                  </div>

                  {attendance.length > 0 && (
                    <div className="mt-4 border-t pt-3 flex flex-wrap gap-2">
                      {attendance.map((a) => (
                        <Badge key={a.id} variant="outline" className={a.status === "ausente" ? "border-destructive text-destructive" : a.status === "justificado" ? "border-gold text-gold" : "border-success text-success"}>
                          {a.participant_name || "Participante"} · {ATTENDANCE_STATUS.find((s) => s.value === a.status)?.label}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {notes.length > 0 && (
                    <div className="mt-4 space-y-2 border-t pt-3">
                      {notes.map((n) => (
                        <div key={n.id} className="text-sm bg-muted/40 p-3 rounded">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold mb-1">
                            {n.is_private && <Lock className="h-3 w-3 text-gold" />}
                            {n.is_private ? "Privada (apenas time interno)" : "Pública"} · {format(new Date(n.created_at), "dd/MM HH:mm")}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Agendar encontro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={newMeeting.title} onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })} placeholder="Check-in semanal" />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Recorrência</Label>
                <Select value={newMeeting.recurrence} onValueChange={(v) => setNewMeeting({ ...newMeeting, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RECURRENCES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Repetir até</Label>
                <Input type="date" disabled={newMeeting.recurrence === "nenhuma"} value={newMeeting.recurrence_until} onChange={(e) => setNewMeeting({ ...newMeeting, recurrence_until: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Pauta</Label>
              <Textarea rows={3} value={newMeeting.agenda} onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })} placeholder="Tópicos previstos para o encontro" />
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

      <Dialog open={!!rescheduleOpen} onOpenChange={(o) => !o && setRescheduleOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reagendar — {rescheduleOpen?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Data atual: {rescheduleOpen && format(new Date(rescheduleOpen.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}
            </p>
            <div>
              <Label>Nova data e hora *</Label>
              <Input type="datetime-local" value={rescheduleData.scheduled_at} onChange={(e) => setRescheduleData({ ...rescheduleData, scheduled_at: e.target.value })} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Textarea rows={3} value={rescheduleData.reason} onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })} placeholder="Justificativa do reagendamento" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(null)}>Cancelar</Button>
            <Button onClick={confirmReschedule} className="bg-gradient-brand">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!attendanceOpen} onOpenChange={(o) => !o && setAttendanceOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Presença — {attendanceOpen?.title}</DialogTitle></DialogHeader>
          {members.length === 0 && <p className="text-sm text-muted-foreground">Nenhum participante vinculado a esta empresa.</p>}
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.user_id} className="grid grid-cols-[1fr_auto] gap-2 items-center border-b pb-3">
                <div>
                  <p className="text-sm font-medium">{m.full_name}</p>
                  <Input className="mt-1 h-8 text-xs" placeholder="Observação" value={attendanceDraft[m.user_id]?.note || ""}
                    onChange={(e) => setAttendanceDraft({ ...attendanceDraft, [m.user_id]: { status: attendanceDraft[m.user_id]?.status ?? "presente", note: e.target.value } })} />
                </div>
                <Select value={attendanceDraft[m.user_id]?.status ?? "presente"}
                  onValueChange={(v) => setAttendanceDraft({ ...attendanceDraft, [m.user_id]: { status: v, note: attendanceDraft[m.user_id]?.note ?? "" } })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{ATTENDANCE_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendanceOpen(null)}>Cancelar</Button>
            <Button onClick={saveAttendance} className="bg-gradient-brand" disabled={members.length === 0}>Salvar presença</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recordingOpen} onOpenChange={(o) => !o && setRecordingOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gravação — {recordingOpen?.title}</DialogTitle></DialogHeader>
          <div>
            <Label>Link da gravação</Label>
            <Input value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="https://drive.google.com/..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordingOpen(null)}>Cancelar</Button>
            <Button onClick={saveRecording} className="bg-gradient-brand">Salvar</Button>
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
              Nota privada (visível apenas para o time interno)
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
