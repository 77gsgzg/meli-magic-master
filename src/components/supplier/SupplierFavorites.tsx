import { useState, useEffect } from 'react';
import { Star, MapPin, Phone, Globe, ExternalLink, Bell, BellOff, Import, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface FavoriteSupplier {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  catalog_url: string | null;
  alert_new_products: boolean;
  product_count: number;
  last_product_check_at: string | null;
  business_type: string | null;
  distance_km: number | null;
}

export function SupplierFavorites() {
  const { session } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCatalog, setEditingCatalog] = useState<string | null>(null);
  const [catalogUrl, setCatalogUrl] = useState('');
  const [importingFrom, setImportingFrom] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      loadFavorites();
    }
  }, [session?.user?.id]);

  const loadFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('discovered_suppliers')
        .select('*')
        .eq('is_favorite', true)
        .order('name');

      if (error) throw error;

      setFavorites(data?.map(s => ({
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        phone: s.phone,
        website: s.website,
        catalog_url: s.catalog_url,
        alert_new_products: s.alert_new_products ?? true,
        product_count: s.product_count ?? 0,
        last_product_check_at: s.last_product_check_at,
        business_type: s.business_type,
        distance_km: s.distance_km ? Number(s.distance_km) : null,
      })) || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
      toast.error('Erro ao carregar favoritos');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAlert = async (supplierId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('discovered_suppliers')
        .update({ alert_new_products: !currentValue })
        .eq('id', supplierId);

      if (error) throw error;

      setFavorites(prev =>
        prev.map(f =>
          f.id === supplierId
            ? { ...f, alert_new_products: !currentValue }
            : f
        )
      );

      toast.success(!currentValue ? 'Alertas ativados' : 'Alertas desativados');
    } catch (error) {
      console.error('Error toggling alert:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const removeFavorite = async (supplierId: string) => {
    try {
      const { error } = await supabase
        .from('discovered_suppliers')
        .update({ is_favorite: false })
        .eq('id', supplierId);

      if (error) throw error;

      setFavorites(prev => prev.filter(f => f.id !== supplierId));
      toast.success('Removido dos favoritos');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Erro ao remover favorito');
    }
  };

  const saveCatalogUrl = async (supplierId: string) => {
    try {
      const { error } = await supabase
        .from('discovered_suppliers')
        .update({ catalog_url: catalogUrl || null })
        .eq('id', supplierId);

      if (error) throw error;

      setFavorites(prev =>
        prev.map(f =>
          f.id === supplierId
            ? { ...f, catalog_url: catalogUrl || null }
            : f
        )
      );

      setEditingCatalog(null);
      setCatalogUrl('');
      toast.success('URL do catálogo salva');
    } catch (error) {
      console.error('Error saving catalog URL:', error);
      toast.error('Erro ao salvar URL');
    }
  };

  const importProducts = async (supplier: FavoriteSupplier) => {
    if (!supplier.catalog_url) {
      toast.error('Configure a URL do catálogo primeiro');
      return;
    }

    setImportingFrom(supplier.id);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-supplier', {
        body: { supplierUrl: supplier.catalog_url },
      });

      if (error) throw error;

      if (data.success && data.products?.length > 0) {
        // Save products to supplier_products
        const productsToSave = data.products.map((p: any) => ({
          user_id: session!.user.id,
          supplier_name: supplier.name,
          supplier_url: supplier.catalog_url,
          title: p.title,
          description: p.description,
          price: p.price,
          currency: p.currency || 'BRL',
          image_url: p.image,
          product_url: p.url,
        }));

        const { error: insertError } = await supabase
          .from('supplier_products')
          .insert(productsToSave);

        if (insertError) throw insertError;

        // Update supplier product count and last check
        await supabase
          .from('discovered_suppliers')
          .update({
            product_count: data.products.length,
            last_product_check_at: new Date().toISOString(),
          })
          .eq('id', supplier.id);

        setFavorites(prev =>
          prev.map(f =>
            f.id === supplier.id
              ? {
                  ...f,
                  product_count: data.products.length,
                  last_product_check_at: new Date().toISOString(),
                }
              : f
          )
        );

        toast.success(`${data.products.length} produtos importados de ${supplier.name}!`);
      } else {
        toast.info('Nenhum produto encontrado');
      }
    } catch (error: any) {
      console.error('Error importing products:', error);
      toast.error(error.message || 'Erro ao importar produtos');
    } finally {
      setImportingFrom(null);
    }
  };

  if (isLoading) {
    return (
      <Card variant="glass">
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (favorites.length === 0) {
    return (
      <Card variant="glass">
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum fornecedor favorito</p>
            <p className="text-sm mt-1">
              Marque fornecedores como favoritos na aba de busca por localização
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Fornecedores Favoritos
          </CardTitle>
          <CardDescription>
            Gerencie seus fornecedores preferidos e configure alertas de novos produtos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {favorites.map((supplier) => (
            <div
              key={supplier.id}
              className="p-4 rounded-lg border bg-card/50 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{supplier.name}</h4>
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  
                  {supplier.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {supplier.address}
                      {supplier.city && `, ${supplier.city}`}
                      {supplier.state && ` - ${supplier.state}`}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 text-sm">
                    {supplier.distance_km !== null && (
                      <span className="text-primary font-medium">
                        {supplier.distance_km} km
                      </span>
                    )}
                    
                    {supplier.phone && (
                      <a
                        href={`tel:${supplier.phone}`}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {supplier.phone}
                      </a>
                    )}
                    
                    {supplier.website && (
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                      >
                        <Globe className="h-3 w-3" />
                        Site
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {supplier.business_type && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {supplier.business_type.split(',').slice(0, 3).map((type, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {type.trim().replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFavorite(supplier.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Catalog URL */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">URL do Catálogo</Label>
                  {supplier.product_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {supplier.product_count} produtos
                    </Badge>
                  )}
                </div>
                
                {editingCatalog === supplier.id ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://fornecedor.com/catalogo"
                      value={catalogUrl}
                      onChange={(e) => setCatalogUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => saveCatalogUrl(supplier.id)}>
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingCatalog(null);
                        setCatalogUrl('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground flex-1 truncate">
                      {supplier.catalog_url || 'Não configurado'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCatalog(supplier.id);
                        setCatalogUrl(supplier.catalog_url || '');
                      }}
                    >
                      {supplier.catalog_url ? 'Editar' : 'Configurar'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`alert-${supplier.id}`}
                    checked={supplier.alert_new_products}
                    onCheckedChange={() => toggleAlert(supplier.id, supplier.alert_new_products)}
                  />
                  <Label
                    htmlFor={`alert-${supplier.id}`}
                    className="text-sm flex items-center gap-1 cursor-pointer"
                  >
                    {supplier.alert_new_products ? (
                      <Bell className="h-3 w-3 text-primary" />
                    ) : (
                      <BellOff className="h-3 w-3 text-muted-foreground" />
                    )}
                    Alertar novos produtos
                  </Label>
                </div>

                <Button
                  size="sm"
                  onClick={() => importProducts(supplier)}
                  disabled={!supplier.catalog_url || importingFrom === supplier.id}
                >
                  {importingFrom === supplier.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Import className="h-4 w-4 mr-1" />
                  )}
                  Importar Produtos
                </Button>
              </div>

              {supplier.last_product_check_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Última verificação: {new Date(supplier.last_product_check_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
