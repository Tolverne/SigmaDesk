/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  classId: string;
  courseId: string;
  lessonId: string;
};

function secsFromPgInterval(x: any): number {
  if (!x) return 0;
  const sec = (x.seconds ?? 0) + 60*(x.minutes ?? 0) + 3600*(x.hours ?? 0) + 86400*(x.days ?? 0);
  return Math.max(0, Math.round(sec));
}

const StudentProgressCard: React.FC<Props> = ({ classId, courseId, lessonId }) => {
  const { user } = useAuth();
  const uid = user?.id;

  const [timeToday, setTimeToday] = useState<number>(0);
  const [timeTotal, setTimeTotal] = useState<number>(0);
  const [attempts7d, setAttempts7d] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);

        // Time today
        const today = new Date(); today.setHours(0,0,0,0);
        const { data: mvToday, error: e1 } = await supabase
          .from('mv_student_active_time')
          .select('active_time')
          .eq('user_id', uid)
          .eq('class_id', classId)
          .eq('lesson_id', lessonId)
          .gte('day', today.toISOString());

        if (e1) throw e1;

        // Total time (this lesson)
        const { data: mvAll, error: e2 } = await supabase
          .from('mv_student_active_time')
          .select('active_time')
          .eq('user_id', uid)
          .eq('class_id', classId)
          .eq('lesson_id', lessonId);

        if (e2) throw e2;

        // Attempts (last 7 days)
        const seven = new Date(Date.now() - 7*86400000);
        const { data: attempts, error: e3 } = await supabase
          .from('v_attempts_daily')
          .select('attempts')
          .eq('user_id', uid)
          .eq('class_id', classId)
          .eq('lesson_id', lessonId)
          .gte('day', seven.toISOString());

        if (e3) throw e3;

        if (!cancelled) {
          setTimeToday((mvToday ?? []).reduce((acc: number, r: any) => acc + secsFromPgInterval(r.active_time), 0));
          setTimeTotal((mvAll ?? []).reduce((acc: number, r: any) => acc + secsFromPgInterval(r.active_time), 0));
          setAttempts7d((attempts ?? []).reduce((acc: number, r: any) => acc + (r.attempts ?? 0), 0));
        }
      } catch (e: any) {
        // swallow
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, classId, lessonId, courseId]);

  if (loading) return <div className="border rounded p-3 text-sm text-gray-600">Loading your progress…</div>;

  return (
    <div className="border rounded p-3">
      <div className="font-medium mb-1">Your progress</div>
      <div className="text-sm text-gray-700 space-y-1">
        <div>Time today: <b>{Math.floor(timeToday/60)}m {timeToday%60}s</b></div>
        <div>Total time (this lesson): <b>{Math.floor(timeTotal/60)}m {timeTotal%60}s</b></div>
        <div>Attempts (last 7d): <b>{attempts7d}</b></div>
      </div>
    </div>
  );
};

export default StudentProgressCard;
