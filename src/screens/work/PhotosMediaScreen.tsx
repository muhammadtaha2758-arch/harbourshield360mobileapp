import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppDrawerParamList, AppTabParamList } from '../../navigation/types';
import { portalService } from '../../services/api/portalService';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import type { CustomerJob } from '../../types/portal';
import {
  buildJobsMediaFromPhotos,
  mergeStormbuddiUploads,
  type JobMedia,
} from '../../utils/photoMediaMapping';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { SearchResultsEmpty } from '../../components/SearchResultsEmpty';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { PHOTO_MEDIA_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';

type PhotosMediaScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'PhotosMediaTab'>,
  DrawerNavigationProp<AppDrawerParamList>
>;

const ALBUM_CARD_WIDTH = 152;
const PREVIEW_IMAGE_MAX_H = Math.round(Dimensions.get('window').height * 0.68);
const VIEW_ALL_SHEET_H_PAD = 16 * 2;
const VIEW_ALL_COL_GAP = 10;

type MediaStripItem = { id: string; uri: string; jobName: string };

type PhotoPreviewState = { uri: string; jobName: string; kind: 'Before' | 'After' };

function MediaHorizontalStrip({
  items,
  kindLabel,
  emptyMessage,
  onOpenItem,
}: {
  items: MediaStripItem[];
  kindLabel: 'Before' | 'After';
  emptyMessage: string;
  onOpenItem: (item: MediaStripItem, kind: 'Before' | 'After') => void;
}): React.JSX.Element {
  if (items.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      contentContainerStyle={styles.hStripContent}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={({ pressed }) => [styles.mediaCardH, pressed && styles.dim]}
          onPress={() => onOpenItem(item, kindLabel)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${kindLabel} photo for ${item.jobName}`}
        >
          <View style={styles.mediaImageWrap}>
            <Image source={{ uri: item.uri }} style={styles.mediaImageH} resizeMode="cover" />
            <View style={styles.mediaOverlay} pointerEvents="none">
              <Text style={styles.mediaOverlayIcon}>📁</Text>
              <Text style={styles.mediaOverlayCount}>1</Text>
            </View>
          </View>
          <View style={styles.mediaMetaH}>
            <Text style={styles.mediaJobNameH} numberOfLines={2}>
              {item.jobName}
            </Text>
            <Text style={styles.mediaSubLine}>
              1 Photo · {kindLabel}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function PhotosMediaScreen(): React.JSX.Element {
  const navigation = useNavigation<PhotosMediaScreenNavigation>();
  const [jobsMedia, setJobsMedia] = useState<JobMedia[]>([]);
  const [jobOptions, setJobOptions] = useState<CustomerJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<'all' | string>('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadJobId, setUploadJobId] = useState<string>('');
  const [uploadPhotoKind, setUploadPhotoKind] = useState<'before' | 'after'>('before');
  const [uploadPhotoUri, setUploadPhotoUri] = useState<string | null>(null);
  const [uploadPhotoName, setUploadPhotoName] = useState('');
  const [uploadPhotoType, setUploadPhotoType] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [modalJobPickerOpen, setModalJobPickerOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState | null>(null);
  const [viewAllKind, setViewAllKind] = useState<'before' | 'after' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [jobsPayload, photos] = await Promise.all([
        portalService.getJobs(),
        portalService.getPhotoMedia(),
      ]);
      const jobs = jobsPayload.jobs ?? [];
      setJobOptions(jobs);
      setJobsMedia(buildJobsMediaFromPhotos(jobs, photos));
      setUploadJobId((prev) => {
        if (prev) {
          return prev;
        }
        return jobs.length > 0 && jobs[0].id != null ? String(jobs[0].id) : '';
      });
    } catch (error) {
      toastAlert('Photos & Media', error instanceof Error ? error.message : 'Failed to load photos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData(false);
    }, [loadData]),
  );

  const closePhotoPreview = useCallback(() => {
    setPhotoPreview(null);
  }, []);

  const openPhotoFromStrip = useCallback((item: MediaStripItem, kind: 'Before' | 'After') => {
    setPhotoPreview({ uri: item.uri, jobName: item.jobName, kind });
  }, []);

  const closeViewAll = useCallback(() => {
    setViewAllKind(null);
  }, []);

  const openPhotoFromViewAll = useCallback(
    (item: MediaStripItem, kind: 'before' | 'after') => {
      setViewAllKind(null);
      openPhotoFromStrip(item, kind === 'before' ? 'Before' : 'After');
    },
    [openPhotoFromStrip],
  );

  const selectedLabel =
    selectedJobId === 'all'
      ? 'All Projects'
      : jobsMedia.find((job) => job.id === selectedJobId)?.jobName ?? 'All Projects';

  const scopedMedia = useMemo(() => {
    let list = selectedJobId === 'all' ? jobsMedia : jobsMedia.filter((job) => job.id === selectedJobId);
    return applyListFilters(list, {
      searchQuery,
      searchFields: (job) => [job.jobName, String(job.id ?? '')],
      sort: sortBy,
      getName: (job) => job.jobName,
      getDate: () => '',
    });
  }, [selectedJobId, jobsMedia, searchQuery, sortBy]);

  const filterActive = mediaFilter != null || sortBy !== DEFAULT_SORT;
  const showBeforeSection = mediaFilter !== 'after';
  const showAfterSection = mediaFilter !== 'before';

  const beforeImages = scopedMedia.flatMap((job) =>
    job.before.map((uri, idx) => ({ id: `before-${job.id}-${idx}`, uri, jobName: job.jobName })),
  );
  const afterImages = scopedMedia.flatMap((job) =>
    job.after.map((uri, idx) => ({ id: `after-${job.id}-${idx}`, uri, jobName: job.jobName })),
  );

  const viewAllTileW = useMemo(() => {
    const w = Dimensions.get('window').width;
    return Math.floor((w - VIEW_ALL_SHEET_H_PAD - VIEW_ALL_COL_GAP) / 2);
  }, []);

  const viewAllScrollMaxH = useMemo(() => Math.round(Dimensions.get('window').height * 0.68), []);

  const viewAllItems = viewAllKind === 'before' ? beforeImages : viewAllKind === 'after' ? afterImages : [];

  const onViewAllBefore = useCallback(() => {
    if (beforeImages.length === 0) {
      toastAlert('Photos & Media', 'No before photos for the current filter.');
      return;
    }
    setViewAllKind('before');
  }, [beforeImages.length]);

  const onViewAllAfter = useCallback(() => {
    if (afterImages.length === 0) {
      toastAlert('Photos & Media', 'No after photos for the current filter.');
      return;
    }
    setViewAllKind('after');
  }, [afterImages.length]);

  const uploadJobsList = useMemo(() => {
    if (jobOptions.length > 0) {
      return jobOptions.map((job) => ({
        id: String(job.id),
        jobName: String(job.jobs ?? job.job ?? `Job #${job.id}`),
      }));
    }
    return jobsMedia;
  }, [jobOptions, jobsMedia]);

  const uploadJobLabel =
    uploadJobsList.find((j) => j.id === uploadJobId)?.jobName ?? 'Select job';

  const openUploadModal = useCallback(() => {
    setDropdownOpen(false);
    const defaultJob =
      selectedJobId !== 'all' ? selectedJobId : uploadJobsList[0]?.id ?? '';
    if (defaultJob) {
      setUploadJobId(defaultJob);
    }
    setUploadPhotoKind('before');
    setUploadPhotoUri(null);
    setUploadPhotoName('');
    setUploadPhotoType(null);
    setModalJobPickerOpen(false);
    setUploadModalOpen(true);
  }, [selectedJobId, uploadJobsList]);

  const closeUploadModal = useCallback(() => {
    setUploadModalOpen(false);
    setUploadPhotoUri(null);
    setUploadPhotoName('');
    setModalJobPickerOpen(false);
  }, []);

  const onPickPhoto = useCallback(async () => {
    try {
      const [file] = await pick({
        type: [types.images],
        allowMultiSelection: false,
        ...(Platform.OS === 'android' ? { allowVirtualFiles: true } : {}),
      });
      if (file.error) {
        toastAlert('Photos & Media', file.error);
        return;
      }
      let uri = file.uri;
      const baseName = file.name || 'photo';

      if (Platform.OS === 'ios') {
        const [copy] = await keepLocalCopy({
          files: [{ uri: file.uri, fileName: baseName }],
          destination: 'cachesDirectory',
        });
        if (copy.status === 'success') {
          uri = copy.localUri;
        }
      } else if (file.isVirtual && file.convertibleToMimeTypes?.length) {
        const mime = file.convertibleToMimeTypes[0].mimeType;
        const [copy] = await keepLocalCopy({
          files: [{ uri: file.uri, fileName: baseName, convertVirtualFileToType: mime }],
          destination: 'cachesDirectory',
        });
        if (copy.status === 'success') {
          uri = copy.localUri;
        } else {
          toastAlert('Photos & Media', copy.copyError || 'Could not read the selected photo.');
          return;
        }
      }

      if (!uri) {
        toastAlert('Photos & Media', 'Could not read the selected photo.');
        return;
      }
      setUploadPhotoUri(uri);
      setUploadPhotoName(baseName);
      setUploadPhotoType(file.type ?? 'image/jpeg');
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      toastAlert('Photos & Media', e instanceof Error ? e.message : 'Could not pick a photo.');
    }
  }, []);

  const onSubmitUpload = useCallback(async () => {
    if (!uploadPhotoUri) {
      toastAlert('Photos & Media', 'Choose a photo to upload.');
      return;
    }
    if (!uploadJobId) {
      toastAlert('Photos & Media', 'Select a job.');
      return;
    }
    try {
      setUploading(true);
      const result = await portalService.uploadPhotoMedia({
        uri: uploadPhotoUri,
        name: uploadPhotoName.trim() || 'photo.jpg',
        type: uploadPhotoType,
        jobId: uploadJobId,
        pictureType: uploadPhotoKind === 'before' ? 'before_pictures' : 'after_pictures',
      });
      if (!result.success) {
        toastAlert('Photos & Media', result.message || 'Upload failed.');
        return;
      }
      const jobName =
        uploadJobsList.find((job) => job.id === uploadJobId)?.jobName ?? `Job #${uploadJobId}`;
      if (result.files?.length) {
        setJobsMedia((prev) =>
          mergeStormbuddiUploads(prev, uploadJobId, jobName, uploadPhotoKind, result.files ?? []),
        );
      }
      toastAlert('Photos & Media', 'Photo uploaded successfully.');
      closeUploadModal();
    } catch (error) {
      toastAlert('Photos & Media', error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }, [
    closeUploadModal,
    uploadJobId,
    uploadJobsList,
    uploadPhotoKind,
    uploadPhotoName,
    uploadPhotoType,
    uploadPhotoUri,
  ]);

  const onRefresh = useCallback(() => {
    setDropdownOpen(false);
    void loadData(true);
  }, [loadData]);

  if (loading && jobsMedia.length === 0 && jobOptions.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={portalScreenLayout.chrome}>
        <View style={portalScreenLayout.profileRow}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable style={({ pressed }) => [styles.iconTile, pressed && styles.dim]} />
        </View>

        <View style={styles.searchRow}>
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={({ pressed }) => [styles.iconTile, pressed && styles.dim]}
          >
            <View style={styles.menuGlyph}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </Pressable>
          <PortalSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search projects for photos"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Photos & Media</Text>
          <Text style={styles.heroSub}>Before and after progress photos for every project.</Text>

          <View style={styles.dropdownRow}>
            <View style={[styles.dropdownFlex, dropdownOpen && styles.dropdownFlexOpen]}>
              <View style={[styles.dropdownWrap, dropdownOpen && styles.dropdownWrapOpen]}>
                <Pressable
                  style={({ pressed }) => [styles.dropdownButton, pressed && styles.dim]}
                  onPress={() => setDropdownOpen((v) => !v)}
                >
                  <Text style={styles.dropdownValue} numberOfLines={1}>
                    {selectedLabel}
                  </Text>
                  <Text style={styles.dropdownChevron}>{dropdownOpen ? '▴' : '▾'}</Text>
                </Pressable>

                {dropdownOpen ? (
                  <View style={styles.dropdownMenu}>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={uploadJobsList.length > 4}
                      style={styles.dropdownMenuScroll}
                    >
                      <Pressable
                        style={({ pressed }) => [styles.dropdownItem, selectedJobId === 'all' && styles.dropdownItemActive, pressed && styles.dim]}
                        onPress={() => {
                          setSelectedJobId('all');
                          setDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, selectedJobId === 'all' && styles.dropdownItemTextActive]}>All Projects</Text>
                      </Pressable>
                      {uploadJobsList.map((job) => (
                        <Pressable
                          key={job.id}
                          style={({ pressed }) => [styles.dropdownItem, selectedJobId === job.id && styles.dropdownItemActive, pressed && styles.dim]}
                          onPress={() => {
                            setSelectedJobId(job.id);
                            setDropdownOpen(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, selectedJobId === job.id && styles.dropdownItemTextActive]} numberOfLines={1}>
                            {job.jobName}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.uploadTrigger, pressed && styles.dim]}
              onPress={openUploadModal}
              accessibilityRole="button"
              accessibilityLabel="Upload photo"
            >
              <Text style={styles.uploadTriggerText}>Upload</Text>
            </Pressable>
          </View>
        </View>

        {jobsMedia.length > 0 && scopedMedia.length === 0 && (searchQuery.trim() || filterActive) ? (
          <SearchResultsEmpty
            query={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setMediaFilter(null);
              setSortBy(DEFAULT_SORT);
            }}
          />
        ) : null}

        {showBeforeSection ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Before</Text>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.sectionCount}>{String(beforeImages.length).padStart(2, '0')}</Text>
              <Pressable
                onPress={onViewAllBefore}
                hitSlop={8}
                disabled={beforeImages.length === 0}
                accessibilityRole="button"
                accessibilityLabel="View all before photos"
                accessibilityState={{ disabled: beforeImages.length === 0 }}
              >
                <Text style={[styles.viewAllText, beforeImages.length === 0 && styles.viewAllTextDisabled]}>View All</Text>
              </Pressable>
            </View>
          </View>
          <MediaHorizontalStrip
            items={beforeImages}
            kindLabel="Before"
            emptyMessage="No before images for the selected project."
            onOpenItem={openPhotoFromStrip}
          />
        </View>
        ) : null}

        {showAfterSection ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>After</Text>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.sectionCount}>{String(afterImages.length).padStart(2, '0')}</Text>
              <Pressable
                onPress={onViewAllAfter}
                hitSlop={8}
                disabled={afterImages.length === 0}
                accessibilityRole="button"
                accessibilityLabel="View all after photos"
                accessibilityState={{ disabled: afterImages.length === 0 }}
              >
                <Text style={[styles.viewAllText, afterImages.length === 0 && styles.viewAllTextDisabled]}>View All</Text>
              </Pressable>
            </View>
          </View>
          <MediaHorizontalStrip
            items={afterImages}
            kindLabel="After"
            emptyMessage="No after images for the selected project."
            onOpenItem={openPhotoFromStrip}
          />
        </View>
        ) : null}
      </ScrollView>

      <Modal visible={uploadModalOpen} transparent animationType="slide" onRequestClose={closeUploadModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload photo</Text>
              <Pressable onPress={closeUploadModal} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalFieldLabel}>Job</Text>
              <View style={styles.modalPickerWrap}>
                <Pressable
                  style={({ pressed }) => [styles.modalPickerButton, pressed && styles.dim]}
                  onPress={() => setModalJobPickerOpen((v) => !v)}
                >
                  <Text style={styles.modalPickerValue} numberOfLines={1}>
                    {uploadJobLabel}
                  </Text>
                  <Text style={styles.modalPickerChevron}>{modalJobPickerOpen ? '▴' : '▾'}</Text>
                </Pressable>
                {modalJobPickerOpen ? (
                  <View style={styles.modalPickerMenu}>
                    {uploadJobsList.map((job) => (
                      <Pressable
                        key={job.id}
                        style={({ pressed }) => [styles.modalPickerItem, uploadJobId === job.id && styles.modalPickerItemActive, pressed && styles.dim]}
                        onPress={() => {
                          setUploadJobId(job.id);
                          setModalJobPickerOpen(false);
                        }}
                      >
                        <Text style={[styles.modalPickerItemText, uploadJobId === job.id && styles.modalPickerItemTextActive]}>{job.jobName}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <Text style={styles.modalFieldLabel}>Photo type</Text>
              <View style={styles.typeRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.typeChip,
                    styles.typeChipSpacing,
                    uploadPhotoKind === 'before' && styles.typeChipOn,
                    pressed && styles.dim,
                  ]}
                  onPress={() => setUploadPhotoKind('before')}
                >
                  <Text style={[styles.typeChipText, uploadPhotoKind === 'before' && styles.typeChipTextOn]}>Before</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.typeChip,
                    uploadPhotoKind === 'after' && styles.typeChipOn,
                    pressed && styles.dim,
                  ]}
                  onPress={() => setUploadPhotoKind('after')}
                >
                  <Text style={[styles.typeChipText, uploadPhotoKind === 'after' && styles.typeChipTextOn]}>After</Text>
                </Pressable>
              </View>

              <Text style={styles.modalFieldLabel}>Photo</Text>
              <Pressable style={({ pressed }) => [styles.pickPhotoBtn, pressed && styles.dim]} onPress={onPickPhoto}>
                <Text style={styles.pickPhotoBtnText}>{uploadPhotoName ? 'Change photo' : 'Choose photo'}</Text>
              </Pressable>
              {uploadPhotoName ? (
                <Text style={styles.pickedPhotoMeta} numberOfLines={2}>
                  {uploadPhotoName}
                </Text>
              ) : (
                <Text style={styles.modalFieldHint}>JPG, PNG, or other images from your device</Text>
              )}

              <Pressable
                style={({ pressed }) => [styles.modalSubmitBtn, (pressed || uploading) && styles.dim]}
                onPress={() => void onSubmitUpload()}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Upload photo</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={viewAllKind !== null} transparent animationType="slide" onRequestClose={closeViewAll}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, styles.viewAllSheet]}>
            <View style={styles.modalHeader}>
              <View style={styles.viewAllHeaderTitles}>
                <Text style={styles.modalTitle}>
                  {viewAllKind === 'before' ? 'Before photos' : viewAllKind === 'after' ? 'After photos' : ''}
                </Text>
                <Text style={styles.viewAllSubtitle}>{String(viewAllItems.length).padStart(2, '0')} items</Text>
              </View>
              <Pressable onPress={closeViewAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: viewAllScrollMaxH }}
              contentContainerStyle={styles.viewAllGrid}
            >
              {viewAllItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.viewAllTile, { width: viewAllTileW }, pressed && styles.dim]}
                  onPress={() => viewAllKind && openPhotoFromViewAll(item, viewAllKind)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${viewAllKind === 'before' ? 'before' : 'after'} photo for ${item.jobName}`}
                >
                  <Image source={{ uri: item.uri }} style={styles.viewAllThumb} resizeMode="cover" />
                  <Text style={styles.viewAllJobName} numberOfLines={2}>
                    {item.jobName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={photoPreview !== null} transparent animationType="fade" onRequestClose={closePhotoPreview}>
        <View style={styles.photoPreviewRoot}>
          <Pressable style={styles.photoPreviewBackdrop} onPress={closePhotoPreview} accessibilityLabel="Dismiss photo" />
          <View style={styles.photoPreviewPanel} pointerEvents="box-none">
            <View style={styles.photoPreviewHeader}>
              <View style={styles.photoPreviewTitleCol}>
                <Text style={styles.photoPreviewTitle} numberOfLines={1}>
                  {photoPreview?.jobName}
                </Text>
                <Text style={styles.photoPreviewKind}>{photoPreview?.kind} photo</Text>
              </View>
              <Pressable
                onPress={closePhotoPreview}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.photoPreviewClose}>✕</Text>
              </Pressable>
            </View>
            {photoPreview ? (
              <Image
                source={{ uri: photoPreview.uri }}
                style={styles.photoPreviewImage}
                resizeMode="contain"
                accessibilityLabel={`Full size ${photoPreview.kind} photo`}
              />
            ) : null}
          </View>
        </View>
      </Modal>
      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter photos"
        statusOptions={PHOTO_MEDIA_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={mediaFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setMediaFilter(status);
          setSortBy(sort);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
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
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  innerFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.innerFilterBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    overflow: 'visible',
  },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 12 },
  dropdownRow: { flexDirection: 'row', alignItems: 'flex-start', zIndex: 1 },
  dropdownFlex: { flex: 1, minWidth: 0 },
  dropdownFlexOpen: { zIndex: 20 },
  uploadTrigger: {
    marginLeft: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  uploadTriggerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  dropdownWrap: { position: 'relative', zIndex: 1 },
  dropdownWrapOpen: { zIndex: 30 },
  dropdownButton: {
    minHeight: 44,
    backgroundColor: '#2D74E8',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1, paddingRight: 10 },
  dropdownChevron: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE3EE',
    overflow: 'hidden',
    maxHeight: 220,
    zIndex: 40,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  dropdownMenuScroll: { maxHeight: 220 },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F8',
  },
  dropdownItemActive: { backgroundColor: '#EEF4FF' },
  dropdownItemText: { color: '#344054', fontSize: 13, fontWeight: '500' },
  dropdownItemTextActive: { color: colors.primary, fontWeight: '700' },
  sectionBlock: { marginTop: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700' },
  sectionCount: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  viewAllText: { color: colors.primary, fontSize: 13, fontWeight: '600', marginLeft: 12 },
  viewAllTextDisabled: { color: '#94A3B8', opacity: 0.65 },
  hStripContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingRight: 8,
  },
  mediaCardH: {
    width: ALBUM_CARD_WIDTH,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    overflow: 'hidden',
  },
  mediaImageWrap: {
    position: 'relative',
    width: '100%',
    height: 118,
    backgroundColor: '#D7DEE8',
  },
  mediaImageH: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  mediaOverlayIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  mediaOverlayCount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  mediaMetaH: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  mediaJobNameH: {
    color: '#0F2744',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  mediaSubLine: {
    color: '#6A7489',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  emptyText: { color: '#6A7489', fontSize: 13, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#4B5563', fontSize: 18, fontWeight: '700', padding: 4 },
  modalFieldLabel: { color: '#344054', fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  modalFieldHint: { color: colors.textSecondary, fontSize: 12, marginTop: 6, marginBottom: 4 },
  modalPickerWrap: { position: 'relative', zIndex: 2 },
  modalPickerButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E0EE',
    backgroundColor: '#F9FBFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalPickerValue: { color: '#24334E', fontSize: 14, fontWeight: '600', flex: 1, paddingRight: 8 },
  modalPickerChevron: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  modalPickerMenu: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDE3EE',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    maxHeight: 200,
  },
  modalPickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F8',
  },
  modalPickerItemActive: { backgroundColor: '#EEF4FF' },
  modalPickerItemText: { color: '#344054', fontSize: 13, fontWeight: '500' },
  modalPickerItemTextActive: { color: colors.primary, fontWeight: '700' },
  typeRow: { flexDirection: 'row' },
  typeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E0EE',
    backgroundColor: '#F9FBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipSpacing: { marginRight: 10 },
  typeChipOn: {
    borderColor: colors.primary,
    backgroundColor: '#EEF4FF',
  },
  typeChipText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  typeChipTextOn: { color: colors.primary, fontWeight: '700' },
  pickPhotoBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#F0F6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickPhotoBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  pickedPhotoMeta: { marginTop: 8, color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  modalSubmitBtn: {
    marginTop: 18,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  viewAllSheet: {
    maxHeight: '92%',
    minHeight: 320,
  },
  viewAllHeaderTitles: { flex: 1, paddingRight: 12 },
  viewAllSubtitle: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 4 },
  viewAllGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 12,
    rowGap: VIEW_ALL_COL_GAP,
  },
  viewAllTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    overflow: 'hidden',
  },
  viewAllThumb: {
    width: '100%',
    height: 112,
    backgroundColor: '#D7DEE8',
  },
  viewAllJobName: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0F2744',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  photoPreviewRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  photoPreviewBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  photoPreviewPanel: {
    marginHorizontal: 16,
    zIndex: 1,
  },
  photoPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoPreviewTitleCol: { flex: 1, paddingRight: 12 },
  photoPreviewTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  photoPreviewKind: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  photoPreviewClose: { color: '#FFFFFF', fontSize: 22, fontWeight: '600', padding: 4 },
  photoPreviewImage: {
    width: '100%',
    height: PREVIEW_IMAGE_MAX_H,
    backgroundColor: 'transparent',
  },
  dim: { opacity: 0.88 },
});
