import { supabase } from '../utils/supabase';
import { Course, Topic, Lesson, Enrollment, UserProgress } from '../types/course.types';

// Type for Supabase nested query responses
interface TopicWithLessons extends Omit<Topic, 'lessons'> {
  lessons?: Array<{
    id: string;
    title: string;
    description?: string;
    estimated_minutes: number;
    display_order: number;
  }>;
}

export const courseService = {
  // Fetch all published courses with better error handling
  async getCourses(): Promise<Course[]> {
    console.log('🔍 courseService: Fetching courses...');
    
    try {
      // Add a timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const queryPromise = supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          organization_id,
          is_published,
          display_order,
          created_at,
          updated_at
        `)
        .eq('is_published', true)
        .order('display_order');
  
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error('🔍 courseService: Database error:', error);
        // Handle specific error types
        if (error.code === 'PGRST301') {
          throw new Error('Unauthorized access to courses. Please check your login.');
        } else if (error.code === 'PGRST204') {
          console.log('🔍 courseService: No courses found');
          return [];
        }
        throw new Error(`Database error: ${error.message}`);
      }
      
      console.log('🔍 courseService: Fetched courses:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('🔍 courseService: Exception in getCourses:', error);
      if (error instanceof Error && error.message === 'Request timeout') {
        throw new Error('Request timed out. Please check your connection.');
      }
      throw error;
    }
  },

  // Get course details with topics and lessons
  async getCourseDetails(courseId: string): Promise<Course & { topics: Topic[] }> {
    console.log('🔍 courseService: Fetching course details for:', courseId);
    
    try {
      // First get the course
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) {
        console.error('❌ Error fetching course:', courseError);
        throw new Error(`Course not found: ${courseError.message}`);
      }

      // Then get topics with lessons
      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select(`
          *,
          lessons (
            id,
            title,
            description,
            estimated_minutes,
            display_order
          )
        `)
        .eq('course_id', courseId)
        .order('display_order');

      if (topicsError) {
        console.error('❌ Error fetching topics:', topicsError);
        // Don't throw error, just return empty topics
        return { ...course, topics: [] };
      }

      // Sort lessons within each topic
      const sortedTopics = topics?.map(topic => ({
        ...topic,
        lessons: topic.lessons?.sort((a: { display_order: number }, b: { display_order: number }) => 
          a.display_order - b.display_order
        ) || []
      })) || [];

      console.log('✅ Course details fetched successfully');
      return { ...course, topics: sortedTopics };
    } catch (error) {
      console.error('❌ Exception in getCourseDetails:', error);
      throw error;
    }
  },

  // Get user's enrolled courses with better error handling
  async getEnrolledCourses(userId: string): Promise<Course[]> {
    console.log('🔍 courseService: Fetching enrolled courses for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          courses!inner (
            id,
            title,
            description,
            thumbnail_url,
            organization_id,
            is_published,
            display_order,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId);
  
      if (error) {
        console.error('❌ Error fetching enrolled courses:', error);
        // Don't throw error, return empty array
        return [];
      }
      
      // Extract courses from the enrollment data
      const courses = data?.map((enrollment: any) => enrollment.courses).filter(Boolean) || [];
      console.log('✅ Enrolled courses fetched:', courses.length);
      return courses;
    } catch (error) {
      console.error('❌ Exception in getEnrolledCourses:', error);
      return []; // Return empty array instead of throwing
    }
  },

  // Enroll in a course with better error handling
  async enrollInCourse(courseId: string, userId: string): Promise<Enrollment> {
    console.log('📝 courseService: Enrolling user', userId, 'in course', courseId);
    
    try {
      // First check if already enrolled
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        throw new Error('Already enrolled in this course');
      }

      // Enroll the user
      const { data, error } = await supabase
        .from('enrollments')
        .insert({
          course_id: courseId,
          user_id: userId,
          enrolled_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error enrolling in course:', error);
        if (error.code === '23505') { // Unique violation
          throw new Error('Already enrolled in this course');
        } else if (error.code === '23503') { // Foreign key violation
          throw new Error('Course or user not found');
        }
        throw new Error(`Enrollment failed: ${error.message}`);
      }
      
      console.log('✅ Successfully enrolled in course');
      return data;
    } catch (error) {
      console.error('❌ Exception in enrollInCourse:', error);
      throw error;
    }
  },

  // Check enrollment status with better error handling
  async checkEnrollment(courseId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error checking enrollment:', error);
        return false; // Return false instead of throwing
      }
      
      return !!data;
    } catch (error) {
      console.error('❌ Exception in checkEnrollment:', error);
      return false;
    }
  },

  // Get topics for a course
  async getCourseTopics(courseId: string): Promise<Topic[]> {
    console.log('🔍 courseService: Fetching topics for course:', courseId);
    
    try {
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

      if (error) {
        console.error('❌ Error fetching topics:', error);
        return [];
      }
      
      // Sort lessons within each topic
      const sortedTopics = data?.map(topic => ({
        ...topic,
        lessons: topic.lessons?.sort((a: { display_order: number }, b: { display_order: number }) => 
          a.display_order - b.display_order
        ) || []
      })) || [];

      return sortedTopics;
    } catch (error) {
      console.error('❌ Exception in getCourseTopics:', error);
      return [];
    }
  },

  // Get lessons for a topic
  async getTopicLessons(topicId: string): Promise<Lesson[]> {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('topic_id', topicId)
        .order('display_order');

      if (error) {
        console.error('❌ Error fetching lessons:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('❌ Exception in getTopicLessons:', error);
      return [];
    }
  },

  // Get specific lesson with better error handling
  async getLesson(lessonId: string): Promise<Lesson> {
    console.log('🔍 courseService: Fetching lesson:', lessonId);
    
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select(`
          *,
          topics (
            id,
            title,
            course_id,
            courses (
              id,
              title
            )
          )
        `)
        .eq('id', lessonId)
        .single();

      if (error) {
        console.error('❌ Error fetching lesson:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Lesson not found');
        }
        throw new Error(`Failed to load lesson: ${error.message}`);
      }
      
      console.log('✅ Lesson fetched successfully');
      return data;
    } catch (error) {
      console.error('❌ Exception in getLesson:', error);
      throw error;
    }
  },

  // Update progress with better error handling
  async updateProgress(lessonId: string, userId: string, isCompleted: boolean): Promise<UserProgress> {
    console.log('📝 courseService: Updating progress for lesson:', lessonId);
    
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          lesson_id: lessonId,
          user_id: userId,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          started_at: new Date().toISOString() // Always update started_at
        }, {
          onConflict: 'user_id,lesson_id'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating progress:', error);
        throw new Error(`Failed to update progress: ${error.message}`);
      }
      
      console.log('✅ Progress updated successfully');
      return data;
    } catch (error) {
      console.error('❌ Exception in updateProgress:', error);
      throw error;
    }
  },

  // Get user progress for a course with better error handling
  async getCourseProgress(courseId: string, userId: string) {
    console.log('🔍 courseService: Fetching course progress:', courseId, userId);
    
    try {
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

      if (error) {
        console.error('❌ Error fetching course progress:', error);
        return { totalLessons: 0, completedLessons: 0, percentage: 0 };
      }

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
    } catch (error) {
      console.error('❌ Exception in getCourseProgress:', error);
      return { totalLessons: 0, completedLessons: 0, percentage: 0 };
    }
  }
};