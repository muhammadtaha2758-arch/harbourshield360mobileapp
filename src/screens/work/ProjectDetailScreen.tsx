import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DrawerActions, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { ProjectsStackParamList } from '../../navigation/types';
import { portalService } from '../../services/api/portalService';
import type { JobDetailApiResponse } from '../../types/jobDetail';
import {
  buildTimelineStepViews,
  isCurrentTimelineStep,
  type ProjectStepId,
  type TimelineStepItem,
} from '../../utils/jobDetailMapping';
import { openChatAttachment } from '../../utils/chatAttachment';
import { downloadRemoteFile } from '../../utils/documentDownload';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { SearchResultsEmpty } from '../../components/SearchResultsEmpty';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { PROJECT_TIMELINE_OPTIONS } from '../../constants/listFilterPresets';
import { DEFAULT_SORT } from '../../types/listFilters';
import { matchesSearchQuery } from '../../utils/listFiltering';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';

type FilterTab = 'all' | 'documents';

const TIMELINE_STROKE = '#FFFFFF';
const TIMELINE_SW = 1.15;

function StepTimelineIcon({ stepId }: { stepId: string }): React.JSX.Element {
  const s = { stroke: TIMELINE_STROKE, strokeWidth: TIMELINE_SW, fill: 'none' as const };

  switch (stepId) {
    case 'new-job':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x="4" y="3" width="11" height="13" rx="1" {...s} />
          <Path d="M13 3v3.5h3.5" {...s} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10 8.5v3M8.5 10h3" stroke={TIMELINE_STROKE} strokeWidth={TIMELINE_SW} strokeLinecap="round" />
        </Svg>
      );
    case 'inspection-appointment':
    case 'proposal-signed':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x="4" y="3" width="11" height="13" rx="1" {...s} />
          <Path d="M13 3v3.5h3.5" {...s} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M7.5 10.5l2 2 4-4" stroke={TIMELINE_STROKE} strokeWidth={TIMELINE_SW} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'proposal-sent':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path d="M3 7l7 4.5L17 7v9H3z" {...s} strokeLinejoin="round" />
          <Path d="M3 7l7 4.5L17 7" {...s} strokeLinecap="round" />
          <Circle cx="14.5" cy="13.5" r="3.2" {...s} />
          <Path d="M13 13.5l1.1 1.1 2.3-2.3" stroke={TIMELINE_STROKE} strokeWidth={TIMELINE_SW} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'material-order':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path d="M10 3.5l6 3.5v6L10 16.5 4 13V7z" {...s} strokeLinejoin="round" />
          <Path d="M4 7l6 3.5 6-3.5" {...s} strokeLinecap="round" />
          <Path d="M10 10.5v6" {...s} strokeLinecap="round" />
        </Svg>
      );
    case 'work-order':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x="3.5" y="4.5" width="7" height="7" rx="0.8" {...s} />
          <Rect x="6" y="7" width="7" height="7" rx="0.8" {...s} />
          <Rect x="8.5" y="9.5" width="7" height="7" rx="0.8" {...s} />
        </Svg>
      );
    case 'appointment-scheduled':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x="3.5" y="5" width="13" height="11.5" rx="1" {...s} />
          <Path d="M3.5 8.5h13" {...s} />
          <Path d="M7 3.5v3M13 3.5v3" {...s} strokeLinecap="round" />
          <SvgText x="10" y="14.5" fill={TIMELINE_STROKE} fontSize="6.5" fontWeight="600" textAnchor="middle">
            23
          </SvgText>
        </Svg>
      );
    case 'invoicing-payment':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x="4" y="6" width="12" height="8" rx="1.2" {...s} />
          <Path d="M4 9.5h12" {...s} />
          <Path d="M6.5 12h5" stroke={TIMELINE_STROKE} strokeWidth={TIMELINE_SW} strokeLinecap="round" />
        </Svg>
      );
    case 'job-completed':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path d="M4.5 10.2l4.2 4.2L15.5 5" stroke={TIMELINE_STROKE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      );
    case 'lost':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x="4" y="3" width="11" height="13" rx="1" {...s} />
          <Path d="M13 3v3.5h3.5" {...s} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 8l4 4M12 8l-4 4" stroke={TIMELINE_STROKE} strokeWidth={TIMELINE_SW} strokeLinecap="round" />
        </Svg>
      );
    case 'unqualified':
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Circle cx="10" cy="10" r="6.5" {...s} />
          <Path d="M6.5 13.5l7-7" stroke={TIMELINE_STROKE} strokeWidth={TIMELINE_SW} strokeLinecap="round" />
        </Svg>
      );
    default:
      return (
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Rect x="4" y="3" width="11" height="13" rx="1" {...s} />
        </Svg>
      );
  }
}

