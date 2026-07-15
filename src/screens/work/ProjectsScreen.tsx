import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { env } from '../../config/env';
import { getMobileJobsUrl, portalService } from '../../services/api/portalService';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import type { CustomerJob } from '../../types/portal';
import { getProjectMapImageUrl, setGoogleMapsApiKey } from '../../utils/projectMapImage';
import { loadMobileConfig } from '../../services/api/configService';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import type { ProjectsStackParamList } from '../../navigation/types';
import {
  PROJECT_PIPELINE_FILTERS,
  jobMatchesPipelineFilter,
  type ProjectPipelineFilter,
  type ProjectPipelineFilterId,
} from '../../utils/jobDetailMapping';

const THUMB_SIZE = 88;

const usePortalMocks = (): boolean => env.useMockAuth === true;

function jobTitle(job: CustomerJob): string {
  const raw = job.jobs ?? job.job ?? job.description;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return job.id != null ? `Job #${String(job.id)}` : 'Untitled job';
}

function jobDisplayId(job: CustomerJob): string {
  const id = job.id != null ? String(job.id) : '';
  if (/^job-/i.test(id)) {
    return id.toUpperCase();
  }
  if (/^\d+$/.test(id)) {
    return `JOB-${id}`;
  }
  return id ? `JOB-${id}` : 'JOB-—';
}

function normalizeJobs(value: unknown): CustomerJob[] {
  if (Array.isArray(value)) {
    return value as CustomerJob[];
  }
  if (value && typeof value === 'object') {
    const asRecord = value as Record<string, unknown>;
    return Object.values(asRecord).filter((item): item is CustomerJob => !!item && typeof item === 'object');
  }
  return [];
}

function buildMockProjects(): CustomerJob[] {
  return [
    {
      id: '1025',
      jobs: 'Roof Repair - Johnson Residence',
      status: 'Inspection Appointment',
      customer_address: '1247 Maple Street, Austin, TX 78701',
      updated_at: '2026-05-15T10:00:00',
      progress: 60,
      tags: ['Repair', 'Shingle'],
    },
    {
      id: '1024',
      jobs: 'Gutter Replacement - Smith Home',
      status: 'Job completed',
      customer_address: '892 Oak Avenue, Dallas, TX 75201',
      updated_at: '2026-05-14T16:00:00',
      tags: ['Replacement', 'Gutter'],
    },
    {
      id: '1023',
      jobs: 'Leak Inspection - Davis Property',
      status: 'Proposal sent/presented',
      customer_address: '456 Pine Road, Houston, TX 77001',
      updated_at: '2026-05-13T09:00:00',
      tags: ['Inspection', 'Leak'],
    },
    {
      id: '1022',
      jobs: 'Full Roof Replacement',
      status: 'Appointment schedule',
      customer_address: '2100 Cedar Lane, San Antonio, TX 78205',
      updated_at: '2026-05-20T14:00:00',
      tags: ['Replacement'],
    },
    {
      id: '1021',
      jobs: 'Storm Damage Assessment',
      status: 'Material ordered',
      customer_address: '77 Bay View Dr, Corpus Christi, TX 78401',
      updated_at: '2026-05-16T11:00:00',
      progress: 35,
      tags: ['Inspection', 'Storm'],
    },
    {
      id: '1020',
      jobs: 'Skylight Repair',
      status: 'Invoicing payment',
      customer_address: '300 Hillcrest Blvd, Plano, TX 75024',
      updated_at: '2026-05-10T08:00:00',
      tags: ['Repair'],
    },
  ];
}

function normalizeStatusKey(status: string): string {
  return status.trim().toLowerCase();
}

function countJobsForPipeline(jobs: CustomerJob[], filter: ProjectPipelineFilter | null): number {
  if (!filter) {
    return jobs.length;
  }
  return jobs.filter((job) => jobMatchesPipelineFilter(job, filter)).length;
}

type StatusVisual = {
  badgeBg: string;
  badgeText: string;
  label: string;
};

function statusVisual(status: string): StatusVisual {
  const key = normalizeStatusKey(status);
  if (key.includes('complete')) {
    return { badgeBg: '#D1FAE5', badgeText: '#065F46', label: status || 'Completed' };
  }
  if (key.includes('hold')) {
    return { badgeBg: '#FEE2E2', badgeText: '#991B1B', label: status || 'On Hold' };
  }
  if (key.includes('schedule')) {
    return { badgeBg: '#E0E7FF', badgeText: '#3730A3', label: status || 'Scheduled' };
  }
  if (key.includes('progress') || key === 'active') {
    return { badgeBg: '#FEF3C7', badgeText: '#92400E', label: status || 'In Progress' };
  }
  return { badgeBg: '#E5E7EB', badgeText: '#374151', label: status || 'Job' };
}

