import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface StorageFile {
  name: string;
  path: string;
  url: string;
  created_at?: string;
}

interface CleanupResult {
  success: boolean;
  dry_run: boolean;
  files_to_delete: number;
  deleted_count: number;
  images_in_use: number;
  total_files_scanned: number;
}

export function StorageImageViewer() {
  const { user } = useAuth();
  const [images, setImages] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<CleanupResult | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchImages = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // List user's images from storage
      const { data: folders, error: foldersError } = await supabase
        .storage
        .from('product-images')
        .list(user.id, { limit: 100 });

      if (foldersError) throw foldersError;

      const allImages: StorageFile[] = [];

      // Get images from each subfolder (product folders)
      for (const folder of folders || []) {
        if (folder.name) {
          const { data: files } = await supabase
            .storage
            .from('product-images')
            .list(`${user.id}/${folder.name}`, { limit: 50 });

          for (const file of files || []) {
            if (file.name && !file.name.startsWith('.')) {
              const path = `${user.id}/${folder.name}/${file.name}`;
              const { data: publicUrl } = supabase.storage
                .from('product-images')
                .getPublicUrl(path);

              allImages.push({
                name: file.name,
                path: path,
                url: publicUrl.publicUrl,
                created_at: file.created_at
              });
            }
          }
        }
      }

      setImages(allImages);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Erro ao carregar imagens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [user]);

  const previewCleanup = async () => {
    setCleanupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-storage', {
        body: { days_old: 30, dry_run: true }
      });

      if (error) throw error;

      setCleanupPreview(data);
    } catch (error) {
      console.error('Error previewing cleanup:', error);
      toast.error('Erro ao verificar limpeza');
    } finally {
      setCleanupLoading(false);
    }
  };

  const runCleanup = async () => {
    setCleanupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-storage', {
        body: { days_old: 30, dry_run: false }
      });

      if (error) throw error;

      toast.success(`${data.deleted_count} imagens removidas com sucesso`);
      setCleanupPreview(null);
      fetchImages();
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast.error('Erro ao executar limpeza');
    } finally {
      setCleanupLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          Armazenamento de Imagens
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchImages}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={previewCleanup}
                disabled={cleanupLoading}
              >
                {cleanupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpeza de Imagens Antigas</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    {cleanupPreview ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            <span>Total escaneado: {cleanupPreview.total_files_scanned}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <span>Em uso: {cleanupPreview.images_in_use}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span>Para remover: {cleanupPreview.files_to_delete}</span>
                          </div>
                        </div>
                        {cleanupPreview.files_to_delete > 0 ? (
                          <p className="text-muted-foreground">
                            Serão removidas {cleanupPreview.files_to_delete} imagens 
                            órfãs com mais de 30 dias. Esta ação não pode ser desfeita.
                          </p>
                        ) : (
                          <p className="text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            Nenhuma imagem para limpar. Tudo em ordem!
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        Carregando informações de limpeza...
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={runCleanup}
                  disabled={!cleanupPreview || cleanupPreview.files_to_delete === 0}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Limpar Agora
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma imagem armazenada</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{images.length} imagens</span>
              <Badge variant="secondary">
                Bucket: product-images
              </Badge>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {images.map((image) => (
                  <Dialog key={image.path}>
                    <DialogTrigger asChild>
                      <button
                        className="relative aspect-square rounded-md overflow-hidden bg-muted hover:ring-2 ring-primary transition-all group"
                        onClick={() => setSelectedImage(image.url)}
                      >
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-foreground" />
                        </div>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="truncate text-sm">
                          {image.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="relative aspect-video">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-full object-contain rounded-md"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        {image.path}
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
