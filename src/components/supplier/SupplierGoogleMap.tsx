import { useCallback, useState, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { MapPin, Plus, Loader2, Star, ExternalLink, Phone, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DiscoveredSupplier, SearchLocation } from '@/hooks/useSupplierLocationSearch';

interface SupplierGoogleMapProps {
  suppliers: DiscoveredSupplier[];
  searchLocation: SearchLocation | null;
  onAddSupplier: (supplier: DiscoveredSupplier) => void;
  onToggleFavorite?: (supplier: DiscoveredSupplier) => void;
  googleMapsApiKey?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

export function SupplierGoogleMap({
  suppliers,
  searchLocation,
  onAddSupplier,
  onToggleFavorite,
  googleMapsApiKey,
}: SupplierGoogleMapProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<DiscoveredSupplier | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || '',
    id: 'google-map-script',
  });

  const center = useMemo(() => {
    if (searchLocation?.lat && searchLocation?.lng) {
      return { lat: searchLocation.lat, lng: searchLocation.lng };
    }
    // If we have suppliers, center on the first one with coordinates
    const firstWithCoords = suppliers.find(s => s.latitude && s.longitude);
    if (firstWithCoords) {
      return { lat: Number(firstWithCoords.latitude), lng: Number(firstWithCoords.longitude) };
    }
    return defaultCenter;
  }, [searchLocation, suppliers]);

  const suppliersWithLocation = useMemo(() => 
    suppliers.filter(s => s.latitude && s.longitude),
    [suppliers]
  );

  const handleAdd = async () => {
    if (!selectedSupplier) return;
    setIsAdding(true);
    await onAddSupplier(selectedSupplier);
    setIsAdding(false);
    setSelectedSupplier(null);
  };

  const handleMarkerClick = useCallback((supplier: DiscoveredSupplier) => {
    setSelectedSupplier(supplier);
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    if (suppliersWithLocation.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      suppliersWithLocation.forEach(supplier => {
        if (supplier.latitude && supplier.longitude) {
          bounds.extend({
            lat: Number(supplier.latitude),
            lng: Number(supplier.longitude),
          });
        }
      });
      if (searchLocation?.lat && searchLocation?.lng) {
        bounds.extend({
          lat: searchLocation.lat,
          lng: searchLocation.lng,
        });
      }
      map.fitBounds(bounds);
    }
  }, [suppliersWithLocation, searchLocation]);

  if (loadError) {
    return (
      <div className="w-full h-[400px] rounded-lg bg-muted/50 flex items-center justify-center">
        <div className="text-center text-destructive">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Erro ao carregar Google Maps</p>
          <p className="text-sm mt-1">Verifique a chave de API</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[400px] rounded-lg bg-muted/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!googleMapsApiKey) {
    return (
      <div className="w-full h-[400px] rounded-lg bg-muted/50 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Google Maps não configurado</p>
          <p className="text-sm mt-1">Configure a chave GOOGLE_PLACES_API_KEY</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={12}
        onLoad={onMapLoad}
        options={{
          styles: [
            {
              featureType: 'all',
              elementType: 'geometry',
              stylers: [{ color: '#242f3e' }],
            },
            {
              featureType: 'all',
              elementType: 'labels.text.stroke',
              stylers: [{ color: '#242f3e' }],
            },
            {
              featureType: 'all',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#746855' }],
            },
            {
              featureType: 'road',
              elementType: 'geometry',
              stylers: [{ color: '#38414e' }],
            },
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#17263c' }],
            },
          ],
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {/* Search location marker */}
        {searchLocation?.lat && searchLocation?.lng && (
          <Marker
            position={{ lat: searchLocation.lat, lng: searchLocation.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#10b981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
            title="Sua localização"
          />
        )}

        {/* Supplier markers */}
        {suppliersWithLocation.map((supplier) => (
          <Marker
            key={supplier.place_id}
            position={{
              lat: Number(supplier.latitude),
              lng: Number(supplier.longitude),
            }}
            onClick={() => handleMarkerClick(supplier)}
            icon={{
              path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: (supplier as any).is_favorite ? '#f59e0b' : '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            title={supplier.name}
          />
        ))}

        {/* Info window for selected supplier */}
        {selectedSupplier && selectedSupplier.latitude && selectedSupplier.longitude && (
          <InfoWindow
            position={{
              lat: Number(selectedSupplier.latitude),
              lng: Number(selectedSupplier.longitude),
            }}
            onCloseClick={() => setSelectedSupplier(null)}
          >
            <div className="p-2 min-w-[200px] max-w-[300px] text-foreground">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm text-gray-900">{selectedSupplier.name}</h4>
                {(selectedSupplier as any).is_favorite && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                )}
              </div>
              
              {selectedSupplier.address && (
                <p className="text-xs text-gray-600 mt-1">{selectedSupplier.address}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                {selectedSupplier.distance_km !== null && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedSupplier.distance_km} km
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {selectedSupplier.source === 'local_database' ? 'Local' : 'Google'}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {selectedSupplier.phone && (
                  <a
                    href={`tel:${selectedSupplier.phone}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    Ligar
                  </a>
                )}
                {selectedSupplier.website && (
                  <a
                    href={selectedSupplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    Site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={handleAdd}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </>
                  )}
                </Button>
                {onToggleFavorite && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => onToggleFavorite(selectedSupplier)}
                  >
                    <Star className={`h-3 w-3 ${(selectedSupplier as any).is_favorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                  </Button>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Sua localização</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Fornecedor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Favorito</span>
        </div>
      </div>
    </div>
  );
}
