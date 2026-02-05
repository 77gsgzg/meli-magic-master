import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchParams {
  latitude?: number
  longitude?: number
  city?: string
  state?: string
  economicProfile?: string
  radiusKm?: number
  searchQuery?: string
}

interface PlaceResult {
  place_id: string
  name: string
  formatted_address: string
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  types: string[]
  business_status?: string
  formatted_phone_number?: string
  website?: string
  opening_hours?: {
    open_now: boolean
  }
}

// Economic profile to search keywords mapping
const economicProfileKeywords: Record<string, string[]> = {
  industrial: ['fábrica', 'indústria', 'manufatura', 'metalúrgica', 'siderúrgica'],
  comercial: ['atacado', 'distribuidor', 'comércio', 'loja', 'varejo'],
  logistica: ['transportadora', 'logística', 'armazém', 'distribuição', 'frete'],
  agricola: ['agrícola', 'agropecuária', 'sementes', 'fertilizantes', 'máquinas agrícolas'],
  tecnologia: ['tecnologia', 'informática', 'eletrônicos', 'software', 'hardware'],
  textil: ['têxtil', 'confecção', 'tecidos', 'vestuário', 'moda'],
  alimentos: ['alimentos', 'bebidas', 'embalagens', 'frigorífico', 'laticínios'],
  construcao: ['construção', 'materiais de construção', 'cimento', 'ferragens', 'madeireira'],
}

// Calculate distance between two coordinates in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Parse city and state from address
function parseAddress(address: string): { city: string, state: string } {
  const parts = address.split(',').map(p => p.trim())
  let city = ''
  let state = ''
  
  if (parts.length >= 2) {
    // Usually format: "Street, Number - Neighborhood, City - State, ZIP, Country"
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i]
      if (part.includes(' - ') && !state) {
        const [cityPart, statePart] = part.split(' - ')
        if (statePart && statePart.length === 2) {
          state = statePart
          city = cityPart
          break
        }
      }
    }
    if (!city && parts.length >= 2) {
      city = parts[parts.length - 3] || parts[1]
    }
  }
  
  return { city, state }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: authError } = await supabase.auth.getClaims(token)
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claims.claims.sub as string
    const body = await req.json()
    
    const params: SearchParams = body
    
    console.log('Search params:', params)

    const results: any[] = []
    let searchLocation = { lat: 0, lng: 0 }

    // Step 1: Get coordinates (from params or geocode city)
    if (params.latitude && params.longitude) {
      searchLocation = { lat: params.latitude, lng: params.longitude }
    } else if (params.city) {
      // Geocode the city
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(params.city + (params.state ? ', ' + params.state : '') + ', Brasil')}&key=${googleApiKey}`
      const geocodeRes = await fetch(geocodeUrl)
      const geocodeData = await geocodeRes.json()
      
      if (geocodeData.results && geocodeData.results.length > 0) {
        searchLocation = geocodeData.results[0].geometry.location
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'Cidade não encontrada',
            suppliers: [],
            searchLocation: null 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      return new Response(
        JSON.stringify({ 
          error: 'Localização ou cidade necessária',
          suppliers: [],
          searchLocation: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Step 2: Build search queries
    const searchQueries: string[] = []
    
    if (params.searchQuery) {
      searchQueries.push(params.searchQuery)
    }
    
    if (params.economicProfile && economicProfileKeywords[params.economicProfile]) {
      searchQueries.push(...economicProfileKeywords[params.economicProfile])
    }
    
    // Default supplier-related searches if no specific query
    if (searchQueries.length === 0) {
      searchQueries.push('fornecedor', 'atacado', 'distribuidor', 'fábrica')
    }

    // Step 3: Search with progressive radius expansion
    const radiusOptions = [params.radiusKm || 25, 50, 100, 200] // km
    let foundResults = false

    for (const radius of radiusOptions) {
      if (foundResults) break
      
      for (const query of searchQueries.slice(0, 3)) { // Limit queries to avoid rate limits
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${searchLocation.lat},${searchLocation.lng}&radius=${radius * 1000}&key=${googleApiKey}&language=pt-BR`
        
        console.log(`Searching for "${query}" within ${radius}km`)
        
        const searchRes = await fetch(searchUrl)
        const searchData = await searchRes.json()
        
        if (searchData.results && searchData.results.length > 0) {
          foundResults = true
          
          for (const place of searchData.results as PlaceResult[]) {
            // Skip if already added
            if (results.some(r => r.place_id === place.place_id)) continue
            
            const distance = calculateDistance(
              searchLocation.lat,
              searchLocation.lng,
              place.geometry.location.lat,
              place.geometry.location.lng
            )
            
            const { city, state } = parseAddress(place.formatted_address)
            
            // Get more details about the place
            let phone = ''
            let website = ''
            
            try {
              const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${googleApiKey}`
              const detailsRes = await fetch(detailsUrl)
              const detailsData = await detailsRes.json()
              
              if (detailsData.result) {
                phone = detailsData.result.formatted_phone_number || ''
                website = detailsData.result.website || ''
              }
            } catch (e) {
              console.log('Error fetching place details:', e)
            }
            
            results.push({
              place_id: place.place_id,
              name: place.name,
              address: place.formatted_address,
              city,
              state,
              country: 'Brasil',
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng,
              phone,
              website,
              business_type: place.types?.join(', ') || '',
              economic_profile: params.economicProfile || null,
              distance_km: Math.round(distance * 10) / 10,
              source: 'google_places',
              raw_data: place
            })
          }
        }
      }
      
      // If we found results, don't expand radius further
      if (results.length >= 5) break
    }

    // Step 4: Also search in local database (existing supplier_products)
    const { data: localSuppliers } = await supabase
      .from('supplier_products')
      .select('supplier_name, supplier_url')
      .eq('user_id', userId)
    
    const uniqueLocalSuppliers = localSuppliers ? 
      [...new Set(localSuppliers.map(s => s.supplier_name))].map(name => {
        const supplier = localSuppliers.find(s => s.supplier_name === name)
        return {
          place_id: `local_${name.replace(/\s+/g, '_').toLowerCase()}`,
          name,
          address: null,
          city: params.city || null,
          state: params.state || null,
          country: 'Brasil',
          latitude: null,
          longitude: null,
          phone: null,
          website: supplier?.supplier_url || null,
          business_type: 'fornecedor local',
          economic_profile: null,
          distance_km: null,
          source: 'local_database',
          raw_data: null
        }
      }) : []

    // Combine and sort by distance
    const allResults = [...results, ...uniqueLocalSuppliers]
      .sort((a, b) => {
        if (a.distance_km === null) return 1
        if (b.distance_km === null) return -1
        return a.distance_km - b.distance_km
      })

    console.log(`Found ${allResults.length} suppliers`)

    return new Response(
      JSON.stringify({
        suppliers: allResults,
        searchLocation,
        totalFound: allResults.length,
        message: allResults.length === 0 
          ? 'Nenhum fornecedor encontrado nesta região' 
          : `${allResults.length} fornecedor(es) encontrado(s)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in search-suppliers-location:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage, suppliers: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})