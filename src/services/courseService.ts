import { supabase } from '../utils/supabase';
import { Course, Topic, Lesson, Enrollment, UserProgress } from '../types/course.types';

// -----------------------------
// Request cache to prevent duplicate requests
// -----------------------------
const requestCache = new Map<string, Promise<any>>();

// -----------------------------
// Helpers: Abort-aware dedupe & retry
// -----------------------------

/**
 * Abort-aware request deduplication.
 * - If a request with the same key is in-flight, returns it.
 * - If `signal` is aborted, rejects with AbortError and does NOT cache.
 * - On any failure (including abort), removes the cached promise.
 * - On success, evicts the cache entry after a short delay.
 */
const dedupedRequest = <T>(
  key: string,
  requestFn: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> => {
  // If the caller already aborted, fail fast
  if (signal?.aborted) {
    const err = new DOMException('Operation aborted', 'AbortError');
    return Promise.reject(err);
  }

  // If an identical request is already running, reuse it
  if (requestCache.has(key)) {
    // Optional: log once per key
    console.log('🔄 Using cached request for:', key);
    return requestCache.get(key)!;
  }

  // Wrap the request so we can react to abort and cleanup cache
  let abortListener: (() => void) | null = null;

  const promise = new Promise<T>((resolve, reject) => {
    // If the signal aborts, reject and cleanup
    if (signal) {
      abortListener = () => {
        console.log('⏹️ Request aborted for:', key);
        requestCache.delete(key);
        reject(new DOMException('Operation aborted', 'AbortError'));
      };
      signal.addEventListener('abort', abortListener, { once: true });
    }

    requestFn()
      .then((res) => {
        resolve(res);
      })
      .catch((error) => {
        // Remove failed requests from cache immediately
        console.log('❌ Request failed, removing from cache:', key);
        requestCache.delete(key);
        reject(error);
      })
      .finally(() => {
        // Detach abort listener
        if (signal && abortListener) {
          signal.removeEventListener('abort', abortListener);
        }
        // Clean up successful requests after delay
        // setTimeout(() => {
        //   requestCache.delete(key);
        // }, 5000);
      });
  });

  requestCache.set(key, promise);
  return promise;
};

/**
 * Retry with exponential backoff.
 * - Aborts immediately if `signal` is aborted.
 * - Checks connection health between retries.
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  signal?: AbortSignal
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }
    try {
      return await operation();
    } catch (error) {
      // If aborted during the operation, surface abort immediately
      if (signal?.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }

      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) throw error;

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        if (signal) {
          const onAbort = () => {
            clearTimeout(t);
            reject(new DOMException('Operation aborted', 'AbortError'));
          };
          signal.addEventListener('abort', onAbort, { once: true });
        }
      });

      // Check connection health before retry
      const isHealthy = await checkConnection();
      if (!isHealthy) {
        console.error('🔴 Connection unhealthy, skipping retry');
        throw new Error('Connection lost');
      }
    }
  }
  throw new Error('Max retries exceeded');
};

// -----------------------------
// Connection health check
// -----------------------------
const checkConnection = async (): Promise<boolean> => {
  try {
    // Minimal query—if it returns, we consider the connection OK
    await supabase.from('organizations').select('count').limit(1).single();
    return true;
  } catch (error) {
    console.error('🔴 Connection check failed:', error);
    return false;
  }
};

// -----------------------------
// Public API (now abort-aware; options are optional/back-compat)
// -----------------------------
type RequestOpts = { signal?: AbortSignal };

export const courseService = {
  // Fetch all published courses
  async getCourses(opts?: RequestOpts): Promise<Course[]> {
    const cacheKey = 'get-courses';

    return dedupedRequest(
      cacheKey,
      async () => {
        console.log('🔍 courseService: Fetching courses...');

        return withRetry(
          async () => {
            try {
              const { data, error } = await supabase
                .from('courses')
                .select(
                  `
                  id,
                  title,
                  description,
                  thumbnail_url,
                  organization_id,
                  is_published,
                  display_order,
                  created_at,
                  updated_at
                `
                )
                .eq('is_published', true)
                .order('display_order');

              if (error) {
                console.error('🔍 courseService: Database error:', error);

                // Handle specific error types
                if ((error as any).code === 'PGRST301') {
                  throw new Error('Unauthorized access to courses. Please refresh and try again.');
                } else if ((error as any).code === 'PGRST204' || (error as any).code === 'PGRST116') {
                  console.log('🔍 courseService: No courses found');
                  return [];
                } else if ((error as any).message?.includes('JWT')) {
                  throw new Error('Session expired. Please sign in again.');
                }

                throw new Error(`Database error: ${(error as any).message}`);
              }

              const courses = data || [];
              console.log('🔍 courseService: Fetched courses:', courses.length);
              return courses;
            } catch (error) {
              console.error('🔍 courseService: Exception in getCourses:', error);
              throw error;
            }
          },
          2,
          2000,
          opts?.signal
        );
      },
      opts?.signal
    );
  },

  // Get course details with improved error handling
  async getCourseDetails(courseId: string, opts?: RequestOpts): Promise<Course & { topics: Topic[] }> {
    const cacheKey = `course-details-${courseId}`;

    return dedupedRequest(
      cacheKey,
      async () => {
        console.log('🔍 courseService: Fetching course details for:', courseId);

        return withRetry(
          async () => {
            try {
              // Get course and topics in parallel
              const [courseResult, topicsResult] = await Promise.all([
                supabase.from('courses').select('*').eq('id', courseId).single(),
                supabase
                  .from('topics')
                  .select(
                    `
                    *,
                    lessons (
                      id,
                      title,
                      description,
                      estimated_minutes,
                      display_order
                    )
                  `
                  )
                  .eq('course_id', courseId)
                  .order('display_order'),
              ]);

              if (courseResult.error) {
                console.error('❌ Error fetching course:', courseResult.error);
                throw new Error(`Course not found: ${courseResult.error.message}`);
              }

              const topics = topicsResult.error ? [] : topicsResult.data;

              // Sort lessons within each topic
              const sortedTopics =
                topics?.map((topic: any) => ({
                  ...topic,
                  lessons:
                    topic.lessons?.sort(
                      (a: { display_order: number }, b: { display_order: number }) =>
                        a.display_order - b.display_order
                    ) || [],
                })) || [];

              console.log('✅ Course details fetched successfully');
              return { ...(courseResult.data as Course), topics: sortedTopics };
            } catch (error) {
              console.error('❌ Exception in getCourseDetails:', error);
              throw error;
            }
          },
          3,
          1000,
          opts?.signal
        );
      },
      opts?.signal
    );
  },

  // Get user's enrolled courses
  async getEnrolledCourses(userId: string, opts?: RequestOpts): Promise<Course[]> {
    const cacheKey = `enrolled-courses-${userId}`;

    return dedupedRequest(
      cacheKey,
      async () => {
        console.log('🔍 courseService: Fetching enrolled courses for user:', userId);

        return withRetry(
          async () => {
            try {
              const { data, error } = await supabase
                .from('enrollments')
                .select(
                  `
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
                `
                )
                .eq('user_id', userId);

              if (error) {
                console.error('❌ Error fetching enrolled courses:', error);
                return []; // Return empty array instead of throwing
              }

              const courses =
                data?.map((enrollment: any) => enrollment.courses).filter(Boolean) || [];
              console.log('✅ Enrolled courses fetched:', courses.length);
              return courses as Course[];
            } catch (error) {
              console.error('❌ Exception in getEnrolledCourses:', error);
              return []; // Return empty array instead of throwing
            }
          },
          1,
          1000,
          opts?.signal
        );
      },
      opts?.signal
    );
  },

  // Enroll in a course with better conflict handling
  async enrollInCourse(courseId: string, userId: string, opts?: RequestOpts): Promise<Enrollment> {
    console.log('📝 courseService: Enrolling user', userId, 'in course', courseId);

    return withRetry(
      async () => {
        try {
          // Check if already enrolled first
          const { data: existing } = await supabase
            .from('enrollments')
            .select('id')
            .eq('course_id', courseId)
            .eq('user_id', userId)
            .maybeSingle();

          if (existing) {
            throw new Error('Already enrolled in this course');
          }

          // Enroll the user
          const { data, error } = await supabase
            .from('enrollments')
            .insert({
              course_id: courseId,
              user_id: userId,
              enrolled_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) {
            console.error('❌ Error enrolling in course:', error);
            if ((error as any).code === '23505') {
              throw new Error('Already enrolled in this course');
            } else if ((error as any).code === '23503') {
              throw new Error('Course or user not found');
            } else if ((error as any).message?.includes('JWT')) {
              throw new Error('Session expired. Please sign in again.');
            }
            throw new Error(`Enrollment failed: ${(error as any).message}`);
          }

          // Clear relevant caches after successful enrollment
          requestCache.delete(`enrolled-courses-${userId}`);

          console.log('✅ Successfully enrolled in course');
          return data as Enrollment;
        } catch (error) {
          console.error('❌ Exception in enrollInCourse:', error);
          throw error;
        }
      },
      2,
      1000,
      opts?.signal
    );
  },

  // Check enrollment status
  async checkEnrollment(courseId: string, userId: string, opts?: RequestOpts): Promise<boolean> {
    const cacheKey = `enrollment-check-${courseId}-${userId}`;

    return dedupedRequest(
      cacheKey,
      async () => {
        try {
          const { data, error } = await supabase
            .from('enrollments')
            .select('id')
            .eq('course_id', courseId)
            .eq('user_id', userId)
            .maybeSingle();

          if (error && (error as any).code !== 'PGRST116') {
            console.error('❌ Error checking enrollment:', error);
            return false;
          }

          return !!data;
        } catch (error) {
          console.error('❌ Exception in checkEnrollment:', error);
          return false;
        }
      },
      opts?.signal
    );
  },

  // Get topics for a course
  async getCourseTopics(courseId: string, opts?: RequestOpts): Promise<Topic[]> {
    const cacheKey = `course-topics-${courseId}`;

    return dedupedRequest(
      cacheKey,
      async () => {
        console.log('🔍 courseService: Fetching topics for course:', courseId);

        try {
          const { data, error } = await supabase
            .from('topics')
            .select(
              `
              *,
              lessons (
                id,
                title,
                display_order,
                estimated_minutes
              )
            `
            )
            .eq('course_id', courseId)
            .order('display_order');

          if (error) {
            console.error('❌ Error fetching topics:', error);
            return [];
          }

          const sortedTopics =
            data?.map((topic: any) => ({
              ...topic,
              lessons:
                topic.lessons?.sort(
                  (a: { display_order: number }, b: { display_order: number }) =>
                    a.display_order - b.display_order
                ) || [],
            })) || [];

          return sortedTopics as Topic[];
        } catch (error) {
          console.error('❌ Exception in getCourseTopics:', error);
          return [];
        }
      },
      opts?.signal
    );
  },

  // Get lessons for a topic
  async getTopicLessons(topicId: string, _opts?: RequestOpts): Promise<Lesson[]> {
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
      return (data || []) as Lesson[];
    } catch (error) {
      console.error('❌ Exception in getTopicLessons:', error);
      return [];
    }
  },

  // Get specific lesson
  async getLesson(lessonId: string, opts?: RequestOpts): Promise<Lesson> {
    const cacheKey = `lesson-${lessonId}`;

    return dedupedRequest(
      cacheKey,
      async () => {
        console.log('🔍 courseService: Fetching lesson:', lessonId);

        return withRetry(
          async () => {
            try {
              const { data, error } = await supabase
                .from('lessons')
                .select(
                  `
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
                `
                )
                .eq('id', lessonId)
                .single();

              if (error) {
                console.error('❌ Error fetching lesson:', error);
                if ((error as any).code === 'PGRST116') {
                  throw new Error('Lesson not found');
                }
                throw new Error(`Failed to load lesson: ${(error as any).message}`);
              }

              console.log('✅ Lesson fetched successfully');
              return data as Lesson;
            } catch (error) {
              console.error('❌ Exception in getLesson:', error);
              throw error;
            }
          },
          3,
          1000,
          opts?.signal
        );
      },
      opts?.signal
    );
  },

  // Update progress
  async updateProgress(
    lessonId: string,
    userId: string,
    isCompleted: boolean,
    opts?: RequestOpts
  ): Promise<UserProgress> {
    console.log('📝 courseService: Updating progress for lesson:', lessonId);

    return withRetry(
      async () => {
        try {
          const { data, error } = await supabase
            .from('user_progress')
            .upsert(
              {
                lesson_id: lessonId,
                user_id: userId,
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null,
                started_at: new Date().toISOString(),
              },
              {
                onConflict: 'user_id,lesson_id',
              }
            )
            .select()
            .single();

          if (error) {
            console.error('❌ Error updating progress:', error);
            throw new Error(`Failed to update progress: ${(error as any).message}`);
          }

          console.log('✅ Progress updated successfully');
          return data as UserProgress;
        } catch (error) {
          console.error('❌ Exception in updateProgress:', error);
          throw error;
        }
      },
      2,
      1000,
      opts?.signal
    );
  },

  // Get user progress for a course
  async getCourseProgress(courseId: string, userId: string, _opts?: RequestOpts) {
    console.log('🔍 courseService: Fetching course progress:', courseId, userId);

    try {
      const { data, error } = await supabase
        .from('topics')
        .select(
          `
          lessons (
            id,
            user_progress!left (
              is_completed
            )
          )
        `
        )
        .eq('course_id', courseId);

      if (error) {
        console.error('❌ Error fetching course progress:', error);
        return { totalLessons: 0, completedLessons: 0, percentage: 0 };
      }

      const totalLessons =
        data?.reduce((acc: number, topic: any) => acc + (topic.lessons?.length || 0), 0) || 0;
      const completedLessons =
        data?.reduce(
          (acc: number, topic: any) =>
            acc +
            (topic.lessons?.filter((lesson: any) => lesson.user_progress?.[0]?.is_completed)
              .length || 0),
          0
        ) || 0;

      return {
        totalLessons,
        completedLessons,
        percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      };
    } catch (error) {
      console.error('❌ Exception in getCourseProgress:', error);
      return { totalLessons: 0, completedLessons: 0, percentage: 0 };
    }
  },

  // Clear all caches (useful for debugging)
  clearCache(): void {
    console.log('🧹 Clearing courseService cache...');
    requestCache.clear();
  },
};

// Make courseService available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).courseService = courseService;
}