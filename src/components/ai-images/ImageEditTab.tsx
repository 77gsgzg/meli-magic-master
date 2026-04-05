import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Sparkles, Download, ImagePlus, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const editTypes = [
  { value: "remove_object", label: "Remover Objeto", desc: "Remove elementos indesejados" },
  { value: "add_element", label: "Adicionar Elemento", desc: "Insere novos objetos na cena" },
  { value: "change_background", label: "Mudar Fundo", desc: "Altera o cenário da imagem" },
  { value: "improve_quality", label: "Melhorar Qualidade", desc: "Nitidez, iluminação, cores" },
  { value: "general_adjust", label: "Ajuste Geral", desc: "Correções diversas" },
  { value: "custom", label: "Personalizado", desc: "Descreva livremente" },
];

interface EditHistoryItem {
  id: string;
  original_image_url: string;
  edited_image_url: string | null;
  prompt: string;
  edit_type: string;
  status: string;
  created_at: string;
}

interface ImageEditTabProps {
  userId: string;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ImageEditTab({ userId }: ImageEditTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [editType, setEditType] = useState("custom");
  const [prompt, setPrompt] = useState("");
  const [processing, setProcessing] = useState(false);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("ai_image_edits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory((data as unknown as EditHistoryItem[]) || []);
    setHistoryLoading(false);
  }, [userId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      setImageBase64(result);
      setEditedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setPreviewUrl(null);
    setImageBase64(null);
    setEditedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEdit = async () => {
    if (!imageBase64 || !prompt.trim()) {
      toast.error("Envie uma imagem e descreva a edição desejada.");
      return;
    }

    setProcessing(true);
    setEditedImage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      // Create record
      const { data: record } = await supabase
        .from("ai_image_edits" as any)
        .insert({
          user_id: userId,
          original_image_url: "upload",
          prompt: prompt.trim(),
          edit_type: editType,
          status: "processing",
        } as any)
        .select()
        .single();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-edit-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_data: imageBase64,
            prompt: prompt.trim(),
            edit_type: editType,
            record_id: (record as any)?.id,
          }),
        }
      );

      if (response.status === 429) { toast.error("Limite de requisições excedido."); return; }
      if (response.status === 402) { toast.error("Créditos de IA esgotados."); return; }
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro ao editar imagem");
      }

      const data = await response.json();
      if (data.edited_image) {
        setEditedImage(data.edited_image);
        toast.success("Imagem editada com sucesso!");
      } else {
        toast.error("Não foi possível gerar a edição.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = (dataUrl: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `ai-edit-${editType}-${Date.now()}.png`;
    link.click();
  };

  const handleDeleteHistory = async (id: string) => {
    const { error } = await supabase.from("ai_image_edits").delete().eq("id", id);
    if (!error) {
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success("Registro removido");
    }
  };

  const editLabel = (val: string) => editTypes.find((e) => e.value === val)?.label || val;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload + Config */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Upload & Edição</CardTitle>
            <CardDescription>Envie uma imagem e descreva a edição desejada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Upload area */}
            <div className="space-y-2">
              <Label>Imagem</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              {!previewUrl ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para enviar imagem</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG ou WEBP (máx. 10MB)</span>
                </button>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-48 object-contain bg-muted/30" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={clearImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Edit type */}
            <div className="space-y-2">
              <Label>Tipo de edição</Label>
              <div className="grid grid-cols-2 gap-2">
                {editTypes.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setEditType(t.value)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      editType === t.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="font-medium text-xs text-foreground">{t.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label>Instrução de edição *</Label>
              <Textarea
                placeholder='Ex: "remover o fundo e deixar branco", "adicionar mesa de madeira moderna"...'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={1000}
                className="min-h-[80px]"
              />
              <p className="text-[10px] text-muted-foreground text-right">{prompt.length}/1000</p>
            </div>

            <Button
              onClick={handleEdit}
              disabled={processing || !previewUrl || !prompt.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {processing ? "Processando edição..." : "Editar Imagem"}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Resultado</CardTitle>
            <CardDescription>
              {editedImage ? "Imagem editada com sucesso" : "A imagem editada aparecerá aqui"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {processing && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Editando imagem com IA...</p>
              </div>
            )}
            {!processing && !editedImage && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <ImagePlus className="h-12 w-12 opacity-30" />
                <p className="text-sm">Nenhuma edição realizada ainda</p>
              </div>
            )}
            {editedImage && (
              <div className="space-y-3">
                <div className="relative group rounded-lg overflow-hidden border border-border">
                  <img src={editedImage} alt="Editada" className="w-full h-auto object-contain" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleDownload(editedImage)} className="gap-1">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                </div>
                {/* Before/After comparison */}
                {previewUrl && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg overflow-hidden border border-border">
                      <p className="text-[10px] text-center text-muted-foreground py-1 bg-muted/30">Original</p>
                      <img src={previewUrl} alt="Original" className="w-full h-32 object-contain" />
                    </div>
                    <div className="rounded-lg overflow-hidden border border-border">
                      <p className="text-[10px] text-center text-muted-foreground py-1 bg-muted/30">Editada</p>
                      <img src={editedImage} alt="Editada" className="w-full h-32 object-contain" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History toggle */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory && history.length === 0) fetchHistory();
          }}
          className="gap-1.5"
        >
          Histórico de Edições {showHistory ? "▲" : "▼"}
        </Button>
      </div>

      {showHistory && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Edições</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma edição realizada</p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-border/60">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{editLabel(item.edit_type)}</Badge>
                        <Badge variant={item.status === "done" ? "default" : "secondary"} className="text-xs">
                          {item.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => handleDeleteHistory(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.prompt}</p>
                    {item.edited_image_url && (
                      <div className="relative group rounded-lg overflow-hidden border border-border aspect-video max-w-xs">
                        <img src={item.edited_image_url} alt="Editada" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button size="sm" variant="secondary" onClick={() => handleDownload(item.edited_image_url!)} className="gap-1 text-xs">
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
