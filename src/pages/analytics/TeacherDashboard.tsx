/* eslint-disable no-console */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useParams } from 'react-router-dom';

type Row = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  active_time_seconds: number;
  attempts: number;
  avg_marks: number | null;
  any_released: boolean;
};

type SlotMetric = {
  slot_index: number;
  p50_time_secs: number | null;
  avg_marks: number | null;
  release_rate: number | null;
};

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

const TeacherDashboard: React.FC = () => {
  const { courseId, classId, lessonId } = useParams<{courseId: string; classId: string; lessonId: string;}>();

  const [rows, setRows] = useState<Row[]>([]);
  const [slots, setSlots] = useState<SlotMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) Per-student summaries for this class + lesson
        const { data: summary, error: e1 } = await supabase
          .from('v_class_lesson_summary')
          .select('user_id, class_id, lesson_id, active_time, attempts, avg_marks, any_released')
          .eq('class_id', classId)
          .eq('lesson_id', lessonId);

        if (e1) throw e1;

        const uids = Array.from(new Set((summary ?? []).map((r: any) => r.user_id)));
        const { data: profiles, error: e2 } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', uids);

        if (e2) throw e2;

        const byId = new Map<string, { name: string|null; email: string|null }>();
        (profiles ?? []).forEach((p: any) => {
          byId.set(p.id, { name: p.full_name ?? null, email: p.email ?? null });
        });

        const mapped: Row[] = (summary ?? []).map((r: any) => ({
          user_id: r.user_id,
          name: byId.get(r.user_id)?.name ?? null,
          email: byId.get(r.user_id)?.email ?? null,
          active_time_seconds: Math.max(0, Math.round((r.active_time?.seconds ?? 0) + (r.active_time?.minutes ?? 0)*60 + (r.active_time?.hours ?? 0)*3600)),
          attempts: r.attempts ?? 0,
          avg_marks: r.avg_marks,
          any_released: !!r.any_released,
        }));

        // 2) Slot-level difficulty metrics
        const { data: slotMetrics, error: e3 } = await supabase
          .from('v_class_slot_metrics')
          .select('slot_index, p50_time_secs, avg_marks, release_rate')
          .eq('class_id', classId)
          .eq('lesson_id', lessonId)
          .order('slot_index', { ascending: true });

        if (e3) throw e3;

        if (!cancelled) {
          setRows(mapped);
          setSlots((slotMetrics ?? []).map((s: any) => ({
            slot_index: s.slot_index,
            p50_time_secs: s.p50_time_secs,
            avg_marks: s.avg_marks,
            release_rate: s.release_rate,
          })));
        }
      } catch (e: any) {
        if (!cancelled) setErr(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, classId, lessonId]);

  if (loading) return <div className="p-4 text-sm text-gray-600">Loading analytics…</div>;
  if (err) return <div className="p-4 text-sm text-red-600">Error: {err}</div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Class Analytics</h1>

      {/* Class overview */}
      <div className="bg-white border rounded p-4">
        <h2 className="font-medium mb-2">Student overview</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Active time</th>
                <th className="py-2 pr-4">Attempts</th>
                <th className="py-2 pr-4">Avg marks</th>
                <th className="py-2 pr-4">Released?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.name ?? '—'}</td>
                  <td className="py-2 pr-4">{r.email ?? '—'}</td>
                  <td className="py-2 pr-4">{fmtDuration(r.active_time_seconds)}</td>
                  <td className="py-2 pr-4">{r.attempts}</td>
                  <td className="py-2 pr-4">{r.avg_marks != null ? r.avg_marks.toFixed(2) : '—'}</td>
                  <td className="py-2 pr-4">{r.any_released ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Common struggle points */}
      <div className="bg-white border rounded p-4">
        <h2 className="font-medium mb-2">Common struggle points</h2>
        <p className="text-xs text-gray-600 mb-3">
          Highlighted when median time is high and marks/release rate are low.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-[600px] w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-4">Slot</th>
                <th className="py-2 pr-4">Median time</th>
                <th className="py-2 pr-4">Avg marks</th>
                <th className="py-2 pr-4">Release rate</th>
                <th className="py-2 pr-4">Flag</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => {
                const highTime = (s.p50_time_secs ?? 0) > 600; // > 10m
                const lowMarks = (s.avg_marks ?? 9999) < 0.6 * 100; // adjust if you have max_marks scaling
                const lowRelease = (s.release_rate ?? 1) < 0.3;
                const flagged = highTime && (lowMarks || lowRelease);
                return (
                  <tr key={s.slot_index} className="border-b last:border-0">
                    <td className="py-2 pr-4">Slot {s.slot_index}</td>
                    <td className="py-2 pr-4">{s.p50_time_secs != null ? fmtDuration(s.p50_time_secs) : '—'}</td>
                    <td className="py-2 pr-4">{s.avg_marks != null ? s.avg_marks.toFixed(1) : '—'}</td>
                    <td className="py-2 pr-4">{s.release_rate != null ? `${Math.round(s.release_rate * 100)}%` : '—'}</td>
                    <td className="py-2 pr-4">{flagged ? '⚠️' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
