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
      backtests: {
        Row: {
          avg_r_multiple: number | null
          config: Json
          created_at: string
          end_date: string
          equity_curve: Json
          id: string
          max_drawdown: number | null
          name: string
          net_profit: number | null
          pair: string
          profit_factor: number | null
          sharpe_ratio: number | null
          start_date: string
          status: string
          strategy_key: string
          timeframe: string
          total_trades: number
          win_rate: number | null
        }
        Insert: {
          avg_r_multiple?: number | null
          config?: Json
          created_at?: string
          end_date: string
          equity_curve?: Json
          id?: string
          max_drawdown?: number | null
          name: string
          net_profit?: number | null
          pair: string
          profit_factor?: number | null
          sharpe_ratio?: number | null
          start_date: string
          status?: string
          strategy_key: string
          timeframe: string
          total_trades?: number
          win_rate?: number | null
        }
        Update: {
          avg_r_multiple?: number | null
          config?: Json
          created_at?: string
          end_date?: string
          equity_curve?: Json
          id?: string
          max_drawdown?: number | null
          name?: string
          net_profit?: number | null
          pair?: string
          profit_factor?: number | null
          sharpe_ratio?: number | null
          start_date?: string
          status?: string
          strategy_key?: string
          timeframe?: string
          total_trades?: number
          win_rate?: number | null
        }
        Relationships: []
      }
      candles: {
        Row: {
          close: number
          created_at: string
          high: number
          id: number
          low: number
          open: number
          pair: string
          source: string
          spread: number | null
          timeframe: string
          ts: string
          volume: number
        }
        Insert: {
          close: number
          created_at?: string
          high: number
          id?: number
          low: number
          open: number
          pair: string
          source?: string
          spread?: number | null
          timeframe: string
          ts: string
          volume?: number
        }
        Update: {
          close?: number
          created_at?: string
          high?: number
          id?: number
          low?: number
          open?: number
          pair?: string
          source?: string
          spread?: number | null
          timeframe?: string
          ts?: string
          volume?: number
        }
        Relationships: []
      }
      configs: {
        Row: {
          account_balance: number
          active: boolean
          atr_max: number
          atr_min: number
          atr_period: number
          atr_sl_multiplier: number
          cooldown_minutes: number
          created_at: string
          drawdown_circuit_breaker: number
          ema_fast: number
          ema_slow: number
          id: string
          kill_switch: boolean
          live_trading_armed: boolean
          max_daily_loss: number
          max_daily_trades: number
          max_open_trades: number
          mode: Database["public"]["Enums"]["trade_mode"]
          name: string
          pair: string
          risk_per_trade: number
          rr_ratio: number
          rsi_min: number
          rsi_period: number
          spread_threshold: number
          strategy_key: string
          timeframe: string
          updated_at: string
        }
        Insert: {
          account_balance?: number
          active?: boolean
          atr_max?: number
          atr_min?: number
          atr_period?: number
          atr_sl_multiplier?: number
          cooldown_minutes?: number
          created_at?: string
          drawdown_circuit_breaker?: number
          ema_fast?: number
          ema_slow?: number
          id?: string
          kill_switch?: boolean
          live_trading_armed?: boolean
          max_daily_loss?: number
          max_daily_trades?: number
          max_open_trades?: number
          mode?: Database["public"]["Enums"]["trade_mode"]
          name?: string
          pair?: string
          risk_per_trade?: number
          rr_ratio?: number
          rsi_min?: number
          rsi_period?: number
          spread_threshold?: number
          strategy_key?: string
          timeframe?: string
          updated_at?: string
        }
        Update: {
          account_balance?: number
          active?: boolean
          atr_max?: number
          atr_min?: number
          atr_period?: number
          atr_sl_multiplier?: number
          cooldown_minutes?: number
          created_at?: string
          drawdown_circuit_breaker?: number
          ema_fast?: number
          ema_slow?: number
          id?: string
          kill_switch?: boolean
          live_trading_armed?: boolean
          max_daily_loss?: number
          max_daily_trades?: number
          max_open_trades?: number
          mode?: Database["public"]["Enums"]["trade_mode"]
          name?: string
          pair?: string
          risk_per_trade?: number
          rr_ratio?: number
          rsi_min?: number
          rsi_period?: number
          spread_threshold?: number
          strategy_key?: string
          timeframe?: string
          updated_at?: string
        }
        Relationships: []
      }
      equity_snapshots: {
        Row: {
          balance: number
          drawdown: number
          equity: number
          id: number
          mode: Database["public"]["Enums"]["trade_mode"]
          open_pnl: number
          ts: string
        }
        Insert: {
          balance: number
          drawdown?: number
          equity: number
          id?: number
          mode: Database["public"]["Enums"]["trade_mode"]
          open_pnl?: number
          ts?: string
        }
        Update: {
          balance?: number
          drawdown?: number
          equity?: number
          id?: number
          mode?: Database["public"]["Enums"]["trade_mode"]
          open_pnl?: number
          ts?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: number
          message: string
          payload: Json
          signal_id: string | null
          stage: string | null
          trade_id: string | null
          ts: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          id?: number
          message: string
          payload?: Json
          signal_id?: string | null
          stage?: string | null
          trade_id?: string | null
          ts?: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          id?: number
          message?: string
          payload?: Json
          signal_id?: string | null
          stage?: string | null
          trade_id?: string | null
          ts?: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: []
      }
      features: {
        Row: {
          atr: number | null
          created_at: string
          ema_fast: number | null
          ema_slow: number | null
          id: number
          pair: string
          payload: Json
          rsi: number | null
          timeframe: string
          trend: string | null
          ts: string
          volatility_state: string | null
        }
        Insert: {
          atr?: number | null
          created_at?: string
          ema_fast?: number | null
          ema_slow?: number | null
          id?: number
          pair: string
          payload?: Json
          rsi?: number | null
          timeframe: string
          trend?: string | null
          ts: string
          volatility_state?: string | null
        }
        Update: {
          atr?: number | null
          created_at?: string
          ema_fast?: number | null
          ema_slow?: number | null
          id?: number
          pair?: string
          payload?: Json
          rsi?: number | null
          timeframe?: string
          trend?: string | null
          ts?: string
          volatility_state?: string | null
        }
        Relationships: []
      }
      risk_audits: {
        Row: {
          approved: boolean
          backtest_id: string | null
          context: Json
          decision: Json
          id: number
          mode: Database["public"]["Enums"]["trade_mode"] | null
          pair: string
          rejection_reason: string | null
          rules: Json
          side: Database["public"]["Enums"]["trade_side"] | null
          signal_id: string | null
          strategy_key: string
          timeframe: string
          trade_id: string | null
          ts: string
        }
        Insert: {
          approved: boolean
          backtest_id?: string | null
          context?: Json
          decision?: Json
          id?: number
          mode?: Database["public"]["Enums"]["trade_mode"] | null
          pair: string
          rejection_reason?: string | null
          rules?: Json
          side?: Database["public"]["Enums"]["trade_side"] | null
          signal_id?: string | null
          strategy_key: string
          timeframe: string
          trade_id?: string | null
          ts?: string
        }
        Update: {
          approved?: boolean
          backtest_id?: string | null
          context?: Json
          decision?: Json
          id?: number
          mode?: Database["public"]["Enums"]["trade_mode"] | null
          pair?: string
          rejection_reason?: string | null
          rules?: Json
          side?: Database["public"]["Enums"]["trade_side"] | null
          signal_id?: string | null
          strategy_key?: string
          timeframe?: string
          trade_id?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_audits_backtest_id_fkey"
            columns: ["backtest_id"]
            isOneToOne: false
            referencedRelation: "backtests"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          approved: boolean | null
          confidence: number
          created_at: string
          id: string
          pair: string
          reason: Json
          rejection_reason: string | null
          side: Database["public"]["Enums"]["trade_side"]
          strategy_key: string
          timeframe: string
          trade_id: string | null
          ts: string
        }
        Insert: {
          approved?: boolean | null
          confidence?: number
          created_at?: string
          id?: string
          pair: string
          reason?: Json
          rejection_reason?: string | null
          side: Database["public"]["Enums"]["trade_side"]
          strategy_key: string
          timeframe: string
          trade_id?: string | null
          ts?: string
        }
        Update: {
          approved?: boolean | null
          confidence?: number
          created_at?: string
          id?: string
          pair?: string
          reason?: Json
          rejection_reason?: string | null
          side?: Database["public"]["Enums"]["trade_side"]
          strategy_key?: string
          timeframe?: string
          trade_id?: string | null
          ts?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          name: string
          version: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          name: string
          version?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          version?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          backtest_id: string | null
          close_reason: string | null
          created_at: string
          entry_price: number
          entry_time: string
          exit_price: number | null
          exit_time: string | null
          id: string
          lot_size: number
          mode: Database["public"]["Enums"]["trade_mode"]
          pair: string
          pnl: number | null
          pnl_pips: number | null
          r_multiple: number | null
          risk_amount: number
          side: Database["public"]["Enums"]["trade_side"]
          signal_id: string | null
          status: Database["public"]["Enums"]["trade_status"]
          stop_loss: number
          strategy_key: string
          take_profit: number
          timeframe: string
        }
        Insert: {
          backtest_id?: string | null
          close_reason?: string | null
          created_at?: string
          entry_price: number
          entry_time?: string
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          lot_size: number
          mode: Database["public"]["Enums"]["trade_mode"]
          pair: string
          pnl?: number | null
          pnl_pips?: number | null
          r_multiple?: number | null
          risk_amount: number
          side: Database["public"]["Enums"]["trade_side"]
          signal_id?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          stop_loss: number
          strategy_key: string
          take_profit: number
          timeframe: string
        }
        Update: {
          backtest_id?: string | null
          close_reason?: string | null
          created_at?: string
          entry_price?: number
          entry_time?: string
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          lot_size?: number
          mode?: Database["public"]["Enums"]["trade_mode"]
          pair?: string
          pnl?: number | null
          pnl_pips?: number | null
          r_multiple?: number | null
          risk_amount?: number
          side?: Database["public"]["Enums"]["trade_side"]
          signal_id?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          stop_loss?: number
          strategy_key?: string
          take_profit?: number
          timeframe?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_backtest_id_fkey"
            columns: ["backtest_id"]
            isOneToOne: false
            referencedRelation: "backtests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_type:
        | "info"
        | "warning"
        | "error"
        | "trade"
        | "signal"
        | "risk"
        | "pipeline"
      trade_mode: "backtest" | "paper" | "live" | "shadow"
      trade_side: "LONG" | "SHORT"
      trade_status: "open" | "closed" | "cancelled" | "rejected"
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
      event_type: [
        "info",
        "warning",
        "error",
        "trade",
        "signal",
        "risk",
        "pipeline",
      ],
      trade_mode: ["backtest", "paper", "live", "shadow"],
      trade_side: ["LONG", "SHORT"],
      trade_status: ["open", "closed", "cancelled", "rejected"],
    },
  },
} as const
