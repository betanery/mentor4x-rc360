import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckCircle2, Clock3, Settings2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Organizer = {
  id: string;
  display_name: string;
  slot_duration_min: number;
  timezone: string;
  booking_window_days: number;
  minimum_notice_hours: number;
};

type Slot = {
  start_at: string;
  end_at: string;
  local_date: string;
  local_time: string;
};

type BookingResult = {
  meeting?: { id: string; scheduled_at: string; meeting_url: string | null; title: string };
  teams_join_url?: string | null;
  organizer?: string;
  error?: string;
};

export default function WarRoomBooking() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const { user, isStaff } = useAuth();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [organizerId, setOrganizerId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<BookingResult | null>(null);
  const [agenda, setAgenda] = useState("Sala de Guerra 4X — revisão de execução, bloqueios, indicadores e próximos passos.");
  const [hostForm, setHostForm] = useState({
    display_name: "",
    microsoft_email: user?.email || "",
    workday_start: "09:00",
    workday_end: "18:00",
    slot_duration_min: 60,
    buffer_min: 15,
    booking_window_days: 30,
    minimum_notice_hours: 24,
  });
  const [savingHost, setSavingHost] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const endDate = format(addDays(new Date(), 14), "yyyy-MM-dd");

  const invoke = async <T,>(body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("teams-calendar", { body });
    if (error) throw error;
    const payload = data as T & { error?: string };
    if (payload?.error) throw new Error(payload.error);
    return payload;
  };

  const loadOrganizers = async () => {
    if (!current) return;
    setLoadingHosts(true);
    try {
      const data = await invoke<{ organizers: Organizer[] }>({
        action: "organizers",
        company_id: current.id,
        contract_id: currentContract?.id ?? null,
      });
      setOrganizers(data.organizers || []);
      if (!organizerId && data.organizers?.[0]) setOrganizerId(data.organizers[0].id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as agendas.");
    } finally {
      setLoadingHosts(false);
    }
  };

  useEffect(() => { void loadOrganizers(); }, [current?.id, currentContract?.id]);

  const loadAvailability = async () => {
    if (!current || !organizerId) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setBooked(null);
    try {
      const data = await invoke<{ slots: Slot[] }>({
        action: "availability",
        company_id: current.id,
        contract_id: currentContract?.id ?? null,
        organizer_id: organizerId,
        start_date: today,
        end_date: endDate,
      });
      setSlots(data.slots || []);
      if (!data.slots?.length) toast.info("Nenhum horário livre nos próximos 14 dias.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar a agenda Microsoft.");
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (organizerId) void loadAvailability();
  }, [organizerId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    slots.forEach((slot) => map.set(slot.local_date, [...(map.get(slot.local_date) || []), slot]));
    return Array.from(map.entries());
  }, [slots]);

  const book = async () => {
    if (!current || !selectedSlot || !organizerId || !user?.email) return;
    setBooking(true);
    try {
      const data = await invoke<BookingResult>({
        action: "book",
        company_id: current.id,
        contract_id: currentContract?.id ?? null,
        organizer_id: organizerId,
        start_at: selectedSlot.start_at,
        attendee_email: user.email,
        attendee_name: user.email.split("@")[0],
        title: `Sala de Guerra 4X · ${current.name}`,
        meeting_type: "sala_guerra",
        agenda,
      });
      setBooked(data);
      setSlots((prev) => prev.filter((slot) => slot.start_at !== selectedSlot.start_at));
      toast.success("Encontro agendado. O convite do Teams foi enviado para o seu e-mail.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível agendar o encontro.");
      void loadAvailability();
    } finally {
      setBooking(false);
    }
  };

  const saveMyHost = async () => {
    if (!current) return;
    setSavingHost(true);
    try {
      await invoke({
        action: "upsert_my_host",
        company_id: current.id,
        contract_id: currentContract?.id ?? null,
        ...hostForm,
      });
      toast.success("Sua agenda Microsoft foi habilitada para reservas.");
      await loadOrganizers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível configurar a agenda.");
    } finally {
      setSavingHost(false);
    }
  };

  if (!current) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Selecione uma empresa antes de agendar um encontro.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendar Sala de Guerra"
        subtitle="Escolha um horário livre. O Mentor 4X bloqueia a agenda do Consultor, cria o evento e envia o convite com link do Microsoft Teams."
        action={<Link to="/sala-guerra"><Button variant="outline">Voltar para Sala de Guerra</Button></Link>}
      />

      {booked?.meeting ? (
        <Card className="p-6 border-success/40 bg-success/5 space-y-4">
          <div className="flex items-center gap-2 text-success font-bold">
            <CheckCircle2 className="h-5 w-5" /> Encontro confirmado
          </div>
          <div>
            <h2 className="text-lg font-bold">{booked.meeting.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(booked.meeting.scheduled_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              {booked.organizer ? ` · ${booked.organizer}` : ""}
            </p>
          </div>
          <p className="text-sm">O convite foi enviado ao seu e-mail e o encontro já está registrado na Sala de Guerra.</p>
          <div className="flex flex-wrap gap-2">
            {booked.teams_join_url && (
              <a href={booked.teams_join_url} target="_blank" rel="noreferrer">
                <Button className="bg-gradient-brand"><Video className="h-4 w-4 mr-1" /> Abrir Microsoft Teams</Button>
              </a>
            )}
            <Link to="/sala-guerra"><Button variant="outline">Ver encontro na Sala de Guerra</Button></Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-gold" />
              <h2 className="font-bold">1. Escolha quem fará o encontro</h2>
            </div>
            {loadingHosts ? (
              <p className="text-sm text-muted-foreground">Carregando agendas…</p>
            ) : organizers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Ainda não há agenda Microsoft habilitada para reserva. Um Consultor ou Estrategista precisa configurar a própria agenda abaixo.
              </div>
            ) : (
              <Select value={organizerId} onValueChange={setOrganizerId}>
                <SelectTrigger className="max-w-md"><SelectValue placeholder="Escolha o Consultor/Estrategista" /></SelectTrigger>
                <SelectContent>
                  {organizers.map((host) => (
                    <SelectItem key={host.id} value={host.id}>{host.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Card>

          {organizerId && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-gold" />
                <h2 className="font-bold">2. Escolha um horário livre</h2>
              </div>
              <p className="text-xs text-muted-foreground">Disponibilidade real da agenda Microsoft nos próximos 14 dias.</p>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Consultando agenda…</p>
              ) : (
                <div className="space-y-5">
                  {grouped.map(([date, daySlots]) => (
                    <div key={date}>
                      <p className="text-sm font-semibold mb-2">{format(new Date(`${date}T12:00:00`), "EEEE, dd/MM", { locale: ptBR })}</p>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <Button
                            key={slot.start_at}
                            type="button"
                            variant={selectedSlot?.start_at === slot.start_at ? "default" : "outline"}
                            className={selectedSlot?.start_at === slot.start_at ? "bg-gradient-brand" : ""}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {slot.local_time}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {selectedSlot && (
            <Card className="p-5 space-y-4">
              <h2 className="font-bold">3. Confirmar encontro</h2>
              <div className="rounded-lg bg-muted/40 p-4 text-sm">
                <strong>{format(new Date(`${selectedSlot.local_date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })} às {selectedSlot.local_time}</strong>
                <div className="text-muted-foreground mt-1">O convite será enviado para {user?.email}.</div>
              </div>
              <div>
                <Label>Pauta inicial</Label>
                <Textarea className="mt-2" value={agenda} onChange={(e) => setAgenda(e.target.value)} />
              </div>
              <Button onClick={book} disabled={booking} className="bg-gradient-brand">
                <Video className="h-4 w-4 mr-1" /> {booking ? "Criando encontro no Teams…" : "Confirmar e gerar link do Teams"}
              </Button>
            </Card>
          )}
        </>
      )}

      {isStaff && (
        <Card className="p-5 space-y-4 border-gold/30">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-bold">Configurar minha agenda Microsoft 365</h2>
              <p className="text-xs text-muted-foreground">Cada Consultor ou Estrategista habilita a própria agenda uma única vez.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Label>Nome exibido</Label>
              <Input value={hostForm.display_name} onChange={(e) => setHostForm({ ...hostForm, display_name: e.target.value })} placeholder="Ex.: Roberta Cardoso" />
            </div>
            <div className="sm:col-span-2">
              <Label>E-mail Microsoft 365</Label>
              <Input type="email" value={hostForm.microsoft_email} onChange={(e) => setHostForm({ ...hostForm, microsoft_email: e.target.value })} placeholder="nome@empresa.com.br" />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="time" value={hostForm.workday_start} onChange={(e) => setHostForm({ ...hostForm, workday_start: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="time" value={hostForm.workday_end} onChange={(e) => setHostForm({ ...hostForm, workday_end: e.target.value })} />
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input type="number" min={15} max={240} value={hostForm.slot_duration_min} onChange={(e) => setHostForm({ ...hostForm, slot_duration_min: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Intervalo (min)</Label>
              <Input type="number" min={0} max={120} value={hostForm.buffer_min} onChange={(e) => setHostForm({ ...hostForm, buffer_min: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Agenda aberta (dias)</Label>
              <Input type="number" min={1} max={180} value={hostForm.booking_window_days} onChange={(e) => setHostForm({ ...hostForm, booking_window_days: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Antecedência mínima (h)</Label>
              <Input type="number" min={0} max={336} value={hostForm.minimum_notice_hours} onChange={(e) => setHostForm({ ...hostForm, minimum_notice_hours: Number(e.target.value) })} />
            </div>
          </div>
          <Button variant="outline" onClick={saveMyHost} disabled={savingHost}>
            {savingHost ? "Salvando…" : "Habilitar minha agenda"}
          </Button>
          <p className="text-xs text-muted-foreground">
            A conexão usa credenciais de aplicação do Microsoft Graph armazenadas somente nos secrets da Edge Function. Nenhuma senha Microsoft é salva no Mentor 4X.
          </p>
        </Card>
      )}
    </div>
  );
}
