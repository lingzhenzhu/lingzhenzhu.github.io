import { useCallback, useEffect, useRef, useState } from 'react';
import { ContentSchema, type Content } from '@lzzhu/content';
import {
  diffResources,
  historyEntry,
  applyResources,
  mergeAcknowledgement,
  type WorkspaceSnapshot,
  type VersionMap,
  type HistoryEntry,
  type ChangeRequest,
  type ChangeResponse,
} from '@lzzhu/content/resources';
import { api, send } from './api';
import { describeIssue } from './validation';
import { trimHistory } from './resource-history';
const conflictMessage =
  'Content changed in another session. Your edits are kept here. Reload the saved version before continuing.';

/** One queue survives navigation; each request contains only changed resources. */
export function useDraft() {
  const [content, setContent] = useState<Content>();
  const draft = useRef<Content | undefined>(undefined);
  const baseline = useRef<Content | undefined>(undefined);
  const versions = useRef<VersionMap>({});
  const pending = useRef<{
    request: ChangeRequest;
    base: Content;
    captured: Content;
    counter: number;
  } | null>(null);
  const [message, setMessage] = useState('Connecting…');
  const [error, setError] = useState('');
  const [local, setLocal] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const loading = useRef<Promise<void> | null>(null);
  const edits = useRef(0),
    saved = useRef(0),
    revision = useRef(0);
  const saving = useRef<Promise<void> | null>(null),
    halted = useRef(false);
  const unresolvedConflict = useRef(false);
  const undo = useRef<HistoryEntry[]>([]),
    redo = useRef<HistoryEntry[]>([]);
  const load = useCallback(async () => {
    if (loading.current) return loading.current;
    setIsLoading(true);
    const task = (async () => {
      // A previous save must finish before GET chooses the saved draft to restore.
      await saving.current?.catch(() => {});
      const counter = edits.current;
      const session = await api<{ identity: { local: boolean } }>('/session');
      const snapshot = await api<WorkspaceSnapshot>('/content');
      const { resourceVersions, ...data } = snapshot;
      if (edits.current !== counter)
        throw new Error(
          'The draft changed while reloading. Your new edits were kept. Reload again to discard them.',
        );
      setLocal(session.identity.local);
      draft.current = data;
      baseline.current = data;
      versions.current = resourceVersions;
      pending.current = null;
      revision.current = data.revision;
      edits.current = saved.current = 0;
      halted.current = false;
      unresolvedConflict.current = false;
      undo.current = [];
      redo.current = [];
      setContent(data);
      setMessage('All changes saved');
      setError('');
      setPreviewVersion((v) => v + 1);
    })();
    loading.current = task;
    try {
      await task;
    } finally {
      loading.current = null;
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const change = (fn: (value: Content) => Content, record = true) => {
    if (!draft.current) return;
    const next = fn(draft.current);
    const entry = historyEntry(draft.current, next);
    if (!entry.after.length) return;
    if (record) {
      undo.current.push(entry);
      trimHistory(undo.current);
      redo.current = [];
    }
    draft.current = next;
    edits.current++;
    setContent(draft.current);
    setMessage('Unsaved changes');
  };
  const save = useCallback(async (): Promise<void> => {
    if (loading.current) {
      await loading.current;
      return save();
    }
    if (unresolvedConflict.current) throw new Error(conflictMessage);
    if (saving.current) {
      await saving.current;
      if (saved.current < edits.current) return save();
      return;
    }
    if (!draft.current || !baseline.current || saved.current === edits.current) return;
    const captured = pending.current?.captured || draft.current,
      counter = pending.current?.counter ?? edits.current;
    const validation = ContentSchema.safeParse(captured);
    if (!validation.success) {
      const explanation = validation.error.issues
        .map((i) => describeIssue(captured, i.path, i.message))
        .join('; ');
      setMessage('Needs attention');
      setError(explanation);
      throw new Error(explanation);
    }
    if (!pending.current) {
      const changes = diffResources(baseline.current, captured);
      if (!changes.length) {
        saved.current = counter;
        setMessage('All changes saved');
        return;
      }
      pending.current = {
        base: baseline.current,
        captured,
        counter,
        request: {
          mutationId: crypto.randomUUID(),
          baseRevision: revision.current,
          changes: changes.map((change) => ({
            ...change,
            expectedRevision: versions.current[change.key] ?? null,
          })),
        },
      };
    }
    const transaction = pending.current;
    setMessage('Saving…');
    const task = (async () => {
      try {
        const result = await send<ChangeResponse>('/content', transaction.request, 'PATCH');
        const merged = mergeAcknowledgement(
          transaction.base,
          captured,
          draft.current!,
          versions.current,
          result,
        );
        baseline.current = merged.saved;
        versions.current = merged.versions;
        pending.current = null;
        revision.current = result.revision;
        saved.current = counter;
        if (draft.current) {
          draft.current = merged.current;
          setContent(draft.current);
        }
        const own = new Set(transaction.request.changes.map((change) => change.key));
        const remote = new Set(
          result.changes
            .filter((change) => !own.has(change.key) || change.revision > result.commitRevision)
            .map((change) => change.key),
        );
        undo.current = undo.current.filter((entry) => !entry.after.some((change) => remote.has(change.key)));
        redo.current = redo.current.filter((entry) => !entry.after.some((change) => remote.has(change.key)));
        if (merged.conflicts.length) {
          unresolvedConflict.current = true;
          throw new Error(conflictMessage);
        }
        setMessage(saved.current === edits.current ? 'All changes saved' : 'Unsaved changes');
        setError('');
        setPreviewVersion((v) => v + 1);
      } catch (e) {
        halted.current = true;
        setMessage('Saving paused');
        setError((e as Error).message);
        throw e;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = task;
    await task;
    if (saved.current < edits.current) return save();
  }, []);
  useEffect(() => {
    if (!content || isLoading || halted.current || edits.current === saved.current) return;
    const timer = setTimeout(() => {
      // A manual save can fail after this timer was scheduled. Only explicit
      // retry may resume a paused queue; re-check its live state at execution.
      if (halted.current || loading.current) return;
      save().catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [content, isLoading, save]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (edits.current !== saved.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, []);
  const run = (task: () => Promise<unknown>) => {
    if (!halted.current) setError('');
    task().catch((e) => setError(e.message));
  };
  const historyAction = (back: boolean) => {
    const value = (back ? undo.current : redo.current).pop();
    if (!value || !draft.current) return;
    (back ? redo.current : undo.current).push(value);
    change((current) => applyResources(current, back ? value.before : value.after), false);
  };
  return {
    content,
    change,
    save,
    load,
    run,
    local,
    message,
    setMessage,
    error,
    revision,
    previewVersion,
    canUndo: !!undo.current.length,
    canRedo: !!redo.current.length,
    historyAction,
    retrySave: () => {
      if (!unresolvedConflict.current) halted.current = false;
      return save();
    },
  };
}
