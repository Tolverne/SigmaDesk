import { supabase } from '../utils/supabase';
import { Course, Topic, Lesson, Enrollment, UserProgress } from '../types/course.types';

export const courseService = {
// Fetch all published courses
async getCourses(): Promise<Course[]> {
    console.log('🔍 courseService: Fetching courses...');
    
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('display_order');
  
      if (error) {
        console.error('🔍 courseService: Error fetching courses:', error);
        throw error;
      }
      
      console.log('🔍 courseService: Fetched courses:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('🔍 courseService: Exception in getCourses:', error);
      throw error;
    }
  },

  // Get course details with topics and lessons
  async getCourseDetails(courseId: string) {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        topics (
          *,
          lessons (
            *,
            user_progress!left (
              is_completed
            )
          )
        )
      `)
      .eq('id', courseId)
      .single();

    if (error) throw error;
    return data;
  },

// Get user's enrolled courses
async getEnrolledCourses(userId: string): Promise<Course[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        courses (
          *,
          topics:topics(count)
        )
      `)
      .eq('user_id', userId);
  
    if (error) throw error;
    
    // Type assertion and null check
    const courses = data?.map(enrollment => (enrollment as any).courses).filter(Boolean) || [];
    return courses as Course[];
  },

  // Enroll in a course
  async enrollInCourse(courseId: string, userId: string): Promise<Enrollment> {
    const { data, error } = await supabase
      .from('enrollments')
      .insert({
        course_id: courseId,
        user_id: userId
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Already enrolled in this course');
      }
      throw error;
    }
    
    return data;
  },

  // Check enrollment status
  async checkEnrollment(courseId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }
    
    return !!data;
  },

  // Get topics for a course
  async getCourseTopics(courseId: string): Promise<Topic[]> {
    const { data, error } = await supabase
      .from('topics')
      .select(`
        *,
        lessons (
          id,
          title,
          display_order,
          estimated_minutes
        )
      `)
      .eq('course_id', courseId)
      .order('display_order');

    if (error) throw error;
    return data || [];
  },

  // Get lessons for a topic
  async getTopicLessons(topicId: string): Promise<Lesson[]> {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('topic_id', topicId)
      .order('display_order');

    if (error) throw error;
    return data || [];
  },

  // Get specific lesson
  async getLesson(lessonId: string): Promise<Lesson> {
    const { data, error } = await supabase
      .from('lessons')
      .select(`
        *,
        topic:topics (
          id,
          title,
          course_id,
          course:courses (
            id,
            title
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update progress
  async updateProgress(lessonId: string, userId: string, isCompleted: boolean): Promise<UserProgress> {
    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        lesson_id: lessonId,
        user_id: userId,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null
      }, {
        onConflict: 'user_id,lesson_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get user progress for a course
  async getCourseProgress(courseId: string, userId: string) {
    const { data, error } = await supabase
      .from('topics')
      .select(`
        lessons (
          id,
          user_progress!left (
            is_completed
          )
        )
      `)
      .eq('course_id', courseId);

    if (error) throw error;

    const totalLessons = data?.reduce((acc, topic) => acc + (topic.lessons?.length || 0), 0) || 0;
    const completedLessons = data?.reduce((acc, topic) => 
      acc + (topic.lessons?.filter(lesson => 
        lesson.user_progress?.[0]?.is_completed
      ).length || 0), 0) || 0;

    return {
      totalLessons,
      completedLessons,
      percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
    };
  }
};