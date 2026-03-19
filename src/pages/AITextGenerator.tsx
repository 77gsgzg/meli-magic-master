import { useState } from "react";
import { useNavigate, useEffect } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Copy, Loader2, Sparkles, ShieldAlert, Check } from "lucide-react";
import { useEffect as useEffectReact } from "react";

interface GeneratedText {
  id?: string;
  generated_title: string;
  short_description: string;
  long_description: string;
  benefits: string;
  specifications: string;
  cta: string;
}

export default function AITextGenerator() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsWalletAdmin();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [tone, setTone] = useState("profissional");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedText | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffectReact(() => {
    if (!authLoading && !adminLoading && !isAdmin) {
      toast.error("Acesso restrito a administradores");
      navigate("/");
    }
  }, [authLoading, adminLoading, isAdmin, navigate]);

  if (authLoading || adminLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) return null;

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error("Informe o título do produto");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-text`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title, category, characteristics, tone }),
        }
      );

      if (response.status === 429) {
        toast.error("Limite de requisições excedido.");
        return;
      }
      if (response.status === 402) {
        toast.error("Créditos de IA esgotados.");
        return;
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro ao gerar texto");
      }

      const data = await response.json();
      setResult(data);
      toast.success("Texto gerado com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const ResultSection = ({ label, value, field }: { label: string; value: string; field: string }) => {
    if (!value) return null;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => copyToClipboard(value, field)}
          >
            {copiedField === field ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedField === field ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 border border-border/60 text-sm text-foreground whitespace-pre-wrap">
          {value}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerador de Texto IA</h1>
            <p className="text-sm text-muted-foreground">Gere descrições otimizadas para Mercado Livre</p>
          </div>
          <Badge variant="outline" className="ml-auto gap-1">
            <ShieldAlert className="h-3 w-3" /> Admin
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Dados do Produto</CardTitle>
              <CardDescription>Preencha as informações para gerar o conteúdo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título do Produto *</Label>
                <Input
                  placeholder="Ex: Fone Bluetooth JBL Tune 520BT"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  placeholder="Ex: Eletrônicos > Áudio"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Características</Label>
                <Textarea
                  placeholder="Ex: Bluetooth 5.3, bateria 57h, dobrável, microfone integrado"
                  value={characteristics}
                  onChange={(e) => setCharacteristics(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Tom</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="tecnico">Técnico</SelectItem>
                    <SelectItem value="premium">Premium / Luxo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !title.trim()}
                className="w-full gap-2"
                size="lg"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Gerando conteúdo..." : "Gerar Descrição"}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Conteúdo Gerado</CardTitle>
              <CardDescription>
                {result ? "Clique em copiar para usar o texto" : "O conteúdo gerado aparecerá aqui"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generating && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Gerando com IA...</p>
                </div>
              )}

              {!generating && !result && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <FileText className="h-12 w-12 opacity-30" />
                  <p className="text-sm">Nenhum texto gerado ainda</p>
                </div>
              )}

              {result && (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  <ResultSection label="Título Otimizado" value={result.generated_title} field="title" />
                  <ResultSection label="Descrição Curta" value={result.short_description} field="short" />
                  <ResultSection label="Descrição Longa" value={result.long_description} field="long" />
                  <ResultSection label="Benefícios" value={result.benefits} field="benefits" />
                  <ResultSection label="Especificações" value={result.specifications} field="specs" />
                  <ResultSection label="Call-to-Action" value={result.cta} field="cta" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
