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
      ai_logs: {
        Row: {
          action: string
          company_id: string | null
          contract_id: string | null
          created_at: string
          decision: string | null
          entity: string | null
          entity_id: string | null
          id: string
          payload: Json | null
          prompt: string | null
          response: string | null
          tool_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          contract_id?: string | null
          created_at?: string
          decision?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          payload?: Json | null
          prompt?: string | null
          response?: string | null
          tool_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          contract_id?: string | null
          created_at?: string
          decision?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          payload?: Json | null
          prompt?: string | null
          response?: string | null
          tool_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_proposals: {
        Row: {
          ai_message: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          entity: string | null
          entity_id: string | null
          error_message: string | null
          expires_at: string
          id: string
          instruction: string | null
          payload: Json
          payload_hash: string
          required_scope: string
          status: string
          tool_name: string
          updated_at: string
        }
        Insert: {
          ai_message?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          entity?: string | null
          entity_id?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          instruction?: string | null
          payload?: Json
          payload_hash: string
          required_scope?: string
          status?: string
          tool_name: string
          updated_at?: string
        }
        Update: {
          ai_message?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          entity?: string | null
          entity_id?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          instruction?: string | null
          payload?: Json
          payload_hash?: string
          required_scope?: string
          status?: string
          tool_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_proposals_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      bottleneck_rank_history: {
        Row: {
          bottleneck_id: string
          changed_by: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          cycle: string | null
          id: string
          justification: string | null
          new_position: number | null
          previous_position: number | null
        }
        Insert: {
          bottleneck_id: string
          changed_by?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          cycle?: string | null
          id?: string
          justification?: string | null
          new_position?: number | null
          previous_position?: number | null
        }
        Update: {
          bottleneck_id?: string
          changed_by?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          cycle?: string | null
          id?: string
          justification?: string | null
          new_position?: number | null
          previous_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bottleneck_rank_history_bottleneck_id_fkey"
            columns: ["bottleneck_id"]
            isOneToOne: false
            referencedRelation: "bottlenecks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bottleneck_rank_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bottleneck_rank_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      bottlenecks: {
        Row: {
          area: string | null
          blindspot_code: string | null
          capacity_code: string | null
          company_id: string
          contract_id: string | null
          correction_plan: string | null
          created_at: string
          diagnostic_id: string | null
          due_date: string | null
          estimated_value: number | null
          expected_result: string | null
          id: string
          impact: string | null
          name: string
          progress: number
          rank_position: number | null
          resolved: boolean | null
          responsible_user_id: string | null
          root_cause: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["bottleneck_urgency"]
        }
        Insert: {
          area?: string | null
          blindspot_code?: string | null
          capacity_code?: string | null
          company_id: string
          contract_id?: string | null
          correction_plan?: string | null
          created_at?: string
          diagnostic_id?: string | null
          due_date?: string | null
          estimated_value?: number | null
          expected_result?: string | null
          id?: string
          impact?: string | null
          name: string
          progress?: number
          rank_position?: number | null
          resolved?: boolean | null
          responsible_user_id?: string | null
          root_cause?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["bottleneck_urgency"]
        }
        Update: {
          area?: string | null
          blindspot_code?: string | null
          capacity_code?: string | null
          company_id?: string
          contract_id?: string | null
          correction_plan?: string | null
          created_at?: string
          diagnostic_id?: string | null
          due_date?: string | null
          estimated_value?: number | null
          expected_result?: string | null
          id?: string
          impact?: string | null
          name?: string
          progress?: number
          rank_position?: number | null
          resolved?: boolean | null
          responsible_user_id?: string | null
          root_cause?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["bottleneck_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "bottlenecks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bottlenecks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bottlenecks_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          code: string | null
          company_id: string
          contract_id: string | null
          id: string
          issued_at: string
          pdf_url: string | null
          user_id: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          contract_id?: string | null
          id?: string
          issued_at?: string
          pdf_url?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          contract_id?: string | null
          id?: string
          issued_at?: string
          pdf_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          chaos_level: Database["public"]["Enums"]["chaos_level"]
          created_at: string
          expected_completion: string | null
          id: string
          journey_stage: Database["public"]["Enums"]["journey_stage"]
          logo_url: string | null
          name: string
          notes: string | null
          overall_score: number
          owner_dependency: number
          projected_revenue: number | null
          segment: string | null
          started_at: string | null
          updated_at: string
        }
        Insert: {
          chaos_level?: Database["public"]["Enums"]["chaos_level"]
          created_at?: string
          expected_completion?: string | null
          id?: string
          journey_stage?: Database["public"]["Enums"]["journey_stage"]
          logo_url?: string | null
          name: string
          notes?: string | null
          overall_score?: number
          owner_dependency?: number
          projected_revenue?: number | null
          segment?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          chaos_level?: Database["public"]["Enums"]["chaos_level"]
          created_at?: string
          expected_completion?: string | null
          id?: string
          journey_stage?: Database["public"]["Enums"]["journey_stage"]
          logo_url?: string | null
          name?: string
          notes?: string | null
          overall_score?: number
          owner_dependency?: number
          projected_revenue?: number | null
          segment?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          member_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          member_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          member_role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_journey_stages: {
        Row: {
          company_id: string
          completed_at: string | null
          completed_by: string | null
          contract_id: string
          created_at: string
          cycle_number: number | null
          description: string | null
          id: string
          order_index: number
          planned_end: string | null
          planned_start: string | null
          stage_template_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          contract_id: string
          created_at?: string
          cycle_number?: number | null
          description?: string | null
          id?: string
          order_index?: number
          planned_end?: string | null
          planned_start?: string | null
          stage_template_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          contract_id?: string
          created_at?: string
          cycle_number?: number | null
          description?: string | null
          id?: string
          order_index?: number
          planned_end?: string | null
          planned_start?: string | null
          stage_template_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_journey_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_journey_stages_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_journey_stages_stage_template_id_fkey"
            columns: ["stage_template_id"]
            isOneToOne: false
            referencedRelation: "product_version_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_onboarding_items: {
        Row: {
          company_id: string
          completed_at: string | null
          completed_by: string | null
          contract_id: string
          course_id: string | null
          created_at: string
          description: string | null
          done: boolean
          due_date: string | null
          id: string
          item_type: Database["public"]["Enums"]["onboarding_item_type"]
          meeting_id: string | null
          order_index: number
          stage: string | null
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          contract_id: string
          course_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          item_type: Database["public"]["Enums"]["onboarding_item_type"]
          meeting_id?: string | null
          order_index?: number
          stage?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          contract_id?: string
          course_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["onboarding_item_type"]
          meeting_id?: string | null
          order_index?: number
          stage?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_onboarding_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_onboarding_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_onboarding_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_onboarding_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_onboarding_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "product_version_onboarding_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          access_expires_at: string | null
          company_id: string
          completed_at: string | null
          contracted_scope: Json
          created_at: string
          current_cycle: number
          expected_completion: string | null
          id: string
          journey_stage: Database["public"]["Enums"]["journey_stage"]
          notes: string | null
          onboarding_generated_at: string | null
          product_id: string
          product_version_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_expires_at?: string | null
          company_id: string
          completed_at?: string | null
          contracted_scope?: Json
          created_at?: string
          current_cycle?: number
          expected_completion?: string | null
          id?: string
          journey_stage?: Database["public"]["Enums"]["journey_stage"]
          notes?: string | null
          onboarding_generated_at?: string | null
          product_id: string
          product_version_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_expires_at?: string | null
          company_id?: string
          completed_at?: string | null
          contracted_scope?: Json
          created_at?: string
          current_cycle?: number
          expected_completion?: string | null
          id?: string
          journey_stage?: Database["public"]["Enums"]["journey_stage"]
          notes?: string | null
          onboarding_generated_at?: string | null
          product_id?: string
          product_version_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number | null
          product_id: string | null
          product_version_id: string | null
          published: boolean | null
          title: string
        }
        Insert: {
          category: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          product_id?: string | null
          product_version_id?: string | null
          published?: boolean | null
          title: string
        }
        Update: {
          category?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          product_id?: string | null
          product_version_id?: string | null
          published?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_records: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          cycle: string
          evidence_url: string | null
          gate_override_justification: string | null
          id: string
          started_at: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          cycle: string
          evidence_url?: string | null
          gate_override_justification?: string | null
          id?: string
          started_at?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          cycle?: string
          evidence_url?: string | null
          gate_override_justification?: string | null
          id?: string
          started_at?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_records_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_responses: {
        Row: {
          answers: Json
          diagnostic_id: string
          id: string
          respondent_group: Database["public"]["Enums"]["respondent_group"]
          respondent_name: string | null
          respondent_user_id: string | null
          submitted_at: string
        }
        Insert: {
          answers?: Json
          diagnostic_id: string
          id?: string
          respondent_group?: Database["public"]["Enums"]["respondent_group"]
          respondent_name?: string | null
          respondent_user_id?: string | null
          submitted_at?: string
        }
        Update: {
          answers?: Json
          diagnostic_id?: string
          id?: string
          respondent_group?: Database["public"]["Enums"]["respondent_group"]
          respondent_name?: string | null
          respondent_user_id?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_responses_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostics: {
        Row: {
          company_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          id: string
          idd_score: number | null
          improviso_score: number | null
          maturity: Database["public"]["Enums"]["maturity_level"] | null
          mode: Database["public"]["Enums"]["diagnostic_mode"]
          notes: string | null
          priority_blindspot: string | null
          priority_pillar: Database["public"]["Enums"]["pillar"] | null
          results: Json | null
          status: Database["public"]["Enums"]["diagnostic_status"]
          title: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          version: number
        }
        Insert: {
          company_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idd_score?: number | null
          improviso_score?: number | null
          maturity?: Database["public"]["Enums"]["maturity_level"] | null
          mode?: Database["public"]["Enums"]["diagnostic_mode"]
          notes?: string | null
          priority_blindspot?: string | null
          priority_pillar?: Database["public"]["Enums"]["pillar"] | null
          results?: Json | null
          status?: Database["public"]["Enums"]["diagnostic_status"]
          title?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version?: number
        }
        Update: {
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idd_score?: number | null
          improviso_score?: number | null
          maturity?: Database["public"]["Enums"]["maturity_level"] | null
          mode?: Database["public"]["Enums"]["diagnostic_mode"]
          notes?: string | null
          priority_blindspot?: string | null
          priority_pillar?: Database["public"]["Enums"]["pillar"] | null
          results?: Json | null
          status?: Database["public"]["Enums"]["diagnostic_status"]
          title?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostics_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_updates: {
        Row: {
          author_id: string | null
          created_at: string
          goal_id: string
          id: string
          message: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          goal_id: string
          id?: string
          message: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_updates_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          blindspot_code: string | null
          bottleneck_id: string | null
          capacity_code: string | null
          capacity_justification: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          current_situation: string | null
          description: string | null
          due_date: string | null
          evidence_url: string | null
          expected_result: string | null
          financial_impact: number | null
          id: string
          indicator: string | null
          is_critical: boolean
          mentor_comment: string | null
          notes: string | null
          pillar: Database["public"]["Enums"]["pillar"] | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["goal_status"]
          title: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          week_start: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          blindspot_code?: string | null
          bottleneck_id?: string | null
          capacity_code?: string | null
          capacity_justification?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          current_situation?: string | null
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          expected_result?: string | null
          financial_impact?: number | null
          id?: string
          indicator?: string | null
          is_critical?: boolean
          mentor_comment?: string | null
          notes?: string | null
          pillar?: Database["public"]["Enums"]["pillar"] | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          week_start?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          blindspot_code?: string | null
          bottleneck_id?: string | null
          capacity_code?: string | null
          capacity_justification?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          current_situation?: string | null
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          expected_result?: string | null
          financial_impact?: number | null
          id?: string
          indicator?: string | null
          is_critical?: boolean
          mentor_comment?: string | null
          notes?: string | null
          pillar?: Database["public"]["Enums"]["pillar"] | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_bottleneck_id_fkey"
            columns: ["bottleneck_id"]
            isOneToOne: false
            referencedRelation: "bottlenecks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_log: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          justification: string | null
          new_value: string | null
          previous_value: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          justification?: string | null
          new_value?: string | null
          previous_value?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          justification?: string | null
          new_value?: string | null
          previous_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_audit: {
        Row: {
          accepted_at: string | null
          company_id: string | null
          created_at: string
          email: string
          error_message: string | null
          full_name: string | null
          id: string
          invited_by: string | null
          invited_user_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          error_message?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          error_message?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_checklist: {
        Row: {
          company_id: string
          completed_at: string | null
          completed_by: string | null
          contract_id: string | null
          created_at: string
          done: boolean
          id: string
          item_key: string
          item_type: string
          stage: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          contract_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          item_key: string
          item_type: string
          stage: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          contract_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          item_key?: string
          item_type?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_checklist_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_diagnostics: {
        Row: {
          answers: Json
          company_name: string | null
          completed_at: string | null
          consent_at: string | null
          consent_ip_hash: string | null
          consent_lgpd: boolean
          consent_version: string | null
          converted_company_id: string | null
          created_at: string
          current_step: number
          email: string | null
          full_name: string | null
          id: string
          idd_score: number | null
          improviso_score: number | null
          landing_page: string | null
          last_seen_at: string
          phone: string | null
          priority_blindspot: string | null
          priority_pillar: string | null
          recommendation: Json | null
          referrer: string | null
          result: Json | null
          resume_token: string
          revenue_band: string | null
          role_title: string | null
          segment: string | null
          status: string
          team_size: string | null
          top5: string[] | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          answers?: Json
          company_name?: string | null
          completed_at?: string | null
          consent_at?: string | null
          consent_ip_hash?: string | null
          consent_lgpd?: boolean
          consent_version?: string | null
          converted_company_id?: string | null
          created_at?: string
          current_step?: number
          email?: string | null
          full_name?: string | null
          id?: string
          idd_score?: number | null
          improviso_score?: number | null
          landing_page?: string | null
          last_seen_at?: string
          phone?: string | null
          priority_blindspot?: string | null
          priority_pillar?: string | null
          recommendation?: Json | null
          referrer?: string | null
          result?: Json | null
          resume_token: string
          revenue_band?: string | null
          role_title?: string | null
          segment?: string | null
          status?: string
          team_size?: string | null
          top5?: string[] | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          answers?: Json
          company_name?: string | null
          completed_at?: string | null
          consent_at?: string | null
          consent_ip_hash?: string | null
          consent_lgpd?: boolean
          consent_version?: string | null
          converted_company_id?: string | null
          created_at?: string
          current_step?: number
          email?: string | null
          full_name?: string | null
          id?: string
          idd_score?: number | null
          improviso_score?: number | null
          landing_page?: string | null
          last_seen_at?: string
          phone?: string | null
          priority_blindspot?: string | null
          priority_pillar?: string | null
          recommendation?: Json | null
          referrer?: string | null
          result?: Json | null
          resume_token?: string
          revenue_band?: string | null
          role_title?: string | null
          segment?: string | null
          status?: string
          team_size?: string | null
          top5?: string[] | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_diagnostics_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_throttle: {
        Row: {
          action: string
          count: number
          created_at: string
          id: string
          ip_hash: string
          updated_at: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          created_at?: string
          id?: string
          ip_hash: string
          updated_at?: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          created_at?: string
          id?: string
          ip_hash?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          id: string
          lesson_id: string
          progress_pct: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          id?: string
          lesson_id: string
          progress_pct?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          id?: string
          lesson_id?: string
          progress_pct?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          duration_min: number | null
          id: string
          order_index: number | null
          pdf_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          order_index?: number | null
          pdf_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          order_index?: number | null
          pdf_url?: string | null
          title?: string
          video_url?: string | null
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
      meeting_attendance: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          note: string | null
          participant_name: string | null
          recorded_by: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          note?: string | null
          participant_name?: string | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          note?: string | null
          participant_name?: string | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          is_private: boolean | null
          meeting_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_private?: boolean | null
          meeting_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_private?: boolean | null
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          duration_min: number | null
          id: string
          location: string | null
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          meeting_url: string | null
          recording_url: string | null
          recurrence: string
          recurrence_until: string | null
          reschedule_reason: string | null
          rescheduled_from: string | null
          scheduled_at: string
          series_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          id?: string
          location?: string | null
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          meeting_url?: string | null
          recording_url?: string | null
          recurrence?: string
          recurrence_until?: string | null
          reschedule_reason?: string | null
          rescheduled_from?: string | null
          scheduled_at: string
          series_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          id?: string
          location?: string | null
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          meeting_url?: string | null
          recording_url?: string | null
          recurrence?: string
          recurrence_until?: string | null
          reschedule_reason?: string | null
          rescheduled_from?: string | null
          scheduled_at?: string
          series_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          message: string | null
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pillar_scores: {
        Row: {
          blind_spots: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          id: string
          measured_at: string
          pillar: Database["public"]["Enums"]["pillar"]
          recommendations: string | null
          score: number
        }
        Insert: {
          blind_spots?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          id?: string
          measured_at?: string
          pillar: Database["public"]["Enums"]["pillar"]
          recommendations?: string | null
          score: number
        }
        Update: {
          blind_spots?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          id?: string
          measured_at?: string
          pillar?: Database["public"]["Enums"]["pillar"]
          recommendations?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "pillar_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pillar_scores_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          blindspot_code: string | null
          category: string | null
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          motor: string | null
          order_index: number
          pillar: Database["public"]["Enums"]["pillar"] | null
          product_id: string | null
          product_version_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          blindspot_code?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          motor?: string | null
          order_index?: number
          pillar?: Database["public"]["Enums"]["pillar"] | null
          product_id?: string | null
          product_version_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          blindspot_code?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          motor?: string | null
          order_index?: number
          pillar?: Database["public"]["Enums"]["pillar"] | null
          product_id?: string | null
          product_version_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inheritance: {
        Row: {
          base_version_id: string
          created_at: string
          derived_version_id: string
          id: string
          inherited_components: string[]
          notes: string | null
          overridden_components: string[]
          updated_at: string
        }
        Insert: {
          base_version_id: string
          created_at?: string
          derived_version_id: string
          id?: string
          inherited_components?: string[]
          notes?: string | null
          overridden_components?: string[]
          updated_at?: string
        }
        Update: {
          base_version_id?: string
          created_at?: string
          derived_version_id?: string
          id?: string
          inherited_components?: string[]
          notes?: string | null
          overridden_components?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_inheritance_base_version_id_fkey"
            columns: ["base_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inheritance_derived_version_id_fkey"
            columns: ["derived_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_upgrade_paths: {
        Row: {
          condition: string | null
          created_at: string
          from_product_id: string
          from_version_id: string | null
          id: string
          notes: string | null
          to_product_id: string
          to_version_id: string | null
          updated_at: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          from_product_id: string
          from_version_id?: string | null
          id?: string
          notes?: string | null
          to_product_id: string
          to_version_id?: string | null
          updated_at?: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          from_product_id?: string
          from_version_id?: string | null
          id?: string
          notes?: string | null
          to_product_id?: string
          to_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_upgrade_paths_from_product_id_fkey"
            columns: ["from_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_upgrade_paths_from_version_id_fkey"
            columns: ["from_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_upgrade_paths_to_product_id_fkey"
            columns: ["to_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_upgrade_paths_to_version_id_fkey"
            columns: ["to_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_version_config: {
        Row: {
          access_days: number | null
          action_plan_days: number | null
          ai_enabled: boolean
          audience: string | null
          bonuses: string | null
          catalog_visibility: string
          checkout_url: string | null
          community_included: boolean
          completion_rules: Json
          created_at: string
          currency: string
          diagnostic_required: boolean
          duration_amount: number | null
          duration_unit: string
          format: string | null
          goal_required_fields: Json
          id: string
          ladder_level: string | null
          max_critical_goals: number | null
          modality: string | null
          notes: string | null
          price_cents: number | null
          product_version_id: string
          promise: string | null
          recommendation_mode: string
          sales_url: string | null
          service_type: string | null
          support_model: string | null
          updated_at: string
        }
        Insert: {
          access_days?: number | null
          action_plan_days?: number | null
          ai_enabled?: boolean
          audience?: string | null
          bonuses?: string | null
          catalog_visibility?: string
          checkout_url?: string | null
          community_included?: boolean
          completion_rules?: Json
          created_at?: string
          currency?: string
          diagnostic_required?: boolean
          duration_amount?: number | null
          duration_unit?: string
          format?: string | null
          goal_required_fields?: Json
          id?: string
          ladder_level?: string | null
          max_critical_goals?: number | null
          modality?: string | null
          notes?: string | null
          price_cents?: number | null
          product_version_id: string
          promise?: string | null
          recommendation_mode?: string
          sales_url?: string | null
          service_type?: string | null
          support_model?: string | null
          updated_at?: string
        }
        Update: {
          access_days?: number | null
          action_plan_days?: number | null
          ai_enabled?: boolean
          audience?: string | null
          bonuses?: string | null
          catalog_visibility?: string
          checkout_url?: string | null
          community_included?: boolean
          completion_rules?: Json
          created_at?: string
          currency?: string
          diagnostic_required?: boolean
          duration_amount?: number | null
          duration_unit?: string
          format?: string | null
          goal_required_fields?: Json
          id?: string
          ladder_level?: string | null
          max_critical_goals?: number | null
          modality?: string | null
          notes?: string | null
          price_cents?: number | null
          product_version_id?: string
          promise?: string | null
          recommendation_mode?: string
          sales_url?: string | null
          service_type?: string | null
          support_model?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_version_config_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: true
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_version_deliverables: {
        Row: {
          created_at: string
          description: string | null
          format: string | null
          id: string
          order_index: number
          product_version_id: string
          required: boolean
          stage_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          order_index?: number
          product_version_id: string
          required?: boolean
          stage_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          order_index?: number
          product_version_id?: string
          required?: boolean
          stage_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_version_deliverables_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_version_deliverables_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "product_version_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      product_version_meetings: {
        Row: {
          cadence: string | null
          created_at: string
          duration_min: number
          id: string
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          notes: string | null
          order_index: number
          product_version_id: string
          quantity: number
          required: boolean
          title: string
          updated_at: string
        }
        Insert: {
          cadence?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          notes?: string | null
          order_index?: number
          product_version_id: string
          quantity?: number
          required?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          cadence?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          notes?: string | null
          order_index?: number
          product_version_id?: string
          quantity?: number
          required?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_version_meetings_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_version_onboarding_items: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          duration_min: number | null
          id: string
          item_type: Database["public"]["Enums"]["onboarding_item_type"]
          meeting_type: Database["public"]["Enums"]["meeting_type"] | null
          offset_days: number
          order_index: number
          product_version_id: string
          stage: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          item_type: Database["public"]["Enums"]["onboarding_item_type"]
          meeting_type?: Database["public"]["Enums"]["meeting_type"] | null
          offset_days?: number
          order_index?: number
          product_version_id: string
          stage?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          item_type?: Database["public"]["Enums"]["onboarding_item_type"]
          meeting_type?: Database["public"]["Enums"]["meeting_type"] | null
          offset_days?: number
          order_index?: number
          product_version_id?: string
          stage?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_version_onboarding_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_version_onboarding_items_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_version_stages: {
        Row: {
          created_at: string
          cycle_number: number | null
          description: string | null
          duration_days: number | null
          id: string
          order_index: number
          product_version_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_number?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          order_index?: number
          product_version_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_number?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          order_index?: number
          product_version_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_version_stages_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_versions: {
        Row: {
          created_at: string
          cycle_count: number
          description: string | null
          duration_days: number | null
          id: string
          is_active: boolean
          methodology_code: string
          product_id: string
          published_at: string | null
          updated_at: string
          version_label: string
        }
        Insert: {
          created_at?: string
          cycle_count?: number
          description?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean
          methodology_code?: string
          product_id: string
          published_at?: string | null
          updated_at?: string
          version_label: string
        }
        Update: {
          created_at?: string
          cycle_count?: number
          description?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean
          methodology_code?: string
          product_id?: string
          published_at?: string | null
          updated_at?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          company_id: string
          contract_id: string | null
          created_at: string
          generated_by: string | null
          id: string
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          summary: Json | null
          title: string
        }
        Insert: {
          company_id: string
          contract_id?: string | null
          created_at?: string
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          summary?: Json | null
          title: string
        }
        Update: {
          company_id?: string
          contract_id?: string | null
          created_at?: string
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          summary?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      role_capabilities: {
        Row: {
          capability: string
          created_at: string
          description: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          scope: string
          updated_at: string
        }
        Insert: {
          capability: string
          created_at?: string
          description?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: string
          updated_at?: string
        }
        Update: {
          capability?: string
          created_at?: string
          description?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          blindspot_code: string | null
          capacity_code: string | null
          checklist: Json
          company_id: string
          contract_id: string | null
          created_at: string
          description: string | null
          done: boolean | null
          due_date: string | null
          goal_id: string | null
          id: string
          priority: string
          responsible_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          blindspot_code?: string | null
          capacity_code?: string | null
          checklist?: Json
          company_id: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          priority?: string
          responsible_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          blindspot_code?: string | null
          capacity_code?: string | null
          checklist?: Json
          company_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          priority?: string
          responsible_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
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
          role: Database["public"]["Enums"]["app_role"]
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
      weekly_reviews: {
        Row: {
          ai_summary: string | null
          ata_status: string
          blocked: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          decisions: string | null
          done: string | null
          id: string
          indicators: string | null
          next_steps: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          ai_summary?: string | null
          ata_status?: string
          blocked?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          done?: string | null
          id?: string
          indicators?: string | null
          next_steps?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          ai_summary?: string | null
          ata_status?: string
          blocked?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          done?: string | null
          id?: string
          indicators?: string | null
          next_steps?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reviews_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_contract_journey: {
        Args: { _contract_id: string }
        Returns: number
      }
      generate_contract_onboarding: {
        Args: { _contract_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_consultor: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      user_companies: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "mentor"
        | "estrategista"
        | "cliente_dono"
        | "gestor_cliente"
        | "colaborador_cliente"
      bottleneck_urgency: "baixa" | "media" | "alta" | "critica"
      chaos_level: "total" | "severo" | "moderado" | "leve" | "escala"
      diagnostic_mode: "lead" | "cliente"
      diagnostic_status: "rascunho" | "consolidado" | "validado"
      goal_status:
        | "nao_iniciado"
        | "em_andamento"
        | "concluido"
        | "atrasado"
        | "bloqueado"
      journey_stage:
        | "mes_1"
        | "mes_2"
        | "mes_3"
        | "mes_4"
        | "ciclo_1"
        | "ciclo_2"
        | "ciclo_3"
        | "ciclo_4"
        | "ciclo_5"
        | "ciclo_6"
        | "concluido"
      maturity_level:
        | "inicial"
        | "emergente"
        | "estruturada"
        | "escalavel"
        | "autonoma"
      meeting_type:
        | "sala_guerra"
        | "mentoria"
        | "estrategia"
        | "kickoff"
        | "review"
        | "checkin_semanal"
      onboarding_item_type: "etapa" | "encontro" | "entregavel" | "conteudo"
      pillar: "crescimento" | "eficiencia" | "encantamento" | "lideranca"
      respondent_group: "dono_socio" | "gestor" | "equipe"
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
      app_role: [
        "super_admin",
        "mentor",
        "estrategista",
        "cliente_dono",
        "gestor_cliente",
        "colaborador_cliente",
      ],
      bottleneck_urgency: ["baixa", "media", "alta", "critica"],
      chaos_level: ["total", "severo", "moderado", "leve", "escala"],
      diagnostic_mode: ["lead", "cliente"],
      diagnostic_status: ["rascunho", "consolidado", "validado"],
      goal_status: [
        "nao_iniciado",
        "em_andamento",
        "concluido",
        "atrasado",
        "bloqueado",
      ],
      journey_stage: [
        "mes_1",
        "mes_2",
        "mes_3",
        "mes_4",
        "ciclo_1",
        "ciclo_2",
        "ciclo_3",
        "ciclo_4",
        "ciclo_5",
        "ciclo_6",
        "concluido",
      ],
      maturity_level: [
        "inicial",
        "emergente",
        "estruturada",
        "escalavel",
        "autonoma",
      ],
      meeting_type: [
        "sala_guerra",
        "mentoria",
        "estrategia",
        "kickoff",
        "review",
        "checkin_semanal",
      ],
      onboarding_item_type: ["etapa", "encontro", "entregavel", "conteudo"],
      pillar: ["crescimento", "eficiencia", "encantamento", "lideranca"],
      respondent_group: ["dono_socio", "gestor", "equipe"],
    },
  },
} as const