function formatJobDate(iso?: string): string {
  if (!iso) {
    return 'Date TBD';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCompletedDate(iso?: string): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function inferTags(job: CustomerJob): string[] {
  const fromApi = job.tags;
  if (Array.isArray(fromApi)) {
    return fromApi.map((t) => String(t)).filter(Boolean).slice(0, 4);
  }
  const title = jobTitle(job).toLowerCase();
  const tags: string[] = [];
  if (title.includes('repair')) tags.push('Repair');
  if (title.includes('replace')) tags.push('Replacement');
  if (title.includes('inspect') || title.includes('leak')) tags.push('Inspection');
  if (title.includes('gutter')) tags.push('Gutter');
  if (title.includes('shingle')) tags.push('Shingle');
  if (tags.length === 0) tags.push('Project');
  return tags.slice(0, 3);
}

function progressPercent(job: CustomerJob): number {
  const raw = job.progress;
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return Math.min(100, Math.max(0, Math.round(raw)));
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) {
      return Math.min(100, Math.max(0, n));
    }
  }
  const id = String(job.id ?? '0');
  return 25 + (id.charCodeAt(0) % 55);
}

type JobListCardProps = {
  job: CustomerJob;
  onPress: () => void;
};

function JobListCard({ job, onPress }: JobListCardProps): React.JSX.Element {
  const status = typeof job.status === 'string' && job.status.trim() ? job.status.trim() : 'In Progress';
  const visual = statusVisual(status);
  const key = normalizeStatusKey(status);
  const isInProgress = key.includes('progress') || key === 'active';
  const isCompleted = key.includes('complete');
  const isOnHold = key.includes('hold');
  const progress = progressPercent(job);
  const thumbUri = getProjectMapImageUrl(job, { width: THUMB_SIZE * 2, height: THUMB_SIZE * 2 });
  const dateIso =
    typeof job.scheduled_at === 'string'
      ? job.scheduled_at
      : typeof job.updated_at === 'string'
        ? job.updated_at
        : typeof job.created_at === 'string'
          ? job.created_at
          : undefined;

  return (
    <Pressable style={({ pressed }) => [styles.jobCard, pressed && styles.dim]} onPress={onPress}>
      <View style={styles.jobThumbWrap}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.jobThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.jobThumb, styles.jobThumbPlaceholder]}>
            <Text style={styles.jobThumbPlaceholderText}>📍</Text>
          </View>
        )}
      </View>

      <View style={styles.jobBody}>
        <View style={styles.jobTopRow}>
          <Text style={styles.jobId}>{jobDisplayId(job)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: visual.badgeBg }]}>
            <Text style={[styles.statusBadgeText, { color: visual.badgeText }]}>{visual.label}</Text>
          </View>
        </View>

        <Text style={styles.jobTitle} numberOfLines={2}>
          {jobTitle(job)}
        </Text>

        <View style={styles.jobMetaRow}>
          <Text style={styles.jobMetaIcon}>📍</Text>
          <Text style={styles.jobMetaText} numberOfLines={1}>
            {typeof job.customer_address === 'string' && job.customer_address.trim()
              ? job.customer_address.trim()
              : 'Address not available'}
          </Text>
        </View>

        <View style={styles.jobMetaRow}>
          <Text style={styles.jobMetaIcon}>📅</Text>
          <Text style={styles.jobMetaText}>{formatJobDate(dateIso)}</Text>
        </View>

        <View style={styles.tagRow}>
          {inferTags(job).map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {isInProgress ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        ) : null}

        {isCompleted ? (
          <Text style={styles.statusFootnote}>Completed on {formatCompletedDate(dateIso)}</Text>
        ) : null}

        {isOnHold ? (
          <Text style={styles.statusFootnote}>On Hold since {formatCompletedDate(dateIso)}</Text>
        ) : null}
      </View>

      <Text style={styles.jobChevron}>›</Text>
    </Pressable>
  );
}

