import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get parameters from request body or use defaults
    const body = await req.json().catch(() => ({}));
    const daysOld = body.days_old || 30; // Default: 30 days
    const dryRun = body.dry_run ?? false; // Default: actually delete
    
    console.log(`[CLEANUP-STORAGE] Starting cleanup for images older than ${daysOld} days (dry_run: ${dryRun})`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = cutoffDate.toISOString();

    // Get all products to identify which images are still in use
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, images, user_id');

    if (productsError) {
      console.error('[CLEANUP-STORAGE] Error fetching products:', productsError);
      throw productsError;
    }

    // Build set of all image URLs currently in use
    const imagesInUse = new Set<string>();
    for (const product of products || []) {
      const images = product.images as string[] | null;
      if (images && Array.isArray(images)) {
        for (const img of images) {
          if (typeof img === 'string') {
            // Extract the path from full URL
            const match = img.match(/product-images\/(.+)/);
            if (match) {
              imagesInUse.add(match[1]);
            }
          }
        }
      }
    }

    console.log(`[CLEANUP-STORAGE] Found ${imagesInUse.size} images currently in use`);

    // List all files in storage bucket
    const { data: storageFiles, error: listError } = await supabase
      .storage
      .from('product-images')
      .list('', { 
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      console.error('[CLEANUP-STORAGE] Error listing storage files:', listError);
      throw listError;
    }

    // Recursively list files in user folders
    const allFiles: { path: string; created_at: string }[] = [];
    
    for (const folder of storageFiles || []) {
      if (folder.id && folder.name) {
        // List files inside user folder
        const { data: userFiles, error: userError } = await supabase
          .storage
          .from('product-images')
          .list(folder.name, { limit: 500 });

        if (!userError && userFiles) {
          for (const subFolder of userFiles) {
            if (subFolder.name) {
              // List files inside product folder
              const { data: productFiles } = await supabase
                .storage
                .from('product-images')
                .list(`${folder.name}/${subFolder.name}`, { limit: 100 });

              if (productFiles) {
                for (const file of productFiles) {
                  if (file.name && file.created_at) {
                    allFiles.push({
                      path: `${folder.name}/${subFolder.name}/${file.name}`,
                      created_at: file.created_at
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    console.log(`[CLEANUP-STORAGE] Found ${allFiles.length} total files in storage`);

    // Find orphaned files older than cutoff
    const filesToDelete: string[] = [];
    
    for (const file of allFiles) {
      const fileDate = new Date(file.created_at);
      const isOld = fileDate < cutoffDate;
      const isOrphaned = !imagesInUse.has(file.path);
      
      if (isOld && isOrphaned) {
        filesToDelete.push(file.path);
      }
    }

    console.log(`[CLEANUP-STORAGE] Found ${filesToDelete.length} orphaned files to delete`);

    let deletedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    if (!dryRun && filesToDelete.length > 0) {
      // Delete files in batches of 100
      for (let i = 0; i < filesToDelete.length; i += 100) {
        const batch = filesToDelete.slice(i, i + 100);
        
        const { error: deleteError } = await supabase
          .storage
          .from('product-images')
          .remove(batch);

        if (deleteError) {
          console.error(`[CLEANUP-STORAGE] Error deleting batch:`, deleteError);
          failedCount += batch.length;
          errors.push(deleteError.message);
        } else {
          deletedCount += batch.length;
          console.log(`[CLEANUP-STORAGE] Deleted batch of ${batch.length} files`);
        }
      }
    }

    const result = {
      success: true,
      dry_run: dryRun,
      cutoff_date: cutoffTimestamp,
      total_files_scanned: allFiles.length,
      images_in_use: imagesInUse.size,
      files_to_delete: filesToDelete.length,
      deleted_count: deletedCount,
      failed_count: failedCount,
      errors: errors.length > 0 ? errors : undefined,
      sample_files_to_delete: filesToDelete.slice(0, 10),
    };

    console.log(`[CLEANUP-STORAGE] Complete:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CLEANUP-STORAGE] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
