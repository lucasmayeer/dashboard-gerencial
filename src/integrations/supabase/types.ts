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
      commission_plans: {
        Row: {
          active: boolean | null
          amount: number
          created_at: string | null
          plan_id: number
          plan_name: string
          plan_type: Database["public"]["Enums"]["plan_type"] | null
        }
        Insert: {
          active?: boolean | null
          amount?: number
          created_at?: string | null
          plan_id: number
          plan_name: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          created_at?: string | null
          plan_id?: number
          plan_name?: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
        }
        Relationships: []
      }
      commissions_report: {
        Row: {
          achieved: number | null
          active: boolean | null
          amount: number
          commission: number | null
          created_at: string | null
          date_from: string
          forecast: number | null
          id: number
          manager_id: number | null
          manager_name: string | null
          plan_id: number | null
          plan_name: string
          plan_type: Database["public"]["Enums"]["plan_type"] | null
          skip_record: boolean | null
          target_amount: number | null
          team_id: number
          team_name: string | null
          team_type: string | null
          user_id: number
          user_name: string | null
        }
        Insert: {
          achieved?: number | null
          active?: boolean | null
          amount?: number
          commission?: number | null
          created_at?: string | null
          date_from: string
          forecast?: number | null
          id?: number
          manager_id?: number | null
          manager_name?: string | null
          plan_id?: number | null
          plan_name: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          skip_record?: boolean | null
          target_amount?: number | null
          team_id?: number
          team_name?: string | null
          team_type?: string | null
          user_id: number
          user_name?: string | null
        }
        Update: {
          achieved?: number | null
          active?: boolean | null
          amount?: number
          commission?: number | null
          created_at?: string | null
          date_from?: string
          forecast?: number | null
          id?: number
          manager_id?: number | null
          manager_name?: string | null
          plan_id?: number | null
          plan_name?: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          skip_record?: boolean | null
          target_amount?: number | null
          team_id?: number
          team_name?: string | null
          team_type?: string | null
          user_id?: number
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_plan"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "fk_report_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "res_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_report_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sales_team"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "fk_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "res_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lov_cleaning_entries: {
        Row: {
          categoria: string | null
          colaborador: string | null
          created_at: string
          data: string | null
          entrou: string | null
          external_id: string
          hrs_trabalhadas: string | null
          id: string
          informacoes: string | null
          passagem: number | null
          saiu: string | null
          semana: string | null
          synced_at: string | null
          valor: number | null
        }
        Insert: {
          categoria?: string | null
          colaborador?: string | null
          created_at?: string
          data?: string | null
          entrou?: string | null
          external_id: string
          hrs_trabalhadas?: string | null
          id?: string
          informacoes?: string | null
          passagem?: number | null
          saiu?: string | null
          semana?: string | null
          synced_at?: string | null
          valor?: number | null
        }
        Update: {
          categoria?: string | null
          colaborador?: string | null
          created_at?: string
          data?: string | null
          entrou?: string | null
          external_id?: string
          hrs_trabalhadas?: string | null
          id?: string
          informacoes?: string | null
          passagem?: number | null
          saiu?: string | null
          semana?: string | null
          synced_at?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      lov_commission_plans: {
        Row: {
          amount: number | null
          created_at: string
          external_id: string
          id: string
          plan_name: string | null
          synced_at: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          external_id: string
          id?: string
          plan_name?: string | null
          synced_at?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          external_id?: string
          id?: string
          plan_name?: string | null
          synced_at?: string | null
          type?: string | null
        }
        Relationships: []
      }
      lov_equipment: {
        Row: {
          categoria: string | null
          created_at: string
          custo: number | null
          external_id: string
          funcionario: string | null
          id: string
          modelo: string | null
          nome_equipamento: string
          numero_serie: string | null
          synced_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          custo?: number | null
          external_id: string
          funcionario?: string | null
          id?: string
          modelo?: string | null
          nome_equipamento: string
          numero_serie?: string | null
          synced_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          custo?: number | null
          external_id?: string
          funcionario?: string | null
          id?: string
          modelo?: string | null
          nome_equipamento?: string
          numero_serie?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      lov_limpeza: {
        Row: {
          categoria: string | null
          colaborador: string | null
          created_at: string
          data: string | null
          entrou: string | null
          external_id: string
          hrs_trabalhadas: number | null
          id: string
          informacoes: string | null
          passagem: number | null
          saiu: string | null
          semana: string | null
          synced_at: string | null
          valor: number | null
        }
        Insert: {
          categoria?: string | null
          colaborador?: string | null
          created_at?: string
          data?: string | null
          entrou?: string | null
          external_id: string
          hrs_trabalhadas?: number | null
          id?: string
          informacoes?: string | null
          passagem?: number | null
          saiu?: string | null
          semana?: string | null
          synced_at?: string | null
          valor?: number | null
        }
        Update: {
          categoria?: string | null
          colaborador?: string | null
          created_at?: string
          data?: string | null
          entrou?: string | null
          external_id?: string
          hrs_trabalhadas?: number | null
          id?: string
          informacoes?: string | null
          passagem?: number | null
          saiu?: string | null
          semana?: string | null
          synced_at?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      lov_orders: {
        Row: {
          cat: string | null
          cod_pedido: string | null
          created_at: string
          data_pedido: string | null
          descricao: string | null
          external_id: string
          fornecedor: string | null
          id: string
          id_prod: string | null
          mes_ref: string | null
          nfe: string | null
          produto: string | null
          qtde: number | null
          solicitante: string | null
          status: string | null
          sub_cat: string | null
          synced_at: string | null
          tipo: string | null
          valor_frete: number | null
          valor_total: number | null
          valor_unit: number | null
          vencimento: string | null
        }
        Insert: {
          cat?: string | null
          cod_pedido?: string | null
          created_at?: string
          data_pedido?: string | null
          descricao?: string | null
          external_id: string
          fornecedor?: string | null
          id?: string
          id_prod?: string | null
          mes_ref?: string | null
          nfe?: string | null
          produto?: string | null
          qtde?: number | null
          solicitante?: string | null
          status?: string | null
          sub_cat?: string | null
          synced_at?: string | null
          tipo?: string | null
          valor_frete?: number | null
          valor_total?: number | null
          valor_unit?: number | null
          vencimento?: string | null
        }
        Update: {
          cat?: string | null
          cod_pedido?: string | null
          created_at?: string
          data_pedido?: string | null
          descricao?: string | null
          external_id?: string
          fornecedor?: string | null
          id?: string
          id_prod?: string | null
          mes_ref?: string | null
          nfe?: string | null
          produto?: string | null
          qtde?: number | null
          solicitante?: string | null
          status?: string | null
          sub_cat?: string | null
          synced_at?: string | null
          tipo?: string | null
          valor_frete?: number | null
          valor_total?: number | null
          valor_unit?: number | null
          vencimento?: string | null
        }
        Relationships: []
      }
      lov_sales_commissions: {
        Row: {
          achieved: number | null
          commission: number | null
          commission_plan: string | null
          created_at: string
          external_id: string
          forecast: number | null
          id: string
          manager: string | null
          month: number | null
          period_from: string | null
          sales_person: string | null
          synced_at: string | null
          target: number | null
          target_amount: number | null
          team: string | null
          type: string | null
        }
        Insert: {
          achieved?: number | null
          commission?: number | null
          commission_plan?: string | null
          created_at?: string
          external_id: string
          forecast?: number | null
          id?: string
          manager?: string | null
          month?: number | null
          period_from?: string | null
          sales_person?: string | null
          synced_at?: string | null
          target?: number | null
          target_amount?: number | null
          team?: string | null
          type?: string | null
        }
        Update: {
          achieved?: number | null
          commission?: number | null
          commission_plan?: string | null
          created_at?: string
          external_id?: string
          forecast?: number | null
          id?: string
          manager?: string | null
          month?: number | null
          period_from?: string | null
          sales_person?: string | null
          synced_at?: string | null
          target?: number | null
          target_amount?: number | null
          team?: string | null
          type?: string | null
        }
        Relationships: []
      }
      lov_sales_team_members: {
        Row: {
          created_at: string
          id: string
          manager_tetra: string | null
          sales_tetra: string
          synced_at: string | null
          team_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_tetra?: string | null
          sales_tetra: string
          synced_at?: string | null
          team_name: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_tetra?: string | null
          sales_tetra?: string
          synced_at?: string | null
          team_name?: string
        }
        Relationships: []
      }
      lov_sales_teams: {
        Row: {
          created_at: string
          external_id: string
          id: string
          manager: string | null
          sales_person_raw: string | null
          synced_at: string | null
          team_name: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          manager?: string | null
          sales_person_raw?: string | null
          synced_at?: string | null
          team_name?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          manager?: string | null
          sales_person_raw?: string | null
          synced_at?: string | null
          team_name?: string | null
          type?: string | null
        }
        Relationships: []
      }
      lov_sync_logs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          rows_processed: number | null
          started_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_processed?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_processed?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      res_users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          manager_id: number | null
          manager_name: string | null
          user_email: string | null
          user_id: number
          user_name: string
          user_position: string | null
          user_role: Database["public"]["Enums"]["role"] | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          manager_id?: number | null
          manager_name?: string | null
          user_email?: string | null
          user_id: number
          user_name: string
          user_position?: string | null
          user_role?: Database["public"]["Enums"]["role"] | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          manager_id?: number | null
          manager_name?: string | null
          user_email?: string | null
          user_id?: number
          user_name?: string
          user_position?: string | null
          user_role?: Database["public"]["Enums"]["role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "res_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sales_team: {
        Row: {
          created_at: string | null
          manager_id: number | null
          team_department: string | null
          team_id: number
          team_name: string | null
          team_type: string | null
        }
        Insert: {
          created_at?: string | null
          manager_id?: number | null
          team_department?: string | null
          team_id?: number
          team_name?: string | null
          team_type?: string | null
        }
        Update: {
          created_at?: string | null
          manager_id?: number | null
          team_department?: string | null
          team_id?: number
          team_name?: string | null
          team_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_team_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "res_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      plan_type: "MRR" | "NRR"
      role: "EMPLOYEE" | "TEAM_LEADER" | "MANAGER" | "ADMIN"
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
      plan_type: ["MRR", "NRR"],
      role: ["EMPLOYEE", "TEAM_LEADER", "MANAGER", "ADMIN"],
    },
  },
} as const
