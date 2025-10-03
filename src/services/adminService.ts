import { supabase } from '../utils/supabase';

export interface CreateCourseData {
  title: string;
  description?: string;
  organization_id: string;
  is_published?: boolean;
  display_order?: number;
}

export interface CreateTopicData {
  course_id: string;
  title: string;
  description?: string;
  display_order: number;
}

export interface CreateLessonData {
  topic_id: string;
  title: string;
  description?: string;
  content_latex?: string;
  estimated_minutes: number;
  display_order: number;
}

export type AdminRole = 'admin' | 'teacher' | 'student';

export async function listUsersInOrg(orgId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, role, is_active')
    .eq('organization_id', orgId)
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function updateUserRole(userId: string, role: AdminRole) {
  const { error } = await supabase
    .from('user_profiles')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}

export async function setUserActive(userId: string, isActive: boolean) {
  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active: isActive })
    .eq('id', userId);
  if (error) throw error;
}



export const adminService = {
  // ==================== COURSES ====================
  
  async getCourses(organizationId: string) {
    const { data, error } = await supabase
      .from('courses')
      .select('*, topics(count)')
      .eq('organization_id', organizationId)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data;
  },



  
  async getCourse(courseId: string) {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        topics(
          *,
          lessons(count)
        )
      `)
      .eq('id', courseId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async createCourse(course: CreateCourseData) {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        ...course,
        display_order: course.display_order ?? 0,
        is_published: course.is_published ?? false,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateCourse(courseId: string, updates: Partial<CreateCourseData>) {
    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', courseId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteCourse(courseId: string) {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);
    
    if (error) throw error;
  },

  // ==================== TOPICS ====================
  
  async getTopics(courseId: string) {
    const { data, error } = await supabase
      .from('topics')
      .select('*, lessons(count)')
      .eq('course_id', courseId)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async createTopic(topic: CreateTopicData) {
    const { data, error } = await supabase
      .from('topics')
      .insert(topic)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTopic(topicId: string, updates: Partial<CreateTopicData>) {
    const { data, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', topicId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteTopic(topicId: string) {
    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', topicId);
    
    if (error) throw error;
  },

  // ==================== LESSONS ====================
  
  async getLessons(topicId: string) {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('topic_id', topicId)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async getLesson(lessonId: string) {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async createLesson(lesson: CreateLessonData) {
    const { data, error } = await supabase
      .from('lessons')
      .insert(lesson)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateLesson(lessonId: string, updates: Partial<CreateLessonData>) {
    const { data, error } = await supabase
      .from('lessons')
      .update(updates)
      .eq('id', lessonId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteLesson(lessonId: string) {
    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lessonId);
    
    if (error) throw error;
  },
};