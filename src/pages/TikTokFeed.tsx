import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  Zap,
  Bookmark,
  BookmarkCheck,
  XCircle,
  Crown,
  RefreshCw,
  Search,
  Play,
  Hash,
  Star,
  Layers,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FeedVideo {
  id: string;
  video_url: string;
  hashtags: string[];
  views: number;
  likes: number;
  comments_count: number;
  shares: number;
  author_username: string | null;
  description: string | null;
  collected_at: string;
  feed_status: string;
  thumbnail_url: string | null;
  is_model: boolean;
  source: string;
}

interface CreativeModel {
  id: string;
  video_id: string | null;
  hook_type: string | null;
  opening_style: string | null;
  selling_style: string | null;
  pacing: string | null;
  format: string | null;
  structure_summary: string | null;
  tags: string[];
  created_at: string;
}

const HOOK_LABELS: Record<string, string> = {
  pergunta: "❓ Pergunta",
  choque: "⚡ Choque",
  curiosidade: "🤔 Curiosidade",
  demonstracao: "🎬 Demonstração",
  antes_depois: "🔄 Antes/Depois",
  estatistica: "📊 Estatística",
};

const SELLING_LABELS: Record<string, string> = {
  soft_sell: "🤝 Soft Sell",
  hard_sell: "🔥 Hard Sell",
  story_telling: "📖 Storytelling",
  educativo: "🎓 Educativo",
  comparacao: "⚖️ Comparação",
  urgencia: "⏰ Urgência",
};

