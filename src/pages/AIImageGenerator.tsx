import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImagePlus, Download, Loader2, Sparkles, ShieldAlert, History, Trash2, Pencil } from "lucide-react";
import { ImageEditTab } from "@/components/ai-images/ImageEditTab";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const styleOptions = [
  { value: "white_background", label: "Fundo Branco", desc: "Profissional, e-commerce" },
  { value: "lifestyle", label: "Lifestyle", desc: "Ambiente natural" },
  { value: "highlight", label: "Destaque", desc: "Premium, spotlight" },
];

interface ImageHistoryItem {
  id: string;
  original_image_url: string | null;
  generated_image_urls: string[] | null;
  style: string;
  status: string;
  created_at: string;
}

export default function AIImageGenerator() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsWalletAdmin();
  const navigate = useNavigate();
  const [selectedStyle, setSelectedStyle] = useState("white_background");
  const [imageUrl, setImageUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [history, setHistory] = useState<ImageHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading && !isAdmin) {
      toast.error("Acesso restrito a administradores");
      navigate("/");
    }
  }, [authLoading, adminLoading, isAdmin, navigate]);

  const fetchHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("ai_generated_images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data as unknown as ImageHistoryItem[]) || []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (user && isAdmin) fetchHistory();
  }, [user, isAdmin]);

  if (authLoading || adminLoading) {
    return (
      <DashboardLayout title="Gerador de Fotos IA">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    setResults([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const { data: record } = await supabase
        .from('ai_generated_images' as any)
        .insert({
          user_id: user!.id,
          original_image_url: imageUrl || null,
          style: selectedStyle,
          status: 'processing',
        } as any)
        .select()
        .single();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            style: selectedStyle,
            image_url: imageUrl || null,
            record_id: (record as any)?.id,
          }),
        }
      );

      if (response.status === 429) { toast.error("Limite de requisições excedido."); return; }
      if (response.status === 402) { toast.error("Créditos de IA esgotados."); return; }
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro ao gerar imagens");
      }

      const data = await response.json();
      setResults(data.images || []);
      toast.success(`${data.count} imagens geradas com sucesso!`);
      fetchHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (dataUrl: string, index: number) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `ai-image-${selectedStyle}-${index + 1}.png`;
    link.click();
  };

  const handleDeleteHistory = async (id: string) => {
    const { error } = await supabase.from("ai_generated_images").delete().eq("id", id);
    if (!error) {
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success("Registro removido");
    }
  };

  const styleLabel = (val: string) => styleOptions.find((s) => s.value === val)?.label || val;

  return (
    <DashboardLayout title="Gerador de Fotos IA">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
            <ImagePlus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerador de Fotos IA</h1>
            <p className="text-sm text-muted-foreground">Gere fotos profissionais para seus produtos</p>
          </div>
          <Badge variant="outline" className="ml-auto gap-1">
            <ShieldAlert className="h-3 w-3" /> Admin
          </Badge>
        </div>

        <Tabs defaultValue="generate">
          <TabsList>
            <TabsTrigger value="generate" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Gerar
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" /> Histórico ({history.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-lg">Configurações</CardTitle>
                  <CardDescription>Configure o estilo e envie uma imagem base (opcional)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>URL da imagem original (opcional)</Label>
                    <Input placeholder="https://exemplo.com/produto.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Deixe vazio para gerar do zero</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Estilo</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {styleOptions.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setSelectedStyle(s.value)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            selectedStyle === s.value ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
                          }`}
                        >
                          <span className="font-medium text-sm text-foreground">{s.label}</span>
                          <span className="block text-xs text-muted-foreground">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2" size="lg">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generating ? "Gerando 3 variações..." : "Gerar Imagens"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-lg">Resultado</CardTitle>
                  <CardDescription>{results.length > 0 ? `${results.length} variações geradas` : "As imagens geradas aparecerão aqui"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {generating && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Gerando imagens com IA...</p>
                    </div>
                  )}
                  {!generating && results.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                      <ImagePlus className="h-12 w-12 opacity-30" />
                      <p className="text-sm">Nenhuma imagem gerada ainda</p>
                    </div>
                  )}
                  {results.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                      {results.map((url, i) => (
                        <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
                          <img src={url} alt={`Variação ${i + 1}`} className="w-full h-auto object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleDownload(url, i)} className="gap-1">
                              <Download className="h-3.5 w-3.5" /> Download
                            </Button>
                          </div>
                          <Badge className="absolute top-2 left-2" variant="secondary">Variação {i + 1}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Gerações</CardTitle>
                <CardDescription>Imagens geradas anteriormente</CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhuma imagem gerada ainda</p>
                ) : (
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div key={item.id} className="p-4 rounded-lg border border-border/60">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{styleLabel(item.style)}</Badge>
                            <Badge variant={item.status === "completed" ? "default" : "secondary"} className="text-xs">{item.status}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => handleDeleteHistory(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {Array.isArray(item.generated_image_urls) && item.generated_image_urls.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {item.generated_image_urls.map((url, i) => (
                              <div key={i} className="relative group rounded-lg overflow-hidden border border-border aspect-square">
                                <img src={url} alt={`Geração ${i + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Button size="sm" variant="secondary" onClick={() => handleDownload(url, i)} className="gap-1 text-xs">
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sem imagens disponíveis</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
