export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      cv_documents: {
        Row: { company: string; created_at: string; cv: Json; id: string; match_explanation: string; match_score: number; matrix: Json; role_title: string; selected_suggestions: Json; stage: string; strategy: Json; target_role_id: string | null; updated_at: string; user_id: string; work_sheet_id: string | null }
        Insert: { company?: string; created_at?: string; cv?: Json; id?: string; match_explanation?: string; match_score?: number; matrix?: Json; role_title?: string; selected_suggestions?: Json; stage?: string; strategy?: Json; target_role_id?: string | null; updated_at?: string; user_id: string; work_sheet_id?: string | null }
        Update: { company?: string; created_at?: string; cv?: Json; id?: string; match_explanation?: string; match_score?: number; matrix?: Json; role_title?: string; selected_suggestions?: Json; stage?: string; strategy?: Json; target_role_id?: string | null; updated_at?: string; user_id?: string; work_sheet_id?: string | null }
        Relationships: [{ foreignKeyName: "cv_documents_target_role_id_fkey"; columns: ["target_role_id"]; isOneToOne: false; referencedRelation: "target_roles"; referencedColumns: ["id"] }, { foreignKeyName: "cv_documents_work_sheet_id_fkey"; columns: ["work_sheet_id"]; isOneToOne: false; referencedRelation: "work_sheets"; referencedColumns: ["id"] }]
      }
      profiles: {
        Row: { created_at: string; email: string | null; full_name: string | null; id: string; updated_at: string }
        Insert: { created_at?: string; email?: string | null; full_name?: string | null; id: string; updated_at?: string }
        Update: { created_at?: string; email?: string | null; full_name?: string | null; id?: string; updated_at?: string }
        Relationships: []
      }
      target_roles: {
        Row: { company: string; created_at: string; data: Json; id: string; role_title: string; source_text: string; updated_at: string; user_id: string; work_sheet_id: string | null }
        Insert: { company?: string; created_at?: string; data?: Json; id?: string; role_title?: string; source_text?: string; updated_at?: string; user_id: string; work_sheet_id?: string | null }
        Update: { company?: string; created_at?: string; data?: Json; id?: string; role_title?: string; source_text?: string; updated_at?: string; user_id?: string; work_sheet_id?: string | null }
        Relationships: [{ foreignKeyName: "target_roles_work_sheet_id_fkey"; columns: ["work_sheet_id"]; isOneToOne: false; referencedRelation: "work_sheets"; referencedColumns: ["id"] }]
      }
      user_roles: {
        Row: { created_at: string; id: string; role: Database["public"]["Enums"]["app_role"]; user_id: string }
        Insert: { created_at?: string; id?: string; role: Database["public"]["Enums"]["app_role"]; user_id: string }
        Update: { created_at?: string; id?: string; role?: Database["public"]["Enums"]["app_role"]; user_id?: string }
        Relationships: []
      }
      work_sheets: {
        Row: { created_at: string; data: Json; id: string; title: string; updated_at: string; user_id: string }
        Insert: { created_at?: string; data?: Json; id?: string; title?: string; updated_at?: string; user_id: string }
        Update: { created_at?: string; data?: Json; id?: string; title?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { has_role: { Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string }; Returns: boolean } }
    Enums: { app_role: "admin" | "user" }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]
export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
export const Constants = { public: { Enums: { app_role: ["admin", "user"] } } } as const
