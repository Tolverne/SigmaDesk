/* eslint-disable no-console */
import React, { useEffect, useMemo, useState } from 'react';
import type { CanvasSession } from '../../types/canvas.types';
import CanvasWorkspace from './CanvasWorkspace';
import CanvasPlayback from './CanvasPlayback';
import { feedbackService } from '../../services/feedbackService';
import { supabase } from '../../utils/supabase';
import type {
  FeedbackConfig,
  FeedbackEntry,
  FeedbackType,
  CanvasLock,
} from '../../types/feedback.types';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Save,
  CheckCircle2,
  XCircle,
  Settings,
  PlayCircle,
  Image as ImageIcon,
} from 'lucide-react';

type Props = {
  sessions: (CanvasSession & { user_name?: string })[];
  /** Optional class scope; if omitted, we'll infer the student's class per-lesson as needed. */
  classId?: string;
  /** Optional course; if omitted we resolve from lesson via topics. */
  courseId?: string;
  /** If omitted, infer from sessions[0] */
  lessonId?: string;
  slotIndex?: number;
};

const roleBadge = (role: FeedbackType) => {
  switch (role) {
    case 'marks': return 'bg-amber-100 text-amber-800';
    case 'letter': return 'bg-violet-100 text-violet-800';
    case 'text': return 'bg-green-100 text-green-800';
    case 'rubric': return 'bg-sky-100 text-sky-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const gradeLetters = ['A+','A','A-','B+','B','B-','C+','C','C-','D','E','F'];

const StudentCanvasCarousel: React.FC<Props> = ({
  sessions,
  classId,
  courseId,
  lessonId,
  slotIndex,
}) => {
  const [idx, setIdx] = useState(0);
  const [showPlayback, setShowPlayback] = useState(false);

  const hasSessions = Array.isArray(sessions) && sessions.length > 0;
  const current = hasSessions ? sessions[Math.max(0, Math.min(idx, sessions.length - 1))] : null;

  // Infer lesson/slot if missing
  const resolvedLessonId = lessonId || (sessions[0]?.lesson_id ?? '');
  const resolvedSlotIndex = typeof slotIndex === 'number' ? slotIndex : (sessions[0]?.slot_index ?? 0);

  // Resolve course for the lesson via topics (if not passed)
  const [resolvedCourseId, setResolvedCourseId] = useState<string | null>(courseId ?? null);
  useEffect(() => {
    let cancelled = false;
    if (courseId) { setResolvedCourseId(courseId); return; }
    if (!resolvedLessonId) { setResolvedCourseId(null); return; }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('topic_id, topics ( course_id )')
          .eq('id', resolvedLessonId)
          .maybeSingle();
        if (!cancelled) {
          if (error) setResolvedCourseId(null);
          else setResolvedCourseId((data as any)?.topics?.course_id ?? null);
        }
      } catch {
        if (!cancelled) setResolvedCourseId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, resolvedLessonId]);

  // Cache of inferred class per student (so we don’t refetch on every click)
  const [classByStudent, setClassByStudent] = useState<Record<string, string | null>>({});

  // Helper: resolve a class id for a specific student (via RPC, then fallback)
  const resolveClassForStudent = async (lesson_id: string, student_id: string): Promise<string | null> => {
    // 1) RPC path (if you created public.resolve_current_class_for_student)
    try {
      const { data, error } = await supabase.rpc('resolve_current_class_for_student', {
        _lesson_id: lesson_id,
        _student_id: student_id,
      });
      if (!error && data) return data as string;
    } catch (e) {
      // ignore; we'll fallback
    }

    // 2) Fallback: client-side joins: lessons -> topics -> course_id, then latest enrollment
    try {
      // Ensure we have a course id
      let course = resolvedCourseId;
      if (!course) {
        const { data: d2 } = await supabase
          .from('lessons')
          .select('topic_id, topics ( course_id )')
          .eq('id', lesson_id)
          .maybeSingle();
        course = (d2 as any)?.topics?.course_id ?? null;
      }
      if (!course) return null;

      const { data: enr, error: enrErr } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('user_id', student_id)
        .eq('course_id', course)
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (enrErr) return null;
      return (enr as any)?.class_id ?? null;
    } catch {
      return null;
    }
  };

  // Keep a derived "current class id" that always tries to be ready for the selected student
  const [currentClassId, setCurrentClassId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sid = current?.user_id;
      if (!sid || !resolvedLessonId) { setCurrentClassId(undefined); return; }

      // Use cache if present
      if (sid in classByStudent) {
        setCurrentClassId(classByStudent[sid]!);
        return;
      }

      // Otherwise resolve and cache
      const cid = await resolveClassForStudent(resolvedLessonId, sid);
      if (cancelled) return;
      setClassByStudent((m) => ({ ...m, [sid]: cid }));
      setCurrentClassId(cid);
    })();
    return () => { cancelled = true; };
  }, [current?.user_id, resolvedLessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Teacher config + entries + locks state (only when explicit classId is supplied)
  const [config, setConfig] = useState<FeedbackConfig | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const [entriesByStudent, setEntriesByStudent] = useState<Record<string, FeedbackEntry>>({});
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);

  const [classLock, setClassLock] = useState<CanvasLock | null>(null);
  const [classLockSaving, setClassLockSaving] = useState(false);

  const [studentLock, setStudentLock] = useState<CanvasLock | null>(null);
  const [studentLockSaving, setStudentLockSaving] = useState(false);

  const classScopedControls = !!classId;

  // Load class-scoped config/entries/lock when we were explicitly passed a classId
  useEffect(() => {
    let cancelled = false;
    if (!classScopedControls || !classId || !resolvedLessonId) return;

    (async () => {
      try {
        const cfg = await feedbackService.getConfig(classId, resolvedLessonId, resolvedSlotIndex);
        if (!cancelled) setConfig(cfg);

        setEntriesLoading(true);
        const list = await feedbackService.listEntriesForClassSlot(classId, resolvedLessonId, resolvedSlotIndex);
        if (!cancelled) {
          const map: Record<string, FeedbackEntry> = {};
          for (const e of list) map[e.student_id] = e;
          setEntriesByStudent(map);
        }
      } catch (e) {
        console.warn('[Carousel] load config/entries failed', e);
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }

      try {
        const lock = await feedbackService.getClassLock(classId, resolvedLessonId, resolvedSlotIndex);
        if (!cancelled) setClassLock(lock);
      } catch (e) {
        console.warn('[Carousel] getClassLock failed', e);
      }
    })();

    return () => { cancelled = true; };
  }, [classScopedControls, classId, resolvedLessonId, resolvedSlotIndex]);

  // Per-student lock follows current student (uses per-student class id, whether explicit or inferred)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!current?.user_id || !resolvedLessonId) { setStudentLock(null); return; }

      const effectiveClassId = classId ?? currentClassId ?? null;
      if (!effectiveClassId) { setStudentLock(null); return; }

      try {
        const lock = await feedbackService.getStudentLock(
          effectiveClassId, resolvedLessonId, resolvedSlotIndex, current.user_id
        );
        if (!cancelled) setStudentLock(lock);
      } catch (e) {
        if (!cancelled) setStudentLock(null);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, currentClassId, current?.user_id, resolvedLessonId, resolvedSlotIndex]);

  // Current entry (only preloaded when class-scoped)
  const currentEntry = useMemo<FeedbackEntry | null>(() => {
    if (!current?.user_id) return null;
    return entriesByStudent[current.user_id] || null;
  }, [entriesByStudent, current?.user_id]);

  const currentDisplayName =
    (current as any)?.user_name ||
    (current as any)?.display_name ||
    'Student';

  const fbType: FeedbackType = config?.feedback_type ?? 'none';

  // Config handlers (class-scoped toolbar)
  const handleSaveConfig = async (next: Partial<FeedbackConfig>) => {
    if (!classScopedControls || !classId) return;
    try {
      setConfigSaving(true);
      const saved = await feedbackService.upsertConfig({
        organization_id: config?.organization_id ?? null,
        class_id: classId,
        course_id: (resolvedCourseId ?? null),
        lesson_id: resolvedLessonId,
        slot_index: resolvedSlotIndex,
        feedback_type: (next.feedback_type ?? fbType) as FeedbackType,
        rubric_id: next.rubric_id ?? config?.rubric_id ?? null,
        max_marks: typeof next.max_marks === 'number' ? next.max_marks : (config?.max_marks ?? null),
      });
      setConfig(saved);
    } catch (e: any) {
      alert(`Failed to save settings: ${e.message || e}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleToggleReleaseAll = async () => {
    if (!classScopedControls || !classId) return;
    try {
      const next = !(config?.released ?? false);
      await feedbackService.setConfigReleased(classId, resolvedLessonId, resolvedSlotIndex, next);
      setConfig((c) => c ? { ...c, released: next, released_at: next ? new Date().toISOString() : null } : c);
    } catch (e: any) {
      alert(`Failed to toggle release: ${e.message || e}`);
    }
  };

  // ---------- Per-student feedback editor (works with explicit classId OR resolved per-student class) ----------
  const [kind, setKind] = useState<FeedbackType>('none');
  const [draftMarks, setDraftMarks] = useState<string>('');
  const [draftLetter, setDraftLetter] = useState<string>('A');
  const [draftComment, setDraftComment] = useState<string>('');

  useEffect(() => {
    setDraftMarks(currentEntry?.marks != null ? String(currentEntry.marks) : '');
    setDraftLetter(currentEntry?.letter || 'A');
    setDraftComment(currentEntry?.comment || '');
    setKind(classScopedControls ? fbType : 'none');
  }, [currentEntry?.id, fbType, classScopedControls]);

  const activeKind: FeedbackType = classScopedControls ? fbType : kind;

  const ensureEffectiveClassId = async (): Promise<string | null> => {
    // Prefer explicit classId prop
    if (classId) return classId;
    if (!current?.user_id || !resolvedLessonId) return null;

    // Cache hit?
    const cached = classByStudent[current.user_id];
    if (typeof cached !== 'undefined') return cached;

    // Resolve and cache
    const cid = await resolveClassForStudent(resolvedLessonId, current.user_id);
    setClassByStudent((m) => ({ ...m, [current.user_id!]: cid }));
    return cid;
  };

  const handleSaveEntry = async () => {
    if (!current) return;
    console.log('[Carousel] save entry click', { current, activeKind, draftMarks, resolvedCourseId });
    const effectiveClassId = await ensureEffectiveClassId();
    if (!effectiveClassId) {
      alert('Could not infer a class for this student in this lesson’s course. Are they enrolled?');
      return;
    }
    try {
      setEntrySaving(true);
      const saved = await feedbackService.upsertEntry({
        organization_id: config?.organization_id ?? null,
        class_id: effectiveClassId,
        course_id: resolvedCourseId ?? null,
        lesson_id: resolvedLessonId,
        slot_index: resolvedSlotIndex,
        session_id: current.id,
        student_id: current.user_id,
        feedback_type: activeKind,
        marks: activeKind === 'marks' ? (draftMarks === '' ? null : Number(draftMarks)) : null,
        letter: activeKind === 'letter' ? draftLetter : null,
        comment: activeKind === 'text' ? draftComment : null,
        rubric_scores: null,
      });
      setEntriesByStudent((m) => ({ ...m, [saved.student_id]: saved }));
      alert('Feedback saved.');
    } catch (e: any) {
      console.error('Save feedback failed', e);
      alert(`Failed to save feedback: ${e?.message || 'unknown error'}`);
    } finally {
      setEntrySaving(false);
    }
  };

  const handleToggleStudentRelease = async () => {
    if (!current) return;
    console.log('[Carousel] toggle student release', { current, currentClassId: classId ?? currentClassId });
    const effectiveClassId = await ensureEffectiveClassId();
    if (!effectiveClassId) {
      alert('Could not infer a class for this student in this lesson’s course.');
      return;
    }
    try {
      const prev = entriesByStudent[current.user_id];
      const next = !(prev?.released ?? false);
      await feedbackService.setEntryReleased(
        effectiveClassId, resolvedLessonId, resolvedSlotIndex, current.user_id, next
      );
      setEntriesByStudent((m) => {
        const prevEntry = m[current.user_id];
        const nextEntry = prevEntry
          ? { ...prevEntry, released: next, released_at: next ? new Date().toISOString() : null }
          : prevEntry;
        return { ...m, [current.user_id]: nextEntry! };
      });
    } catch (e: any) {
      alert(`Failed to toggle student release: ${e.message || e}`);
    }
  };

  // Locks
  const handleToggleClassLock = async () => {
    if (!classScopedControls || !classId) return;
    try {
      setClassLockSaving(true);
      const nextLocked = !(classLock?.locked ?? false);
      const saved = await feedbackService.setClassLock(
        classId, resolvedLessonId, resolvedSlotIndex, nextLocked, null
      );
      setClassLock(saved);
    } catch (e: any) {
      alert(`Failed to toggle class lock: ${e.message || e}`);
    } finally {
      setClassLockSaving(false);
    }
  };

  const handleToggleStudentLock = async () => {
    if (!current) return;
    console.log('[Carousel] toggle student lock', { current, currentClassId: classId ?? currentClassId });
    const effectiveClassId = await ensureEffectiveClassId();
    if (!effectiveClassId) {
      alert('Could not infer a class for this student in this lesson’s course.');
      return;
    }
    try {
      setStudentLockSaving(true);
      const nextLocked = !(studentLock?.locked ?? false);
      const saved = await feedbackService.setStudentLock(
        effectiveClassId, resolvedLessonId, resolvedSlotIndex, current.user_id, nextLocked, null
      );
      setStudentLock(saved);
    } catch (e: any) {
      alert(`Failed to toggle student lock: ${e.message || e}`);
    } finally {
      setStudentLockSaving(false);
    }
  };

  if (!hasSessions) {
    return <div className="text-sm text-gray-500">No student work yet.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Class-scoped settings toolbar (only if explicit classId provided) */}
      {classScopedControls && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">Feedback</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${roleBadge(fbType)}`}>
                  {fbType.toUpperCase()}
                </span>
              </div>

              <select
                disabled={configSaving}
                className="px-2 py-1 border rounded-md text-sm"
                value={fbType}
                onChange={(e) => handleSaveConfig({ feedback_type: e.target.value as FeedbackType })}
              >
                <option value="none">None</option>
                <option value="marks">Marks</option>
                <option value="letter">Letter</option>
                <option value="text">Text</option>
                <option value="rubric" disabled>Rubric (soon)</option>
              </select>

              {fbType === 'marks' && (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-600">/</span>
                  <input
                    disabled={configSaving}
                    type="number"
                    step="0.5"
                    min="0"
                    className="w-24 px-2 py-1 border rounded-md text-sm"
                    placeholder="Max"
                    value={config?.max_marks ?? ''}
                    onChange={(e) => handleSaveConfig({ max_marks: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleToggleReleaseAll}
                className={`px-3 py-1 rounded-md text-sm border ${
                  config?.released ? 'bg-green-600 text-white border-green-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Release feedback for this activity to all students"
              >
                {config?.released ? (
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Released</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><XCircle className="w-4 h-4" /> Not released</span>
                )}
              </button>

              <button
                onClick={handleToggleClassLock}
                className={`px-3 py-1 rounded-md text-sm border ${
                  classLock?.locked ? 'bg-red-600 text-white border-red-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Lock/unlock canvases for this class (this activity)"
              >
                {classLock?.locked ? (
                  <span className="inline-flex items-center gap-1"><Lock className="w-4 h-4" /> Class Locked</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><Unlock className="w-4 h-4" /> Class Unlocked</span>
                )}
              </button>

              <button
                onClick={() => setShowPlayback((v) => !v)}
                className="px-3 py-1 rounded-md text-sm border bg-white text-gray-700 hover:bg-gray-50"
              >
                {showPlayback ? (
                  <span className="inline-flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Show Final</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><PlayCircle className="w-4 h-4" /> Show Playback</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* If not class-scoped, still provide a playback toggle */}
      {!classScopedControls && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowPlayback((v) => !v)}
            className="px-3 py-1 rounded-md text-sm border bg-white text-gray-700 hover:bg-gray-50"
          >
            {showPlayback ? (
              <span className="inline-flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Show Final</span>
            ) : (
              <span className="inline-flex items-center gap-1"><PlayCircle className="w-4 h-4" /> Show Playback</span>
            )}
          </button>
        </div>
      )}

      {/* Student nav */}
      <div className="flex items-center justify-between">
        <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-sm text-gray-700">
          <span className="font-medium">{idx + 1} / {sessions.length}</span>
          <span className="mx-2">—</span>
          <span className="font-semibold">{currentDisplayName}</span>
        </div>

        <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setIdx((i) => Math.min(sessions.length - 1, i + 1))} disabled={idx >= sessions.length - 1}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas preview — never show both at once */}
      <div className="border rounded">
        {showPlayback ? (
          <CanvasPlayback sessionIds={[current!.id]} />
        ) : (
          <CanvasWorkspace
            sessionId={current!.id}
            isReadOnly={true}
            lockContext={
              (classId ?? currentClassId) && current?.user_id
                ? { classId: (classId ?? currentClassId)!, lessonId: resolvedLessonId, slotIndex: resolvedSlotIndex, studentId: current.user_id }
                : undefined
            }
          />
        )}
      </div>

      {/* Per-student feedback editor */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-medium">{currentDisplayName}</span>
            {currentEntry?.released ? (
              <span className="ml-2 text-green-700 bg-green-100 text-xs px-2 py-0.5 rounded">Released</span>
            ) : (
              <span className="ml-2 text-gray-600 bg-gray-100 text-xs px-2 py-0.5 rounded">Not released</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleStudentLock}
              className={`px-3 py-1 rounded-md text-sm border ${
                studentLock?.locked ? 'bg-red-600 text-white border-red-700' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Lock/unlock this student's canvas for this activity"
            >
              {studentLock?.locked ? (
                <span className="inline-flex items-center gap-1"><Lock className="w-4 h-4" /> Locked</span>
              ) : (
                <span className="inline-flex items-center gap-1"><Unlock className="w-4 h-4" /> Unlocked</span>
              )}
            </button>

            <button
              onClick={handleToggleStudentRelease}
              className={`px-3 py-1 rounded-md text-sm border ${
                currentEntry?.released ? 'bg-green-600 text-white border-green-700' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Release/unrelease feedback for this student"
            >
              {currentEntry?.released ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Released</span>
              ) : (
                <span className="inline-flex items-center gap-1"><XCircle className="w-4 h-4" /> Not released</span>
              )}
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="mt-4">
          {!classScopedControls && (
            <div className="mb-3">
              <label className="block text-xs text-gray-600 mb-1">Feedback Type</label>
              <select className="px-2 py-1 border rounded" value={activeKind} onChange={(e) => setKind(e.target.value as FeedbackType)}>
                <option value="none">None</option>
                <option value="marks">Marks</option>
                <option value="letter">Letter</option>
                <option value="text">Text</option>
              </select>
            </div>
          )}

          {(activeKind !== 'none') ? (
            <>
              {activeKind === 'marks' && (
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Marks</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="w-36 px-3 py-2 border rounded-md"
                      value={draftMarks}
                      onChange={(e) => setDraftMarks(e.target.value)}
                    />
                  </div>
                  {typeof config?.max_marks === 'number' && classScopedControls && (
                    <div className="pb-2 text-sm text-gray-600">/ {config.max_marks}</div>
                  )}
                  <button onClick={handleSaveEntry} disabled={entrySaving} className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-md bg-sigma-blue text-white hover:bg-blue-700">
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              )}

              {activeKind === 'letter' && (
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Grade</label>
                    <select className="w-36 px-3 py-2 border rounded-md" value={draftLetter} onChange={(e) => setDraftLetter(e.target.value)}>
                      {gradeLetters.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <button onClick={handleSaveEntry} disabled={entrySaving} className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-md bg-sigma-blue text-white hover:bg-blue-700">
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              )}

              {activeKind === 'text' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Comment</label>
                  <textarea className="w-full min-h-[100px] px-3 py-2 border rounded-md" value={draftComment} onChange={(e) => setDraftComment(e.target.value)} placeholder="Write feedback..." />
                  <div className="mt-2 text-right">
                    <button onClick={handleSaveEntry} disabled={entrySaving} className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-sigma-blue text-white hover:bg-blue-700">
                      <Save className="w-4 h-4" /> Save
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600">
              {classScopedControls ? 'Feedback is disabled for this activity.' : 'Choose a feedback type to begin.'}
            </div>
          )}

            {/* Hint if we still cannot infer a class for this student */}
            {!classId && current && currentClassId === undefined && (
            <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                Resolving this student’s class…
            </div>
            )}
            {!classId && current && currentClassId === null && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Couldn’t infer a class for this student in the current course. They might not be enrolled.
            </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default StudentCanvasCarousel;
