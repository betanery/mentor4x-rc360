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
          created_at: string
          id: string
          prompt: string | null
          response: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          id?: string
          prompt?: string | null
          response?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          id?: string
          prompt?: string | null
          response?: string | null
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
        ]
      }
      bottlenecks: {
        Row: {
          area: string | null
          blindspot_code: string | null
          company_id: string
          correction_plan: string | null
          created_at: string
          diagnostic_id: string | null
          estimated_value: number | null
          id: string
          impact: string | null
          name: string
          progress: number
          resolved: boolean | null
          responsible_user_id: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["bottleneck_urgency"]
        }
        Insert: {
          area?: string | null
          blindspot_code?: string | null
          company_id: string
          correction_plan?: string | null
          created_at?: string
          diagnostic_id?: string | null
          estimated_value?: number | null
          id?: string
          impact?: string | null
          name: string
          progress?: number
          resolved?: boolean | null
          responsible_user_id?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["bottleneck_urgency"]
        }
        Update: {
          area?: string | null
          blindspot_code?: string | null
          company_id?: string
          correction_plan?: string | null
          created_at?: string
          diagnostic_id?: string | null
          estimated_value?: number | null
          id?: string
          impact?: string | null
          name?: string
          progress?: number
          resolved?: boolean | null
          responsible_user_id?: string | null
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
          id: string
          issued_at: string
          pdf_url: string | null
          user_id: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          id?: string
          issued_at?: string
          pdf_url?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
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
      courses: {
        Row: {
          category: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number | null
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
          published?: boolean | null
          title?: string
        }
        Relationships: []
      }
      cycle_records: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
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
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          evidence_url: string | null
          financial_impact: number | null
          id: string
          indicator: string | null
          is_critical: boolean
          mentor_comment: string | null
          pillar: Database["public"]["Enums"]["pillar"] | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["goal_status"]
          title: string
          updated_at: string
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
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          financial_impact?: number | null
          id?: string
          indicator?: string | null
          is_critical?: boolean
          mentor_comment?: string | null
          pillar?: Database["public"]["Enums"]["pillar"] | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          title: string
          updated_at?: string
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
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          financial_impact?: number | null
          id?: string
          indicator?: string | null
          is_critical?: boolean
          mentor_comment?: string | null
          pillar?: Database["public"]["Enums"]["pillar"] | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          title?: string
          updated_at?: string
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
          created_at?: string
          done?: boolean
          id?: string
          item_key?: string
          item_type?: string
          stage?: string
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
          company_id: string
          created_at: string
          created_by: string | null
          duration_min: number | null
          id: string
          location: string | null
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          meeting_url: string | null
          scheduled_at: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          id?: string
          location?: string | null
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          meeting_url?: string | null
          scheduled_at: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          id?: string
          location?: string | null
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          meeting_url?: string | null
          scheduled_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
        ]
      }
      playbooks: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          title?: string
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
        ]
      }
      tasks: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          done: boolean | null
          due_date: string | null
          goal_id: string | null
          id: string
          responsible_user_id: string | null
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          done?: boolean | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          responsible_user_id?: string | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          done?: boolean | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          responsible_user_id?: string | null
          title?: string
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
          blocked: string | null
          company_id: string
          created_at: string
          created_by: string | null
          decisions: string | null
          done: string | null
          id: string
          indicators: string | null
          next_steps: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          ai_summary?: string | null
          blocked?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          done?: string | null
          id?: string
          indicators?: string | null
          next_steps?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          ai_summary?: string | null
          blocked?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          done?: string | null
          id?: string
          indicators?: string | null
          next_steps?: string | null
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
        ]
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
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
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
      pillar: ["crescimento", "eficiencia", "encantamento", "lideranca"],
      respondent_group: ["dono_socio", "gestor", "equipe"],
    },
  },
} as const
