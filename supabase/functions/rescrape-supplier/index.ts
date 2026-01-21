import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceChange {
  productId: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  supplierUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const { productIds, checkAll } = await req.json();

    console.log(`Re-scraping supplier products for user ${userId}`);

    // Get products to rescrape
    let query = supabase
      .from('supplier_products')
      .select('id, title, price, product_url, supplier_url, supplier_name')
      .eq('user_id', userId);

    if (!checkAll && productIds?.length > 0) {
      query = query.in('id', productIds);
    }

    const { data: products, error: productsError } = await query;

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw productsError;
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, changes: [], message: 'Nenhum produto para verificar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${products.length} products to rescrape`);

    const priceChanges: PriceChange[] = [];
    const errors: string[] = [];
    let processed = 0;

    // Group products by supplier URL for efficiency
    const bySupplier = new Map<string, typeof products>();
    for (const product of products) {
      const supplierUrl = product.supplier_url || '';
      if (!bySupplier.has(supplierUrl)) {
        bySupplier.set(supplierUrl, []);
      }
      bySupplier.get(supplierUrl)!.push(product);
    }

    // Process each supplier
    for (const [supplierUrl, supplierProducts] of bySupplier) {
      if (!supplierUrl) {
        errors.push(`Produtos sem URL do fornecedor: ${supplierProducts.length}`);
        continue;
      }

      try {
        // Fetch supplier page
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const pageResponse = await fetch(supplierUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!pageResponse.ok) {
          errors.push(`Falha ao acessar ${supplierUrl}: ${pageResponse.status}`);
          continue;
        }

        const pageContent = await pageResponse.text();

        // For each product, try to find its current price
        for (const product of supplierProducts) {
          if (!product.product_url) {
            processed++;
            continue;
          }

          try {
            // Fetch individual product page
            const productController = new AbortController();
            const productTimeoutId = setTimeout(() => productController.abort(), 10000);

            const productResponse = await fetch(product.product_url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              signal: productController.signal,
            });

            clearTimeout(productTimeoutId);

            if (!productResponse.ok) {
              processed++;
              continue;
            }

            const productContent = await productResponse.text();
            const newPrice = extractPriceFromHTML(productContent);

            if (newPrice !== null && product.price !== null) {
              const oldPrice = Number(product.price);
              const percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;

              // Only report significant changes (> 1%)
              if (Math.abs(percentageChange) > 1) {
                priceChanges.push({
                  productId: product.id,
                  title: product.title,
                  oldPrice,
                  newPrice,
                  percentageChange: Math.round(percentageChange * 100) / 100,
                  supplierUrl: product.product_url,
                });

                // Update the product price in database
                await supabase
                  .from('supplier_products')
                  .update({ 
                    price: newPrice,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', product.id);

                // Log price change to history
                await supabase
                  .from('supplier_price_history')
                  .insert({
                    supplier_product_id: product.id,
                    user_id: userId,
                    old_price: oldPrice,
                    new_price: newPrice,
                    price_change_percent: Math.round(percentageChange * 100) / 100,
                  });

                console.log(`Price change detected for ${product.title}: ${oldPrice} -> ${newPrice} (${percentageChange.toFixed(2)}%)`);
              }
            }

            processed++;
          } catch (productError) {
            console.error(`Error fetching product ${product.id}:`, productError);
            processed++;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (supplierError) {
        console.error(`Error processing supplier ${supplierUrl}:`, supplierError);
        errors.push(`Erro ao processar ${supplierUrl}`);
      }
    }

    console.log(`Re-scrape complete. Processed: ${processed}, Changes: ${priceChanges.length}, Errors: ${errors.length}`);

    // Trigger webhook for significant price changes and auto-sync ML prices
    if (priceChanges.length > 0) {
      // Get user preferences to check threshold
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('supplier_price_threshold, supplier_price_alert_enabled')
        .eq('user_id', userId)
        .single();

      const threshold = prefs?.supplier_price_threshold || 10;
      const significantChanges = priceChanges.filter(c => Math.abs(c.percentageChange) >= threshold);

      if (significantChanges.length > 0) {
        // Trigger webhook for external systems
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/trigger-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'supplier_price_change',
              user_id: userId,
              data: {
                changes: significantChanges,
                total_changes: significantChanges.length,
                threshold_percent: threshold,
                timestamp: new Date().toISOString(),
              },
            }),
          });
          console.log(`Webhook triggered for ${significantChanges.length} significant price changes`);
        } catch (webhookError) {
          console.error('Failed to trigger webhook:', webhookError);
        }
      }

      // Auto-sync ML prices for products with price changes
      try {
        const productIdsToSync = priceChanges.map(c => c.productId);
        await fetch(`${SUPABASE_URL}/functions/v1/sync-supplier-prices`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'auto_sync',
            productIds: productIdsToSync,
          }),
        });
        console.log(`Auto-sync triggered for ${productIdsToSync.length} products with price changes`);
      } catch (syncError) {
        console.error('Failed to trigger auto-sync:', syncError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        changes: priceChanges,
        errors: errors.length > 0 ? errors : undefined,
        message: priceChanges.length > 0 
          ? `${priceChanges.length} mudança(s) de preço detectada(s)` 
          : 'Nenhuma mudança de preço detectada',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rescrape error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractPriceFromHTML(html: string): number | null {
  // Try multiple price patterns
  const patterns = [
    /R\$\s*([\d.,]+)/i,
    /<span[^>]*class="[^"]*price[^"]*"[^>]*>.*?R?\$?\s*([\d.,]+)/i,
    /<ins[^>]*>.*?R?\$?\s*([\d.,]+)/i, // WooCommerce sale price
    /data-price="([\d.,]+)"/i,
    /"price":\s*([\d.]+)/i,
    /itemprop="price"[^>]*content="([\d.]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      // Clean and parse the price
      let priceStr = match[1].trim();
      
      // Handle Brazilian format (1.234,56) vs international (1,234.56)
      if (priceStr.includes(',') && priceStr.indexOf(',') > priceStr.indexOf('.')) {
        // Brazilian format
        priceStr = priceStr.replace(/\./g, '').replace(',', '.');
      } else if (priceStr.includes(',') && !priceStr.includes('.')) {
        // Comma as decimal separator
        priceStr = priceStr.replace(',', '.');
      }
      
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  }

  return null;
}