function FeedVideoCard({
  video,
  onAnalyze,
  onSave,
  onIgnore,
  onMarkModel,
  isAnalyzing,
  isMarkingModel,
}: {
  video: FeedVideo;
  onAnalyze: () => void;
  onSave: () => void;
  onIgnore: () => void;
  onMarkModel: () => void;
  isAnalyzing: boolean;
  isMarkingModel: boolean;
}) {
  const engagementRate = video.views > 0
    ? (((video.likes + video.comments_count + video.shares) / video.views) * 100).toFixed(1)
    : "0";

  return (
    <Card className="overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm">
      {/* Video preview area */}
      <div className="relative bg-gradient-to-br from-pink-500/10 to-purple-500/10 aspect-[9/16] max-h-[280px] flex items-center justify-center">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <Play className="h-12 w-12 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground line-clamp-3">
            {video.description || video.video_url}
          </p>
        </div>

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {video.is_model && (
            <Badge className="bg-amber-500/90 text-white border-0 text-[10px]">
              <Crown className="h-3 w-3 mr-0.5" /> Modelo
            </Badge>
          )}
          {video.feed_status === "saved" && (
            <Badge className="bg-blue-500/90 text-white border-0 text-[10px]">
              <BookmarkCheck className="h-3 w-3 mr-0.5" /> Salvo
            </Badge>
          )}
          {video.feed_status === "analyzed" && (
            <Badge className="bg-green-500/90 text-white border-0 text-[10px]">
              <Sparkles className="h-3 w-3 mr-0.5" /> Analisado
            </Badge>
          )}
        </div>

        {/* Engagement rate */}
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm">
            {engagementRate}% eng.
          </Badge>
        </div>

        {/* Open external */}
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm"
          onClick={() => window.open(video.video_url, "_blank")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Author + stats */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground truncate">
            {video.author_username ? `@${video.author_username}` : "Autor desconhecido"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(video.collected_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatNumber(video.views)}</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {formatNumber(video.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {formatNumber(video.comments_count)}</span>
          <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> {formatNumber(video.shares)}</span>
        </div>

        {/* Hashtags */}
        {video.hashtags && video.hashtags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {video.hashtags.slice(0, 4).map((h, i) => (
              <Badge key={i} variant="outline" className="text-[10px] border-pink-500/30 text-pink-400">
                {h.startsWith("#") ? h : `#${h}`}
              </Badge>
            ))}
            {video.hashtags.length > 4 && (
              <Badge variant="outline" className="text-[10px]">+{video.hashtags.length - 4}</Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <Button
            size="sm"
            onClick={onAnalyze}
            disabled={isAnalyzing || video.feed_status === "analyzed"}
            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0 text-xs h-8"
          >
            {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            Analisar
          </Button>
          <Button
            size="sm"
            variant={video.feed_status === "saved" ? "secondary" : "outline"}
            onClick={onSave}
            className="h-8 px-2"
            title="Salvar"
          >
            {video.feed_status === "saved" ? <BookmarkCheck className="h-3.5 w-3.5 text-blue-400" /> : <Bookmark className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onIgnore}
            className="h-8 px-2"
            title="Ignorar"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={video.is_model ? "secondary" : "outline"}
            onClick={onMarkModel}
            disabled={isMarkingModel || video.is_model}
            className="h-8 px-2"
            title="Marcar como Modelo"
          >
            {isMarkingModel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5 text-amber-400" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export default function TikTokFeed() {
  const { user } = useAuth();
  const { isAdmin } = useIsWalletAdmin();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [models, setModels] = useState<CreativeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [markingModelId, setMarkingModelId] = useState<string | null>(null);
  const [searchHashtags, setSearchHashtags] = useState("viral, produto, tendencia");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState("feed");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useRef<HTMLDivElement | null>(null);

  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!isAdmin) { navigate("/"); return; }
    fetchFeed(0, true);
    fetchModels();
  }, [isAdmin]);

  // Infinite scroll
  const lastCardCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((p) => p + 1);
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [loading, hasMore]
  );

  useEffect(() => {
    if (page > 0) fetchFeed(page, false);
  }, [page]);

  const fetchFeed = async (pageNum: number, reset: boolean) => {
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("tiktok_videos" as any)
      .select("*")
      .neq("feed_status", "ignored")
      .order("collected_at", { ascending: false })
      .range(from, to);

    const list = (data || []) as unknown as FeedVideo[];
    if (reset) {
      setVideos(list);
    } else {
      setVideos((prev) => [...prev, ...list]);
    }
    setHasMore(list.length === PAGE_SIZE);
    setLoading(false);
  };

  const fetchModels = async () => {
    const { data } = await supabase
      .from("video_creative_models" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setModels((data || []) as unknown as CreativeModel[]);
  };

  const collectVideos = async () => {
    setCollecting(true);
    try {
      const tags = searchHashtags.split(",").map((h) => h.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("tiktok-analyze", {
        body: { action: "auto_collect", hashtags: tags, limit: 20 },
      });
      if (error) throw error;
      toast.success(`Feed atualizado! ${data?.inserted || 0} novos vídeos`);
      setPage(0);
      fetchFeed(0, true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao coletar vídeos");
    }
    setCollecting(false);
  };

  const analyzeVideo = async (videoId: string) => {
    setAnalyzingId(videoId);
    try {
      const { error } = await supabase.functions.invoke("tiktok-analyze", {
        body: { action: "analyze", videoId },
      });
      if (error) throw error;
      toast.success("Análise concluída!");
      setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, feed_status: "analyzed" } : v));
    } catch (err: any) {
      toast.error(err.message || "Erro na análise");
    }
    setAnalyzingId(null);
  };

  const updateFeedStatus = async (videoId: string, status: string) => {
    try {
      const { error } = await supabase.functions.invoke("tiktok-analyze", {
        body: { action: "update_feed_status", videoId, status },
      });
      if (error) throw error;

      if (status === "ignored") {
        setVideos((prev) => prev.filter((v) => v.id !== videoId));
        toast.success("Vídeo ignorado");
      } else {
        setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, feed_status: status } : v));
        toast.success(status === "saved" ? "Vídeo salvo!" : "Status atualizado");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    }
  };

  const markAsModel = async (videoId: string) => {
    setMarkingModelId(videoId);
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-analyze", {
        body: { action: "mark_as_model", videoId },
      });
      if (error) throw error;
      if (data?.error === "already_model") {
        toast.info("Este vídeo já é um modelo");
      } else {
        toast.success("Modelo criativo extraído com sucesso!");
        setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, is_model: true, feed_status: "model" } : v));
        fetchModels();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar modelo");
    }
    setMarkingModelId(null);
  };

  if (!isAdmin) return null;

  const savedVideos = videos.filter((v) => v.feed_status === "saved");
  const modelVideos = videos.filter((v) => v.is_model);

  return (
    <DashboardLayout title="Feed Inteligente" subtitle="Vídeos virais automatizados">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30">
            <Zap className="h-6 w-6 text-pink-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Feed Inteligente</h1>
            <p className="text-xs text-muted-foreground">
              Vídeos virais coletados automaticamente
            </p>
          </div>
        </div>

        {/* Collection controls */}
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-3 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="viral, produto, tendencia..."
                  value={searchHashtags}
                  onChange={(e) => setSearchHashtags(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Button
                onClick={collectVideos}
                disabled={collecting}
                className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0 h-9"
              >
                {collecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Coletar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="feed" className="text-xs">
              <Play className="h-3.5 w-3.5 mr-1" /> Feed ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="saved" className="text-xs">
              <Bookmark className="h-3.5 w-3.5 mr-1" /> Salvos ({savedVideos.length})
            </TabsTrigger>
            <TabsTrigger value="models" className="text-xs">
              <Crown className="h-3.5 w-3.5 mr-1" /> Modelos ({models.length})
            </TabsTrigger>
          </TabsList>

          {/* Feed tab */}
          <TabsContent value="feed" className="mt-3">
            {videos.length === 0 && !loading ? (
              <Card className="border-border/60 bg-card/80">
                <CardContent className="py-12 text-center">
                  <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Nenhum vídeo no feed. Clique em "Coletar" para buscar vídeos virais automaticamente.
                  </p>
                  <Button onClick={collectVideos} disabled={collecting} className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0">
                    {collecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Coletar Vídeos
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {videos.map((video, idx) => (
                  <div key={video.id} ref={idx === videos.length - 1 ? lastCardCallback : null}>
                    <FeedVideoCard
                      video={video}
                      onAnalyze={() => analyzeVideo(video.id)}
                      onSave={() => updateFeedStatus(video.id, "saved")}
                      onIgnore={() => updateFeedStatus(video.id, "ignored")}
                      onMarkModel={() => markAsModel(video.id)}
                      isAnalyzing={analyzingId === video.id}
                      isMarkingModel={markingModelId === video.id}
                    />
                  </div>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
              </div>
            )}
          </TabsContent>

          {/* Saved tab */}
          <TabsContent value="saved" className="mt-3">
            {savedVideos.length === 0 ? (
              <Card className="border-border/60 bg-card/80">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  Nenhum vídeo salvo ainda. Use o botão <Bookmark className="h-4 w-4 inline" /> no feed.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {savedVideos.map((video) => (
                  <FeedVideoCard
                    key={video.id}
                    video={video}
                    onAnalyze={() => analyzeVideo(video.id)}
                    onSave={() => updateFeedStatus(video.id, "new")}
                    onIgnore={() => updateFeedStatus(video.id, "ignored")}
                    onMarkModel={() => markAsModel(video.id)}
                    isAnalyzing={analyzingId === video.id}
                    isMarkingModel={markingModelId === video.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Models tab */}
          <TabsContent value="models" className="mt-3">
            {models.length === 0 ? (
              <Card className="border-border/60 bg-card/80">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  Nenhum modelo criativo ainda. Marque vídeos com <Crown className="h-4 w-4 inline text-amber-400" /> para extrair padrões.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {models.map((model) => (
                  <Card key={model.id} className="border-border/60 bg-card/80">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-amber-400" />
                          <span className="text-sm font-semibold text-foreground">
                            Modelo #{model.id.slice(0, 6)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(model.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>

                      {model.structure_summary && (
                        <p className="text-xs text-muted-foreground">{model.structure_summary}</p>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {model.hook_type && (
                          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Hook</p>
                            <p className="text-xs font-medium text-foreground">
                              {HOOK_LABELS[model.hook_type] || model.hook_type}
                            </p>
                          </div>
                        )}
                        {model.selling_style && (
                          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Venda</p>
                            <p className="text-xs font-medium text-foreground">
                              {SELLING_LABELS[model.selling_style] || model.selling_style}
                            </p>
                          </div>
                        )}
                        {model.opening_style && (
                          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Abertura</p>
                            <p className="text-xs font-medium text-foreground">{model.opening_style}</p>
                          </div>
                        )}
                        {model.pacing && (
                          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Ritmo</p>
                            <p className="text-xs font-medium text-foreground">{model.pacing}</p>
                          </div>
                        )}
                        {model.format && (
                          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Formato</p>
                            <p className="text-xs font-medium text-foreground">{model.format}</p>
                          </div>
                        )}
                      </div>

                      {model.tags && model.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {model.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