function EmptyProposalIcon(): React.JSX.Element {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M7 3h7l4 4v14H7z" fill="none" stroke="#1E6BFF" strokeWidth={1.7} />
      <Path d="M14 3v4h4" fill="none" stroke="#1E6BFF" strokeWidth={1.7} />
      <Path d="M10 12h6M10 15h6" stroke="#1E6BFF" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function ProjectDetailScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ProjectsStackParamList, 'ProjectDetail'>>();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedStepId, setExpandedStepId] = useState<ProjectStepId | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<JobDetailApiResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [openingItemId, setOpeningItemId] = useState<string | null>(null);
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);

  const projectId = route.params?.projectId;

  const loadDetail = useCallback(async (isRefresh = false) => {
    if (!projectId) {
      setLoading(false);
      setRefreshing(false);
      setDetail(null);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await portalService.getJobById(projectId);
      setDetail(data);
    } catch (error) {
      toastAlert(
        'Project',
        error instanceof Error ? error.message : 'Failed to load project details.',
      );
      if (!isRefresh) {
        setDetail(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const title = useMemo(() => {
    const fromApi = detail?.job?.title?.trim();
    if (fromApi) {
      return fromApi;
    }
    return route.params?.title || 'Project';
  }, [detail?.job?.title, route.params?.title]);

  const subtitle = useMemo(() => {
    const fromApi = detail?.job?.status?.trim();
    if (fromApi) {
      return fromApi;
    }
    return route.params?.status || 'In Progress';
  }, [detail?.job?.status, route.params?.status]);

  const jobDescription = useMemo(() => {
    const fromApi = detail?.job?.description?.trim();
    if (fromApi) {
      return fromApi;
    }
    return route.params?.description?.trim() || '';
  }, [detail?.job?.description, route.params?.description]);

  const jobAddress = useMemo(
    () => detail?.job?.lead_address?.trim() || detail?.job?.client?.address?.trim() || '',
    [detail?.job?.lead_address, detail?.job?.client?.address],
  );

  const timelineSteps = useMemo(
    () => (detail ? buildTimelineStepViews(detail) : []),
    [detail],
  );

  const visibleSteps = useMemo(() => {
    let steps = activeFilter !== 'documents' ? timelineSteps : timelineSteps.filter((view) => view.items.length > 0);
    const query = searchQuery.trim();
    if (!query) {
      return steps;
    }
    return steps.filter((view) =>
      matchesSearchQuery(query, [
        view.title,
        view.subtitle,
        ...view.items.flatMap((item) => [item.title, ...item.lines]),
      ]),
    );
  }, [activeFilter, searchQuery, timelineSteps]);

  const filterActive = activeFilter !== 'all';

  const openTimelineItem = useCallback(async (item: TimelineStepItem) => {
    if (!item.url) {
      toastAlert('Open file', 'This file cannot be opened.');
      return;
    }
    if (openingItemId || downloadingItemId) {
      return;
    }
    setOpeningItemId(item.id);
    try {
      if (item.openAs === 'file') {
        await openChatAttachment({
          url: item.url,
          fileName: item.fileName || item.title,
          kind: item.fileKind === 'photo' ? 'photo' : 'document',
        });
        return;
      }
      await Linking.openURL(item.url);
    } catch (error) {
      toastAlert(
        'Open file',
        error instanceof Error ? error.message : 'Unable to open this item.',
      );
    } finally {
      setOpeningItemId(null);
    }
  }, [downloadingItemId, openingItemId]);

  const downloadTimelineItem = useCallback(async (item: TimelineStepItem) => {
    if (!item.url || item.openAs !== 'file') {
      toastAlert('Download', 'This file cannot be downloaded.');
      return;
    }
    if (openingItemId || downloadingItemId) {
      return;
    }
    setDownloadingItemId(item.id);
    try {
      await downloadRemoteFile({
        url: item.url,
        fileName: item.fileName || item.title,
        mime: item.mime,
      });
      if (Platform.OS === 'android') {
        toastAlert('Download started', 'Check your Downloads folder or notification shade.');
      }
    } catch (error) {
      toastAlert(
        'Download failed',
        error instanceof Error ? error.message : 'Could not download this file.',
      );
    } finally {
      setDownloadingItemId(null);
    }
  }, [downloadingItemId, openingItemId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={portalScreenLayout.chrome}>
        <View style={portalScreenLayout.profileRow}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable style={styles.iconTile} />
        </View>

        <View style={styles.searchRow}>
          <Pressable style={styles.iconTile} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
            <View style={styles.menuGlyph}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </Pressable>
          <PortalSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search timeline steps and documents"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setActiveFilter('all')}
            style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>All</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveFilter('documents')}
            style={[styles.filterPill, activeFilter === 'documents' && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, activeFilter === 'documents' && styles.filterTextActive]}>Documents</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadDetail(true)} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.timelineCard}>
            <Text style={styles.projectTitleLabel}>{title}</Text>
            <Text style={styles.projectStatusLabel}>{subtitle}</Text>
            {jobDescription ? <Text style={styles.projectDescription}>{jobDescription}</Text> : null}
            {jobAddress ? <Text style={styles.projectAddress}>{jobAddress}</Text> : null}

            {visibleSteps.length === 0 ? (
              <Text style={styles.noDocumentsFilter}>No documents uploaded for this project yet.</Text>
            ) : null}

            {visibleSteps.length === 0 && searchQuery.trim() ? (
              <SearchResultsEmpty
                query={searchQuery}
                onClear={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                }}
              />
            ) : null}
            {visibleSteps.map((stepView, index) => {
              const { step, summary, items } = stepView;
              const isActive = isCurrentTimelineStep(step, detail?.job?.status);
              const isExpanded = expandedStepId === step.id;

              return (
                <View key={step.id} style={styles.stepBlock}>
                  <View style={styles.stepRow}>
                    <View style={styles.stepRail}>
                      <View style={[styles.stepIconWrap, isActive && styles.stepIconWrapActive]}>
                        <StepTimelineIcon stepId={step.id} />
                      </View>
                      {index < visibleSteps.length - 1 ? <View style={styles.stepLine} /> : null}
                    </View>
                    <View style={styles.stepContent}>
                      <Pressable
                        style={styles.stepHeaderButton}
                        onPress={() => setExpandedStepId((prev) => (prev === step.id ? null : step.id))}
                      >
                        <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>{step.heading}</Text>
                      </Pressable>
                      <Text style={styles.stepText}>{summary}</Text>
                      {isExpanded ? (
                        <Animated.View
                          entering={FadeInDown.duration(260)}
                          exiting={FadeOutUp.duration(180)}
                          style={styles.collapseBody}
                        >
                          {items.length > 0 ? (
                            <View style={styles.documentsList}>
                              {items.map((item) => {
                                const itemBusy = openingItemId === item.id || downloadingItemId === item.id;
                                const canDownload = Boolean(item.url) && item.openAs === 'file';
                                return (
                                <View key={item.id} style={styles.documentCard}>
                                  <Text style={styles.documentName}>{item.title}</Text>
                                  {item.lines.map((line) => (
                                    <Text key={`${item.id}-${line}`} style={styles.documentMeta}>
                                      {line}
                                    </Text>
                                  ))}
                                  {item.url ? (
                                    <View style={styles.documentActions}>
                                      <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Open file"
                                        onPress={() => void openTimelineItem(item)}
                                        disabled={itemBusy}
                                        style={styles.documentActionHit}
                                      >
                                        {openingItemId === item.id ? (
                                          <View style={styles.documentOpeningRow}>
                                            <ActivityIndicator size="small" color={colors.primary} />
                                            <Text style={styles.documentLink}>Opening…</Text>
                                          </View>
                                        ) : (
                                          <Text style={styles.documentLink}>Open</Text>
                                        )}
                                      </Pressable>
                                      {canDownload ? (
                                        <Pressable
                                          accessibilityRole="button"
                                          accessibilityLabel="Download file"
                                          onPress={() => void downloadTimelineItem(item)}
                                          disabled={itemBusy}
                                          style={styles.documentActionHit}
                                        >
                                          {downloadingItemId === item.id ? (
                                            <View style={styles.documentOpeningRow}>
                                              <ActivityIndicator size="small" color={colors.primary} />
                                              <Text style={styles.documentLink}>Downloading…</Text>
                                            </View>
                                          ) : (
                                            <Text style={styles.documentLink}>Download</Text>
                                          )}
                                        </Pressable>
                                      ) : null}
                                    </View>
                                  ) : null}
                                </View>
                                );
                              })}
                            </View>
                          ) : (
                            <View style={styles.emptyDocumentBox}>
                              <View style={styles.emptyDocumentIconWrap}>
                                <EmptyProposalIcon />
                              </View>
                              <Text style={styles.emptyDocumentTitle}>
                                {step.id === 'proposal-sent' || step.id === 'proposal-signed'
                                  ? 'No proposal found for this project'
                                  : 'No records found for this stage'}
                              </Text>
                              <Text style={styles.emptyDocumentText}>
                                Content from the portal will appear here when available.
                              </Text>
                            </View>
                          )}
                        </Animated.View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.stepDivider} />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter timeline"
        statusOptions={PROJECT_TIMELINE_OPTIONS}
        sortOptions={[]}
        initialStatus={activeFilter === 'documents' ? 'documents' : null}
        initialSort={DEFAULT_SORT}
        onApply={({ status }) => {
          setActiveFilter(status === 'documents' ? 'documents' : 'all');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
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
  avatarGlyph: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
  profileName: { fontSize: 16, fontWeight: '600', color: '#4A5568', marginLeft: 10 },
  chevron: { fontSize: 11, color: colors.primary, marginLeft: 6 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  menuGlyph: { width: 18, gap: 4 },
  menuLine: { width: 18, height: 2, borderRadius: 2, backgroundColor: colors.textPrimary },
  searchShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    marginLeft: 10,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, paddingVertical: 10, paddingHorizontal: 8 },
  innerFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.innerFilterBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EDEFF3' },
  filterPillActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 14, color: '#222B45', fontWeight: '500' },
  filterTextActive: { color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 140 },
  loadingBox: { paddingVertical: 48, alignItems: 'center' },
  uploadCard: {
    borderWidth: 2,
    borderColor: '#1D8FFF',
    borderRadius: 20,
    minHeight: 118,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFF',
    marginBottom: 18,
  },
  uploadTitle: { fontSize: 18, color: '#1F2937', fontWeight: '600', marginBottom: 4 },
  uploadSub: { fontSize: 11, color: '#586174' },
  timelineCard: { backgroundColor: colors.primary, borderRadius: 20, padding: 14 },
  projectTitleLabel: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  projectStatusLabel: { color: '#DDE8FF', fontSize: 12, marginTop: 2, marginBottom: 6 },
  projectDescription: { color: '#E8EFFF', fontSize: 12, lineHeight: 17, marginBottom: 4 },
  projectAddress: { color: '#C5D4F5', fontSize: 11, lineHeight: 16, marginBottom: 12 },
  noDocumentsFilter: { color: '#DDE8FF', fontSize: 13, marginBottom: 12 },
  stepBlock: {
    width: '100%',
  },
  stepDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
   
    marginBottom: 4,
    marginLeft: 30,
    marginRight: 50,
    alignSelf: 'stretch',
  },
  stepRow: { flexDirection: 'row' },
  stepRail: { width: 24, alignItems: 'center' },
  stepIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepIconWrapActive: {
    transform: [{ scale: 1.08 }],
  },
  stepLine: { flex: 1, width: 1, backgroundColor: 'rgba(255,255,255,0.75)', marginTop: 2, marginBottom: 2 },
  stepContent: { flex: 1, paddingBottom: 12 },
  stepHeaderButton: {
    paddingRight: 0,
  },
  stepTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '500' },
  stepTitleActive: { fontWeight: '700', textDecorationLine: 'underline' },
  collapseBody: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: '88%',
  },
  stepText: { color: '#DDE8FF', fontSize: 11, lineHeight: 16 },
  documentsList: {
    marginTop: 4,
    gap: 4,
  },
  documentCard: {
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  documentName: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  documentMeta: {
    color: '#4B5563',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  documentLink: {
    color: '#1A3FD8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 0,
  },
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 16,
  },
  documentActionHit: {
    minHeight: 28,
    justifyContent: 'center',
  },
  documentOpeningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyDocumentBox: {
    marginTop: 0,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  emptyDocumentIconWrap: {
    marginBottom: 4,
  },
  emptyDocumentTitle: {
    color: '#606770',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyDocumentText: {
    color: '#8A9099',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 16,
  },
});
