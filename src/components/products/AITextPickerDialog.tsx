import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIText {
  id: string;
  generated_title: string | null;
  short_description: string | null;
  long_description: string | null;
  input_data: Record<string, unknown>;
  created_at: string;
}

interface AITextPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (title: string, description: string) => void;
}

export function AITextPickerDialog({ open, onOpenChange, onApply }: AITextPickerDialogProps) {
  const { user } = useAuth();
  const [texts, setTexts] = useState<AIText[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      supabase
        .from("ai_generated_texts")
        .select("id, generated_title, short_description, long_description, input_data, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setTexts((data as unknown as AIText[]) || []);
          setLoading(false);
        });
    }
  }, [open, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Aplicar Texto da IA
          </DialogTitle>
          <DialogDescription>
            Selecione um texto gerado anteriormente para aplicar ao produto
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[50vh] space-y-2 pr-1">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!loading && texts.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum texto gerado ainda. Use o Gerador de Texto IA primeiro.
            </p>
          )}

          {texts.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onApply(
                  t.generated_title || "",
                  t.long_description || t.short_description || ""
                );
                onOpenChange(false);
              }}
              className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-colors"
            >
              <p className="font-medium text-sm text-foreground line-clamp-1">
                {t.generated_title || "Sem título"}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {t.short_description || "Sem descrição"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px]">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" /> IA
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
