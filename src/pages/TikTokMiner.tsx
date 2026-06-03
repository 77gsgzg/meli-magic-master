import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Sparkles,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
  ExternalLink,
  Zap,
  BarChart3,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TikTokVideo {
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
}

interface TikTokAnalysis {
  id: string;
  video_id: string;
  detected_product: string | null;
  trend_type: string | null;
  potential_score: number | null;
  virality_reason: string | null;
  video_summary: string | null;
  comments_summary: string | null;
  created_at: string;
}

const TREND_LABELS: Record<string, string> = {
  problema_resolvido: "Problema Resolvido",
  demonstracao: "Demonstração",
  emocional: "Emocional",
  viral_hook: "Viral Hook",
  review: "Review",
  unboxing: "Unboxing",
  tutorial: "Tutorial",
  outro: "Outro",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 8
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : score >= 5
      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      : "bg-red-500/20 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      <Zap className="h-3 w-3" />
      {score.toFixed(1)}
    </span>
  );
}

export default function TikTokMiner() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsWalletAdmin();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, TikTokAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Form
  const [videoUrl, setVideoUrl] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [description, setDescription] = useState("");
  const [authorUsername, setAuthorUsername] = useState("");
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [commentsCount, setCommentsCount] = useState("");
  const [shares, setShares] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    const { data: vids } = await supabase
      .from("tiktok_videos" as any)
      .select("*")
      .order("collected_at", { ascending: false })
      .limit(100);

    const videoList = (vids || []) as unknown as TikTokVideo[];
    setVideos(videoList);

    if (videoList.length > 0) {
      const ids = videoList.map((v) => v.id);
      const { data: ans } = await supabase
        .from("tiktok_analysis" as any)
        .select("*")
        .in("video_id", ids);

      const map: Record<string, TikTokAnalysis> = {};
      ((ans || []) as unknown as TikTokAnalysis[]).forEach((a) => {
        map[a.video_id] = a;
      });
      setAnalyses(map);
    }
    setLoading(false);
  };

  const addVideo = async () => {
    if (!videoUrl.trim()) {
      toast.error("URL do vídeo é obrigatória");
      return;
    }
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-analyze", {
        body: {
          action: "add_video",
          videoUrl: videoUrl.trim(),
          hashtags: hashtags
            .split(",")
            .map((h) => h.trim())
            .filter(Boolean),
          description: description.trim() || null,
          author_username: authorUsername.trim() || null,
          views: parseInt(views) || 0,
          likes: parseInt(likes) || 0,
          comments_count: parseInt(commentsCount) || 0,
          shares: parseInt(shares) || 0,
        },
      });

      if (error) throw error;
      toast.success("Vídeo adicionado!");
      setVideoUrl("");
      setHashtags("");
      setDescription("");
      setAuthorUsername("");
      setViews("");
      setLikes("");
      setCommentsCount("");
      setShares("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar vídeo");
    }
    setAdding(false);
  };

  const analyzeVideo = async (videoId: string) => {
    setAnalyzingId(videoId);
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-analyze", {
        body: { action: "analyze", videoId },
      });

      if (error) throw error;
      toast.success("Análise concluída!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro na análise");
    }
    setAnalyzingId(null);
  };

  const deleteVideo = async (videoId: string) => {
    try {
      const { error } = await supabase.functions.invoke("tiktok-analyze", {
        body: { action: "delete_video", videoId },
      });
      if (error) throw error;
      toast.success("Vídeo removido!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  };

  if (!isAdmin) return null;

  const analyzedVideos = videos.filter((v) => analyses[v.id]);
  const pendingVideos = videos.filter((v) => !analyses[v.id]);
  const topVideos = [...analyzedVideos].sort(
    (a, b) => (analyses[b.id]?.potential_score || 0) - (analyses[a.id]?.potential_score || 0)
  );

  return (
    <DashboardLayout title="TikTok Miner" subtitle="Mineração e análise de vídeos virais">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30">
            <TrendingUp className="h-6 w-6 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">TikTok Miner</h1>
            <p className="text-sm text-muted-foreground">
              Mineração e análise de vídeos virais
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="glass">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{videos.length}</p>
              <p className="text-xs text-muted-foreground">Vídeos Coletados</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{analyzedVideos.length}</p>
              <p className="text-xs text-muted-foreground">Analisados</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{pendingVideos.length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-pink-400">
                {topVideos.length > 0
                  ? (analyses[topVideos[0]?.id]?.potential_score || 0).toFixed(1)
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Maior Score</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="add" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="add">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </TabsTrigger>
            <TabsTrigger value="videos">
              <BarChart3 className="h-4 w-4 mr-1" /> Vídeos ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="top">
              <Sparkles className="h-4 w-4 mr-1" /> Top Score
            </TabsTrigger>
          </TabsList>

          {/* Add video */}
          <TabsContent value="add">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Adicionar Vídeo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">URL do Vídeo *</label>
                  <Input
                    placeholder="https://tiktok.com/@user/video/..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Autor</label>
                    <Input
                      placeholder="@username"
                      value={authorUsername}
                      onChange={(e) => setAuthorUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Hashtags (separadas por vírgula)
                    </label>
                    <Input
                      placeholder="#viral, #produto, #tendencia"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Descrição</label>
                  <Textarea
                    placeholder="Descrição do vídeo..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">Views</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={views}
                      onChange={(e) => setViews(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Likes</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={likes}
                      onChange={(e) => setLikes(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Comentários</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={commentsCount}
                      onChange={(e) => setCommentsCount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Shares</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={addVideo} disabled={adding} className="w-full">
                  {adding ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Adicionar Vídeo
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Videos */}
          <TabsContent value="videos">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : videos.length === 0 ? (
              <Card className="glass">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum vídeo adicionado. Use a aba "Adicionar" para começar.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {videos.map((video) => {
                  const analysis = analyses[video.id];
                  return (
                    <Card key={video.id} className="glass">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {video.author_username && (
                                <span className="text-sm font-semibold text-foreground">
                                  @{video.author_username}
                                </span>
                              )}
                              {analysis && <ScoreBadge score={analysis.potential_score} />}
                              {analysis?.trend_type && (
                                <Badge variant="outline" className="text-[10px]">
                                  {TREND_LABELS[analysis.trend_type] || analysis.trend_type}
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {video.description || video.video_url}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" /> {(video.views || 0).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" /> {(video.likes || 0).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />{" "}
                                {(video.comments_count || 0).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Share2 className="h-3 w-3" />{" "}
                                {(video.shares || 0).toLocaleString()}
                              </span>
                            </div>

                            {video.hashtags && video.hashtags.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {video.hashtags.map((h, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">
                                    {h}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {analysis && (
                              <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                                {analysis.detected_product && (
                                  <p className="text-xs">
                                    <span className="font-medium text-foreground">Produto:</span>{" "}
                                    <span className="text-muted-foreground">
                                      {analysis.detected_product}
                                    </span>
                                  </p>
                                )}
                                {analysis.virality_reason && (
                                  <p className="text-xs">
                                    <span className="font-medium text-foreground">
                                      Viralização:
                                    </span>{" "}
                                    <span className="text-muted-foreground">
                                      {analysis.virality_reason}
                                    </span>
                                  </p>
                                )}
                                {analysis.video_summary && (
                                  <p className="text-xs">
                                    <span className="font-medium text-foreground">Resumo:</span>{" "}
                                    <span className="text-muted-foreground">
                                      {analysis.video_summary}
                                    </span>
                                  </p>
                                )}
                              </div>
                            )}

                            <p className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(video.collected_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(video.video_url, "_blank")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            {!analysis && (
                              <Button
                                size="sm"
                                onClick={() => analyzeVideo(video.id)}
                                disabled={analyzingId === video.id}
                                className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0"
                              >
                                {analyzingId === video.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteVideo(video.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Top Score */}
          <TabsContent value="top">
            {topVideos.length === 0 ? (
              <Card className="glass">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum vídeo analisado ainda. Adicione vídeos e clique em analisar.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {topVideos.map((video, idx) => {
                  const analysis = analyses[video.id];
                  return (
                    <Card
                      key={video.id}
                      className={`glass ${
                        idx === 0 ? "border-pink-500/40 shadow-lg shadow-pink-500/10" : ""
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-muted-foreground/40">
                            #{idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <ScoreBadge score={analysis?.potential_score || null} />
                              {video.author_username && (
                                <span className="text-sm font-medium text-foreground">
                                  @{video.author_username}
                                </span>
                              )}
                              {analysis?.trend_type && (
                                <Badge variant="outline" className="text-[10px]">
                                  {TREND_LABELS[analysis.trend_type] || analysis.trend_type}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {analysis?.detected_product || "Produto não identificado"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {analysis?.virality_reason}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(video.video_url, "_blank")}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