export function ProjectsScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ProjectsStackParamList>>();
  const [items, setItems] = useState<CustomerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePipeline, setActivePipeline] = useState<ProjectPipelineFilterId>('all');
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (__DEV__) {
        console.log('[ProjectsScreen] fetching jobs', {
          fullUrl: getMobileJobsUrl(),
          mockMode: usePortalMocks(),
        });
      }

      await loadMobileConfig();

      const data = await portalService.getJobs({
        mapWidth: THUMB_SIZE * 2,
        mapHeight: THUMB_SIZE * 2,
      });
      const mapsKey = data.google_maps_api_key?.trim();
      if (mapsKey) {
        setGoogleMapsApiKey(mapsKey);
      }
      const normalized = normalizeJobs(data.jobs);
      const nextItems =
        usePortalMocks() && normalized.length === 0 ? buildMockProjects() : normalized;

      setItems(nextItems);
    } catch (error) {
      if (__DEV__) {
        console.log('[ProjectsScreen] load failed', error);
      }
      toastAlert('Projects', error instanceof Error ? error.message : 'Failed to load jobs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const searchFiltered = useMemo(() => {
    return applyListFilters(items, {
      searchQuery,
      searchFields: (job) => [
        typeof job.jobs === 'string' ? job.jobs : typeof job.job === 'string' ? job.job : '',
        typeof job.customer_name === 'string' ? job.customer_name : '',
        typeof job.customer_address === 'string' ? job.customer_address : '',
        job.id != null ? String(job.id) : '',
        jobDisplayId(job),
      ],
      statusFilter: null,
      getStatus: () => '',
      sort: sortBy,
      getName: (job) => jobTitle(job),
      getDate: (job) =>
        typeof job.updated_at === 'string' ? job.updated_at : typeof job.created_at === 'string' ? job.created_at : '',
    });
  }, [items, searchQuery, sortBy]);

  const pipelineFilteredJobs = useMemo(() => {
    if (activePipeline === 'all') {
      return searchFiltered;
    }
    const filter = PROJECT_PIPELINE_FILTERS.find((entry) => entry.id === activePipeline);
    if (!filter) {
      return searchFiltered;
    }
    return searchFiltered.filter((job) => jobMatchesPipelineFilter(job, filter));
  }, [searchFiltered, activePipeline]);

  const filterActive = sortBy !== DEFAULT_SORT;

  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const openProjectDetail = useCallback(
    (project: CustomerJob) => {
      const address =
        typeof project.customer_address === 'string' && project.customer_address.trim()
          ? project.customer_address.trim()
          : undefined;
      const descParts = [
        typeof project.description === 'string' ? project.description.trim() : '',
        address,
      ].filter(Boolean);

      navigation.navigate('ProjectDetail', {
        projectId: project.id != null ? String(project.id) : undefined,
        title: jobTitle(project),
        status:
          typeof project.status === 'string' && project.status.trim()
            ? project.status.trim()
            : 'Job has been created and is ready for processing.',
        description: descParts.length > 0 ? descParts.join('\n\n') : undefined,
      });
    },
    [navigation],
  );

  const isEmpty = !loading && items.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={portalScreenLayout.chrome}>
        <View style={portalScreenLayout.profileRow}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable style={({ pressed }) => [styles.iconTile, pressed && styles.dim]} />
        </View>

        <View style={styles.searchRow}>
          <Pressable onPress={openDrawer} style={({ pressed }) => [styles.iconTile, pressed && styles.dim]}>
            <View style={styles.menuGlyph}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </Pressable>
          <PortalSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search projects by name, address, or job ID"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />
          }
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pipelineRow}
          >
            <Pressable
              style={[styles.pipelinePill, activePipeline === 'all' && styles.pipelinePillActive]}
              onPress={() => setActivePipeline('all')}
            >
              <Text style={[styles.pipelinePillText, activePipeline === 'all' && styles.pipelinePillTextActive]}>
                All ({countJobsForPipeline(searchFiltered, null)})
              </Text>
            </Pressable>
            {PROJECT_PIPELINE_FILTERS.map((filter) => {
              const selected = activePipeline === filter.id;
              const count = countJobsForPipeline(searchFiltered, filter);
              return (
                <Pressable
                  key={filter.id}
                  style={[styles.pipelinePill, selected && styles.pipelinePillActive]}
                  onPress={() => setActivePipeline(filter.id)}
                >
                  <Text style={[styles.pipelinePillText, selected && styles.pipelinePillTextActive]}>
                    {filter.label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {isEmpty ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptySub}>Your jobs from the portal will appear here once they are assigned.</Text>
              <Pressable style={({ pressed }) => [styles.retryBtn, pressed && styles.dim]} onPress={() => void load()}>
                <Text style={styles.retryBtnText}>Refresh</Text>
              </Pressable>
            </View>
          ) : pipelineFilteredJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No matching projects</Text>
              <Text style={styles.emptySub}>Try another stage or adjust your search.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {pipelineFilteredJobs.map((job) => (
                <JobListCard
                  key={String(job.id ?? jobTitle(job))}
                  job={job}
                  onPress={() => openProjectDetail(job)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Sort projects"
        statusOptions={[]}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={null}
        initialSort={sortBy}
        onApply={({ sort }) => setSortBy(sort)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dashboardCanvas,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.avatarSoftFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginLeft: 10,
  },
  chevron: {
    fontSize: 11,
    color: colors.primary,
    marginLeft: 6,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuGlyph: {
    width: 18,
    gap: 4,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.textPrimary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dashboardCanvas,
  },
  dim: {
    opacity: 0.88,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 120,
  },
  pipelineRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    paddingBottom: 12,
  },
  pipelinePill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E3EAF6',
  },
  pipelinePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pipelinePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pipelinePillTextActive: {
    color: '#FFFFFF',
  },
  listWrap: {
    paddingHorizontal: 16,
    gap: 12,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  jobThumbWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  jobThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  jobThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobThumbPlaceholderText: {
    fontSize: 28,
  },
  jobBody: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  jobId: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
    lineHeight: 20,
  },
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  jobMetaIcon: {
    fontSize: 12,
  },
  jobMetaText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  progressBlock: {
    marginTop: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  statusFootnote: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  jobChevron: {
    fontSize: 22,
    color: '#9CA3AF',
    marginLeft: 4,
    marginTop: 4,
    fontWeight: '300',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
