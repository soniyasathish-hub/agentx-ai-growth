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
      action_history: {
        Row: {
          action_id: string
          business_id: string
          created_at: string
          history_id: string
          new_status: string
          performed_by: string | null
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          action_id: string
          business_id: string
          created_at?: string
          history_id?: string
          new_status: string
          performed_by?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          action_id?: string
          business_id?: string
          created_at?: string
          history_id?: string
          new_status?: string
          performed_by?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_history_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "autonomous_actions"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "action_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_id"]
          },
        ]
      }
      autonomous_actions: {
        Row: {
          action_id: string
          action_type: string
          approved_at: string | null
          block_reason: string | null
          blocked_at: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          discount_percent: number
          dismissed: boolean
          estimated_opportunity: number
          executed_at: string | null
          margin_percent: number
          new_price: number | null
          performed_by: string | null
          previous_price: number | null
          price_change_percent: number
          priority: string
          product_id: string | null
          reason: string
          rejected_at: string | null
          status: string
        }
        Insert: {
          action_id?: string
          action_type: string
          approved_at?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          discount_percent?: number
          dismissed?: boolean
          estimated_opportunity?: number
          executed_at?: string | null
          margin_percent?: number
          new_price?: number | null
          performed_by?: string | null
          previous_price?: number | null
          price_change_percent?: number
          priority?: string
          product_id?: string | null
          reason: string
          rejected_at?: string | null
          status?: string
        }
        Update: {
          action_id?: string
          action_type?: string
          approved_at?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          discount_percent?: number
          dismissed?: boolean
          estimated_opportunity?: number
          executed_at?: string | null
          margin_percent?: number
          new_price?: number | null
          performed_by?: string | null
          previous_price?: number | null
          price_change_percent?: number
          priority?: string
          product_id?: string | null
          reason?: string
          rejected_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_actions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "autonomous_actions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "autonomous_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_id: string
          business_name: string
          created_at: string
          email: string
          owner_name: string
        }
        Insert: {
          business_id?: string
          business_name: string
          created_at?: string
          email: string
          owner_name: string
        }
        Update: {
          business_id?: string
          business_name?: string
          created_at?: string
          email?: string
          owner_name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          email: string
          name: string
          phone: string | null
          total_spent: number
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string
          email: string
          name: string
          phone?: string | null
          total_spent?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          email?: string
          name?: string
          phone?: string | null
          total_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string
          category: string
          cost: number
          created_at: string
          price: number
          product_id: string
          product_name: string
          stock: number
          updated_at: string
        }
        Insert: {
          business_id: string
          category: string
          cost: number
          created_at?: string
          price: number
          product_id?: string
          product_name: string
          stock?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string
          cost?: number
          created_at?: string
          price?: number
          product_id?: string
          product_name?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_id"]
          },
        ]
      }
      retention_offers: {
        Row: {
          action_id: string
          business_id: string
          created_at: string
          customer_id: string | null
          discount_percent: number
          estimated_opportunity: number
          expires_at: string
          offer_id: string
          updated_at: string
        }
        Insert: {
          action_id: string
          business_id: string
          created_at?: string
          customer_id?: string | null
          discount_percent?: number
          estimated_opportunity?: number
          expires_at?: string
          offer_id?: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          business_id?: string
          created_at?: string
          customer_id?: string | null
          discount_percent?: number
          estimated_opportunity?: number
          expires_at?: string
          offer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_offers_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "autonomous_actions"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "retention_offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "retention_offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      sales: {
        Row: {
          business_id: string
          customer_id: string | null
          product_id: string | null
          quantity: number
          sale_date: string
          sale_id: string
          total_amount: number
          unit_price: number
        }
        Insert: {
          business_id: string
          customer_id?: string | null
          product_id?: string | null
          quantity: number
          sale_date?: string
          sale_id?: string
          total_amount: number
          unit_price: number
        }
        Update: {
          business_id?: string
          customer_id?: string | null
          product_id?: string | null
          quantity?: number
          sale_date?: string
          sale_id?: string
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      users: {
        Row: {
          business_id: string
          created_at: string
          email: string
          name: string
          password_hash: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          name: string
          password_hash?: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          name?: string
          password_hash?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_business_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
