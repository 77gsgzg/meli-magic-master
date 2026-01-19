import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupplierProduct {
  id: string;
  user_id: string;
  supplier_url: string;
  product_url: string;
  price: number | null;
  published_product_id: string | null;
  ml_item_id: string | null;
  is_published: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, productIds } = await req.json();
    console.log(`[sync-supplier-prices] Action: ${action}, User: ${user.id}`);

    if (action === "sync_all") {
      // Get all published supplier products
      const { data: supplierProducts, error: fetchError } = await supabase
        .from("supplier_products")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_published", true)
        .not("published_product_id", "is", null);

      if (fetchError) {
        console.error("[sync-supplier-prices] Error fetching products:", fetchError);
        throw fetchError;
      }

      if (!supplierProducts || supplierProducts.length === 0) {
        return new Response(
          JSON.stringify({ success: true, synced: 0, message: "No published products to sync" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let syncedCount = 0;
      let errorCount = 0;
      const results: any[] = [];

      for (const sp of supplierProducts) {
        try {
          // Calculate new price based on margin
          const basePrice = sp.price || 0;
          const margin = sp.margin || 30;
          const newPrice = sp.target_price || basePrice * (1 + margin / 100);

          // Update the linked product
          if (sp.published_product_id) {
            const { error: updateError } = await supabase
              .from("products")
              .update({
                price: newPrice,
                original_price: basePrice,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sp.published_product_id)
              .eq("user_id", user.id);

            if (updateError) {
              console.error(`[sync-supplier-prices] Error updating product ${sp.published_product_id}:`, updateError);
              errorCount++;
              results.push({ id: sp.id, status: "error", error: updateError.message });
            } else {
              syncedCount++;
              results.push({ 
                id: sp.id, 
                status: "synced", 
                oldPrice: basePrice, 
                newPrice,
                productId: sp.published_product_id 
              });
            }
          }
        } catch (err: any) {
          console.error(`[sync-supplier-prices] Error processing product ${sp.id}:`, err);
          errorCount++;
          results.push({ id: sp.id, status: "error", error: err.message });
        }
      }

      console.log(`[sync-supplier-prices] Synced: ${syncedCount}, Errors: ${errorCount}`);

      return new Response(
        JSON.stringify({
          success: true,
          synced: syncedCount,
          errors: errorCount,
          total: supplierProducts.length,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sync_selected" && productIds?.length > 0) {
      const { data: supplierProducts, error: fetchError } = await supabase
        .from("supplier_products")
        .select("*")
        .eq("user_id", user.id)
        .in("id", productIds);

      if (fetchError) throw fetchError;

      let syncedCount = 0;
      const results: any[] = [];

      for (const sp of supplierProducts || []) {
        if (!sp.published_product_id) continue;

        const basePrice = sp.price || 0;
        const margin = sp.margin || 30;
        const newPrice = sp.target_price || basePrice * (1 + margin / 100);

        const { error: updateError } = await supabase
          .from("products")
          .update({
            price: newPrice,
            original_price: basePrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sp.published_product_id)
          .eq("user_id", user.id);

        if (!updateError) {
          syncedCount++;
          results.push({ id: sp.id, status: "synced", newPrice });
        } else {
          results.push({ id: sp.id, status: "error", error: updateError.message });
        }
      }

      return new Response(
        JSON.stringify({ success: true, synced: syncedCount, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check_price_changes") {
      // Check if supplier prices have changed (would need re-scraping in real scenario)
      const { data: supplierProducts, error: fetchError } = await supabase
        .from("supplier_products")
        .select("id, title, price, margin, target_price, published_product_id")
        .eq("user_id", user.id)
        .eq("is_published", true);

      if (fetchError) throw fetchError;

      const priceChanges: any[] = [];
      
      for (const sp of supplierProducts || []) {
        if (!sp.published_product_id) continue;

        // Get current product price
        const { data: product } = await supabase
          .from("products")
          .select("price")
          .eq("id", sp.published_product_id)
          .single();

        if (product) {
          const expectedPrice = sp.target_price || (sp.price || 0) * (1 + (sp.margin || 30) / 100);
          const currentPrice = product.price || 0;
          
          if (Math.abs(currentPrice - expectedPrice) > 0.01) {
            priceChanges.push({
              id: sp.id,
              title: sp.title,
              currentPrice,
              expectedPrice,
              difference: expectedPrice - currentPrice,
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, priceChanges, hasChanges: priceChanges.length > 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sync-supplier-prices] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
