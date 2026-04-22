import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquarePlus, Mail, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  admin_reply: string | null;
  status: "open" | "answered" | "closed";
  created_at: string;
  replied_at: string | null;
}

const statusMeta: Record<
  Ticket["status"],
  { label: string; icon: typeof Clock; variant: "secondary" | "default" | "outline" }
> = {
  open: { label: "Aguardando", icon: Clock, variant: "secondary" },
  answered: { label: "Respondido", icon: CheckCircle2, variant: "default" },
  closed: { label: "Fechado", icon: XCircle, variant: "outline" },
};

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, subject, message, admin_reply, status, created_at, replied_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar tickets");
    } else {
      setTickets((data ?? []) as Ticket[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const submit = async () => {
    if (!user) return;
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (trimmedSubject.length < 3 || trimmedSubject.length > 200) {
      toast.error("Assunto deve ter entre 3 e 200 caracteres");
      return;
    }
    if (trimmedMessage.length < 5 || trimmedMessage.length > 5000) {
      toast.error("Mensagem deve ter entre 5 e 5000 caracteres");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: trimmedSubject,
      message: trimmedMessage,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Erro ao abrir ticket");
      return;
    }
    toast.success("Ticket enviado! Em breve nossa equipe responderá.");
    setSubject("");
    setMessage("");
    setOpen(false);
    load();
  };

  const closeTicket = async (id: string) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "closed" })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao fechar ticket");
      return;
    }
    toast.success("Ticket fechado");
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Suporte</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Abra um ticket e acompanhe as respostas da nossa equipe.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Novo ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Abrir novo ticket</DialogTitle>
                <DialogDescription>
                  Descreva o problema ou dúvida com o máximo de detalhes possível.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assunto</label>
                  <Input
                    placeholder="Ex.: Problema ao publicar produto"
                    maxLength={200}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mensagem</label>
                  <Textarea
                    placeholder="Conte o que está acontecendo..."
                    maxLength={5000}
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {message.length}/5000
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Você ainda não abriu nenhum ticket. Clique em "Novo ticket" para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const meta = statusMeta[t.status];
              const Icon = meta.icon;
              return (
                <Card key={t.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg break-words">
                          {t.subject}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Aberto{" "}
                          {formatDistanceToNow(new Date(t.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </CardDescription>
                      </div>
                      <Badge variant={meta.variant} className="shrink-0">
                        <Icon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                        Sua mensagem
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {t.message}
                      </p>
                    </div>
                    {t.admin_reply ? (
                      <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-primary uppercase mb-1">
                          Resposta do suporte
                          {t.replied_at && (
                            <span className="text-muted-foreground font-normal normal-case ml-2">
                              ·{" "}
                              {formatDistanceToNow(new Date(t.replied_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          )}
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {t.admin_reply}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Aguardando resposta da equipe.
                      </p>
                    )}
                    {t.status !== "closed" && (
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => closeTicket(t.id)}
                        >
                          Marcar como resolvido
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
