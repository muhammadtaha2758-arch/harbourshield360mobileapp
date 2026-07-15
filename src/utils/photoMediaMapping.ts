import { env } from '../config/env';
import type { CustomerJob } from '../types/portal';
import type { PhotoMediaItem, PhotoMediaListResponse } from '../types/photoMedia';

export type JobMedia = {
  id: string;
  jobName: string;
  before: string[];
  after: string[];
};

export function resolvePhotoDisplayUrl(url?: string | null): string {
  if (!url) {
    return '';
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const base = env.stormBuddiApiOrigin.replace(/\/+$/, '');
  return `${base}/${trimmed.replace(/^\//, '')}`;
}

export function photoItemDisplayUrl(item: PhotoMediaItem): string {
  return resolvePhotoDisplayUrl(item.display_url ?? item.url);
}

export function buildJobsMediaFromPhotos(
  jobs: CustomerJob[],
  photos: PhotoMediaListResponse,
): JobMedia[] {
  const byId = new Map<string, JobMedia>();

  for (const job of jobs) {
    if (job.id == null) {
      continue;
    }
    const id = String(job.id);
    const name = String(job.jobs ?? job.job ?? `Job #${id}`).trim() || `Job #${id}`;
    byId.set(id, { id, jobName: name, before: [], after: [] });
  }

  const attach = (items: PhotoMediaItem[] | undefined, kind: 'before' | 'after') => {
    for (const pic of items ?? []) {
      const projectId = pic.project_id != null ? String(pic.project_id) : 'unknown';
      if (!byId.has(projectId)) {
        const fallbackName =
          String(pic.project_name ?? '').trim() || `Job #${projectId}`;
        byId.set(projectId, {
          id: projectId,
          jobName: fallbackName,
          before: [],
          after: [],
        });
      }
      const url = photoItemDisplayUrl(pic);
      if (!url) {
        continue;
      }
      byId.get(projectId)![kind].push(url);
    }
  };

  attach(photos.before_pictures, 'before');
  attach(photos.after_pictures, 'after');

  const withPhotos = Array.from(byId.values()).filter(
    (entry) => entry.before.length > 0 || entry.after.length > 0,
  );

  if (withPhotos.length > 0) {
    return withPhotos;
  }

  return Array.from(byId.values());
}

/** Merge StormBuddi upload response URLs into the in-app gallery (storage lives on StormBuddi). */
export function mergeStormbuddiUploads(
  prev: JobMedia[],
  jobId: string,
  jobName: string,
  kind: 'before' | 'after',
  files: Array<{ url?: string | null }>,
): JobMedia[] {
  const urls = files
    .map((file) => resolvePhotoDisplayUrl(file.url))
    .filter((url) => url.length > 0);
  if (urls.length === 0) {
    return prev;
  }

  const listKey = kind === 'before' ? 'before' : 'after';
  const existing = prev.find((job) => job.id === jobId);
  if (existing) {
    return prev.map((job) =>
      job.id === jobId ? { ...job, [listKey]: [...job[listKey], ...urls] } : job,
    );
  }

  return [
    ...prev,
    {
      id: jobId,
      jobName,
      before: kind === 'before' ? urls : [],
      after: kind === 'after' ? urls : [],
    },
  ];
}
