/**
 * Hand maintained mirror of the database schema in `supabase/migrations`.
 *
 * Keeping the types in the repository (instead of relying on a generated file
 * that lives outside version control) means the compiler verifies every query
 * against the real schema. When a migration changes a column, this file must
 * be updated in the same commit.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'student' | 'teacher'

export type Profile = {
  id: string
  full_name: string
  email: string
  role: UserRole
  grade_level: string
  avatar_url: string
  created_at: string
  updated_at: string
}

export type ClassRow = {
  id: string
  title: string
  description: string
  display_order: number
  is_published: boolean
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Lesson = {
  id: string
  class_id: string
  title: string
  description: string
  display_order: number
  is_published: boolean
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type LessonDocument = {
  id: string
  lesson_id: string
  title: string
  description: string
  file_path: string
  original_file_name: string
  mime_type: string
  file_size: number
  storage_bucket: string
  version: number
  created_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type Conversation = {
  id: string
  student_id: string
  teacher_id: string
  last_message_at: string
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  read_at: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          full_name?: string
          email?: string
          role?: UserRole
          grade_level?: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      classes: {
        Row: ClassRow
        Insert: {
          id?: string
          title: string
          description?: string
          display_order?: number
          is_published?: boolean
          is_archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<ClassRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: 'classes_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lessons: {
        Row: Lesson
        Insert: {
          id?: string
          class_id: string
          title: string
          description?: string
          display_order?: number
          is_published?: boolean
          is_archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Lesson, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: 'lessons_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'classes'
            referencedColumns: ['id']
          },
        ]
      }
      lesson_documents: {
        Row: LessonDocument
        Insert: {
          id?: string
          lesson_id: string
          title: string
          description?: string
          file_path: string
          original_file_name: string
          mime_type: string
          file_size: number
          storage_bucket?: string
          version?: number
          created_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<LessonDocument, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: 'lesson_documents_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
        ]
      }
      conversations: {
        Row: Conversation
        Insert: {
          id?: string
          student_id: string
          teacher_id: string
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Conversation, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'conversations_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversations_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: Message
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          body: string
          read_at?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Message, 'id' | 'conversation_id' | 'sender_id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      set_user_role: {
        Args: { target_email: string; new_role: UserRole }
        Returns: Profile
      }
    }
    Enums: {
      user_role: UserRole
    }
    CompositeTypes: Record<never, never>
  }
}

export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
