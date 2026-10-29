import type { Content } from '@lzzhu/content';
export type DraftChange = (update: (value: Content) => Content, record?: boolean) => void;
export type RunTask = (task: () => Promise<unknown>) => void;
export type ReleaseInfo = {
  id: string;
  status: string;
  created_at: string;
  error?: string;
  artifact_hash?: string;
};
export type Asset = { id: string; filename: string; size: number };
export type Revision = { revision: number; created_at: string; created_by: string };
export type FeedState = { entries: string; succeeded_at?: string; error?: string };
export interface CollectionProps {
  content: Content;
  change: DraftChange;
}
