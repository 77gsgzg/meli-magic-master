import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
};

type ScrapeOptions = {
  formats?: (
    | 'markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot' | 'branding' | 'summary'
    | { type: 'json'; schema?: object; prompt?: string }
  )[];
  onlyMainContent?: boolean;
  waitFor?: number;
  location?: { country?: string; languages?: string[] };
};

export const firecrawlApi = {
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  /**
   * Scrape a supplier page with JS rendering, returning markdown + screenshot + images
   */
  async scrapeSupplier(url: string): Promise<FirecrawlResponse> {
    return this.scrape(url, {
      formats: ['markdown', 'html', 'screenshot', 'links'],
      onlyMainContent: true,
      waitFor: 3000,
      location: { country: 'BR', languages: ['pt-BR'] },
    });
  },
};
