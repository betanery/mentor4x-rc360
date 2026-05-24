import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
    setItems(data || []);
  };
  useEffect(() => { load(); }, [user]);

  const markRead = async (id: string) => { await supabase.from("notifications").update({ read: true }).eq("id", id); load(); };

  return (
    <div className="space-y-6">
      <PageHeader title="Notificações" subtitle="Alertas, lembretes e marcos da sua jornada." />
      {items.length === 0 && <Card className="p-12 text-center text-muted-foreground"><Bell className="h-10 w-10 mx-auto mb-2 opacity-40" />Sem notificações.</Card>}
      <div className="space-y-2">
        {items.map((n) => (
          <Card key={n.id} className={`p-4 shadow-card flex items-start gap-3 ${!n.read ? "border-l-4 border-l-gold" : ""}`}>
            <div className={`h-9 w-9 rounded-lg shrink-0 flex items-center justify-center ${n.read ? "bg-muted" : "bg-gold/15"}`}>
              <Bell className={`h-4 w-4 ${n.read ? "text-muted-foreground" : "text-gold"}`} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</p>
            </div>
            {!n.read && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}><Check className="h-4 w-4" /></Button>}
          </Card>
        ))}
      </div>
    </div>
  );
}
