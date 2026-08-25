import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, CalendarClock, Target, AlertTriangle, Compass, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

type Notification = Tables<"notifications">;

const TYPE_META: Record<string, { label: string; icon: any }> = {
  meeting: { label: "Reunião", icon: CalendarClock },
  meeting_soon: { label: "Reunião em 24h", icon: CalendarClock },
  goal_late: { label: "Meta atrasada", icon: Target },
  goal_due: { label: "Meta vencendo", icon: Target },
  goal_done: { label: "Meta concluída", icon: Target },
  pillar_score: { label: "Pilares 4X", icon: Compass },
  cycle_stalled: { label: "Ciclo parado", icon: RefreshCw },
  bottleneck_stalled: { label: "Gargalo sem movimento", icon: AlertTriangle },
};

export default function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Notification[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => { await supabase.from("notifications").update({ read: true }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: async () => { await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = items.filter((n) => !n.read).length;
  const visible = useMemo(() => (onlyUnread ? items.filter((n) => !n.read) : items), [items, onlyUnread]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader title="Notificações" subtitle="Alertas, lembretes e marcos da execução SEE_4X." />
        <div className="flex items-center gap-2">
          <Button variant={onlyUnread ? "default" : "outline"} size="sm" onClick={() => setOnlyUnread((v) => !v)}>
            {onlyUnread ? "Ver todas" : `Só não lidas (${unread})`}
          </Button>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="h-4 w-4 mr-2" /> Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4 shadow-card flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-2 opacity-40" />
          {onlyUnread ? "Nada pendente por aqui." : "Sem notificações."}
        </Card>
      )}

      <div className="space-y-2">
        {visible.map((n) => {
          const meta = (n.type && TYPE_META[n.type]) || { label: "Aviso", icon: Bell };
          const Icon = meta.icon;
          return (
            <Card key={n.id} className={`p-4 shadow-card flex items-start gap-3 ${!n.read ? "border-l-4 border-l-gold" : ""}`}>
              <div className={`h-9 w-9 rounded-lg shrink-0 flex items-center justify-center ${n.read ? "bg-muted" : "bg-gold/15"}`}>
                <Icon className={`h-4 w-4 ${n.read ? "text-muted-foreground" : "text-gold"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{n.title}</p>
                  <Badge variant="secondary" className="text-[10px]">{meta.label}</Badge>
                </div>
                {n.message && <p className="text-sm text-muted-foreground">{n.message}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              {!n.read && (
                <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)} aria-label="Marcar como lida">
                  {markRead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
