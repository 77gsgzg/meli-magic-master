export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      batch_import_logs: {
        Row: {
          batch_id: string
          can_resume: boolean | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_count: number
          id: string
          is_paused: boolean | null
          items: Json | null
          processed_urls: string[] | null
          remaining_urls: string[] | null
          scheduled_import_id: string | null
          started_at: string
          status: string
          success_count: number
          total_urls: number
          user_id: string
        }
        Insert: {
          batch_id: string
          can_resume?: boolean | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number
          id?: string
          is_paused?: boolean | null
          items?: Json | null
          processed_urls?: string[] | null
          remaining_urls?: string[] | null
          scheduled_import_id?: string | null
          started_at?: string
          status?: string
          success_count?: number
          total_urls?: number
          user_id: string
        }
        Update: {
          batch_id?: string
          can_resume?: boolean | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number
          id?: string
          is_paused?: boolean | null
          items?: Json | null
          processed_urls?: string[] | null
          remaining_urls?: string[] | null
          scheduled_import_id?: string | null
          started_at?: string
          status?: string
          success_count?: number
          total_urls?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_import_logs_scheduled_import_id_fkey"
            columns: ["scheduled_import_id"]
            isOneToOne: false
            referencedRelation: "scheduled_batch_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_history: {
        Row: {
          campaign_type: string
          converted_count: number
          created_at: string
          details: Json | null
          id: string
          recipients_count: number
          status: string
          user_id: string
        }
        Insert: {
          campaign_type: string
          converted_count?: number
          created_at?: string
          details?: Json | null
          id?: string
          recipients_count?: number
          status?: string
          user_id: string
        }
        Update: {
          campaign_type?: string
          converted_count?: number
          created_at?: string
          details?: Json | null
          id?: string
          recipients_count?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      cron_job_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_name: string
          result: Json | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_name: string
          result?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_name?: string
          result?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      discovered_suppliers: {
        Row: {
          address: string | null
          alert_new_products: boolean | null
          business_type: string | null
          catalog_url: string | null
          city: string | null
          country: string | null
          created_at: string
          distance_km: number | null
          economic_profile: string | null
          id: string
          is_added_to_suppliers: boolean | null
          is_favorite: boolean | null
          last_product_check_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          place_id: string | null
          product_count: number | null
          raw_data: Json | null
          source: string
          state: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          alert_new_products?: boolean | null
          business_type?: string | null
          catalog_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          distance_km?: number | null
          economic_profile?: string | null
          id?: string
          is_added_to_suppliers?: boolean | null
          is_favorite?: boolean | null
          last_product_check_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          place_id?: string | null
          product_count?: number | null
          raw_data?: Json | null
          source?: string
          state?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          alert_new_products?: boolean | null
          business_type?: string | null
          catalog_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          distance_km?: number | null
          economic_profile?: string | null
          id?: string
          is_added_to_suppliers?: boolean | null
          is_favorite?: boolean | null
          last_product_check_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          place_id?: string | null
          product_count?: number | null
          raw_data?: Json | null
          source?: string
          state?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      goal_alerts: {
        Row: {
          acknowledged: boolean | null
          alert_type: string
          created_at: string
          current_value: number
          goal_id: string
          id: string
          message: string | null
          target_value: number
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          alert_type: string
          created_at?: string
          current_value: number
          goal_id: string
          id?: string
          message?: string | null
          target_value: number
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          alert_type?: string
          created_at?: string
          current_value?: number
          goal_id?: string
          id?: string
          message?: string | null
          target_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_alerts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "user_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_orders: {
        Row: {
          buyer_document_number: string | null
          buyer_document_type: string | null
          buyer_email: string | null
          buyer_first_name: string | null
          buyer_id: string
          buyer_last_name: string | null
          buyer_nickname: string
          buyer_phone: string | null
          cost_price: number | null
          created_at: string
          currency_id: string | null
          date_closed: string | null
          date_created: string
          delivered_at: string | null
          id: string
          item_quantity: number
          item_title: string
          locked_at: string | null
          ml_item_id: string
          ml_order_id: string
          ml_pack_id: string | null
          payment_status: string | null
          product_id: string | null
          raw_order_data: Json | null
          raw_shipping_data: Json | null
          shipped_at: string | null
          shipping_address_city: string | null
          shipping_address_country: string | null
          shipping_address_line: string | null
          shipping_address_state: string | null
          shipping_address_zip_code: string | null
          shipping_id: string | null
          shipping_receiver_name: string | null
          shipping_status: string | null
          status: string
          total_amount: number | null
          tracking_number: string | null
          tracking_url: string | null
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_document_number?: string | null
          buyer_document_type?: string | null
          buyer_email?: string | null
          buyer_first_name?: string | null
          buyer_id: string
          buyer_last_name?: string | null
          buyer_nickname: string
          buyer_phone?: string | null
          cost_price?: number | null
          created_at?: string
          currency_id?: string | null
          date_closed?: string | null
          date_created: string
          delivered_at?: string | null
          id?: string
          item_quantity?: number
          item_title: string
          locked_at?: string | null
          ml_item_id: string
          ml_order_id: string
          ml_pack_id?: string | null
          payment_status?: string | null
          product_id?: string | null
          raw_order_data?: Json | null
          raw_shipping_data?: Json | null
          shipped_at?: string | null
          shipping_address_city?: string | null
          shipping_address_country?: string | null
          shipping_address_line?: string | null
          shipping_address_state?: string | null
          shipping_address_zip_code?: string | null
          shipping_id?: string | null
          shipping_receiver_name?: string | null
          shipping_status?: string | null
          status: string
          total_amount?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          unit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_document_number?: string | null
          buyer_document_type?: string | null
          buyer_email?: string | null
          buyer_first_name?: string | null
          buyer_id?: string
          buyer_last_name?: string | null
          buyer_nickname?: string
          buyer_phone?: string | null
          cost_price?: number | null
          created_at?: string
          currency_id?: string | null
          date_closed?: string | null
          date_created?: string
          delivered_at?: string | null
          id?: string
          item_quantity?: number
          item_title?: string
          locked_at?: string | null
          ml_item_id?: string
          ml_order_id?: string
          ml_pack_id?: string | null
          payment_status?: string | null
          product_id?: string | null
          raw_order_data?: Json | null
          raw_shipping_data?: Json | null
          shipped_at?: string | null
          shipping_address_city?: string | null
          shipping_address_country?: string | null
          shipping_address_line?: string | null
          shipping_address_state?: string | null
          shipping_address_zip_code?: string | null
          shipping_id?: string | null
          shipping_receiver_name?: string | null
          shipping_status?: string | null
          status?: string
          total_amount?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ml_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          ml_user_id: string | null
          nickname: string | null
          refresh_token: string
          seller_id: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          ml_user_id?: string | null
          nickname?: string | null
          refresh_token: string
          seller_id?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          ml_user_id?: string | null
          nickname?: string | null
          refresh_token?: string
          seller_id?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operation_logs: {
        Row: {
          created_at: string
          details: Json | null
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          operation_type: Database["public"]["Enums"]["operation_type"]
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          operation_type: Database["public"]["Enums"]["operation_type"]
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          operation_type?: Database["public"]["Enums"]["operation_type"]
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_alert_settings: {
        Row: {
          created_at: string
          new_order_push_enabled: boolean
          shipping_delay_alert_enabled: boolean
          shipping_delay_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          new_order_push_enabled?: boolean
          shipping_delay_alert_enabled?: boolean
          shipping_delay_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          new_order_push_enabled?: boolean
          shipping_delay_alert_enabled?: boolean
          shipping_delay_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          ai_optimized: boolean | null
          attributes: Json | null
          available_quantity: number | null
          category_id: string | null
          category_name: string | null
          condition: string | null
          created_at: string
          currency: string | null
          description: string | null
          error_message: string | null
          id: string
          images: Json | null
          listing_type: string | null
          ml_item_id: string | null
          ml_permalink: string | null
          original_description: string | null
          original_price: number | null
          original_title: string | null
          price: number | null
          published_at: string | null
          sales: number | null
          source_url: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          title: string
          updated_at: string
          user_id: string
          views: number | null
        }
        Insert: {
          ai_optimized?: boolean | null
          attributes?: Json | null
          available_quantity?: number | null
          category_id?: string | null
          category_name?: string | null
          condition?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          images?: Json | null
          listing_type?: string | null
          ml_item_id?: string | null
          ml_permalink?: string | null
          original_description?: string | null
          original_price?: number | null
          original_title?: string | null
          price?: number | null
          published_at?: string | null
          sales?: number | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"] | null
          title: string
          updated_at?: string
          user_id: string
          views?: number | null
        }
        Update: {
          ai_optimized?: boolean | null
          attributes?: Json | null
          available_quantity?: number | null
          category_id?: string | null
          category_name?: string | null
          condition?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          images?: Json | null
          listing_type?: string | null
          ml_item_id?: string | null
          ml_permalink?: string | null
          original_description?: string | null
          original_price?: number | null
          original_title?: string | null
          price?: number | null
          published_at?: string | null
          sales?: number | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"] | null
          title?: string
          updated_at?: string
          user_id?: string
          views?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      publication_action_mappings: {
        Row: {
          action: string
          created_at: string
          description: string | null
          operation_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          operation_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          operation_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publication_history: {
        Row: {
          action: string
          created_at: string
          error_details: string | null
          id: string
          ml_response: Json | null
          product_id: string
          status: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          error_details?: string | null
          id?: string
          ml_response?: Json | null
          product_id: string
          status: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          error_details?: string | null
          id?: string
          ml_response?: Json | null
          product_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_tracking: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number | null
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number | null
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number | null
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      report_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          report_data: Json | null
          response_status: number | null
          scheduled_report_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          report_data?: Json | null
          response_status?: number | null
          scheduled_report_id: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          report_data?: Json | null
          response_status?: number | null
          scheduled_report_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_logs_scheduled_report_id_fkey"
            columns: ["scheduled_report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_batch_imports: {
        Row: {
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          hour_of_day: number
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          updated_at: string
          urls: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          updated_at?: string
          urls?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          updated_at?: string
          urls?: string[]
          user_id?: string
        }
        Relationships: []
      }
      scheduled_reports: {
        Row: {
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          hour_of_day: number
          id: string
          is_active: boolean
          last_sent_at: string | null
          name: string
          next_run_at: string | null
          report_type: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          name: string
          next_run_at?: string | null
          report_type?: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          name?: string
          next_run_at?: string | null
          report_type?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
          webhook_url?: string
        }
        Relationships: []
      }
      scheduled_tasks: {
        Row: {
          config: Json | null
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          hour_of_day: number
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          task_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          task_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          task_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_alert_settings: {
        Row: {
          created_at: string
          error_threshold: number
          updated_at: string
          user_id: string
          window_minutes: number
        }
        Insert: {
          created_at?: string
          error_threshold?: number
          updated_at?: string
          user_id: string
          window_minutes?: number
        }
        Update: {
          created_at?: string
          error_threshold?: number
          updated_at?: string
          user_id?: string
          window_minutes?: number
        }
        Relationships: []
      }
      supplier_price_history: {
        Row: {
          alert_sent: boolean | null
          created_at: string
          detected_at: string
          id: string
          new_price: number
          old_price: number
          price_change_percent: number
          supplier_product_id: string
          user_id: string
        }
        Insert: {
          alert_sent?: boolean | null
          created_at?: string
          detected_at?: string
          id?: string
          new_price: number
          old_price: number
          price_change_percent: number
          supplier_product_id: string
          user_id: string
        }
        Update: {
          alert_sent?: boolean | null
          created_at?: string
          detected_at?: string
          id?: string
          new_price?: number
          old_price?: number
          price_change_percent?: number
          supplier_product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_history_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          created_at: string
          currency: string | null
          description: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          margin: number | null
          ml_item_id: string | null
          optimized_description: string | null
          optimized_title: string | null
          positioning: string | null
          price: number | null
          product_url: string | null
          published_product_id: string | null
          strategy: string | null
          supplier_name: string
          supplier_url: string | null
          target_price: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          margin?: number | null
          ml_item_id?: string | null
          optimized_description?: string | null
          optimized_title?: string | null
          positioning?: string | null
          price?: number | null
          product_url?: string | null
          published_product_id?: string | null
          strategy?: string | null
          supplier_name: string
          supplier_url?: string | null
          target_price?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          margin?: number | null
          ml_item_id?: string | null
          optimized_description?: string | null
          optimized_title?: string | null
          positioning?: string | null
          price?: number | null
          product_url?: string | null
          published_product_id?: string | null
          strategy?: string | null
          supplier_name?: string
          supplier_url?: string | null
          target_price?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_published_product_id_fkey"
            columns: ["published_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_savings_alerts: {
        Row: {
          channel: string
          created_at: string
          id: string
          message: string | null
          opportunity_id: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          opportunity_id?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          opportunity_id?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_savings_alerts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "supplier_savings_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_savings_opportunities: {
        Row: {
          cheapest_price: number
          cheapest_supplier_name: string
          created_at: string
          detected_at: string
          dismissed_at: string | null
          expensive_price: number
          expensive_supplier_name: string
          group_key: string
          id: string
          metadata: Json | null
          representative_title: string
          seen_at: string | null
          spread_amount: number
          spread_percent: number
          status: string
          user_id: string
        }
        Insert: {
          cheapest_price: number
          cheapest_supplier_name: string
          created_at?: string
          detected_at?: string
          dismissed_at?: string | null
          expensive_price: number
          expensive_supplier_name: string
          group_key: string
          id?: string
          metadata?: Json | null
          representative_title: string
          seen_at?: string | null
          spread_amount: number
          spread_percent: number
          status?: string
          user_id: string
        }
        Update: {
          cheapest_price?: number
          cheapest_supplier_name?: string
          created_at?: string
          detected_at?: string
          dismissed_at?: string | null
          expensive_price?: number
          expensive_supplier_name?: string
          group_key?: string
          id?: string
          metadata?: Json | null
          representative_title?: string
          seen_at?: string | null
          spread_amount?: number
          spread_percent?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_savings_settings: {
        Row: {
          amount_threshold: number
          created_at: string
          enabled: boolean
          lookback_days: number
          max_opportunities_per_run: number
          percent_threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_threshold?: number
          created_at?: string
          enabled?: boolean
          lookback_days?: number
          max_opportunities_per_run?: number
          percent_threshold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_threshold?: number
          created_at?: string
          enabled?: boolean
          lookback_days?: number
          max_opportunities_per_run?: number
          percent_threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          comparison_operator: string
          created_at: string
          id: string
          is_active: boolean | null
          metric_key: string
          metric_name: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comparison_operator?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          metric_key: string
          metric_name: string
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comparison_operator?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          metric_key?: string
          metric_name?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          language: string
          notify_import_error: boolean | null
          notify_import_success: boolean | null
          notify_publish_error: boolean | null
          notify_publish_success: boolean | null
          notify_token_refresh: boolean | null
          notify_webhook_failure: boolean | null
          supplier_alert_email_enabled: boolean | null
          supplier_alert_push_enabled: boolean | null
          supplier_price_alert_enabled: boolean | null
          supplier_price_threshold: number | null
          swipe_haptic_enabled: boolean | null
          swipe_sound_enabled: boolean | null
          theme: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          language?: string
          notify_import_error?: boolean | null
          notify_import_success?: boolean | null
          notify_publish_error?: boolean | null
          notify_publish_success?: boolean | null
          notify_token_refresh?: boolean | null
          notify_webhook_failure?: boolean | null
          supplier_alert_email_enabled?: boolean | null
          supplier_alert_push_enabled?: boolean | null
          supplier_price_alert_enabled?: boolean | null
          supplier_price_threshold?: number | null
          swipe_haptic_enabled?: boolean | null
          swipe_sound_enabled?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          language?: string
          notify_import_error?: boolean | null
          notify_import_success?: boolean | null
          notify_publish_error?: boolean | null
          notify_publish_success?: boolean | null
          notify_token_refresh?: boolean | null
          notify_webhook_failure?: boolean | null
          supplier_alert_email_enabled?: boolean | null
          supplier_alert_push_enabled?: boolean | null
          supplier_price_alert_enabled?: boolean | null
          supplier_price_threshold?: number | null
          swipe_haptic_enabled?: boolean | null
          swipe_sound_enabled?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ml_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          secret: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_order_wallet_debit: {
        Args: { p_order_id: string }
        Returns: Json
      }
      wallet_add_credit: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      operation_type:
        | "import"
        | "publish"
        | "update"
        | "delete"
        | "token_refresh"
        | "ai_optimization"
      product_status: "draft" | "pending" | "published" | "error" | "paused"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      operation_type: [
        "import",
        "publish",
        "update",
        "delete",
        "token_refresh",
        "ai_optimization",
      ],
      product_status: ["draft", "pending", "published", "error", "paused"],
    },
  },
} as const
