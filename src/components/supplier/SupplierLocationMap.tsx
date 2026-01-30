import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiscoveredSupplier, SearchLocation } from '@/hooks/useSupplierLocationSearch';

interface SupplierLocationMapProps {
  suppliers: DiscoveredSupplier[];
  searchLocation: SearchLocation | null;
  onAddSupplier: (supplier: DiscoveredSupplier) => void;
}

export function SupplierLocationMap({ suppliers, searchLocation, onAddSupplier }: SupplierLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<DiscoveredSupplier | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!selectedSupplier) return;
    setIsAdding(true);
    await onAddSupplier(selectedSupplier);
    setIsAdding(false);
    setSelectedSupplier(null);
  };

  // Fallback visualization when Google Maps is not available
  const suppliersWithLocation = suppliers.filter(s => s.latitude && s.longitude);

  return (
    <div className="relative">
      {/* Map container or fallback */}
      <div 
        ref={mapRef} 
        className="w-full h-[400px] rounded-lg bg-muted/50 flex items-center justify-center"
      >
        <div className="text-center space-y-4 p-4">
          {suppliersWithLocation.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-lg mx-auto">
                {suppliersWithLocation.slice(0, 9).map((supplier) => (
                  <button
                    key={supplier.place_id}
                    onClick={() => setSelectedSupplier(supplier)}
                    className={`p-3 rounded-lg border transition-all ${
                      selectedSupplier?.place_id === supplier.place_id
                        ? 'bg-primary/20 border-primary'
                        : 'bg-card/50 border-border hover:border-primary/50'
                    }`}
                  >
                    <MapPin className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs truncate">{supplier.name}</p>
                    {supplier.distance_km && (
                      <p className="text-xs text-muted-foreground">{supplier.distance_km} km</p>
                    )}
                  </button>
                ))}
              </div>
              {suppliersWithLocation.length > 9 && (
                <p className="text-sm text-muted-foreground">
                  +{suppliersWithLocation.length - 9} mais fornecedores
                </p>
              )}
            </>
          ) : (
            <div className="text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Fornecedores sem dados de localização</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected supplier info card */}
      {selectedSupplier && (
        <div className="absolute bottom-4 left-4 right-4 bg-card border rounded-lg p-4 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">{selectedSupplier.name}</h4>
              {selectedSupplier.address && (
                <p className="text-sm text-muted-foreground mt-1">{selectedSupplier.address}</p>
              )}
              <div className="flex items-center gap-2 mt-2 text-sm">
                {selectedSupplier.distance_km && (
                  <span className="text-primary">{selectedSupplier.distance_km} km</span>
                )}
                {selectedSupplier.phone && (
                  <a href={`tel:${selectedSupplier.phone}`} className="text-muted-foreground hover:text-primary">
                    {selectedSupplier.phone}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={isAdding}
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Adicionar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedSupplier(null)}
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}