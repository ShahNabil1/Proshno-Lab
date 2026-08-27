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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          client_timestamp: string | null
          created_at: string
          event_name: string
          id: number
          ip_address: string | null
          page_path: string | null
          page_url: string | null
          params: Json | null
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          client_timestamp?: string | null
          created_at?: string
          event_name: string
          id?: number
          ip_address?: string | null
          page_path?: string | null
          page_url?: string | null
          params?: Json | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          client_timestamp?: string | null
          created_at?: string
          event_name?: string
          id?: number
          ip_address?: string | null
          page_path?: string | null
          page_url?: string | null
          params?: Json | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          priority: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: never
          is_active?: boolean
          priority?: number
          text: string
        }
        Update: {
          created_at?: string
          id?: never
          is_active?: boolean
          priority?: number
          text?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      bkash_payments: {
        Row: {
          amount: number
          bkash_response: Json | null
          coupon_code: string | null
          created_at: string
          customer_msisdn: string | null
          discount: number
          environment: string
          error_message: string | null
          id: number
          institute_name: string | null
          merchant_invoice_number: string
          payer_account: string | null
          payer_reference: string | null
          payment_id: string | null
          selected_packages: Json
          status: string
          teacher_email: string | null
          teacher_name: string | null
          trx_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bkash_response?: Json | null
          coupon_code?: string | null
          created_at?: string
          customer_msisdn?: string | null
          discount?: number
          environment?: string
          error_message?: string | null
          id?: number
          institute_name?: string | null
          merchant_invoice_number: string
          payer_account?: string | null
          payer_reference?: string | null
          payment_id?: string | null
          selected_packages?: Json
          status?: string
          teacher_email?: string | null
          teacher_name?: string | null
          trx_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bkash_response?: Json | null
          coupon_code?: string | null
          created_at?: string
          customer_msisdn?: string | null
          discount?: number
          environment?: string
          error_message?: string | null
          id?: number
          institute_name?: string | null
          merchant_invoice_number?: string
          payer_account?: string | null
          payer_reference?: string | null
          payment_id?: string | null
          selected_packages?: Json
          status?: string
          teacher_email?: string | null
          teacher_name?: string | null
          trx_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          is_free: boolean
          name: string
          subject_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          is_free?: boolean
          name: string
          subject_id: number
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          is_free?: boolean
          name?: string
          subject_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          applicable_packages: string[] | null
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: number
          is_active: boolean
          max_discount: number | null
          min_purchase: number
          use_limit: number | null
          used_count: number
        }
        Insert: {
          applicable_packages?: string[] | null
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: number
          is_active?: boolean
          max_discount?: number | null
          min_purchase?: number
          use_limit?: number | null
          used_count?: number
        }
        Update: {
          applicable_packages?: string[] | null
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: number
          is_active?: boolean
          max_discount?: number | null
          min_purchase?: number
          use_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string
          details: string
          id: number
          priority: string
          status: string
          subject: string
          teacher_id: string
        }
        Insert: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          details?: string
          id?: number
          priority?: string
          status?: string
          subject?: string
          teacher_id: string
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          details?: string
          id?: number
          priority?: string
          status?: string
          subject?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      institutes: {
        Row: {
          created_at: string
          district: string | null
          division: string | null
          id: number
          last_edited_at: string | null
          name: string
          owner_id: string
          phone: string | null
          specific_address: string | null
          upazila: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          district?: string | null
          division?: string | null
          id?: number
          last_edited_at?: string | null
          name?: string
          owner_id: string
          phone?: string | null
          specific_address?: string | null
          upazila?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          district?: string | null
          division?: string | null
          id?: number
          last_edited_at?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          specific_address?: string | null
          upazila?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_packages: {
        Row: {
          class_name: string
          created_at: string
          id: number
          is_active: boolean
          is_coming_soon: boolean
          price: number
          sort_order: number
          subject_name: string
          type: string
        }
        Insert: {
          class_name: string
          created_at?: string
          id?: never
          is_active?: boolean
          is_coming_soon?: boolean
          price: number
          sort_order?: number
          subject_name?: string
          type?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          id?: never
          is_active?: boolean
          is_coming_soon?: boolean
          price?: number
          sort_order?: number
          subject_name?: string
          type?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          admin_note: string | null
          coupon_code: string | null
          created_at: string
          discount: number
          id: number
          institute_name: string
          package_classes: string
          package_name: string
          package_price: number
          payment_method: string
          reviewed_at: string | null
          selected_packages: Json | null
          status: string
          teacher_email: string
          teacher_id: string | null
          teacher_name: string
          teacher_phone: string
          total_price: number
          transaction_id: string
        }
        Insert: {
          admin_note?: string | null
          coupon_code?: string | null
          created_at?: string
          discount?: number
          id?: number
          institute_name?: string
          package_classes?: string
          package_name?: string
          package_price?: number
          payment_method?: string
          reviewed_at?: string | null
          selected_packages?: Json | null
          status?: string
          teacher_email?: string
          teacher_id?: string | null
          teacher_name?: string
          teacher_phone?: string
          total_price?: number
          transaction_id?: string
        }
        Update: {
          admin_note?: string | null
          coupon_code?: string | null
          created_at?: string
          discount?: number
          id?: number
          institute_name?: string
          package_classes?: string
          package_name?: string
          package_price?: number
          payment_method?: string
          reviewed_at?: string | null
          selected_packages?: Json | null
          status?: string
          teacher_email?: string
          teacher_id?: string | null
          teacher_name?: string
          teacher_phone?: string
          total_price?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      question_categories: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      question_reports: {
        Row: {
          admin_reply: string | null
          comment: string
          created_at: string
          error_type: string
          id: number
          question_id: number
          resolved_at: string | null
          status: string
          teacher_id: string
        }
        Insert: {
          admin_reply?: string | null
          comment?: string
          created_at?: string
          error_type?: string
          id?: never
          question_id: number
          resolved_at?: string | null
          status?: string
          teacher_id: string
        }
        Update: {
          admin_reply?: string | null
          comment?: string
          created_at?: string
          error_type?: string
          id?: never
          question_id?: number
          resolved_at?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_reports_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          board_references: Json | null
          category_id: number | null
          chapter_id: number
          class_id: number
          correct_answer: string | null
          created_at: string
          creative_data: Json | null
          explanation: string | null
          id: number
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          question: string
          stimulus_group_id: string | null
          stimulus_text: string | null
          subject_id: number
          teacher_id: string
          topic_id: number | null
          type: string
          university_references: Json | null
        }
        Insert: {
          board_references?: Json | null
          category_id?: number | null
          chapter_id: number
          class_id: number
          correct_answer?: string | null
          created_at?: string
          creative_data?: Json | null
          explanation?: string | null
          id?: number
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question: string
          stimulus_group_id?: string | null
          stimulus_text?: string | null
          subject_id: number
          teacher_id: string
          topic_id?: number | null
          type?: string
          university_references?: Json | null
        }
        Update: {
          board_references?: Json | null
          category_id?: number | null
          chapter_id?: number
          class_id?: number
          correct_answer?: string | null
          created_at?: string
          creative_data?: Json | null
          explanation?: string | null
          id?: number
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question?: string
          stimulus_group_id?: string | null
          stimulus_text?: string | null
          subject_id?: number
          teacher_id?: string
          topic_id?: number | null
          type?: string
          university_references?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          designation: string
          id: number
          image_url: string | null
          institution: string
          name: string
          rating: number
          status: string
          teacher_id: string | null
          text: string
        }
        Insert: {
          created_at?: string
          designation?: string
          id?: never
          image_url?: string | null
          institution?: string
          name: string
          rating?: number
          status?: string
          teacher_id?: string | null
          text: string
        }
        Update: {
          created_at?: string
          designation?: string
          id?: never
          image_url?: string | null
          institution?: string
          name?: string
          rating?: number
          status?: string
          teacher_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_papers: {
        Row: {
          chapter_names: string[]
          class_name: string
          created_at: string
          exam_name: string
          id: string
          institution_name: string
          meta: Json
          question_ids: number[]
          settings: Json
          subject_name: string
          teacher_id: string
        }
        Insert: {
          chapter_names?: string[]
          class_name?: string
          created_at?: string
          exam_name?: string
          id?: string
          institution_name?: string
          meta?: Json
          question_ids?: number[]
          settings?: Json
          subject_name?: string
          teacher_id: string
        }
        Update: {
          chapter_names?: string[]
          class_name?: string
          created_at?: string
          exam_name?: string
          id?: string
          institution_name?: string
          meta?: Json
          question_ids?: number[]
          settings?: Json
          subject_name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          class_id: number
          created_at: string
          id: number
          name: string
          subject_code: string | null
        }
        Insert: {
          class_id: number
          created_at?: string
          id?: number
          name: string
          subject_code?: string | null
        }
        Update: {
          class_id?: number
          created_at?: string
          id?: number
          name?: string
          subject_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          bkash_payment_id: number | null
          created_at: string
          ends_at: string | null
          id: number
          plan: string
          starts_at: string | null
          status: string
          teacher_id: string
        }
        Insert: {
          bkash_payment_id?: number | null
          created_at?: string
          ends_at?: string | null
          id?: number
          plan?: string
          starts_at?: string | null
          status?: string
          teacher_id: string
        }
        Update: {
          bkash_payment_id?: number | null
          created_at?: string
          ends_at?: string | null
          id?: number
          plan?: string
          starts_at?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_bkash_payment_id_fkey"
            columns: ["bkash_payment_id"]
            isOneToOne: false
            referencedRelation: "bkash_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_assignments: {
        Row: {
          created_at: string
          id: number
          package_id: number
          suggestion_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          package_id: number
          suggestion_id: number
        }
        Update: {
          created_at?: string
          id?: never
          package_id?: number
          suggestion_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_assignments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "pricing_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_assignments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          class_id: number
          created_at: string
          description: string
          id: number
          is_active: boolean
          question_ids: number[]
          subject_id: number
          title: string
          updated_at: string
        }
        Insert: {
          class_id: number
          created_at?: string
          description?: string
          id?: never
          is_active?: boolean
          question_ids?: number[]
          subject_id: number
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: number
          created_at?: string
          description?: string
          id?: never
          is_active?: boolean
          question_ids?: number[]
          subject_id?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_banned: boolean
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_banned?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_banned?: boolean
        }
        Relationships: []
      }
      topics: {
        Row: {
          chapter_id: number
          created_at: string
          id: number
          name: string
        }
        Insert: {
          chapter_id: number
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          chapter_id?: number
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          class_id: number
          created_at: string
          id: number
          subject_id: number
          user_id: string
        }
        Insert: {
          class_id: number
          created_at?: string
          id?: number
          subject_id: number
          user_id: string
        }
        Update: {
          class_id?: number
          created_at?: string
          id?: number
          subject_id?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          allowed_pages: string[] | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          allowed_pages?: string[] | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          allowed_pages?: string[] | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      can_read_question: {
        Args: { _class_id: number; _subject_id: number }
        Returns: boolean
      }
      extract_class_levels: { Args: { value: string }; Returns: number[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { coupon_code: string }
        Returns: undefined
      }
      normalize_subscription_text: { Args: { value: string }; Returns: string }
      plan_covers_selection: {
        Args: { class_name: string; plan: string; subject_name: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "developer"
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
      app_role: ["admin", "user", "developer"],
    },
  },
} as const
