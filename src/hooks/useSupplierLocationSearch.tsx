import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';

export interface DiscoveredSupplier {
  place_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  business_type: string | null;
  economic_profile: string | null;
  distance_km: number | null;
  source: 'google_places' | 'local_database';
  raw_data: any;
}

export interface SearchLocation {
  lat: number;
  lng: number;
}

export interface SearchParams {
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  economicProfile?: string;
  radiusKm?: number;
  searchQuery?: string;
}

export function useSupplierLocationSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [suppliers, setSuppliers] = useState<DiscoveredSupplier[]>([]);
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const searchSuppliers = async (params: SearchParams) => {
    setIsSearching(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('search-suppliers-location', {
        body: params
      });

      if (fnError) throw fnError;

      if (data.error && data.suppliers?.length === 0) {
        setError(data.error);
        setSuppliers([]);
        setSearchLocation(data.searchLocation);
        return;
      }

      setSuppliers(data.suppliers || []);
      setSearchLocation(data.searchLocation);
      
      if (data.suppliers?.length > 0) {
        toast({
          title: 'Fornecedores encontrados',
          description: data.message,
        });
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Erro ao buscar fornecedores');
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao buscar fornecedores',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getCurrentLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada pelo navegador'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              reject(new Error('Permissão de localização negada'));
              break;
            case err.POSITION_UNAVAILABLE:
              reject(new Error('Localização indisponível'));
              break;
            case err.TIMEOUT:
              reject(new Error('Tempo limite excedido'));
              break;
            default:
              reject(new Error('Erro ao obter localização'));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const searchByCurrentLocation = async (options?: Omit<SearchParams, 'latitude' | 'longitude'>) => {
    try {
      const position = await getCurrentLocation();
      await searchSuppliers({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        ...options
      });
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Erro de localização',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const searchByCity = async (city: string, state?: string, options?: Omit<SearchParams, 'city' | 'state'>) => {
    await searchSuppliers({
      city,
      state,
      ...options
    });
  };

  const addToSuppliers = async (supplier: DiscoveredSupplier): Promise<boolean> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      // Save to discovered_suppliers table
      const { error: saveError } = await supabase
        .from('discovered_suppliers')
        .upsert({
          user_id: user.user.id,
          name: supplier.name,
          address: supplier.address,
          city: supplier.city,
          state: supplier.state,
          country: supplier.country,
          latitude: supplier.latitude,
          longitude: supplier.longitude,
          phone: supplier.phone,
          website: supplier.website,
          place_id: supplier.place_id,
          business_type: supplier.business_type,
          economic_profile: supplier.economic_profile,
          distance_km: supplier.distance_km,
          source: supplier.source,
          raw_data: supplier.raw_data,
          is_added_to_suppliers: true
        } as any);

      if (saveError) throw saveError;

      toast({
        title: 'Fornecedor adicionado',
        description: `${supplier.name} foi adicionado à sua lista`,
      });

      return true;
    } catch (err: any) {
      console.error('Error adding supplier:', err);
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao adicionar fornecedor',
        variant: 'destructive',
      });
      return false;
    }
  };

  const clearResults = () => {
    setSuppliers([]);
    setSearchLocation(null);
    setError(null);
  };

  return {
    isSearching,
    suppliers,
    searchLocation,
    error,
    searchSuppliers,
    searchByCurrentLocation,
    searchByCity,
    addToSuppliers,
    clearResults,
    getCurrentLocation
  };
}