/* eslint-disable no-console */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';

type ClassLite = {
  id: string;
  name: string;
  course_id: string;
  course_title?: string | null;
};

type TopicLite = { id: string; title: string | null };
type LessonLite = { id: string; title: string | null; topic_id: string };

// Helper to normalize a nested relation that may be an object OR array
function firstOrNull<T>(x: T | T[] | null | undefined): T | null {
  if (Array.isArray(x)) return (x[0] as T) ?? null;
  return (x as T) ?? null;
}

const AnalyticsHomePage: React.FC = () => {
  const { user, profile } = useAuth();
  const role = (profile?.role || 'student') as 'student' | 'teacher' | 'admin' | 'super_admin';

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassLite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [topics, setTopics] = useState<TopicLite[]>([]);
  const [lessons, setLessons] = useState<LessonLite[]>([]);

  const selectedClass = useMemo(
    () => classes.find(c => c.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  // Load visible classes based on role (teacher/admin: taught classes, student: enrolled classes)
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoading(false);
      setError('Not signed in');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (role === 'teacher' || role === 'admin' || role === 'super_admin') {
          // Teacher/admin: classes you teach (class_teachers → classes + courses)
          const { data: ct, error: ctErr } = await supabase
            .from('class_teachers')
            .select('class_id')
            .eq('user_id', user.id);
          if (ctErr) throw ctErr;

          const classIds = (ct ?? []).map(r => r.class_id);
          if (classIds.length === 0) {
            setClasses([]);
            return;
          }

          const { data: cls, error: clsErr } = await supabase
            .from('classes')
            .select('id, name, course_id, courses ( title )')
            .in('id', classIds);
          if (clsErr) throw clsErr;

          const normalized = (cls ?? []).map((c: any) => ({
            id: c.id as string,
            name: (c.name ?? 'Untitled Class') as string,
            course_id: c.course_id as string,
            course_title: firstOrNull<any>(c.courses)?.title ?? null,
          })) as ClassLite[];

          setClasses(normalized);
        } else {
          // Student: classes you are enrolled in (enrollments → classes + courses)
          const { data: enr, error: enrErr } = await supabase
            .from('enrollments')
            .select('class_id, course_id, classes ( id, name ), courses ( id, title )')
            .eq('user_id', user.id);
          if (enrErr) throw enrErr;

          const seen = new Set<string>();
          const normalized: ClassLite[] = [];

          for (const r of (enr ?? []) as any[]) {
            // Normalize possibly-array nested relations
            const c = firstOrNull<any>(r.classes);
            const course = firstOrNull<any>(r.courses);

            const cid = c?.id as string | undefined;
            if (!cid || seen.has(cid)) continue;

            seen.add(cid);
            normalized.push({
              id: cid,
              name: (c?.name ?? 'Untitled Class') as string,
              course_id: (r.course_id ?? course?.id) as string, // fall back to nested course id if needed
              course_title: (course?.title ?? null) as string | null,
            });
          }

          setClasses(normalized);
        }
      } catch (e: any) {
        console.error('[AnalyticsHome] load classes failed', e);
        if (!cancelled) setError(e?.message || 'Failed to load classes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id, role]);

  // When a class is selected, fetch topics + lessons for its course
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedClass?.course_id) {
        setTopics([]);
        setLessons([]);
        return;
      }
      try {
        setLessonsLoading(true);

        const { data: t, error: tErr } = await supabase
          .from('topics')
          .select('id, title')
          .eq('course_id', selectedClass.course_id);
        if (tErr) throw tErr;

        const topicIds = (t ?? []).map((x: any) => x.id as string);
        setTopics((t ?? []) as TopicLite[]);

        if (topicIds.length === 0) {
          setLessons([]);
          return;
        }

        const { data: l, error: lErr } = await supabase
          .from('lessons')
          .select('id, title, topic_id')
          .in('topic_id', topicIds);
        if (lErr) throw lErr;

        setLessons((l ?? []) as LessonLite[]);
      } catch (e: any) {
        console.error('[AnalyticsHome] load lessons failed', e);
      } finally {
        if (!cancelled) setLessonsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedClass?.course_id]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Analytics</h1>
        <p className="text-gray-600">
          {role === 'teacher' || role === 'admin' || role === 'super_admin'
            ? 'Choose a class to explore class and lesson analytics.'
            : 'Choose a class to review your progress, then drill into lessons.'}
        </p>
      </div>

      {/* Classes */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Your Classes</h2>

        {loading ? (
          <div className="text-sm text-gray-500">Loading classes…</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : classes.length === 0 ? (
          <div className="text-sm text-gray-600">No classes found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className={`text-left p-3 border rounded hover:bg-gray-50 transition ${
                  selectedClassId === c.id ? 'border-sigma-blue ring-1 ring-sigma-blue' : 'border-gray-200'
                }`}
              >
                <div className="text-sm font-semibold text-gray-800">{c.name}</div>
                <div className="text-xs text-gray-600">{c.course_title || 'Untitled Course'}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lessons for selected class */}
      {selectedClass && (
        <div className="bg-white border rounded-lg p-4 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-700">
              Lessons in {selectedClass.course_title || 'Course'}
            </h2>
            <button
              onClick={() => setSelectedClassId(null)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Change class
            </button>
          </div>

          {lessonsLoading ? (
            <div className="mt-2 text-sm text-gray-500">Loading lessons…</div>
          ) : lessons.length === 0 ? (
            <div className="mt-2 text-sm text-gray-600">No lessons found.</div>
          ) : (
            <div className="mt-3 space-y-4">
              {topics.map((t) => {
                const topicLessons = lessons.filter((l) => l.topic_id === t.id);
                if (topicLessons.length === 0) return null;
                return (
                  <div key={t.id}>
                    <div className="text-sm font-semibold text-gray-700">{t.title || 'Untitled Topic'}</div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {topicLessons.map((l) => (
                        <Link
                          key={l.id}
                          to={`/courses/${selectedClass.course_id}/classes/${selectedClass.id}/lessons/${l.id}/analytics`}
                          className="p-3 border rounded hover:bg-gray-50 text-sm text-gray-800"
                        >
                          {l.title || 'Untitled Lesson'}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsHomePage;
