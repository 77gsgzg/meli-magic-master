import { useState } from 'react';
import { MapPin, Search, Navigation, Building2, Factory, Truck, Wheat, Cpu, Shirt, UtensilsCrossed, HardHat, Plus, ExternalLink, Phone, Globe, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSupplierLocationSearch, DiscoveredSupplier } from '@/hooks/useSupplierLocationSearch';
import { SupplierLocationMap } from './SupplierLocationMap';

const economicProfiles = [
  { value: 'industrial', label: 'Industrial', icon: Factory },
  { value: 'comercial', label: 'Comercial', icon: Building2 },
  { value: 'logistica', label: 'Logística', icon: Truck },
  { value: 'agricola', label: 'Agrícola', icon: Wheat },
  { value: 'tecnologia', label: 'Tecnologia', icon: Cpu },
  { value: 'textil', label: 'Têxtil', icon: Shirt },
  { value: 'alimentos', label: 'Alimentos', icon: UtensilsCrossed },
  { value: 'construcao', label: 'Construção', icon: HardHat },
];

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function SupplierLocationSearch() {
  const {
    isSearching,
    suppliers,
    searchLocation,
    error,
    searchByCurrentLocation,
    searchByCity,
    addToSuppliers,
    clearResults
  } = useSupplierLocationSearch();

  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [economicProfile, setEconomicProfile] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(50);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [addingSupplier, setAddingSupplier] = useState<string | null>(null);

  const handleLocationSearch = async () => {
    await searchByCurrentLocation({
      economicProfile: economicProfile || undefined,
      radiusKm,
      searchQuery: searchQuery || undefined
    });
  };

  const handleCitySearch = async () => {
    if (!city) return;
    await searchByCity(city, state || undefined, {
      economicProfile: economicProfile || undefined,
      radiusKm,
      searchQuery: searchQuery || undefined
    });
  };

  const handleAddSupplier = async (supplier: DiscoveredSupplier) => {
    setAddingSupplier(supplier.place_id);
    await addToSuppliers(supplier);
    setAddingSupplier(null);
  };

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Buscar Fornecedores por Localização
          </CardTitle>
          <CardDescription>
            Encontre fornecedores reais próximos usando localização automática ou busca manual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Location Search Options */}
          <Tabs defaultValue="automatic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="automatic" className="flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                Localização Automática
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Busca Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="automatic" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para usar sua localização atual. O sistema buscará fornecedores próximos e expandirá automaticamente o raio se necessário.
              </p>
              <Button
                onClick={handleLocationSearch}
                disabled={isSearching}
                className="w-full"
                size="lg"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4 mr-2" />
                )}
                Usar Minha Localização
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    placeholder="Digite a cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {brazilianStates.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleCitySearch}
                disabled={isSearching || !city}
                className="w-full"
                size="lg"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar na Cidade
              </Button>
            </TabsContent>
          </Tabs>

          {/* Advanced Filters */}
          <div className="border-t pt-4 space-y-4">
            <h4 className="text-sm font-medium">Filtros Avançados</h4>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Perfil Econômico</Label>
                <Select value={economicProfile} onValueChange={setEconomicProfile}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os perfis</SelectItem>
                    {economicProfiles.map((profile) => (
                      <SelectItem key={profile.value} value={profile.value}>
                        <div className="flex items-center gap-2">
                          <profile.icon className="h-4 w-4" />
                          {profile.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Raio de Busca (km)</Label>
                <Select value={radiusKm.toString()} onValueChange={(v) => setRadiusKm(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 km</SelectItem>
                    <SelectItem value="50">50 km</SelectItem>
                    <SelectItem value="100">100 km</SelectItem>
                    <SelectItem value="200">200 km</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Termos de Busca</Label>
                <Input
                  placeholder="Ex: eletrônicos, têxtil..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  variant="glass"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {(suppliers.length > 0 || error) && (
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {error ? 'Resultado da Busca' : `${suppliers.length} fornecedor(es) encontrado(s)`}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  Lista
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('map')}
                >
                  Mapa
                </Button>
                <Button variant="ghost" size="sm" onClick={clearResults}>
                  Limpar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && suppliers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{error}</p>
                <p className="text-sm mt-2">Tente expandir o raio de busca ou buscar em outra cidade</p>
              </div>
            ) : viewMode === 'map' ? (
              <SupplierLocationMap
                suppliers={suppliers}
                searchLocation={searchLocation}
                onAddSupplier={handleAddSupplier}
              />
            ) : (
              <div className="space-y-4">
                {suppliers.map((supplier) => (
                  <SupplierCard
                    key={supplier.place_id}
                    supplier={supplier}
                    onAdd={handleAddSupplier}
                    isAdding={addingSupplier === supplier.place_id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SupplierCardProps {
  supplier: DiscoveredSupplier;
  onAdd: (supplier: DiscoveredSupplier) => void;
  isAdding: boolean;
}

function SupplierCard({ supplier, onAdd, isAdding }: SupplierCardProps) {
  return (
    <div className="flex items-start justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors">
      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{supplier.name}</h4>
          <Badge variant={supplier.source === 'local_database' ? 'secondary' : 'outline'} className="text-xs">
            {supplier.source === 'local_database' ? 'Local' : 'Google Places'}
          </Badge>
        </div>
        
        {supplier.address && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {supplier.address}
          </p>
        )}
        
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {supplier.distance_km !== null && (
            <span className="text-primary font-medium">
              {supplier.distance_km} km
            </span>
          )}
          
          {supplier.city && (
            <span className="text-muted-foreground">
              {supplier.city}{supplier.state ? `, ${supplier.state}` : ''}
            </span>
          )}
          
          {supplier.phone && (
            <a href={`tel:${supplier.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary">
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
          <div className="flex flex-wrap gap-1 mt-2">
            {supplier.business_type.split(',').slice(0, 3).map((type, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {type.trim().replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      <Button
        size="sm"
        onClick={() => onAdd(supplier)}
        disabled={isAdding}
        className="ml-4"
      >
        {isAdding ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-1" />
        )}
        Adicionar
      </Button>
    </div>
  );
}