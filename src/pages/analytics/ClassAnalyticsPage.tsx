/* eslint-disable no-console */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Activity,
  BarChart3,
  Clock,
  Repeat2,
  Users,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';

type EventRow = {
  user_id: string;
  class_id: string | null;
  course_id: string | null;
  lesson_id: string | null;
  slot_index: number | null;
  session_id: string | null;
  event_type:
    | 'focus' | 'blur' | 'heartbeat'
    | 'stroke' | 'undo' | 'redo' | 'clear'
    | 'playback_open' | 'playback_close';
  meta: Record<string, any> | null;
  created_at: string;
};

type Student = {
  id: string;
  display_name: string | null;
};

function msToHMM(ms: number) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTimeAgo(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const delta = Date.now() - d.getTime();
  if (delta < 60000) return 'just now';
  if (delta < 3600000) return `${Math.floor(delta / 60000)}m ago`;
  if (delta < 86400000) return `${Math.floor(delta / 3600000)}h ago`;
  return d.toLocaleString();
}

const HEARTBEAT_MS = 15_000;

const ClassAnalyticsPage: React.FC = () => {
  const { courseId, classId, lessonId } = useParams();
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';

  // State hooks must be un-conditional
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [slotOptions, setSlotOptions] = useState<number[]>([]);
  const [slotFilter, setSlotFilter] = useState<'all' | number>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Load students
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isTeacher) { setStudents([]); return; }
      if (!classId || !courseId) { setStudents([]); return; }

      try {
        const { data: enr, error: enrErr } = await supabase
          .from('enrollments')
          .select('user_id')
          .eq('class_id', classId)
          .eq('course_id', courseId);
        if (enrErr) throw enrErr;

        const userIds = Array.from(new Set((enr ?? []).map((r: any) => r.user_id)));
        if (userIds.length === 0) { if (!cancelled) setStudents([]); return; }

        const { data: profs, error: profErr } = await supabase
          .from('user_profiles')
          .select('id, display_name')
          .in('id', userIds);
        if (profErr) throw profErr;

        const list: Student[] = (profs ?? []).map((p: any) => ({
          id: p.id,
          display_name: p.display_name ?? null,
        }));
        if (!cancelled) setStudents(list);
      } catch (e) {
        console.warn('[ClassAnalytics] load students failed', e);
        if (!cancelled) setStudents([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isTeacher, classId, courseId]);

  // Load events
  const loadEvents = async () => {
    if (!isTeacher) { setEvents([]); setSlotOptions([]); return; }
    if (!classId || !lessonId) { setEvents([]); setSlotOptions([]); return; }

    try {
      setLoading(true);

      let q = supabase
        .from('student_activity_events')
        .select('*')
        .eq('class_id', classId)
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true });

      if (slotFilter !== 'all') q = q.eq('slot_index', slotFilter);

      const { data, error } = await q;
      if (error) throw error;
      setEvents((data ?? []) as EventRow[]);

      const { data: dist, error: distErr } = await supabase
        .from('student_activity_events')
        .select('slot_index')
        .eq('class_id', classId)
        .eq('lesson_id', lessonId)
        .order('slot_index', { ascending: true });
      if (!distErr) {
        const uniq = Array.from(
          new Set(
            (dist ?? [])
              .map((d: any) => d.slot_index)
              .filter((n: any) => typeof n === 'number')
          )
        ) as number[];
        setSlotOptions(uniq);
      } else {
        setSlotOptions([]);
      }
    } catch (e) {
      console.warn('[ClassAnalytics] load events failed', e);
      setEvents([]);
      setSlotOptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadEvents();
      if (!cancelled) {
        // no-op
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, classId, lessonId, slotFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  // Derived rollups (safe even if not teacher — just empty arrays)
  type PerStudent = {
    userId: string;
    name: string;
    strokes: number;
    undos: number;
    clears: number;
    attempts: number;
    timeMs: number;
    lastActive: string | null;
  };

  const perStudent: PerStudent[] = useMemo(() => {
    const byUser: Record<string, EventRow[]> = {};
    for (const row of events) {
      if (!row.user_id) continue;
      if (!byUser[row.user_id]) byUser[row.user_id] = [];
      byUser[row.user_id].push(row);
    }

    const result: PerStudent[] = Object.keys(byUser).map((uid) => {
      const list = byUser[uid].slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      let strokes = 0, undos = 0, clears = 0;
      const sessionsWithActivity = new Set<string>();

      for (const e of list) {
        if (e.event_type === 'stroke') strokes++;
        if (e.event_type === 'undo') undos++;
        if (e.event_type === 'clear') clears++;
        if (e.session_id && (e.event_type === 'stroke' || e.event_type === 'clear' || e.event_type === 'undo')) {
          sessionsWithActivity.add(e.session_id);
        }
      }

      const activityTypes = new Set(['heartbeat', 'focus', 'stroke', 'undo', 'clear', 'playback_open']);
      let timeMs = 0;
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i];
        const b = list[i + 1];
        if (!activityTypes.has(a.event_type)) continue;
        const gap = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (gap > 0) timeMs += Math.min(gap, HEARTBEAT_MS * 2);
      }

      const lastActive = list[list.length - 1]?.created_at ?? null;
      const name = students.find((s) => s.id === uid)?.display_name ?? 'Student';

      return { userId: uid, name, strokes, undos, clears, attempts: sessionsWithActivity.size, timeMs, lastActive };
    });

    for (const s of students) {
      if (!result.some((r) => r.userId === s.id)) {
        result.push({ userId: s.id, name: s.display_name ?? 'Student', strokes: 0, undos: 0, clears: 0, attempts: 0, timeMs: 0, lastActive: null });
      }
    }

    result.sort((a, b) => b.strokes - a.strokes || b.timeMs - a.timeMs);
    return result;
  }, [events, students]);

  const totals = useMemo(() => {
    const totalStrokes = perStudent.reduce((sum, r) => sum + r.strokes, 0);
    const totalTime = perStudent.reduce((sum, r) => sum + r.timeMs, 0);
    const activeStudents = perStudent.filter((r) => r.strokes > 0 || r.timeMs > 0 || r.attempts > 0).length;
    return { totalStrokes, totalTime, activeStudents };
  }, [perStudent]);

  // Now it's safe to return conditionally — hooks are all declared above
  if (!isTeacher) {
    return (
      <div className="p-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
            <Link to={`/courses/${courseId}/classes/${classId}/lessons/${lessonId}`} className="text-sm text-blue-600 hover:underline">
              Back to lesson
            </Link>
          </div>
          <div className="rounded border bg-white p-4">
            <h1 className="text-lg font-semibold mb-2">Analytics</h1>
            <p className="text-sm text-gray-600">Only teachers can view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  // Main teacher view
  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
            <Link
              to={`/courses/${courseId}/classes/${classId}/lessons/${lessonId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              Back to lesson
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Slot:</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={slotFilter === 'all' ? 'all' : String(slotFilter)}
              onChange={(e) => {
                const v = e.target.value;
                setSlotFilter(v === 'all' ? 'all' : Number(v));
              }}
            >
              <option value="all">All</option>
              {slotOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1 border rounded px-2 py-1 text-sm bg-white hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-gray-500">Students</div>
            <div className="mt-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <div className="text-lg font-semibold">{students.length}</div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-gray-500">Active Students</div>
            <div className="mt-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <div className="text-lg font-semibold">{totals.activeStudents}</div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-gray-500">Total Strokes</div>
            <div className="mt-1 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-500" />
              <div className="text-lg font-semibold">{totals.totalStrokes}</div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-gray-500">Time Spent</div>
            <div className="mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <div className="text-lg font-semibold">{msToHMM(totals.totalTime)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="text-sm font-medium">Class Overview</div>
            <div className="text-xs text-gray-600">
              Lesson: <span className="font-mono">{lessonId}</span>
              {slotFilter !== 'all' ? (
                <> • Slot: <span className="font-mono">{String(slotFilter)}</span></>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-2">Student</th>
                  <th className="px-4 py-2">Attempts <Repeat2 className="inline w-3 h-3" /></th>
                  <th className="px-4 py-2">Strokes</th>
                  <th className="px-4 py-2">Undos</th>
                  <th className="px-4 py-2">Clears</th>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : perStudent.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      No activity yet.
                    </td>
                  </tr>
                ) : (
                  perStudent.map((r) => (
                    <tr key={r.userId} className="border-t">
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2">{r.attempts}</td>
                      <td className="px-4 py-2">{r.strokes}</td>
                      <td className="px-4 py-2">{r.undos}</td>
                      <td className="px-4 py-2">{r.clears}</td>
                      <td className="px-4 py-2">{msToHMM(r.timeMs)}</td>
                      <td className="px-4 py-2">{fmtTimeAgo(r.lastActive)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ClassAnalyticsPage;
