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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string | null
          id: number
          interested_programs: string[] | null
          metadata: Json
          notes: string | null
          parent_name: string | null
          phone: string | null
          request_type: string
          requested_role: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_name: string | null
          status: string
          student_age: number | null
          student_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          interested_programs?: string[] | null
          metadata?: Json
          notes?: string | null
          parent_name?: string | null
          phone?: string | null
          request_type: string
          requested_role: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_name?: string | null
          status?: string
          student_age?: number | null
          student_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          interested_programs?: string[] | null
          metadata?: Json
          notes?: string | null
          parent_name?: string | null
          phone?: string | null
          request_type?: string
          requested_role?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_name?: string | null
          status?: string
          student_age?: number | null
          student_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      admin_calling_availability: {
        Row: {
          day_of_week: string
          display_limit: number
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          day_of_week: string
          display_limit?: number
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          day_of_week?: string
          display_limit?: number
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: []
      }
      admin_dnd_schedule: {
        Row: {
          day_of_week: number
          enabled: boolean
          end_time: string | null
          id: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          day_of_week: number
          enabled?: boolean
          end_time?: string | null
          id?: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          day_of_week?: number
          enabled?: boolean
          end_time?: string | null
          id?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_notification_buffer: {
        Row: {
          created_at: string
          event_text: string
          flushed_at: string | null
          id: string
          lead_id: string
        }
        Insert: {
          created_at?: string
          event_text: string
          flushed_at?: string | null
          id?: string
          lead_id: string
        }
        Update: {
          created_at?: string
          event_text?: string
          flushed_at?: string | null
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_buffer_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notification_settings: {
        Row: {
          buffer_minutes: number
          id: string
          updated_at: string
        }
        Insert: {
          buffer_minutes?: number
          id?: string
          updated_at?: string
        }
        Update: {
          buffer_minutes?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          url_path: string
          user_identifier: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          url_path: string
          user_identifier?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          url_path?: string
          user_identifier?: string | null
        }
        Relationships: []
      }
      badge_awards: {
        Row: {
          awarded_at: string | null
          badge_id: number | null
          id: number
          student_id: string | null
        }
        Insert: {
          awarded_at?: string | null
          badge_id?: number | null
          id?: never
          student_id?: string | null
        }
        Update: {
          awarded_at?: string | null
          badge_id?: number | null
          id?: never
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badge_awards_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_awards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_awards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_awards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_awards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      badge_series: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon_url: string | null
          id: number
          is_active: boolean
          name: string
          order_index: number
          theme_color: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: never
          is_active?: boolean
          name: string
          order_index?: number
          theme_color?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: never
          is_active?: boolean
          name?: string
          order_index?: number
          theme_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          badge_series_id: number | null
          code: string | null
          criteria: Json | null
          description: string | null
          icon_url: string | null
          id: number
          is_series_completion_badge: boolean
          name: string | null
          series_order: number | null
          series_progress_label: string | null
        }
        Insert: {
          badge_series_id?: number | null
          code?: string | null
          criteria?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: never
          is_series_completion_badge?: boolean
          name?: string | null
          series_order?: number | null
          series_progress_label?: string | null
        }
        Update: {
          badge_series_id?: number | null
          code?: string | null
          criteria?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: never
          is_series_completion_badge?: boolean
          name?: string | null
          series_order?: number | null
          series_progress_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badges_badge_series_id_fkey"
            columns: ["badge_series_id"]
            isOneToOne: false
            referencedRelation: "badge_series"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_items: {
        Row: {
          aliases: string[] | null
          category: string | null
          cost: number | null
          cost_breakdown: Json | null
          created_at: string | null
          id: string
          internal_notes: string | null
          is_active: boolean | null
          name: string
          price: number
        }
        Insert: {
          aliases?: string[] | null
          category?: string | null
          cost?: number | null
          cost_breakdown?: Json | null
          created_at?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean | null
          name: string
          price: number
        }
        Update: {
          aliases?: string[] | null
          category?: string | null
          cost?: number | null
          cost_breakdown?: Json | null
          created_at?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      billing_records: {
        Row: {
          amount_paid: number | null
          corporate_client_id: string | null
          created_at: string | null
          doc_type: string | null
          expires_at: string | null
          guardian_id: string | null
          id: string
          invoice_number: number
          line_items: Json
          metadata: Json | null
          paid_at: string | null
          payment_reference: string
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          corporate_client_id?: string | null
          created_at?: string | null
          doc_type?: string | null
          expires_at?: string | null
          guardian_id?: string | null
          id?: string
          invoice_number: number
          line_items: Json
          metadata?: Json | null
          paid_at?: string | null
          payment_reference: string
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          corporate_client_id?: string | null
          created_at?: string | null
          doc_type?: string | null
          expires_at?: string | null
          guardian_id?: string | null
          id?: string
          invoice_number?: number
          line_items?: Json
          metadata?: Json | null
          paid_at?: string | null
          payment_reference?: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_corporate_client_id_fkey"
            columns: ["corporate_client_id"]
            isOneToOne: false
            referencedRelation: "corporate_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      blueprint_answer_versions: {
        Row: {
          blueprint_answer_id: string
          blueprint_id: string
          choice_value: string | null
          id: string
          lesson_id: number
          prompt_key: string
          saved_at: string
          saved_by: string
          text_value: string | null
          version_number: number
        }
        Insert: {
          blueprint_answer_id: string
          blueprint_id: string
          choice_value?: string | null
          id?: string
          lesson_id: number
          prompt_key: string
          saved_at?: string
          saved_by: string
          text_value?: string | null
          version_number: number
        }
        Update: {
          blueprint_answer_id?: string
          blueprint_id?: string
          choice_value?: string | null
          id?: string
          lesson_id?: number
          prompt_key?: string
          saved_at?: string
          saved_by?: string
          text_value?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_answer_versions_blueprint_answer_id_fkey"
            columns: ["blueprint_answer_id"]
            isOneToOne: false
            referencedRelation: "blueprint_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_answer_versions_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "game_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_answer_versions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_answer_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_answer_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_answer_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_answer_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      blueprint_answers: {
        Row: {
          answer_type: string
          blueprint_id: string
          choice_value: string | null
          created_at: string
          id: string
          is_complete: boolean
          last_saved_at: string
          lesson_id: number
          prompt_group: string | null
          prompt_key: string
          prompt_label: string
          text_value: string | null
          updated_at: string
        }
        Insert: {
          answer_type: string
          blueprint_id: string
          choice_value?: string | null
          created_at?: string
          id?: string
          is_complete?: boolean
          last_saved_at?: string
          lesson_id: number
          prompt_group?: string | null
          prompt_key: string
          prompt_label: string
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          answer_type?: string
          blueprint_id?: string
          choice_value?: string | null
          created_at?: string
          id?: string
          is_complete?: boolean
          last_saved_at?: string
          lesson_id?: number
          prompt_group?: string | null
          prompt_key?: string
          prompt_label?: string
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_answers_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "game_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_answers_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_links: {
        Row: {
          created_at: string | null
          credits: number | null
          id: string
          parent_id: string | null
          status: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits?: number | null
          id?: string
          parent_id?: string | null
          status?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits?: number | null
          id?: string
          parent_id?: string | null
          status?: string | null
          teacher_id?: string | null
        }
        Relationships: []
      }
      bootcamp_components: {
        Row: {
          category: string
          description: string
          id: string
          image_url: string | null
          makecode_color: string
          makecode_drawer: string
          name: string
          real_world_use: string
          tutorial_ids: string[] | null
        }
        Insert: {
          category: string
          description: string
          id?: string
          image_url?: string | null
          makecode_color: string
          makecode_drawer: string
          name: string
          real_world_use: string
          tutorial_ids?: string[] | null
        }
        Update: {
          category?: string
          description?: string
          id?: string
          image_url?: string | null
          makecode_color?: string
          makecode_drawer?: string
          name?: string
          real_world_use?: string
          tutorial_ids?: string[] | null
        }
        Relationships: []
      }
      bootcamp_logic_rules: {
        Row: {
          id: string
          label: string
          makecode_color: string
          makecode_drawer: string
          syntax_pattern: string
        }
        Insert: {
          id?: string
          label: string
          makecode_color: string
          makecode_drawer: string
          syntax_pattern: string
        }
        Update: {
          id?: string
          label?: string
          makecode_color?: string
          makecode_drawer?: string
          syntax_pattern?: string
        }
        Relationships: []
      }
      bootcamp_settings: {
        Row: {
          id: number
          lab_unlocked: boolean | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          lab_unlocked?: boolean | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          lab_unlocked?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bot_flows: {
        Row: {
          action_type: string
          active: boolean
          add_tags: string[]
          bot_media_keyword: string | null
          completion_tag: string | null
          created_at: string
          expects_reply: boolean
          featured_program_id: string | null
          id: string
          label: string
          message_body: string | null
          message_buttons: Json
          notify_admin: boolean
          notify_admin_immediate: boolean
          reply_confirmation: string | null
          reply_label: string | null
          set_source: string | null
          skip_human_handoff: boolean
          template_button_payloads: Json
          template_language: string | null
          template_name: string | null
          template_variable_names: Json
          template_variables: Json
          trigger_button_id: string
          updated_at: string
        }
        Insert: {
          action_type: string
          active?: boolean
          add_tags?: string[]
          bot_media_keyword?: string | null
          completion_tag?: string | null
          created_at?: string
          expects_reply?: boolean
          featured_program_id?: string | null
          id?: string
          label: string
          message_body?: string | null
          message_buttons?: Json
          notify_admin?: boolean
          notify_admin_immediate?: boolean
          reply_confirmation?: string | null
          reply_label?: string | null
          set_source?: string | null
          skip_human_handoff?: boolean
          template_button_payloads?: Json
          template_language?: string | null
          template_name?: string | null
          template_variable_names?: Json
          template_variables?: Json
          trigger_button_id: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          active?: boolean
          add_tags?: string[]
          bot_media_keyword?: string | null
          completion_tag?: string | null
          created_at?: string
          expects_reply?: boolean
          featured_program_id?: string | null
          id?: string
          label?: string
          message_body?: string | null
          message_buttons?: Json
          notify_admin?: boolean
          notify_admin_immediate?: boolean
          reply_confirmation?: string | null
          reply_label?: string | null
          set_source?: string | null
          skip_human_handoff?: boolean
          template_button_payloads?: Json
          template_language?: string | null
          template_name?: string | null
          template_variable_names?: Json
          template_variables?: Json
          trigger_button_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_flows_featured_program_id_fkey"
            columns: ["featured_program_id"]
            isOneToOne: false
            referencedRelation: "featured_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_media: {
        Row: {
          active: boolean
          archived: boolean
          buttons: Json
          caption: string
          created_at: string
          file_type: string
          file_url: string
          filename: string
          id: string
          key: string | null
          tag_filter: string | null
          title: string
          trigger_keywords: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived?: boolean
          buttons?: Json
          caption: string
          created_at?: string
          file_type?: string
          file_url: string
          filename: string
          id?: string
          key?: string | null
          tag_filter?: string | null
          title: string
          trigger_keywords?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived?: boolean
          buttons?: Json
          caption?: string
          created_at?: string
          file_type?: string
          file_url?: string
          filename?: string
          id?: string
          key?: string | null
          tag_filter?: string | null
          title?: string
          trigger_keywords?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      bundle_sessions: {
        Row: {
          bundle_id: string
          id: string
          session_id: string
        }
        Insert: {
          bundle_id: string
          id?: string
          session_id: string
        }
        Update: {
          bundle_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_sessions_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      cash_running_balance_settings: {
        Row: {
          id: string
          opening_balance: number
          opening_balance_date: string
          updated_at: string
        }
        Insert: {
          id?: string
          opening_balance?: number
          opening_balance_date?: string
          updated_at?: string
        }
        Update: {
          id?: string
          opening_balance?: number
          opening_balance_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_waterfall_priority_overrides: {
        Row: {
          created_at: string
          id: string
          item_key: string
          month: string
          sort_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          month: string
          sort_index: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          month?: string
          sort_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      catchup_bookings: {
        Row: {
          created_at: string | null
          id: string
          parent_email: string
          session_id: string | null
          status: Database["public"]["Enums"]["booking_status"]
          student_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_email: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          student_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_email?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "catchup_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "catchup_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      catchup_sessions: {
        Row: {
          created_at: string | null
          id: string
          session_date: string
          status: Database["public"]["Enums"]["session_status"]
          teacher_id: string
          teams_link: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_date: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_id: string
          teams_link?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          session_date?: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_id?: string
          teams_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catchup_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catchup_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catchup_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catchup_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      client_portals: {
        Row: {
          access_code: string
          brand_color: string | null
          client_name: string
          created_at: string | null
          id: string
          is_locked: boolean | null
          project_name: string
          submitted_data: Json
          tasks_schema: Json
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          access_code: string
          brand_color?: string | null
          client_name: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          project_name: string
          submitted_data?: Json
          tasks_schema?: Json
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          access_code?: string
          brand_color?: string | null
          client_name?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          project_name?: string
          submitted_data?: Json
          tasks_schema?: Json
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          coach_id: string
          created_at: string
          guardian_id: string
          id: string
          is_read: boolean | null
          message: string
          sender_id: string
          student_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          guardian_id: string
          id?: string
          is_read?: boolean | null
          message: string
          sender_id: string
          student_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          guardian_id?: string
          id?: string
          is_read?: boolean | null
          message?: string
          sender_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "coach_messages_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "coach_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "coach_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          id: string
          recipient_email: string
          recipient_name: string
          sent_at: string | null
          status: string | null
          subject: string
        }
        Insert: {
          id?: string
          recipient_email: string
          recipient_name: string
          sent_at?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          id?: string
          recipient_email?: string
          recipient_name?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: []
      }
      consent_forms: {
        Row: {
          child_id: string
          confirmed_unchanged: boolean
          consent_wording_version: string
          guardian_id: string
          id: string
          ip_address: string | null
          is_current: boolean
          payload: Json
          submitted_at: string
          submitted_via: string
        }
        Insert: {
          child_id: string
          confirmed_unchanged?: boolean
          consent_wording_version?: string
          guardian_id: string
          id?: string
          ip_address?: string | null
          is_current?: boolean
          payload: Json
          submitted_at?: string
          submitted_via?: string
        }
        Update: {
          child_id?: string
          confirmed_unchanged?: boolean
          consent_wording_version?: string
          guardian_id?: string
          id?: string
          ip_address?: string | null
          is_current?: boolean
          payload?: Json
          submitted_at?: string
          submitted_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_forms_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_forms_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_token_access_log: {
        Row: {
          accessed_at: string
          attempted_token: string | null
          id: string
          ip_address: string | null
          success: boolean
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          attempted_token?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          attempted_token?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_token_access_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "guardian_consent_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      constraint_actions: {
        Row: {
          actual: number
          constraint_state: string
          created_at: string
          id: string
          label: string
          period_label: string | null
          sort_order: number
          target: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          actual?: number
          constraint_state: string
          created_at?: string
          id?: string
          label: string
          period_label?: string | null
          sort_order?: number
          target?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          actual?: number
          constraint_state?: string
          created_at?: string
          id?: string
          label?: string
          period_label?: string | null
          sort_order?: number
          target?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      core_agreements: {
        Row: {
          applicable_to: string[]
          created_at: string | null
          description: string
          id: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          applicable_to?: string[]
          created_at?: string | null
          description: string
          id: string
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          applicable_to?: string[]
          created_at?: string | null
          description?: string
          id?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      corporate_clients: {
        Row: {
          billing_address: string | null
          company_name: string
          contact_person: string
          created_at: string | null
          email: string | null
          id: string
          metadata: Json | null
          phone: string | null
          vat_number: string | null
        }
        Insert: {
          billing_address?: string | null
          company_name: string
          contact_person: string
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          phone?: string | null
          vat_number?: string | null
        }
        Update: {
          billing_address?: string | null
          company_name?: string
          contact_person?: string
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          phone?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      cost_centres: {
        Row: {
          created_at: string
          id: string
          is_profit_centre: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_profit_centre?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_profit_centre?: boolean
          name?: string
        }
        Relationships: []
      }
      course_components: {
        Row: {
          component_id: string
          course_id: string
          is_required: boolean | null
          unlock_tier: string | null
        }
        Insert: {
          component_id: string
          course_id: string
          is_required?: boolean | null
          unlock_tier?: string | null
        }
        Update: {
          component_id?: string
          course_id?: string
          is_required?: boolean | null
          unlock_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "platform_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_components_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_logic_rules: {
        Row: {
          course_id: string
          rule_id: string
          unlock_tier: string | null
        }
        Insert: {
          course_id: string
          rule_id: string
          unlock_tier?: string | null
        }
        Update: {
          course_id?: string
          rule_id?: string
          unlock_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_logic_rules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_logic_rules_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "platform_logic_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          access_level: string | null
          description: string | null
          id: string
          is_lab_unlocked: boolean | null
          is_published: boolean | null
          launch_date: string | null
          order_index: number
          template_type: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
          visibility: string | null
        }
        Insert: {
          access_level?: string | null
          description?: string | null
          id?: string
          is_lab_unlocked?: boolean | null
          is_published?: boolean | null
          launch_date?: string | null
          order_index: number
          template_type?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          visibility?: string | null
        }
        Update: {
          access_level?: string | null
          description?: string | null
          id?: string
          is_lab_unlocked?: boolean | null
          is_published?: boolean | null
          launch_date?: string | null
          order_index?: number
          template_type?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string | null
          guardian_id: string
          id: string
          reason: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string | null
          guardian_id: string
          id?: string
          reason: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string | null
          guardian_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_ledger_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      ctb_progress: {
        Row: {
          completed_at: string
          step_id: string
          student_id: string
        }
        Insert: {
          completed_at?: string
          step_id: string
          student_id: string
        }
        Update: {
          completed_at?: string
          step_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctb_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "ctb_students"
            referencedColumns: ["id"]
          },
        ]
      }
      ctb_students: {
        Row: {
          created_at: string
          first_name: string
          help_module: string | null
          help_requested_at: string | null
          help_track: string | null
          id: string
          last_initial: string
          needs_help: boolean
          workshop_id: string
        }
        Insert: {
          created_at?: string
          first_name: string
          help_module?: string | null
          help_requested_at?: string | null
          help_track?: string | null
          id?: string
          last_initial: string
          needs_help?: boolean
          workshop_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          help_module?: string | null
          help_requested_at?: string | null
          help_track?: string | null
          id?: string
          last_initial?: string
          needs_help?: boolean
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctb_students_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "ctb_workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      ctb_workshops: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: []
      }
      dashboard_focus_item_logs: {
        Row: {
          id: string
          item_id: string
          logged_at: string
          logged_by: string
          note: string | null
        }
        Insert: {
          id?: string
          item_id: string
          logged_at?: string
          logged_by?: string
          note?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          logged_at?: string
          logged_by?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_focus_item_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "dashboard_focus_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_focus_item_results: {
        Row: {
          item_id: string
          result_id: string
        }
        Insert: {
          item_id: string
          result_id: string
        }
        Update: {
          item_id?: string
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_focus_item_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "dashboard_focus_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_focus_item_results_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "dashboard_focus_results"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_focus_items: {
        Row: {
          active_from: string
          active_until: string
          cadence: string
          created_at: string
          id: string
          label: string
          metric_key: string
          sort_order: number
          status: string
          target_max: number | null
          target_value: number
          updated_at: string
        }
        Insert: {
          active_from?: string
          active_until: string
          cadence: string
          created_at?: string
          id?: string
          label: string
          metric_key: string
          sort_order?: number
          status?: string
          target_max?: number | null
          target_value: number
          updated_at?: string
        }
        Update: {
          active_from?: string
          active_until?: string
          cadence?: string
          created_at?: string
          id?: string
          label?: string
          metric_key?: string
          sort_order?: number
          status?: string
          target_max?: number | null
          target_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_focus_results: {
        Row: {
          achieved_at: string | null
          cadence: string
          constraint_key: string | null
          created_at: string
          cycle_days: number
          id: string
          metric_key: string | null
          started_at: string
          status: string
          target_value: number | null
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          cadence?: string
          constraint_key?: string | null
          created_at?: string
          cycle_days?: number
          id?: string
          metric_key?: string | null
          started_at?: string
          status?: string
          target_value?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          cadence?: string
          constraint_key?: string | null
          created_at?: string
          cycle_days?: number
          id?: string
          metric_key?: string | null
          started_at?: string
          status?: string
          target_value?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_settings: {
        Row: {
          active_pipeline_threshold: number
          founder_attention_threshold_per_day: number
          id: string
          last_security_audit_at: string | null
          last_security_audit_note: string | null
          lead_volume_threshold_per_day: number
          mrr_hire_cost_multiplier_months: number
          updated_at: string
          young_adult_template_language: string | null
          young_adult_template_name: string | null
          young_adult_template_variable_names: string[]
        }
        Insert: {
          active_pipeline_threshold?: number
          founder_attention_threshold_per_day?: number
          id?: string
          last_security_audit_at?: string | null
          last_security_audit_note?: string | null
          lead_volume_threshold_per_day?: number
          mrr_hire_cost_multiplier_months?: number
          updated_at?: string
          young_adult_template_language?: string | null
          young_adult_template_name?: string | null
          young_adult_template_variable_names?: string[]
        }
        Update: {
          active_pipeline_threshold?: number
          founder_attention_threshold_per_day?: number
          id?: string
          last_security_audit_at?: string | null
          last_security_audit_note?: string | null
          lead_volume_threshold_per_day?: number
          mrr_hire_cost_multiplier_months?: number
          updated_at?: string
          young_adult_template_language?: string | null
          young_adult_template_name?: string | null
          young_adult_template_variable_names?: string[]
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          created_at: string | null
          html_body: string
          id: string
          send_after: string
          status: string | null
          subject: string
          to_email: string
        }
        Insert: {
          created_at?: string | null
          html_body: string
          id?: string
          send_after: string
          status?: string | null
          subject: string
          to_email: string
        }
        Update: {
          created_at?: string | null
          html_body?: string
          id?: string
          send_after?: string
          status?: string | null
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_content: string
          created_at: string
          id: string
          name: string
          slug: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          body_content: string
          created_at?: string
          id?: string
          name: string
          slug: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          body_content?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          active_task: Json | null
          average_quiz_score: number | null
          completed_at: string | null
          completion_percentage: number | null
          course_id: string | null
          course_xp_earned: number | null
          current_mission_id: string | null
          enrolled_at: string | null
          id: number
          sandbox_state: Json | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          active_task?: Json | null
          average_quiz_score?: number | null
          completed_at?: string | null
          completion_percentage?: number | null
          course_id?: string | null
          course_xp_earned?: number | null
          current_mission_id?: string | null
          enrolled_at?: string | null
          id?: never
          sandbox_state?: Json | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          active_task?: Json | null
          average_quiz_score?: number | null
          completed_at?: string | null
          completion_percentage?: number | null
          course_id?: string | null
          course_xp_earned?: number | null
          current_mission_id?: string | null
          enrolled_at?: string | null
          id?: never
          sandbox_state?: Json | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_current_mission_id_fkey"
            columns: ["current_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      enrolments: {
        Row: {
          attended: boolean | null
          attended_at: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string | null
          pass_credit_id: string | null
          session_id: string
          status: string
          student_id: string
        }
        Insert: {
          attended?: boolean | null
          attended_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          pass_credit_id?: string | null
          session_id: string
          status?: string
          student_id: string
        }
        Update: {
          attended?: boolean | null
          attended_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          pass_credit_id?: string | null
          session_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_pass_credit_id_fkey"
            columns: ["pass_credit_id"]
            isOneToOne: false
            referencedRelation: "pass_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          paid: boolean | null
          profile_id: string | null
          prospect_email: string | null
          prospect_name: string | null
          prospect_phone: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          paid?: boolean | null
          profile_id?: string | null
          prospect_email?: string | null
          prospect_name?: string | null
          prospect_phone?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          paid?: boolean | null
          profile_id?: string | null
          prospect_email?: string | null
          prospect_name?: string | null
          prospect_phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      event_media: {
        Row: {
          bucket_path: string
          captured_at: string | null
          created_at: string | null
          event_name: string
          id: string
          is_processed: boolean | null
          taken_at: string | null
        }
        Insert: {
          bucket_path: string
          captured_at?: string | null
          created_at?: string | null
          event_name: string
          id?: string
          is_processed?: boolean | null
          taken_at?: string | null
        }
        Update: {
          bucket_path?: string
          captured_at?: string | null
          created_at?: string | null
          event_name?: string
          id?: string
          is_processed?: boolean | null
          taken_at?: string | null
        }
        Relationships: []
      }
      event_packages: {
        Row: {
          computed_cost: number | null
          created_at: string
          display_description: string | null
          display_name: string | null
          display_order: number
          expected_attendee_count_override: number | null
          featured_program_id: string | null
          final_fee: number | null
          id: string
          margin_override_reason: string | null
          override_reason_category: string | null
          package_id: string
          published: boolean
          recommended_fee: number | null
          target_margin_pct: number | null
          tier_role: string | null
          unit_multiplier: number
          updated_at: string
        }
        Insert: {
          computed_cost?: number | null
          created_at?: string
          display_description?: string | null
          display_name?: string | null
          display_order?: number
          expected_attendee_count_override?: number | null
          featured_program_id?: string | null
          final_fee?: number | null
          id?: string
          margin_override_reason?: string | null
          override_reason_category?: string | null
          package_id: string
          published?: boolean
          recommended_fee?: number | null
          target_margin_pct?: number | null
          tier_role?: string | null
          unit_multiplier?: number
          updated_at?: string
        }
        Update: {
          computed_cost?: number | null
          created_at?: string
          display_description?: string | null
          display_name?: string | null
          display_order?: number
          expected_attendee_count_override?: number | null
          featured_program_id?: string | null
          final_fee?: number | null
          id?: string
          margin_override_reason?: string | null
          override_reason_category?: string | null
          package_id?: string
          published?: boolean
          recommended_fee?: number | null
          target_margin_pct?: number | null
          tier_role?: string | null
          unit_multiplier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_packages_featured_program_id_fkey"
            columns: ["featured_program_id"]
            isOneToOne: false
            referencedRelation: "featured_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          created_at: string
          date_label: string | null
          date_option_id: string | null
          id: string
          lead_id: string
          location: string | null
          number_of_children: number
          preferred_channel: string | null
          program_id: string | null
          program_title: string
          series: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          date_label?: string | null
          date_option_id?: string | null
          id?: string
          lead_id: string
          location?: string | null
          number_of_children: number
          preferred_channel?: string | null
          program_id?: string | null
          program_title: string
          series?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          date_label?: string | null
          date_option_id?: string | null
          id?: string
          lead_id?: string
          location?: string | null
          number_of_children?: number
          preferred_channel?: string | null
          program_id?: string | null
          program_title?: string
          series?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "featured_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          end_time: string | null
          event_date: string | null
          id: string
          is_free: boolean | null
          location_details: string | null
          location_type: string | null
          price: number | null
          start_time: string | null
          status: string | null
          title: string
          type: string | null
          welcome_config: Json | null
        }
        Insert: {
          capacity?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          is_free?: boolean | null
          location_details?: string | null
          location_type?: string | null
          price?: number | null
          start_time?: string | null
          status?: string | null
          title: string
          type?: string | null
          welcome_config?: Json | null
        }
        Update: {
          capacity?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          is_free?: boolean | null
          location_details?: string | null
          location_type?: string | null
          price?: number | null
          start_time?: string | null
          status?: string | null
          title?: string
          type?: string | null
          welcome_config?: Json | null
        }
        Relationships: []
      }
      expense_program_splits: {
        Row: {
          expense_id: string
          id: string
          pct: number
          program_id: string
        }
        Insert: {
          expense_id: string
          id?: string
          pct: number
          program_id: string
        }
        Update: {
          expense_id?: string
          id?: string
          pct?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_program_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_program_splits_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          allocation_type: string
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          notes: string | null
          program_id: string | null
          requires_approval: boolean
          vendor: string | null
        }
        Insert: {
          allocation_type: string
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          expense_date: string
          id?: string
          notes?: string | null
          program_id?: string | null
          requires_approval?: boolean
          vendor?: string | null
        }
        Update: {
          allocation_type?: string
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          program_id?: string | null
          requires_approval?: boolean
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_programs: {
        Row: {
          accent: string
          allow_multi_date: boolean
          counts_general_attendees: boolean
          created_at: string
          date_options: Json
          default_session_id: string | null
          details: string | null
          draft: boolean
          duration: string | null
          expected_attendee_count: number | null
          form_label: string | null
          id: string
          image_url: string
          is_video: boolean
          label: string
          live_from: string
          live_until: string
          location: string | null
          programs_id: string | null
          quote_email_template_id: string | null
          quote_email_template_needs_review: boolean
          series: string | null
          show_on_events_page: boolean
          show_on_homepage: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          accent?: string
          allow_multi_date?: boolean
          counts_general_attendees?: boolean
          created_at?: string
          date_options?: Json
          default_session_id?: string | null
          details?: string | null
          draft?: boolean
          duration?: string | null
          expected_attendee_count?: number | null
          form_label?: string | null
          id?: string
          image_url: string
          is_video?: boolean
          label?: string
          live_from?: string
          live_until: string
          location?: string | null
          programs_id?: string | null
          quote_email_template_id?: string | null
          quote_email_template_needs_review?: boolean
          series?: string | null
          show_on_events_page?: boolean
          show_on_homepage?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          accent?: string
          allow_multi_date?: boolean
          counts_general_attendees?: boolean
          created_at?: string
          date_options?: Json
          default_session_id?: string | null
          details?: string | null
          draft?: boolean
          duration?: string | null
          expected_attendee_count?: number | null
          form_label?: string | null
          id?: string
          image_url?: string
          is_video?: boolean
          label?: string
          live_from?: string
          live_until?: string
          location?: string | null
          programs_id?: string | null
          quote_email_template_id?: string | null
          quote_email_template_needs_review?: boolean
          series?: string | null
          show_on_events_page?: boolean
          show_on_homepage?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_programs_default_session_id_fkey"
            columns: ["default_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_programs_programs_id_fkey"
            columns: ["programs_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_programs_quote_email_template_id_fkey"
            columns: ["quote_email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_merge_candidates: {
        Row: {
          candidate_lead_ids: string[]
          confidence: string
          created_at: string
          id: string
          match_basis: string | null
          match_type: string
          resolved_lead_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string
          source_payload: Json
          source_table: string
          status: string
        }
        Insert: {
          candidate_lead_ids?: string[]
          confidence: string
          created_at?: string
          id?: string
          match_basis?: string | null
          match_type: string
          resolved_lead_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id: string
          source_payload: Json
          source_table: string
          status?: string
        }
        Update: {
          candidate_lead_ids?: string[]
          confidence?: string
          created_at?: string
          id?: string
          match_basis?: string | null
          match_type?: string
          resolved_lead_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string
          source_payload?: Json
          source_table?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_merge_candidates_resolved_lead_id_fkey"
            columns: ["resolved_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      game_blueprints: {
        Row: {
          course_id: string
          created_at: string
          current_lesson_id: number | null
          id: string
          status: string
          student_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          current_lesson_id?: number | null
          id?: string
          status?: string
          student_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          current_lesson_id?: number | null
          id?: string
          status?: string
          student_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_blueprints_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_blueprints_current_lesson_id_fkey"
            columns: ["current_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_blueprints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_blueprints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_blueprints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_blueprints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      growth_interactions: {
        Row: {
          actual_date: string | null
          admin_id: string
          contact_method: string
          content_draft: string | null
          created_at: string | null
          id: string
          interaction_type: string | null
          lead_id: string
          lead_stage: string | null
          next_followup_date: string | null
          notes: string | null
          outcome: string | null
          planned_date: string
          status: string | null
        }
        Insert: {
          actual_date?: string | null
          admin_id: string
          contact_method: string
          content_draft?: string | null
          created_at?: string | null
          id?: string
          interaction_type?: string | null
          lead_id: string
          lead_stage?: string | null
          next_followup_date?: string | null
          notes?: string | null
          outcome?: string | null
          planned_date: string
          status?: string | null
        }
        Update: {
          actual_date?: string | null
          admin_id?: string
          contact_method?: string
          content_draft?: string | null
          created_at?: string | null
          id?: string
          interaction_type?: string | null
          lead_id?: string
          lead_stage?: string | null
          next_followup_date?: string | null
          notes?: string | null
          outcome?: string | null
          planned_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_interactions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_interactions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_interactions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_interactions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "growth_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "growth_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_lead_stage_history: {
        Row: {
          entered_at: string | null
          exited_at: string | null
          id: string
          lead_id: string
          stage_name: string
        }
        Insert: {
          entered_at?: string | null
          exited_at?: string | null
          id?: string
          lead_id: string
          stage_name: string
        }
        Update: {
          entered_at?: string | null
          exited_at?: string | null
          id?: string
          lead_id?: string
          stage_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "growth_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_leads: {
        Row: {
          admin_id: string
          contact_number: string | null
          converted_profile_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          kids_ages: string | null
          kids_count: number | null
          lead_source: string | null
          location: string | null
          notes: string | null
          stage: string | null
          updated_at: string | null
          warmth: string | null
          workflow_state: Json | null
          workflow_type: string | null
        }
        Insert: {
          admin_id: string
          contact_number?: string | null
          converted_profile_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          kids_ages?: string | null
          kids_count?: number | null
          lead_source?: string | null
          location?: string | null
          notes?: string | null
          stage?: string | null
          updated_at?: string | null
          warmth?: string | null
          workflow_state?: Json | null
          workflow_type?: string | null
        }
        Update: {
          admin_id?: string
          contact_number?: string | null
          converted_profile_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          kids_ages?: string | null
          kids_count?: number | null
          lead_source?: string | null
          location?: string | null
          notes?: string | null
          stage?: string | null
          updated_at?: string | null
          warmth?: string | null
          workflow_state?: Json | null
          workflow_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_leads_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_leads_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_leads_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_leads_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "growth_leads_converted_profile_id_fkey"
            columns: ["converted_profile_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_leads_converted_profile_id_fkey"
            columns: ["converted_profile_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_leads_converted_profile_id_fkey"
            columns: ["converted_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_leads_converted_profile_id_fkey"
            columns: ["converted_profile_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      growth_targets: {
        Row: {
          actual_count: number | null
          admin_id: string
          created_at: string | null
          id: string
          target_count: number | null
          target_date: string
          updated_at: string | null
        }
        Insert: {
          actual_count?: number | null
          admin_id: string
          created_at?: string | null
          id?: string
          target_count?: number | null
          target_date: string
          updated_at?: string | null
        }
        Update: {
          actual_count?: number | null
          admin_id?: string
          created_at?: string | null
          id?: string
          target_count?: number | null
          target_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_targets_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_targets_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_targets_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_targets_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      growth_triage_answers: {
        Row: {
          answer_text: string
          created_at: string | null
          id: string
          lead_id: string
          question_id: string
          updated_at: string | null
        }
        Insert: {
          answer_text: string
          created_at?: string | null
          id?: string
          lead_id: string
          question_id: string
          updated_at?: string | null
        }
        Update: {
          answer_text?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          question_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_triage_answers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "growth_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_triage_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "growth_triage_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_triage_questions: {
        Row: {
          admin_id: string
          created_at: string | null
          id: string
          priority_order: number | null
          question_text: string
          status: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          id?: string
          priority_order?: number | null
          question_text: string
          status?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          id?: string
          priority_order?: number | null
          question_text?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_triage_questions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_triage_questions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_triage_questions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_triage_questions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      guardian_consent_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          guardian_lead_id: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          guardian_lead_id: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          guardian_lead_id?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_consent_tokens_guardian_lead_id_fkey"
            columns: ["guardian_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          active: boolean
          category: string
          cost_type: string
          created_at: string
          id: string
          name: string
          notes: string | null
          unit_cost: number
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          cost_type: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          unit_cost?: number
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          cost_type?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          unit_cost?: number
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          lead_id: string
          method: string
          payfast_payment_id: string | null
          payfast_raw_payload: Json | null
          received_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          lead_id: string
          method?: string
          payfast_payment_id?: string | null
          payfast_raw_payload?: Json | null
          received_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          lead_id?: string
          method?: string
          payfast_payment_id?: string | null
          payfast_raw_payload?: Json | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          created_by: string | null
          delivery_gated_on_payment: boolean
          delivery_month: string | null
          due_at: string
          hold_expires_at: string | null
          id: string
          invoice_number: number
          lead_id: string
          migrated_from_billing_record_id: string | null
          paid_at: string | null
          payment_reference: string | null
          quote_id: string
          sequence_number: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          delivery_gated_on_payment?: boolean
          delivery_month?: string | null
          due_at: string
          hold_expires_at?: string | null
          id?: string
          invoice_number?: number
          lead_id: string
          migrated_from_billing_record_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          quote_id: string
          sequence_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          delivery_gated_on_payment?: boolean
          delivery_month?: string | null
          due_at?: string
          hold_expires_at?: string | null
          id?: string
          invoice_number?: number
          lead_id?: string
          migrated_from_billing_record_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          quote_id?: string
          sequence_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      irene_class_aliases: {
        Row: {
          canonical_class_name: string
          canonical_grade: string
          raw_class_name: string
          raw_grade: string
        }
        Insert: {
          canonical_class_name: string
          canonical_grade: string
          raw_class_name: string
          raw_grade: string
        }
        Update: {
          canonical_class_name?: string
          canonical_grade?: string
          raw_class_name?: string
          raw_grade?: string
        }
        Relationships: []
      }
      irene_fitness_children: {
        Row: {
          class: string | null
          created_at: string
          family_id: string
          grade: string
          id: string
        }
        Insert: {
          class?: string | null
          created_at?: string
          family_id: string
          grade: string
          id?: string
        }
        Update: {
          class?: string | null
          created_at?: string
          family_id?: string
          grade?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "irene_fitness_children_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "irene_fitness_families"
            referencedColumns: ["id"]
          },
        ]
      }
      irene_fitness_families: {
        Row: {
          consent_marketing: boolean
          consent_marketing_timestamp: string | null
          consent_public_display: boolean
          consent_public_display_timestamp: string | null
          consent_source: string | null
          consent_updates: boolean
          consent_updates_timestamp: string | null
          consent_wording_version: string | null
          created_at: string
          email: string | null
          id: string
          ip_address: unknown
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          consent_marketing?: boolean
          consent_marketing_timestamp?: string | null
          consent_public_display?: boolean
          consent_public_display_timestamp?: string | null
          consent_source?: string | null
          consent_updates?: boolean
          consent_updates_timestamp?: string | null
          consent_wording_version?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: unknown
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          consent_marketing?: boolean
          consent_marketing_timestamp?: string | null
          consent_public_display?: boolean
          consent_public_display_timestamp?: string | null
          consent_source?: string | null
          consent_updates?: boolean
          consent_updates_timestamp?: string | null
          consent_wording_version?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: unknown
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      irene_fitness_response_story: {
        Row: {
          boss_level_challenge_2026: string | null
          club_member: boolean | null
          club_names: string | null
          created_at: string
          funniest_fail: string | null
          motivation: string | null
          proudest_moment: string | null
          response_id: string
          shoe_count: number | null
          toughest_challenge: string | null
          updated_at: string
          weirdest_fuel: string | null
        }
        Insert: {
          boss_level_challenge_2026?: string | null
          club_member?: boolean | null
          club_names?: string | null
          created_at?: string
          funniest_fail?: string | null
          motivation?: string | null
          proudest_moment?: string | null
          response_id: string
          shoe_count?: number | null
          toughest_challenge?: string | null
          updated_at?: string
          weirdest_fuel?: string | null
        }
        Update: {
          boss_level_challenge_2026?: string | null
          club_member?: boolean | null
          club_names?: string | null
          created_at?: string
          funniest_fail?: string | null
          motivation?: string | null
          proudest_moment?: string | null
          response_id?: string
          shoe_count?: number | null
          toughest_challenge?: string | null
          updated_at?: string
          weirdest_fuel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irene_fitness_response_story_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: true
            referencedRelation: "irene_fitness_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      irene_fitness_responses: {
        Row: {
          created_at: string
          display_name: string
          family_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          family_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          family_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irene_fitness_responses_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "irene_fitness_families"
            referencedColumns: ["id"]
          },
        ]
      }
      irene_fitness_votes: {
        Row: {
          category: string
          created_at: string
          id: string
          response_id: string
          vote_date: string
          voter_device_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          response_id: string
          vote_date?: string
          voter_device_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          response_id?: string
          vote_date?: string
          voter_device_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "irene_fitness_votes_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "irene_fitness_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      irene_fitness_voting_settings: {
        Row: {
          id: number
          phase: string
          updated_at: string
        }
        Insert: {
          id?: number
          phase?: string
          updated_at?: string
        }
        Update: {
          id?: number
          phase?: string
          updated_at?: string
        }
        Relationships: []
      }
      irene_merge_candidates: {
        Row: {
          confidence: string
          created_at: string
          id: string
          response_a_id: string | null
          response_b_payload: Json
          response_b_source: string
          status: string
        }
        Insert: {
          confidence: string
          created_at?: string
          id?: string
          response_a_id?: string | null
          response_b_payload: Json
          response_b_source: string
          status?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          id?: string
          response_a_id?: string | null
          response_b_payload?: Json
          response_b_source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "irene_merge_candidates_response_a_id_fkey"
            columns: ["response_a_id"]
            isOneToOne: false
            referencedRelation: "irene_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      irene_responses: {
        Row: {
          activity_tags: string[] | null
          club_tags: string[] | null
          created_at: string
          cub_full_names: string[] | null
          cubs: Json | null
          goal_tags: string[] | null
          id: string
          is_flagged: boolean | null
          is_verified: boolean | null
          media_url: string | null
          needs_grade_review: boolean
          needs_name_review: boolean | null
          parent_first_name: string
          parent_relationship: string | null
          q_boss_level: string | null
          q_club: string | null
          q_funny_fail: string | null
          q_longest_distance: string | null
          q_proudest_moment: string | null
          q_shoes: number | null
          q_weird_habit: string | null
          q_why_start: string | null
          verified_at: string | null
        }
        Insert: {
          activity_tags?: string[] | null
          club_tags?: string[] | null
          created_at?: string
          cub_full_names?: string[] | null
          cubs?: Json | null
          goal_tags?: string[] | null
          id?: string
          is_flagged?: boolean | null
          is_verified?: boolean | null
          media_url?: string | null
          needs_grade_review?: boolean
          needs_name_review?: boolean | null
          parent_first_name: string
          parent_relationship?: string | null
          q_boss_level?: string | null
          q_club?: string | null
          q_funny_fail?: string | null
          q_longest_distance?: string | null
          q_proudest_moment?: string | null
          q_shoes?: number | null
          q_weird_habit?: string | null
          q_why_start?: string | null
          verified_at?: string | null
        }
        Update: {
          activity_tags?: string[] | null
          club_tags?: string[] | null
          created_at?: string
          cub_full_names?: string[] | null
          cubs?: Json | null
          goal_tags?: string[] | null
          id?: string
          is_flagged?: boolean | null
          is_verified?: boolean | null
          media_url?: string | null
          needs_grade_review?: boolean
          needs_name_review?: boolean | null
          parent_first_name?: string
          parent_relationship?: string | null
          q_boss_level?: string | null
          q_club?: string | null
          q_funny_fail?: string | null
          q_longest_distance?: string | null
          q_proudest_moment?: string | null
          q_shoes?: number | null
          q_weird_habit?: string | null
          q_why_start?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      irene_settings: {
        Row: {
          educator_vote_weight: number
          id: number
          phase: string
          phase_ends_hint: string | null
          updated_at: string
        }
        Insert: {
          educator_vote_weight?: number
          id?: number
          phase?: string
          phase_ends_hint?: string | null
          updated_at?: string
        }
        Update: {
          educator_vote_weight?: number
          id?: number
          phase?: string
          phase_ends_hint?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      irene_staff_codes: {
        Row: {
          code: string
          id: number
          updated_at: string
        }
        Insert: {
          code?: string
          id?: number
          updated_at?: string
        }
        Update: {
          code?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      irene_voters: {
        Row: {
          class_name: string | null
          consent_ip_address: string | null
          consent_marketing: boolean
          consent_source: string | null
          consent_timestamp: string | null
          consent_wording_version: string | null
          created_at: string
          device_id: string | null
          email: string | null
          expires_at: string
          grade: string | null
          id: string
          ip_address: string
          opted_out: boolean
          parent_first_name: string | null
          referred_by_response_id: string | null
          voter_group: string
          voter_type: string
          votes_awarded: number
          whatsapp_number: string | null
        }
        Insert: {
          class_name?: string | null
          consent_ip_address?: string | null
          consent_marketing?: boolean
          consent_source?: string | null
          consent_timestamp?: string | null
          consent_wording_version?: string | null
          created_at?: string
          device_id?: string | null
          email?: string | null
          expires_at: string
          grade?: string | null
          id?: string
          ip_address: string
          opted_out?: boolean
          parent_first_name?: string | null
          referred_by_response_id?: string | null
          voter_group?: string
          voter_type?: string
          votes_awarded?: number
          whatsapp_number?: string | null
        }
        Update: {
          class_name?: string | null
          consent_ip_address?: string | null
          consent_marketing?: boolean
          consent_source?: string | null
          consent_timestamp?: string | null
          consent_wording_version?: string | null
          created_at?: string
          device_id?: string | null
          email?: string | null
          expires_at?: string
          grade?: string | null
          id?: string
          ip_address?: string
          opted_out?: boolean
          parent_first_name?: string | null
          referred_by_response_id?: string | null
          voter_group?: string
          voter_type?: string
          votes_awarded?: number
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irene_voters_referred_by_response_id_fkey"
            columns: ["referred_by_response_id"]
            isOneToOne: false
            referencedRelation: "irene_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      irene_votes: {
        Row: {
          category: string
          created_at: string
          id: string
          response_id: string
          voter_id: string
          weight: number
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          response_id: string
          voter_id: string
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          response_id?: string
          voter_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "irene_votes_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "irene_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irene_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "irene_voters"
            referencedColumns: ["id"]
          },
        ]
      }
      kid_face_profiles: {
        Row: {
          created_at: string
          descriptor: Json
          id: string
          kid_id: string
          sample_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          descriptor: Json
          id?: string
          kid_id: string
          sample_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          descriptor?: Json
          id?: string
          kid_id?: string
          sample_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kid_face_profiles_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: true
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
        ]
      }
      kid_guardians: {
        Row: {
          created_at: string
          id: string
          kid_id: string
          lead_id: string
          relationship: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kid_id: string
          lead_id: string
          relationship?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kid_id?: string
          lead_id?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kid_guardians_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kid_guardians_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      kids: {
        Row: {
          age: number | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          grade: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          grade?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
        }
        Update: {
          age?: number | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          grade?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
        }
        Relationships: []
      }
      kiosk_token_access_log: {
        Row: {
          accessed_at: string
          attempted_token: string | null
          id: string
          ip_address: string | null
          success: boolean
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          attempted_token?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          attempted_token?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_token_access_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "session_kiosk_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      landmines: {
        Row: {
          created_at: string
          id: string
          next_action: string | null
          owner: string
          state: string
          system: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          next_action?: string | null
          owner?: string
          state?: string
          system: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          next_action?: string | null
          owner?: string
          state?: string
          system?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          lead_id: string
          note: string | null
          outcome: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          lead_id: string
          note?: string | null
          outcome: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          lead_id?: string
          note?: string | null
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_balance_forward: {
        Row: {
          amount: number
          as_of_date: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          legacy_reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          as_of_date: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          legacy_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          as_of_date?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          legacy_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_balance_forward_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_balance_forward_payments: {
        Row: {
          amount: number
          balance_forward_id: string
          created_at: string
          id: string
          note: string | null
          received_at: string
        }
        Insert: {
          amount: number
          balance_forward_id: string
          created_at?: string
          id?: string
          note?: string | null
          received_at?: string
        }
        Update: {
          amount?: number
          balance_forward_id?: string
          created_at?: string
          id?: string
          note?: string | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_balance_forward_payments_balance_forward_id_fkey"
            columns: ["balance_forward_id"]
            isOneToOne: false
            referencedRelation: "lead_balance_forward"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_qualification_checks: {
        Row: {
          checked_at: string
          checked_by: string
          detail: string | null
          id: string
          lead_id: string
          notes: string | null
          passed: boolean
          stage_key: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string
          detail?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          passed: boolean
          stage_key: string
        }
        Update: {
          checked_at?: string
          checked_by?: string
          detail?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          passed?: boolean
          stage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_qualification_checks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          batch_id: string | null
          changed_at: string
          changed_by: string | null
          from_stage: string | null
          id: string
          lead_id: string
          reason: string | null
          to_stage: string
        }
        Insert: {
          batch_id?: string | null
          changed_at?: string
          changed_by?: string | null
          from_stage?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          to_stage: string
        }
        Update: {
          batch_id?: string | null
          changed_at?: string
          changed_by?: string | null
          from_stage?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ad_headline: string | null
          ad_id: string | null
          awaiting_reply_completion_tag: string | null
          awaiting_reply_confirmation: string | null
          awaiting_reply_flow_id: string | null
          awaiting_reply_label: string | null
          backup_email: string | null
          backup_phone: string | null
          billing_address: string | null
          bot_paused: boolean
          bot_paused_at: string | null
          children_names: string[] | null
          class: string | null
          company_name: string | null
          confirm_fail_count: number
          confirm_fail_reset_at: string | null
          consent_marketing: boolean | null
          consent_source: string | null
          consent_timestamp: string | null
          consent_wording_version: string | null
          contacted_at: string | null
          created_at: string
          ctwa_clid: string | null
          customer_type: string
          email: string | null
          engagement_recency: string
          first_purchase_at: string | null
          household_id: string | null
          id: string
          interested_date_label: string | null
          interested_program_id: string | null
          interested_session_id: string | null
          is_confirmed_parent: boolean
          is_customer: boolean
          is_potential_student: boolean
          last_inbound_at: string | null
          last_purchase_at: string | null
          lifecycle_stage: string
          lifetime_value: number | null
          lost_reason: string | null
          marketing_consent_at: string | null
          merged_at: string | null
          merged_into_id: string | null
          name: string | null
          needs_human: boolean
          needs_human_nudged_at: string | null
          number_of_children: number | null
          opted_out: boolean
          otp_code_hash: string | null
          otp_expires_at: string | null
          otp_sent_at: string | null
          phone: string
          preferred_channel: string
          school: string | null
          source: string | null
          stage_entered_at: string
          stage_health: string
          status: string | null
          tags: string[]
          vat_number: string | null
          voucher_code: string | null
          young_adult_last_nurture_sent_at: string | null
        }
        Insert: {
          ad_headline?: string | null
          ad_id?: string | null
          awaiting_reply_completion_tag?: string | null
          awaiting_reply_confirmation?: string | null
          awaiting_reply_flow_id?: string | null
          awaiting_reply_label?: string | null
          backup_email?: string | null
          backup_phone?: string | null
          billing_address?: string | null
          bot_paused?: boolean
          bot_paused_at?: string | null
          children_names?: string[] | null
          class?: string | null
          company_name?: string | null
          confirm_fail_count?: number
          confirm_fail_reset_at?: string | null
          consent_marketing?: boolean | null
          consent_source?: string | null
          consent_timestamp?: string | null
          consent_wording_version?: string | null
          contacted_at?: string | null
          created_at?: string
          ctwa_clid?: string | null
          customer_type?: string
          email?: string | null
          engagement_recency?: string
          first_purchase_at?: string | null
          household_id?: string | null
          id?: string
          interested_date_label?: string | null
          interested_program_id?: string | null
          interested_session_id?: string | null
          is_confirmed_parent?: boolean
          is_customer?: boolean
          is_potential_student?: boolean
          last_inbound_at?: string | null
          last_purchase_at?: string | null
          lifecycle_stage?: string
          lifetime_value?: number | null
          lost_reason?: string | null
          marketing_consent_at?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          name?: string | null
          needs_human?: boolean
          needs_human_nudged_at?: string | null
          number_of_children?: number | null
          opted_out?: boolean
          otp_code_hash?: string | null
          otp_expires_at?: string | null
          otp_sent_at?: string | null
          phone: string
          preferred_channel?: string
          school?: string | null
          source?: string | null
          stage_entered_at?: string
          stage_health?: string
          status?: string | null
          tags?: string[]
          vat_number?: string | null
          voucher_code?: string | null
          young_adult_last_nurture_sent_at?: string | null
        }
        Update: {
          ad_headline?: string | null
          ad_id?: string | null
          awaiting_reply_completion_tag?: string | null
          awaiting_reply_confirmation?: string | null
          awaiting_reply_flow_id?: string | null
          awaiting_reply_label?: string | null
          backup_email?: string | null
          backup_phone?: string | null
          billing_address?: string | null
          bot_paused?: boolean
          bot_paused_at?: string | null
          children_names?: string[] | null
          class?: string | null
          company_name?: string | null
          confirm_fail_count?: number
          confirm_fail_reset_at?: string | null
          consent_marketing?: boolean | null
          consent_source?: string | null
          consent_timestamp?: string | null
          consent_wording_version?: string | null
          contacted_at?: string | null
          created_at?: string
          ctwa_clid?: string | null
          customer_type?: string
          email?: string | null
          engagement_recency?: string
          first_purchase_at?: string | null
          household_id?: string | null
          id?: string
          interested_date_label?: string | null
          interested_program_id?: string | null
          interested_session_id?: string | null
          is_confirmed_parent?: boolean
          is_customer?: boolean
          is_potential_student?: boolean
          last_inbound_at?: string | null
          last_purchase_at?: string | null
          lifecycle_stage?: string
          lifetime_value?: number | null
          lost_reason?: string | null
          marketing_consent_at?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          name?: string | null
          needs_human?: boolean
          needs_human_nudged_at?: string | null
          number_of_children?: number | null
          opted_out?: boolean
          otp_code_hash?: string | null
          otp_expires_at?: string | null
          otp_sent_at?: string | null
          phone?: string
          preferred_channel?: string
          school?: string | null
          source?: string | null
          stage_entered_at?: string
          stage_health?: string
          status?: string | null
          tags?: string[]
          vat_number?: string | null
          voucher_code?: string | null
          young_adult_last_nurture_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_awaiting_reply_flow_id_fkey"
            columns: ["awaiting_reply_flow_id"]
            isOneToOne: false
            referencedRelation: "bot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_program_id_fkey"
            columns: ["interested_program_id"]
            isOneToOne: false
            referencedRelation: "featured_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_session_id_fkey"
            columns: ["interested_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content: {
        Row: {
          id: number
          lesson_id: number | null
          notes: string | null
          objectives: string | null
          pdf_url: string | null
          video_url: string | null
        }
        Insert: {
          id?: never
          lesson_id?: number | null
          notes?: string | null
          objectives?: string | null
          pdf_url?: string | null
          video_url?: string | null
        }
        Update: {
          id?: never
          lesson_id?: number | null
          notes?: string | null
          objectives?: string | null
          pdf_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_evidence_uploads: {
        Row: {
          blueprint_id: string | null
          course_id: string
          created_at: string
          file_name: string | null
          file_path: string
          file_size_bytes: number | null
          id: string
          lesson_id: number
          mime_type: string | null
          status: string
          student_id: string
          updated_at: string
          upload_type: string
        }
        Insert: {
          blueprint_id?: string | null
          course_id: string
          created_at?: string
          file_name?: string | null
          file_path: string
          file_size_bytes?: number | null
          id?: string
          lesson_id: number
          mime_type?: string | null
          status?: string
          student_id: string
          updated_at?: string
          upload_type?: string
        }
        Update: {
          blueprint_id?: string | null
          course_id?: string
          created_at?: string
          file_name?: string | null
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          lesson_id?: number
          mime_type?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          upload_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_evidence_uploads_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "game_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_uploads_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_uploads_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_uploads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_uploads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_uploads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_evidence_uploads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      lesson_schedule: {
        Row: {
          attendance_status: string | null
          created_at: string | null
          delivery_mode: string | null
          end_time: string | null
          guardian_id: string | null
          id: string
          internal_notes: string | null
          location_or_link: string | null
          start_time: string
          student_id: string
          teacher_id: string | null
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          attendance_status?: string | null
          created_at?: string | null
          delivery_mode?: string | null
          end_time?: string | null
          guardian_id?: string | null
          id?: string
          internal_notes?: string | null
          location_or_link?: string | null
          start_time: string
          student_id: string
          teacher_id?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          attendance_status?: string | null
          created_at?: string | null
          delivery_mode?: string | null
          end_time?: string | null
          guardian_id?: string | null
          id?: string
          internal_notes?: string | null
          location_or_link?: string | null
          start_time?: string
          student_id?: string
          teacher_id?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_schedule_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lesson_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lesson_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      lesson_sections: {
        Row: {
          body: string | null
          created_at: string
          id: number
          is_published: boolean
          lesson_id: number
          media_url: string | null
          order_index: number
          resource_url: string | null
          section_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: number
          is_published?: boolean
          lesson_id: number
          media_url?: string | null
          order_index: number
          resource_url?: string | null
          section_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: number
          is_published?: boolean
          lesson_id?: number
          media_url?: string | null
          order_index?: number
          resource_url?: string | null
          section_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_sections_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_id: string | null
          created_at: string | null
          description: string | null
          id: number
          is_published: boolean | null
          is_released: boolean
          order_index: number | null
          slug: string | null
          source_record_id: string | null
          source_status: string | null
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: never
          is_published?: boolean | null
          is_released?: boolean
          order_index?: number | null
          slug?: string | null
          source_record_id?: string | null
          source_status?: string | null
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: never
          is_published?: boolean | null
          is_released?: boolean
          order_index?: number | null
          slug?: string | null
          source_record_id?: string | null
          source_status?: string | null
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      makecode_tutorials: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_hidden: boolean
          markdown_code: string | null
          title: string
          url: string
          xp_value: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          is_hidden?: boolean
          markdown_code?: string | null
          title: string
          url: string
          xp_value?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_hidden?: boolean
          markdown_code?: string | null
          title?: string
          url?: string
          xp_value?: number | null
        }
        Relationships: []
      }
      math_daily_sprints: {
        Row: {
          accuracy_pct: number | null
          created_at: string | null
          grade: number | null
          id: string
          mood_emoji: string | null
          speed_seconds: number | null
          student_id: string | null
        }
        Insert: {
          accuracy_pct?: number | null
          created_at?: string | null
          grade?: number | null
          id?: string
          mood_emoji?: string | null
          speed_seconds?: number | null
          student_id?: string | null
        }
        Update: {
          accuracy_pct?: number | null
          created_at?: string | null
          grade?: number | null
          id?: string
          mood_emoji?: string | null
          speed_seconds?: number | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "math_daily_sprints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "math_daily_sprints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "math_daily_sprints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "math_daily_sprints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      math_lab_questions: {
        Row: {
          cognitive_level: string | null
          config: Json
          created_at: string | null
          difficulty_level: number
          id: string
          prompt: string
          sector: string
          sparks_reward: number | null
          xp_reward: number | null
        }
        Insert: {
          cognitive_level?: string | null
          config: Json
          created_at?: string | null
          difficulty_level: number
          id?: string
          prompt: string
          sector: string
          sparks_reward?: number | null
          xp_reward?: number | null
        }
        Update: {
          cognitive_level?: string | null
          config?: Json
          created_at?: string | null
          difficulty_level?: number
          id?: string
          prompt?: string
          sector?: string
          sparks_reward?: number | null
          xp_reward?: number | null
        }
        Relationships: []
      }
      math_mastery: {
        Row: {
          cognitive_level: string
          content_area: string
          grade: number | null
          id: string
          last_activity_at: string | null
          mastery_score: number | null
          student_id: string | null
          topic: string
          total_challenges_completed: number | null
        }
        Insert: {
          cognitive_level: string
          content_area: string
          grade?: number | null
          id?: string
          last_activity_at?: string | null
          mastery_score?: number | null
          student_id?: string | null
          topic: string
          total_challenges_completed?: number | null
        }
        Update: {
          cognitive_level?: string
          content_area?: string
          grade?: number | null
          id?: string
          last_activity_at?: string | null
          mastery_score?: number | null
          student_id?: string | null
          topic?: string
          total_challenges_completed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "math_mastery_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "math_mastery_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "math_mastery_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "math_mastery_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      media_shares: {
        Row: {
          cover_url: string
          created_at: string
          expires_at: string
          guardian_id: string
          id: string
          media_payload: Json
          token: string
          view_count: number
        }
        Insert: {
          cover_url: string
          created_at?: string
          expires_at: string
          guardian_id: string
          id?: string
          media_payload?: Json
          token: string
          view_count?: number
        }
        Update: {
          cover_url?: string
          created_at?: string
          expires_at?: string
          guardian_id?: string
          id?: string
          media_payload?: Json
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_shares_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_shares_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_shares_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_shares_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      media_tags: {
        Row: {
          created_at: string | null
          id: string
          is_hidden: boolean | null
          is_starred: boolean | null
          media_id: string | null
          rating: number | null
          removal_approved_by_admin: boolean | null
          removal_requested: boolean | null
          removal_requested_at: string | null
          student_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          is_starred?: boolean | null
          media_id?: string | null
          rating?: number | null
          removal_approved_by_admin?: boolean | null
          removal_requested?: boolean | null
          removal_requested_at?: string | null
          student_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          is_starred?: boolean | null
          media_id?: string | null
          rating?: number | null
          removal_approved_by_admin?: boolean | null
          removal_requested?: boolean | null
          removal_requested_at?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_tags_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "event_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          buttons: Json | null
          conversation_category: string | null
          conversation_expires_at: string | null
          created_at: string | null
          direction: string | null
          id: string
          lead_id: string | null
          status: string | null
          status_updated_at: string | null
          wamid: string | null
        }
        Insert: {
          body: string
          buttons?: Json | null
          conversation_category?: string | null
          conversation_expires_at?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          lead_id?: string | null
          status?: string | null
          status_updated_at?: string | null
          wamid?: string | null
        }
        Update: {
          body?: string
          buttons?: Json | null
          conversation_category?: string | null
          conversation_expires_at?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          lead_id?: string | null
          status?: string | null
          status_updated_at?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          created_at: string | null
          id: string
          lore_text: string | null
          mission_config: Json | null
          module_id: string | null
          order_index: number
          sandbox_config: Json | null
          sandbox_type: string | null
          secret_code: string | null
          secret_xp_bonus: number | null
          title: string
          unlock_date: string | null
          video_url: string | null
          xp_reward: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lore_text?: string | null
          mission_config?: Json | null
          module_id?: string | null
          order_index: number
          sandbox_config?: Json | null
          sandbox_type?: string | null
          secret_code?: string | null
          secret_xp_bonus?: number | null
          title: string
          unlock_date?: string | null
          video_url?: string | null
          xp_reward?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lore_text?: string | null
          mission_config?: Json | null
          module_id?: string | null
          order_index?: number
          sandbox_config?: Json | null
          sandbox_type?: string | null
          secret_code?: string | null
          secret_xp_bonus?: number | null
          title?: string
          unlock_date?: string | null
          video_url?: string | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string | null
          created_at: string | null
          description: string | null
          id: string
          order_index: number
          title: string
          unlock_date: string | null
          video_url: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_index: number
          title: string
          unlock_date?: string | null
          video_url?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          unlock_date?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_expenses: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          due_date: string
          id: string
          name: string
          payment_timing: string
          recurring: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          due_date: string
          id?: string
          name: string
          payment_timing?: string
          recurring?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          name?: string
          payment_timing?: string
          recurring?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      monthly_student_tracker: {
        Row: {
          id: string
          is_active: boolean | null
          program: string
          student_id: string | null
          tier: string
          tracking_month: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          program: string
          student_id?: string | null
          tier: string
          tracking_month: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          program?: string
          student_id?: string | null
          tier?: string
          tracking_month?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_student_tracker_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_student_tracker_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_student_tracker_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_student_tracker_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_total: number | null
          bundle_id: string | null
          created_at: string
          currency: string
          guardian_lead_id: string
          id: string
          notes: string | null
          payment_reference: string | null
          status: string
        }
        Insert: {
          amount_total?: number | null
          bundle_id?: string | null
          created_at?: string
          currency?: string
          guardian_lead_id: string
          id?: string
          notes?: string | null
          payment_reference?: string | null
          status?: string
        }
        Update: {
          amount_total?: number | null
          bundle_id?: string | null
          created_at?: string
          currency?: string
          guardian_lead_id?: string
          id?: string
          notes?: string | null
          payment_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_guardian_lead_id_fkey"
            columns: ["guardian_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          package_id: string
          quantity_override: number | null
          quantity_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          package_id: string
          quantity_override?: number | null
          quantity_type: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          package_id?: string
          quantity_override?: number | null
          quantity_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          child_facing_blurb: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          name: string
          recommended_margin_pct: number | null
          recommended_min_attendance: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          child_facing_blurb?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          name: string
          recommended_margin_pct?: number | null
          recommended_min_attendance?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          child_facing_blurb?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          name?: string
          recommended_margin_pct?: number | null
          recommended_min_attendance?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      parents: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      pass_credits: {
        Row: {
          created_at: string
          enrolment_id: string | null
          id: string
          pass_id: string
          redeemed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          enrolment_id?: string | null
          id?: string
          pass_id: string
          redeemed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          enrolment_id?: string | null
          id?: string
          pass_id?: string
          redeemed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pass_credits_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_credits_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "passes"
            referencedColumns: ["id"]
          },
        ]
      }
      passes: {
        Row: {
          created_at: string
          credits_total: number
          credits_used: number
          expires_at: string
          first_session_id: string
          guardian_lead_id: string
          id: string
          order_id: string | null
          purchased_at: string
          qualifying_location: string | null
          qualifying_types: string[] | null
          unused_credit_value: number
        }
        Insert: {
          created_at?: string
          credits_total?: number
          credits_used?: number
          expires_at: string
          first_session_id: string
          guardian_lead_id: string
          id?: string
          order_id?: string | null
          purchased_at?: string
          qualifying_location?: string | null
          qualifying_types?: string[] | null
          unused_credit_value?: number
        }
        Update: {
          created_at?: string
          credits_total?: number
          credits_used?: number
          expires_at?: string
          first_session_id?: string
          guardian_lead_id?: string
          id?: string
          order_id?: string | null
          purchased_at?: string
          qualifying_location?: string | null
          qualifying_types?: string[] | null
          unused_credit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "passes_first_session_id_fkey"
            columns: ["first_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passes_guardian_lead_id_fkey"
            columns: ["guardian_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          id: string
          invoice_id: string | null
          payment_id: string | null
        }
        Insert: {
          amount_allocated?: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          corporate_client_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          due_date: string | null
          id: string
          paid_at: string | null
          parent_id: string | null
          status: string | null
        }
        Insert: {
          amount: number
          corporate_client_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          parent_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          corporate_client_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          parent_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_corporate_client_id_fkey"
            columns: ["corporate_client_id"]
            isOneToOne: false
            referencedRelation: "corporate_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      pending_admin_alerts: {
        Row: {
          created_at: string
          id: string
          lead_phone: string
          stage_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_phone: string
          stage_text: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_phone?: string
          stage_text?: string
        }
        Relationships: []
      }
      pending_bookings: {
        Row: {
          booking_link_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          parent_name: string | null
          requested_time: string | null
          schedule_id: string | null
          status: string | null
          student_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          booking_link_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_name?: string | null
          requested_time?: string | null
          schedule_id?: string | null
          status?: string | null
          student_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          booking_link_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_name?: string | null
          requested_time?: string | null
          schedule_id?: string | null
          status?: string | null
          student_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_bookings_booking_link_id_fkey"
            columns: ["booking_link_id"]
            isOneToOne: false
            referencedRelation: "booking_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_bookings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "teacher_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_gallery_token_access_log: {
        Row: {
          accessed_at: string
          attempted_token: string | null
          id: string
          ip_address: string | null
          success: boolean
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          attempted_token?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          attempted_token?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_gallery_token_access_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "photo_gallery_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_gallery_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          guardian_lead_id: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          session_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          guardian_lead_id: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          session_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          guardian_lead_id?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          session_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_gallery_tokens_guardian_lead_id_fkey"
            columns: ["guardian_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_gallery_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_reset_requests: {
        Row: {
          created_at: string
          id: number
          metadata: Json
          parent_email: string
          request_notes: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_identifier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          metadata?: Json
          parent_email: string
          request_notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_identifier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          metadata?: Json
          parent_email?: string
          request_notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_identifier?: string
          updated_at?: string
        }
        Relationships: []
      }
      pioneer_levels: {
        Row: {
          accent_color: string | null
          code: string
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          name: string
          order_index: number
          updated_at: string
          xp_required: number
        }
        Insert: {
          accent_color?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          name: string
          order_index: number
          updated_at?: string
          xp_required: number
        }
        Update: {
          accent_color?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          name?: string
          order_index?: number
          updated_at?: string
          xp_required?: number
        }
        Relationships: []
      }
      pioneer_progress: {
        Row: {
          completed_at: string | null
          id: string
          mission_id: string | null
          pioneer_id: string | null
          status: string | null
          xp_awarded: number | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          mission_id?: string | null
          pioneer_id?: string | null
          status?: string | null
          xp_awarded?: number | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          mission_id?: string | null
          pioneer_id?: string | null
          status?: string | null
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pioneer_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pioneer_progress_pioneer_id_fkey"
            columns: ["pioneer_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pioneer_progress_pioneer_id_fkey"
            columns: ["pioneer_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pioneer_progress_pioneer_id_fkey"
            columns: ["pioneer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pioneer_progress_pioneer_id_fkey"
            columns: ["pioneer_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      platform_components: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          engine_color: string | null
          engine_drawer: string | null
          id: string
          image_url: string | null
          name: string
          real_world_use: string | null
          tutorial_ids: Json | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          engine_color?: string | null
          engine_drawer?: string | null
          id?: string
          image_url?: string | null
          name: string
          real_world_use?: string | null
          tutorial_ids?: Json | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          engine_color?: string | null
          engine_drawer?: string | null
          id?: string
          image_url?: string | null
          name?: string
          real_world_use?: string | null
          tutorial_ids?: Json | null
        }
        Relationships: []
      }
      platform_logic_rules: {
        Row: {
          created_at: string | null
          engine: string
          engine_color: string | null
          engine_drawer: string | null
          id: string
          label: string
          syntax_pattern: string
        }
        Insert: {
          created_at?: string | null
          engine: string
          engine_color?: string | null
          engine_drawer?: string | null
          id?: string
          label: string
          syntax_pattern: string
        }
        Update: {
          created_at?: string | null
          engine?: string
          engine_color?: string | null
          engine_drawer?: string | null
          id?: string
          label?: string
          syntax_pattern?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_tier: string | null
          auth_attempts: number | null
          auth_user_id: string | null
          bootcamp_xp: number | null
          created_at: string | null
          current_streak: number | null
          date_of_birth: string | null
          display_name: string | null
          elite_until: string | null
          funnel_stage: string | null
          id: string
          inactive_since: string | null
          interested_service: string | null
          inventory: Json | null
          is_acknowledged: boolean | null
          is_locked: boolean | null
          last_active_date: string | null
          lead_source: string | null
          linked_parent_id: string | null
          metadata: Json | null
          onboarding_token: string | null
          payment_plan_preference: string | null
          picture_sequence: Json | null
          pin_hash: string | null
          previous_state: Json | null
          requires_review: boolean | null
          role: string
          show_welcome_guide: boolean | null
          sparks: number | null
          squad_name: string | null
          status: string | null
          student_identifier: string | null
          tc_accepted_at: string | null
          tc_accepted_version: string | null
          temp_entry_pin: string | null
          trial_expires_at: string | null
          updated_at: string | null
          xp: number | null
        }
        Insert: {
          account_tier?: string | null
          auth_attempts?: number | null
          auth_user_id?: string | null
          bootcamp_xp?: number | null
          created_at?: string | null
          current_streak?: number | null
          date_of_birth?: string | null
          display_name?: string | null
          elite_until?: string | null
          funnel_stage?: string | null
          id?: string
          inactive_since?: string | null
          interested_service?: string | null
          inventory?: Json | null
          is_acknowledged?: boolean | null
          is_locked?: boolean | null
          last_active_date?: string | null
          lead_source?: string | null
          linked_parent_id?: string | null
          metadata?: Json | null
          onboarding_token?: string | null
          payment_plan_preference?: string | null
          picture_sequence?: Json | null
          pin_hash?: string | null
          previous_state?: Json | null
          requires_review?: boolean | null
          role?: string
          show_welcome_guide?: boolean | null
          sparks?: number | null
          squad_name?: string | null
          status?: string | null
          student_identifier?: string | null
          tc_accepted_at?: string | null
          tc_accepted_version?: string | null
          temp_entry_pin?: string | null
          trial_expires_at?: string | null
          updated_at?: string | null
          xp?: number | null
        }
        Update: {
          account_tier?: string | null
          auth_attempts?: number | null
          auth_user_id?: string | null
          bootcamp_xp?: number | null
          created_at?: string | null
          current_streak?: number | null
          date_of_birth?: string | null
          display_name?: string | null
          elite_until?: string | null
          funnel_stage?: string | null
          id?: string
          inactive_since?: string | null
          interested_service?: string | null
          inventory?: Json | null
          is_acknowledged?: boolean | null
          is_locked?: boolean | null
          last_active_date?: string | null
          lead_source?: string | null
          linked_parent_id?: string | null
          metadata?: Json | null
          onboarding_token?: string | null
          payment_plan_preference?: string | null
          picture_sequence?: Json | null
          pin_hash?: string | null
          previous_state?: Json | null
          requires_review?: boolean | null
          role?: string
          show_welcome_guide?: boolean | null
          sparks?: number | null
          squad_name?: string | null
          status?: string | null
          student_identifier?: string | null
          tc_accepted_at?: string | null
          tc_accepted_version?: string | null
          temp_entry_pin?: string | null
          trial_expires_at?: string | null
          updated_at?: string | null
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      program_variable_costs: {
        Row: {
          cost_type: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          program_id: string
          rate: number
          session_id: string | null
          unit: string
        }
        Insert: {
          cost_type: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          program_id: string
          rate: number
          session_id?: string | null
          unit?: string
        }
        Update: {
          cost_type?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          program_id?: string
          rate?: number
          session_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_variable_costs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_variable_costs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          active: boolean
          age_max: number | null
          age_min: number | null
          audience: string
          code: string
          created_at: string
          default_cost_centre_id: string | null
          description_long: string | null
          description_short: string | null
          duration_hours: number | null
          id: string
          includes: string[] | null
          level: string | null
          name: string
          prerequisite_programme_id: string | null
          sequence: number | null
          type: string
          version: number
        }
        Insert: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          audience?: string
          code: string
          created_at?: string
          default_cost_centre_id?: string | null
          description_long?: string | null
          description_short?: string | null
          duration_hours?: number | null
          id?: string
          includes?: string[] | null
          level?: string | null
          name: string
          prerequisite_programme_id?: string | null
          sequence?: number | null
          type: string
          version?: number
        }
        Update: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          audience?: string
          code?: string
          created_at?: string
          default_cost_centre_id?: string | null
          description_long?: string | null
          description_short?: string | null
          duration_hours?: number | null
          id?: string
          includes?: string[] | null
          level?: string | null
          name?: string
          prerequisite_programme_id?: string | null
          sequence?: number | null
          type?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "programs_default_cost_centre_id_fkey"
            columns: ["default_cost_centre_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_prerequisite_programme_id_fkey"
            columns: ["prerequisite_programme_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      progress: {
        Row: {
          completed_at: string | null
          current_section_id: number | null
          id: number
          last_opened_at: string | null
          last_section_order: number | null
          lesson_id: number | null
          started_at: string | null
          status: string | null
          student_id: string | null
          time_spent_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          current_section_id?: number | null
          id?: never
          last_opened_at?: string | null
          last_section_order?: number | null
          lesson_id?: number | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          current_section_id?: number | null
          id?: never
          last_opened_at?: string | null
          last_section_order?: number | null
          lesson_id?: number | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_current_section_id_fkey"
            columns: ["current_section_id"]
            isOneToOne: false
            referencedRelation: "lesson_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      prospects: {
        Row: {
          contact_log: Json | null
          created_at: string | null
          email: string | null
          id: string
          metadata: Json | null
          name: string
          next_action_deadline: string | null
          next_action_task: string | null
          phone: string | null
          quote_sent: boolean | null
          raw_form_data: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          contact_log?: Json | null
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name: string
          next_action_deadline?: string | null
          next_action_task?: string | null
          phone?: string | null
          quote_sent?: boolean | null
          raw_form_data?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_log?: Json | null
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          next_action_deadline?: string | null
          next_action_task?: string | null
          phone?: string | null
          quote_sent?: boolean | null
          raw_form_data?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          attempt_number: number
          client_request_id: string | null
          created_at: string | null
          id: number
          module_id: string | null
          passed: boolean | null
          score: number | null
          started_at: string | null
          student_id: string
          submitted_at: string | null
          time_taken: number | null
          total_questions: number | null
          updated_at: string | null
        }
        Insert: {
          attempt_number: number
          client_request_id?: string | null
          created_at?: string | null
          id?: number
          module_id?: string | null
          passed?: boolean | null
          score?: number | null
          started_at?: string | null
          student_id: string
          submitted_at?: string | null
          time_taken?: number | null
          total_questions?: number | null
          updated_at?: string | null
        }
        Update: {
          attempt_number?: number
          client_request_id?: string | null
          created_at?: string | null
          id?: number
          module_id?: string | null
          passed?: boolean | null
          score?: number | null
          started_at?: string | null
          student_id?: string
          submitted_at?: string | null
          time_taken?: number | null
          total_questions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      quiz_items: {
        Row: {
          answer: Json
          explanation: string | null
          id: number
          is_published: boolean
          module_id: string | null
          options: Json | null
          order_index: number | null
          points: number | null
          question: string
          type: string | null
        }
        Insert: {
          answer: Json
          explanation?: string | null
          id?: never
          is_published?: boolean
          module_id?: string | null
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question: string
          type?: string | null
        }
        Update: {
          answer?: Json
          explanation?: string | null
          id?: never
          is_published?: boolean
          module_id?: string | null
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_items_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_item_costs: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          quantity: number
          quote_line_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          quantity?: number
          quote_line_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          quantity?: number
          quote_line_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_item_costs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_item_costs_quote_line_item_id_fkey"
            columns: ["quote_line_item_id"]
            isOneToOne: false
            referencedRelation: "quote_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          created_at: string
          description: string
          discount_pct: number
          event_package_id: string | null
          event_package_quantity: number | null
          id: string
          line_total: number
          program_id: string | null
          quantity: number
          quote_id: string
          session_id: string | null
          sort_order: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_pct?: number
          event_package_id?: string | null
          event_package_quantity?: number | null
          id?: string
          line_total: number
          program_id?: string | null
          quantity?: number
          quote_id: string
          session_id?: string | null
          sort_order?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_pct?: number
          event_package_id?: string | null
          event_package_quantity?: number | null
          id?: string
          line_total?: number
          program_id?: string | null
          quantity?: number
          quote_id?: string
          session_id?: string | null
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_event_package_id_fkey"
            columns: ["event_package_id"]
            isOneToOne: false
            referencedRelation: "event_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_plan_type: string | null
          created_at: string
          created_by: string | null
          currency: string
          event_package_id: string | null
          expires_at: string | null
          id: string
          installment_count: number | null
          is_open_ended: boolean
          lead_id: string
          migrated_from_billing_record_id: string | null
          monthly_installment_amount: number | null
          notes: string | null
          program_id: string
          quote_number: number
          session_id: string | null
          source: string
          status: string
          superseded_by_quote_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_plan_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          event_package_id?: string | null
          expires_at?: string | null
          id?: string
          installment_count?: number | null
          is_open_ended?: boolean
          lead_id: string
          migrated_from_billing_record_id?: string | null
          monthly_installment_amount?: number | null
          notes?: string | null
          program_id: string
          quote_number?: number
          session_id?: string | null
          source?: string
          status?: string
          superseded_by_quote_id?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_plan_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          event_package_id?: string | null
          expires_at?: string | null
          id?: string
          installment_count?: number | null
          is_open_ended?: boolean
          lead_id?: string
          migrated_from_billing_record_id?: string | null
          monthly_installment_amount?: number | null
          notes?: string | null
          program_id?: string
          quote_number?: number
          session_id?: string | null
          source?: string
          status?: string
          superseded_by_quote_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_event_package_id_fkey"
            columns: ["event_package_id"]
            isOneToOne: false
            referencedRelation: "event_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_superseded_by_quote_id_fkey"
            columns: ["superseded_by_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      rad_book_notes: {
        Row: {
          book_id: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          page_number: number | null
          user_comment: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          page_number?: number | null
          user_comment: string
        }
        Update: {
          book_id?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          page_number?: number | null
          user_comment?: string
        }
        Relationships: [
          {
            foreignKeyName: "rad_book_notes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "rad_books"
            referencedColumns: ["id"]
          },
        ]
      }
      rad_book_tags: {
        Row: {
          book_id: string
          tag_id: string
        }
        Insert: {
          book_id: string
          tag_id: string
        }
        Update: {
          book_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rad_book_tags_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "rad_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rad_book_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "rad_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      rad_books: {
        Row: {
          author: string | null
          cover_key: string | null
          created_at: string | null
          file_key: string | null
          file_type: string | null
          has_digital: boolean | null
          has_physical: boolean | null
          id: string
          is_vaulted: boolean | null
          is_vip: boolean | null
          last_cfi: string | null
          last_page_number: number | null
          last_read_at: string | null
          marked_for_deletion: boolean | null
          reading_progress: number | null
          status: string | null
          suggested_metadata: Json | null
          synopsis: string | null
          title: string
        }
        Insert: {
          author?: string | null
          cover_key?: string | null
          created_at?: string | null
          file_key?: string | null
          file_type?: string | null
          has_digital?: boolean | null
          has_physical?: boolean | null
          id?: string
          is_vaulted?: boolean | null
          is_vip?: boolean | null
          last_cfi?: string | null
          last_page_number?: number | null
          last_read_at?: string | null
          marked_for_deletion?: boolean | null
          reading_progress?: number | null
          status?: string | null
          suggested_metadata?: Json | null
          synopsis?: string | null
          title: string
        }
        Update: {
          author?: string | null
          cover_key?: string | null
          created_at?: string | null
          file_key?: string | null
          file_type?: string | null
          has_digital?: boolean | null
          has_physical?: boolean | null
          id?: string
          is_vaulted?: boolean | null
          is_vip?: boolean | null
          last_cfi?: string | null
          last_page_number?: number | null
          last_read_at?: string | null
          marked_for_deletion?: boolean | null
          reading_progress?: number | null
          status?: string | null
          suggested_metadata?: Json | null
          synopsis?: string | null
          title?: string
        }
        Relationships: []
      }
      rad_highlights: {
        Row: {
          book_id: string | null
          created_at: string | null
          id: string
          location_marker: string | null
          text_content: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string | null
          id?: string
          location_marker?: string | null
          text_content: string
        }
        Update: {
          book_id?: string | null
          created_at?: string | null
          id?: string
          location_marker?: string | null
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "rad_highlights_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "rad_books"
            referencedColumns: ["id"]
          },
        ]
      }
      rad_margin_notes: {
        Row: {
          book_id: string
          chapter_title: string | null
          color_code: string | null
          created_at: string | null
          highlighted_text: string
          id: string
          is_starred: boolean | null
          location_cfi: string | null
          page_number: number | null
          updated_at: string | null
          user_note: string | null
        }
        Insert: {
          book_id: string
          chapter_title?: string | null
          color_code?: string | null
          created_at?: string | null
          highlighted_text: string
          id?: string
          is_starred?: boolean | null
          location_cfi?: string | null
          page_number?: number | null
          updated_at?: string | null
          user_note?: string | null
        }
        Update: {
          book_id?: string
          chapter_title?: string | null
          color_code?: string | null
          created_at?: string | null
          highlighted_text?: string
          id?: string
          is_starred?: boolean | null
          location_cfi?: string | null
          page_number?: number | null
          updated_at?: string | null
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rad_margin_notes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "rad_books"
            referencedColumns: ["id"]
          },
        ]
      }
      rad_note_tag_relations: {
        Row: {
          note_id: string
          tag_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rad_note_tag_relations_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "rad_margin_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rad_note_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "rad_note_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      rad_note_tags: {
        Row: {
          color: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      rad_notes: {
        Row: {
          created_at: string | null
          highlight_id: string | null
          id: string
          is_starred: boolean | null
          note_content: string
        }
        Insert: {
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          is_starred?: boolean | null
          note_content: string
        }
        Update: {
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          is_starred?: boolean | null
          note_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "rad_notes_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "rad_highlights"
            referencedColumns: ["id"]
          },
        ]
      }
      rad_reader_settings: {
        Row: {
          id: boolean
          updated_at: string
          vault_pin: string
        }
        Insert: {
          id?: boolean
          updated_at?: string
          vault_pin?: string
        }
        Update: {
          id?: boolean
          updated_at?: string
          vault_pin?: string
        }
        Relationships: []
      }
      rad_reading_sessions: {
        Row: {
          book_id: string | null
          end_location: string | null
          ended_at: string | null
          id: string
          start_location: string | null
          started_at: string
        }
        Insert: {
          book_id?: string | null
          end_location?: string | null
          ended_at?: string | null
          id?: string
          start_location?: string | null
          started_at?: string
        }
        Update: {
          book_id?: string | null
          end_location?: string | null
          ended_at?: string | null
          id?: string
          start_location?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rad_reading_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "rad_books"
            referencedColumns: ["id"]
          },
        ]
      }
      rad_tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      rad_vault_logs: {
        Row: {
          accessed_at: string | null
          attempted_code: string | null
          id: string
        }
        Insert: {
          accessed_at?: string | null
          attempted_code?: string | null
          id?: string
        }
        Update: {
          accessed_at?: string | null
          attempted_code?: string | null
          id?: string
        }
        Relationships: []
      }
      rad_wishlist: {
        Row: {
          author: string | null
          created_at: string | null
          id: string
          sourced_from_book_id: string | null
          status: string | null
          title: string
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          id?: string
          sourced_from_book_id?: string | null
          status?: string | null
          title: string
        }
        Update: {
          author?: string | null
          created_at?: string | null
          id?: string
          sourced_from_book_id?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rad_wishlist_sourced_from_book_id_fkey"
            columns: ["sourced_from_book_id"]
            isOneToOne: false
            referencedRelation: "rad_books"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_billing_plans: {
        Row: {
          created_at: string
          frequency: string
          id: string
          last_generated_invoice_id: string | null
          lead_id: string
          line_items: Json
          next_due_date: string
          notes: string | null
          source_quote_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          id?: string
          last_generated_invoice_id?: string | null
          lead_id: string
          line_items: Json
          next_due_date: string
          notes?: string | null
          source_quote_id?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          last_generated_invoice_id?: string | null
          lead_id?: string
          line_items?: Json
          next_due_date?: string
          notes?: string | null
          source_quote_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_billing_plans_last_generated_invoice_id_fkey"
            columns: ["last_generated_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_billing_plans_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_billing_plans_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          admin_notes: string | null
          auth_attempts: number | null
          created_at: string
          date_of_birth: string | null
          directives_version: string | null
          email: string
          id: string
          interested_programs: string[]
          is_acknowledged: boolean | null
          is_locked: boolean | null
          last_portal_access: string | null
          lesson_format: string | null
          metadata: Json | null
          notes: string | null
          parent_approved_at: string | null
          parent_name: string
          payment_status: string | null
          phone: string
          status: string | null
          student_age: number
          student_completed_at: string | null
          student_name: string
          temp_entry_pin: string | null
          terms_accepted_at: string | null
          terms_version: string | null
        }
        Insert: {
          admin_notes?: string | null
          auth_attempts?: number | null
          created_at?: string
          date_of_birth?: string | null
          directives_version?: string | null
          email: string
          id?: string
          interested_programs: string[]
          is_acknowledged?: boolean | null
          is_locked?: boolean | null
          last_portal_access?: string | null
          lesson_format?: string | null
          metadata?: Json | null
          notes?: string | null
          parent_approved_at?: string | null
          parent_name: string
          payment_status?: string | null
          phone: string
          status?: string | null
          student_age: number
          student_completed_at?: string | null
          student_name: string
          temp_entry_pin?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
        }
        Update: {
          admin_notes?: string | null
          auth_attempts?: number | null
          created_at?: string
          date_of_birth?: string | null
          directives_version?: string | null
          email?: string
          id?: string
          interested_programs?: string[]
          is_acknowledged?: boolean | null
          is_locked?: boolean | null
          last_portal_access?: string | null
          lesson_format?: string | null
          metadata?: Json | null
          notes?: string | null
          parent_approved_at?: string | null
          parent_name?: string
          payment_status?: string | null
          phone?: string
          status?: string | null
          student_age?: number
          student_completed_at?: string | null
          student_name?: string
          temp_entry_pin?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
        }
        Relationships: []
      }
      roadmap_courses: {
        Row: {
          actual_days: number | null
          created_at: string | null
          description: string | null
          effort_days: number | null
          id: string
          intended_for: string | null
          objective: string | null
          prerequisites: string[] | null
          priority_order: number | null
          status: string | null
          target_age: string | null
          tasks: Json | null
          title: string
        }
        Insert: {
          actual_days?: number | null
          created_at?: string | null
          description?: string | null
          effort_days?: number | null
          id?: string
          intended_for?: string | null
          objective?: string | null
          prerequisites?: string[] | null
          priority_order?: number | null
          status?: string | null
          target_age?: string | null
          tasks?: Json | null
          title: string
        }
        Update: {
          actual_days?: number | null
          created_at?: string | null
          description?: string | null
          effort_days?: number | null
          id?: string
          intended_for?: string | null
          objective?: string | null
          prerequisites?: string[] | null
          priority_order?: number | null
          status?: string | null
          target_age?: string | null
          tasks?: Json | null
          title?: string
        }
        Relationships: []
      }
      roadmap_features: {
        Row: {
          actual_hours: number | null
          created_at: string | null
          description: string | null
          effort_hours: number | null
          id: string
          impact_area: string | null
          is_customer_facing: boolean | null
          prerequisites: string[] | null
          priority_order: number | null
          status: string | null
          tasks: Json | null
          title: string
        }
        Insert: {
          actual_hours?: number | null
          created_at?: string | null
          description?: string | null
          effort_hours?: number | null
          id?: string
          impact_area?: string | null
          is_customer_facing?: boolean | null
          prerequisites?: string[] | null
          priority_order?: number | null
          status?: string | null
          tasks?: Json | null
          title: string
        }
        Update: {
          actual_hours?: number | null
          created_at?: string | null
          description?: string | null
          effort_hours?: number | null
          id?: string
          impact_area?: string | null
          is_customer_facing?: boolean | null
          prerequisites?: string[] | null
          priority_order?: number | null
          status?: string | null
          tasks?: Json | null
          title?: string
        }
        Relationships: []
      }
      robotics_day_participants: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          name: string
          points: number
          team: string
          tier: number | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id?: string
          name: string
          points?: number
          team: string
          tier?: number | null
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          name?: string
          points?: number
          team?: string
          tier?: number | null
        }
        Relationships: []
      }
      robotics_day_teams: {
        Row: {
          display_name: string | null
          team: string
          updated_at: string
        }
        Insert: {
          display_name?: string | null
          team: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          team?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_kiosk_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          revoked_at: string | null
          session_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          session_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          session_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_kiosk_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_photo_faces: {
        Row: {
          bbox: Json
          created_at: string
          descriptor: Json
          id: string
          kid_id: string | null
          photo_id: string
          profile_updated: boolean
          suggested_distance: number | null
          suggested_kid_id: string | null
        }
        Insert: {
          bbox: Json
          created_at?: string
          descriptor: Json
          id?: string
          kid_id?: string | null
          photo_id: string
          profile_updated?: boolean
          suggested_distance?: number | null
          suggested_kid_id?: string | null
        }
        Update: {
          bbox?: Json
          created_at?: string
          descriptor?: Json
          id?: string
          kid_id?: string | null
          photo_id?: string
          profile_updated?: boolean
          suggested_distance?: number | null
          suggested_kid_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_photo_faces_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_photo_faces_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "session_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_photo_faces_suggested_kid_id_fkey"
            columns: ["suggested_kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
        ]
      }
      session_photo_subjects: {
        Row: {
          created_at: string
          id: string
          identifiable: boolean
          kid_id: string
          photo_id: string
          selected_for_parent: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          identifiable?: boolean
          kid_id: string
          photo_id: string
          selected_for_parent?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          identifiable?: boolean
          kid_id?: string
          photo_id?: string
          selected_for_parent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "session_photo_subjects_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_photo_subjects_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "session_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      session_photo_usage: {
        Row: {
          destination: string
          id: string
          needs_removal: boolean
          notes: string | null
          photo_id: string
          published_at: string
          published_by: string | null
          removed_at: string | null
        }
        Insert: {
          destination: string
          id?: string
          needs_removal?: boolean
          notes?: string | null
          photo_id: string
          published_at?: string
          published_by?: string | null
          removed_at?: string | null
        }
        Update: {
          destination?: string
          id?: string
          needs_removal?: boolean
          notes?: string | null
          photo_id?: string
          published_at?: string
          published_by?: string | null
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_photo_usage_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "session_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      session_photos: {
        Row: {
          background_checked: boolean
          content_tags: string[]
          created_at: string
          derivative_of: string | null
          faces_detected_at: string | null
          id: string
          identifiable: boolean
          is_derivative: boolean
          quality: number | null
          r2_key: string
          session_id: string
          taken_at: string | null
        }
        Insert: {
          background_checked?: boolean
          content_tags?: string[]
          created_at?: string
          derivative_of?: string | null
          faces_detected_at?: string | null
          id?: string
          identifiable?: boolean
          is_derivative?: boolean
          quality?: number | null
          r2_key: string
          session_id: string
          taken_at?: string | null
        }
        Update: {
          background_checked?: boolean
          content_tags?: string[]
          created_at?: string
          derivative_of?: string | null
          faces_detected_at?: string | null
          id?: string
          identifiable?: boolean
          is_derivative?: boolean
          quality?: number | null
          r2_key?: string
          session_id?: string
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_photos_derivative_of_fkey"
            columns: ["derivative_of"]
            isOneToOne: false
            referencedRelation: "session_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_photos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reviews: {
        Row: {
          built_text: string | null
          completed_at: string | null
          completion: string | null
          device_context: string | null
          difficulty: string | null
          enjoyment: number | null
          hold_status: string
          id: string
          open_text: string | null
          released_at: string | null
          released_by: string | null
          session_id: string
          student_id: string
          submitted_at: string
          wants_more: string | null
        }
        Insert: {
          built_text?: string | null
          completed_at?: string | null
          completion?: string | null
          device_context?: string | null
          difficulty?: string | null
          enjoyment?: number | null
          hold_status?: string
          id?: string
          open_text?: string | null
          released_at?: string | null
          released_by?: string | null
          session_id: string
          student_id: string
          submitted_at?: string
          wants_more?: string | null
        }
        Update: {
          built_text?: string | null
          completed_at?: string | null
          completion?: string | null
          device_context?: string | null
          difficulty?: string | null
          enjoyment?: number | null
          hold_status?: string
          id?: string
          open_text?: string | null
          released_at?: string | null
          released_by?: string | null
          session_id?: string
          student_id?: string
          submitted_at?: string
          wants_more?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reviews_educator: {
        Row: {
          attendance_actual: number | null
          curriculum_notes: string | null
          educator_name: string | null
          excelled_student_ids: string[] | null
          failures_text: string | null
          id: string
          media_captured: boolean
          media_count: number | null
          session_id: string
          struggled_student_ids: string[] | null
          submitted_at: string
          timing: string | null
        }
        Insert: {
          attendance_actual?: number | null
          curriculum_notes?: string | null
          educator_name?: string | null
          excelled_student_ids?: string[] | null
          failures_text?: string | null
          id?: string
          media_captured?: boolean
          media_count?: number | null
          session_id: string
          struggled_student_ids?: string[] | null
          submitted_at?: string
          timing?: string | null
        }
        Update: {
          attendance_actual?: number | null
          curriculum_notes?: string | null
          educator_name?: string | null
          excelled_student_ids?: string[] | null
          failures_text?: string | null
          id?: string
          media_captured?: boolean
          media_count?: number | null
          session_id?: string
          struggled_student_ids?: string[] | null
          submitted_at?: string
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_reviews_educator_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          capacity: number | null
          cost_centre_id: string | null
          created_at: string
          currency: string
          early_bird_ends_at: string | null
          ends_at: string | null
          go_no_go_at: string | null
          id: string
          min_viable_enrolments: number | null
          notes: string | null
          parent_session_id: string | null
          price: number | null
          programme_id: string
          sales_close_at: string | null
          sales_open_at: string | null
          starts_at: string | null
          status: string
          venue: string | null
          venue_id: string | null
        }
        Insert: {
          capacity?: number | null
          cost_centre_id?: string | null
          created_at?: string
          currency?: string
          early_bird_ends_at?: string | null
          ends_at?: string | null
          go_no_go_at?: string | null
          id?: string
          min_viable_enrolments?: number | null
          notes?: string | null
          parent_session_id?: string | null
          price?: number | null
          programme_id: string
          sales_close_at?: string | null
          sales_open_at?: string | null
          starts_at?: string | null
          status?: string
          venue?: string | null
          venue_id?: string | null
        }
        Update: {
          capacity?: number | null
          cost_centre_id?: string | null
          created_at?: string
          currency?: string
          early_bird_ends_at?: string | null
          ends_at?: string | null
          go_no_go_at?: string | null
          id?: string
          min_viable_enrolments?: number | null
          notes?: string | null
          parent_session_id?: string | null
          price?: number | null
          programme_id?: string
          sales_close_at?: string | null
          sales_open_at?: string | null
          starts_at?: string | null
          status?: string
          venue?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_cost_centre_id_fkey"
            columns: ["cost_centre_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_questions: {
        Row: {
          correct_answer: string
          created_at: string | null
          difficulty: number
          id: string
          level: number
          module_id: string
          options: Json
          prompt: string
          updated_at: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          difficulty: number
          id?: string
          level: number
          module_id: string
          options?: Json
          prompt: string
          updated_at?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          difficulty?: number
          id?: string
          level?: number
          module_id?: string
          options?: Json
          prompt?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          awarded_at: string
          badge_id: number
          id: number
          meta: Json | null
          source_course_id: string | null
          source_lesson_id: number | null
          source_type: string | null
          student_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: number
          id?: never
          meta?: Json | null
          source_course_id?: string | null
          source_lesson_id?: number | null
          source_type?: string | null
          student_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: number
          id?: never
          meta?: Json | null
          source_course_id?: string | null
          source_lesson_id?: number | null
          source_type?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_source_lesson_id_fkey"
            columns: ["source_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_xp_transactions: {
        Row: {
          action_key: string
          awarded_at: string
          client_event_id: string | null
          created_at: string
          id: number
          metadata: Json
          rule_id: number | null
          source_badge_id: number | null
          source_course_id: string | null
          source_lesson_id: number | null
          source_section_id: number | null
          source_type: string
          streak_star_delta: number
          student_id: string
          week_start_date: string | null
          xp_delta: number
        }
        Insert: {
          action_key: string
          awarded_at?: string
          client_event_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          rule_id?: number | null
          source_badge_id?: number | null
          source_course_id?: string | null
          source_lesson_id?: number | null
          source_section_id?: number | null
          source_type: string
          streak_star_delta?: number
          student_id: string
          week_start_date?: string | null
          xp_delta?: number
        }
        Update: {
          action_key?: string
          awarded_at?: string
          client_event_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          rule_id?: number | null
          source_badge_id?: number | null
          source_course_id?: string | null
          source_lesson_id?: number | null
          source_section_id?: number | null
          source_type?: string
          streak_star_delta?: number
          student_id?: string
          week_start_date?: string | null
          xp_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_xp_transactions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "xp_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_xp_transactions_source_badge_id_fkey"
            columns: ["source_badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_xp_transactions_source_course_id_fkey"
            columns: ["source_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_xp_transactions_source_lesson_id_fkey"
            columns: ["source_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_xp_transactions_source_section_id_fkey"
            columns: ["source_section_id"]
            isOneToOne: false
            referencedRelation: "lesson_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_xp_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_xp_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_xp_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_xp_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          linked_parent_id: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          linked_parent_id?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "admin_parent_overview"
            referencedColumns: ["parent_id"]
          },
          {
            foreignKeyName: "students_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string | null
          delivery_type: string | null
          id: string
          internal_notes: string | null
          location: string | null
          name: string
          rating: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_type?: string | null
          id?: string
          internal_notes?: string | null
          location?: string | null
          name: string
          rating?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_type?: string | null
          id?: string
          internal_notes?: string | null
          location?: string | null
          name?: string
          rating?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      system_checklist_items: {
        Row: {
          id: string
          label: string
          notes: string | null
          sort_order: number
          state: string
          system_key: string
          updated_at: string
        }
        Insert: {
          id?: string
          label: string
          notes?: string | null
          sort_order?: number
          state?: string
          system_key: string
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          notes?: string | null
          sort_order?: number
          state?: string
          system_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_checklist_items_system_key_fkey"
            columns: ["system_key"]
            isOneToOne: false
            referencedRelation: "systems_status"
            referencedColumns: ["key"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: number
          xp_end_date: string | null
          xp_multiplier: number | null
          xp_start_date: string | null
        }
        Insert: {
          id?: number
          xp_end_date?: string | null
          xp_multiplier?: number | null
          xp_start_date?: string | null
        }
        Update: {
          id?: number
          xp_end_date?: string | null
          xp_multiplier?: number | null
          xp_start_date?: string | null
        }
        Relationships: []
      }
      systems_status: {
        Row: {
          id: string
          key: string
          priority_tier: string
          purpose: string
          sort_order: number
          title: string
        }
        Insert: {
          id?: string
          key: string
          priority_tier: string
          purpose: string
          sort_order?: number
          title: string
        }
        Update: {
          id?: string
          key?: string
          priority_tier?: string
          purpose?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      teacher_availability: {
        Row: {
          booked_by: string | null
          created_at: string | null
          delivery_mode: string
          end_time: string
          id: string
          is_booked: boolean
          start_time: string
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          booked_by?: string | null
          created_at?: string | null
          delivery_mode?: string
          end_time: string
          id?: string
          is_booked?: boolean
          start_time: string
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          booked_by?: string | null
          created_at?: string | null
          delivery_mode?: string
          end_time?: string
          id?: string
          is_booked?: boolean
          start_time?: string
          student_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_availability_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_availability_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      teacher_schedule: {
        Row: {
          day_of_week: string
          delivery_mode: string | null
          id: string
          slot_type: string | null
          status: string | null
          student_id: string | null
          student_ids: Json | null
          teacher_id: string | null
          time_slot: string
        }
        Insert: {
          day_of_week: string
          delivery_mode?: string | null
          id?: string
          slot_type?: string | null
          status?: string | null
          student_id?: string | null
          student_ids?: Json | null
          teacher_id?: string | null
          time_slot: string
        }
        Update: {
          day_of_week?: string
          delivery_mode?: string | null
          id?: string
          slot_type?: string | null
          status?: string | null
          student_id?: string | null
          student_ids?: Json | null
          teacher_id?: string | null
          time_slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      tech_archive: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          media_url: string | null
          mission_id: string | null
          objective_met: boolean | null
          potential_xp: number | null
          required_level: number | null
          review_status: string | null
          score: number | null
          status: string | null
          student_id: string | null
          teacher_feedback: string | null
          teacher_xp_awarded: number | null
          technical_detail: string | null
          title: string
          type: string
          win_condition: string | null
          xp_earned: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          media_url?: string | null
          mission_id?: string | null
          objective_met?: boolean | null
          potential_xp?: number | null
          required_level?: number | null
          review_status?: string | null
          score?: number | null
          status?: string | null
          student_id?: string | null
          teacher_feedback?: string | null
          teacher_xp_awarded?: number | null
          technical_detail?: string | null
          title: string
          type: string
          win_condition?: string | null
          xp_earned?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          media_url?: string | null
          mission_id?: string | null
          objective_met?: boolean | null
          potential_xp?: number | null
          required_level?: number | null
          review_status?: string | null
          score?: number | null
          status?: string | null
          student_id?: string | null
          teacher_feedback?: string | null
          teacher_xp_awarded?: number | null
          technical_detail?: string | null
          title?: string
          type?: string
          win_condition?: string | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tech_archive_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_archive_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_archive_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_archive_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      testimonials: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          consent_verified: boolean
          created_at: string
          display_age: number | null
          display_month: string | null
          display_programme: string | null
          id: string
          quote_text: string
          session_id: string | null
          source_review_id: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          consent_verified?: boolean
          created_at?: string
          display_age?: number | null
          display_month?: string | null
          display_programme?: string | null
          id?: string
          quote_text: string
          session_id?: string | null
          source_review_id?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          consent_verified?: boolean
          created_at?: string
          display_age?: number | null
          display_month?: string | null
          display_programme?: string | null
          id?: string
          quote_text?: string
          session_id?: string | null
          source_review_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_source_review_id_fkey"
            columns: ["source_review_id"]
            isOneToOne: false
            referencedRelation: "session_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          created_at: string | null
          first_name: string
          grade: string
          id: string
          prospect_id: string | null
          score: number
          team_name: string | null
        }
        Insert: {
          created_at?: string | null
          first_name: string
          grade: string
          id?: string
          prospect_id?: string | null
          score?: number
          team_name?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string
          grade?: string
          id?: string
          prospect_id?: string | null
          score?: number
          team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_prospect"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_submissions: {
        Row: {
          bonus_xp: number | null
          group_names: string | null
          id: string
          mission_id: string | null
          share_url: string
          status: string | null
          student_id: string
          submitted_at: string | null
          tutorial_id: string | null
          win_index: number | null
          xp_earned: number | null
        }
        Insert: {
          bonus_xp?: number | null
          group_names?: string | null
          id?: string
          mission_id?: string | null
          share_url: string
          status?: string | null
          student_id: string
          submitted_at?: string | null
          tutorial_id?: string | null
          win_index?: number | null
          xp_earned?: number | null
        }
        Update: {
          bonus_xp?: number | null
          group_names?: string | null
          id?: string
          mission_id?: string | null
          share_url?: string
          status?: string | null
          student_id?: string
          submitted_at?: string | null
          tutorial_id?: string | null
          win_index?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_submissions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutorial_submissions_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "makecode_tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      uplink_challenges: {
        Row: {
          code_snippets: Json | null
          correct_answer: string | null
          correct_sequence: Json | null
          created_at: string | null
          hint_text: string | null
          id: string
          mission_id: string | null
          options: Json | null
          question_text: string
          type: string
        }
        Insert: {
          code_snippets?: Json | null
          correct_answer?: string | null
          correct_sequence?: Json | null
          created_at?: string | null
          hint_text?: string | null
          id?: string
          mission_id?: string | null
          options?: Json | null
          question_text: string
          type: string
        }
        Update: {
          code_snippets?: Json | null
          correct_answer?: string | null
          correct_sequence?: Json | null
          created_at?: string | null
          hint_text?: string | null
          id?: string
          mission_id?: string | null
          options?: Json | null
          question_text?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "uplink_challenges_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          maps_url: string | null
          name: string
          notes: string | null
          type: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          maps_url?: string | null
          name: string
          notes?: string | null
          type?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          maps_url?: string | null
          name?: string
          notes?: string | null
          type?: string
        }
        Relationships: []
      }
      voucher_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          note: string | null
          source_value: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          note?: string | null
          source_value: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          note?: string | null
          source_value?: string
        }
        Relationships: []
      }
      warm_list_staging: {
        Row: {
          added_manually: boolean
          children_notes: string | null
          committed_at: string | null
          contact_method: string
          created_at: string
          email: string | null
          first_seen: string | null
          id: string
          kids_count: number | null
          last_seen: string | null
          location: string | null
          name: string | null
          phone: string | null
          review_note: string | null
          review_status: string
          source: string
          sources: string | null
          status_category: string
          status_labels: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          added_manually?: boolean
          children_notes?: string | null
          committed_at?: string | null
          contact_method?: string
          created_at?: string
          email?: string | null
          first_seen?: string | null
          id?: string
          kids_count?: number | null
          last_seen?: string | null
          location?: string | null
          name?: string | null
          phone?: string | null
          review_note?: string | null
          review_status?: string
          source?: string
          sources?: string | null
          status_category?: string
          status_labels?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          added_manually?: boolean
          children_notes?: string | null
          committed_at?: string | null
          contact_method?: string
          created_at?: string
          email?: string | null
          first_seen?: string | null
          id?: string
          kids_count?: number | null
          last_seen?: string | null
          location?: string | null
          name?: string | null
          phone?: string | null
          review_note?: string | null
          review_status?: string
          source?: string
          sources?: string | null
          status_category?: string
          status_labels?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events_seen: {
        Row: {
          received_at: string
          wa_message_id: string
        }
        Insert: {
          received_at?: string
          wa_message_id: string
        }
        Update: {
          received_at?: string
          wa_message_id?: string
        }
        Relationships: []
      }
      xp_logs: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string | null
          student_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string | null
          student_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      xp_rules: {
        Row: {
          action_key: string
          category: string
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          metadata: Json
          streak_star_value: number
          updated_at: string
          xp_value: number
        }
        Insert: {
          action_key: string
          category: string
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          metadata?: Json
          streak_star_value?: number
          updated_at?: string
          xp_value?: number
        }
        Update: {
          action_key?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          metadata?: Json
          streak_star_value?: number
          updated_at?: string
          xp_value?: number
        }
        Relationships: []
      }
    }
    Views: {
      admin_parent_overview: {
        Row: {
          parent_email: string | null
          parent_id: string | null
          parent_name: string | null
          student_count: number | null
          student_names: string | null
        }
        Insert: {
          parent_email?: string | null
          parent_id?: string | null
          parent_name?: string | null
          student_count?: never
          student_names?: never
        }
        Update: {
          parent_email?: string | null
          parent_id?: string | null
          parent_name?: string | null
          student_count?: never
          student_names?: never
        }
        Relationships: []
      }
      last_month_stats: {
        Row: {
          student_id: string | null
          xp_earned: number | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      last_week_stats: {
        Row: {
          student_id: string | null
          xp_earned: number | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      onboarding_status: {
        Row: {
          display_name: string | null
          id: string | null
          is_locked: boolean | null
          student_identifier: string | null
          temp_entry_pin: string | null
        }
        Insert: {
          display_name?: string | null
          id?: string | null
          is_locked?: boolean | null
          student_identifier?: string | null
          temp_entry_pin?: string | null
        }
        Update: {
          display_name?: string | null
          id?: string | null
          is_locked?: boolean | null
          student_identifier?: string | null
          temp_entry_pin?: string | null
        }
        Relationships: []
      }
      parent_financial_dashboard_view: {
        Row: {
          account_tier: string | null
          avg_days_to_pay: number | null
          children_count: number | null
          created_at: string | null
          display_name: string | null
          funnel_stage: string | null
          has_linked_parent: boolean | null
          id: string | null
          linked_parent_id: string | null
          metadata: Json | null
          months_active: number | null
          outstanding: number | null
          show_welcome_guide: boolean | null
          status: string | null
          tc_accepted_version: string | null
          total_profit: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      squad_leaderboard: {
        Row: {
          member_count: number | null
          squad_name: string | null
          total_xp: number | null
        }
        Relationships: []
      }
      student_active_tiers: {
        Row: {
          active_tier: string | null
          display_name: string | null
          linked_parent_id: string | null
          student_id: string | null
          trial_expires_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "onboarding_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "parent_financial_dashboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_parent_id_fkey"
            columns: ["linked_parent_id"]
            isOneToOne: false
            referencedRelation: "student_active_tiers"
            referencedColumns: ["student_id"]
          },
        ]
      }
      support_queue: {
        Row: {
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: number | null
          queue_type: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_name: string | null
          status: string | null
          student_name: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      teacher_review_queue: {
        Row: {
          group_names: string | null
          share_url: string | null
          status: string | null
          student_id: string | null
          submission_id: string | null
          submitted_at: string | null
          tutorial_title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_xp_multiplier: { Args: { user_id: string }; Returns: number }
      merge_leads: {
        Args: { p_fields: Json; p_loser_id: string; p_survivor_id: string }
        Returns: undefined
      }
    }
    Enums: {
      booking_status: "Pending" | "Confirmed" | "Moved to Next Month"
      session_status:
        | "Draft"
        | "Pending Teacher"
        | "Pending Admin Reassignment"
        | "Pending Admin Link"
        | "Confirmed & Dispatched"
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
      booking_status: ["Pending", "Confirmed", "Moved to Next Month"],
      session_status: [
        "Draft",
        "Pending Teacher",
        "Pending Admin Reassignment",
        "Pending Admin Link",
        "Confirmed & Dispatched",
      ],
    },
  },
} as const
