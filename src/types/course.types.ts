export interface Course {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    organization_id: string | null;
    is_published: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
    topic_count?: number;
    lesson_count?: number;
    is_enrolled?: boolean;
    progress_percentage?: number;
  }
  
  export interface Topic {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    display_order: number;
    created_at: string;
    updated_at: string;
    lessons?: Lesson[];
    lesson_count?: number;
    completed_lesson_count?: number;
  }
  
  export interface Lesson {
    id: string;
    topic_id: string;
    title: string;
    description: string | null;
    content_latex: string | null;
    video_url: string | null;
    estimated_minutes: number;
    display_order: number;
    created_at: string;
    updated_at: string;
    is_completed?: boolean;
    progress?: UserProgress;
  }
  
  export interface Enrollment {
    id: string;
    user_id: string;
    course_id: string;
    enrolled_at: string;
    completed_at: string | null;
  }
  
  export interface UserProgress {
    id: string;
    user_id: string;
    lesson_id: string;
    started_at: string;
    completed_at: string | null;
    time_spent_seconds: number;
    is_completed: boolean;
  }