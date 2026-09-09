import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppDrawerParamList, AppTabParamList } from '../../navigation/types';
import { portalService } from '../../services/api/portalService';
import type { ServiceRequestAttachment, ServiceRequestJob } from '../../types/portal';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import {
  collectRequestAttachments,
  isPdfAttachment,
  openServiceRequestAttachment,
} from '../../utils/serviceRequestAttachment';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { SERVICE_REQUEST_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';

type ServiceRequestsScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'ServiceRequestsTab'>,
  DrawerNavigationProp<AppDrawerParamList>
>;

type RequestStatus = 'Pending' | 'In Progress' | 'Completed';

/** Same options as service-requests.vue */
const REQUEST_TYPES = ['Repair', 'Inspection', 'Emergency'] as const;

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

type MenuAnchor = {
  top: number;
  left: number;
  width: number;
};

function normalizeStatus(raw: string | undefined): RequestStatus {
  const value = String(raw ?? 'Pending').trim();
  if (value === 'Completed') {
    return 'Completed';
  }
  if (value === 'In Progress' || value === 'Scheduled' || value === 'Confirmed') {
    return 'In Progress';
  }
  return 'Pending';
}

function formatCreatedAt(job: ServiceRequestJob): string {
  const raw = job.startDate || job.lastUpdated || job.created_at;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return '—';
}

function requestType(job: ServiceRequestJob): string {
  return String(job.request_type || 'Service Request');
}

function requestDescription(job: ServiceRequestJob): string {
  return String(job.description || 'No description provided');
}

function primaryAttachmentName(job: ServiceRequestJob): string | undefined {
  const list = collectRequestAttachments(job);
  return list[0]?.name ? String(list[0].name) : undefined;
}

function attachmentIconLabel(attachment: ServiceRequestAttachment): string {
  return isPdfAttachment(attachment) ? 'PDF' : 'File';
}

export function ServiceRequestsScreen(): React.JSX.Element {
  const navigation = useNavigation<ServiceRequestsScreenNavigation>();
  const [selectedType, setSelectedType] = useState<(typeof REQUEST_TYPES)[number]>(REQUEST_TYPES[0]);
  const [description, setDescription] = useState('');
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeMenuAnchor, setTypeMenuAnchor] = useState<MenuAnchor | null>(null);
  const typeButtonRef = useRef<View>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<ServiceRequestJob | null>(null);
  const [openingAttachmentKey, setOpeningAttachmentKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await portalService.getServiceRequests();
      const jobs = (data.jobs ?? []).filter((job) => job.id != null && String(job.id).trim() !== '');
      setRequests(jobs);
    } catch (error) {
      toastAlert('Service Requests', error instanceof Error ? error.message : 'Failed to load service requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false).catch(() => setLoading(false));
  }, [load]);

  const filteredRequests = useMemo(
    () =>
      applyListFilters(requests, {
        searchQuery,
        searchFields: (item) => [
          String(item.id ?? ''),
          requestType(item),
          requestDescription(item),
          typeof item.status === 'string' ? item.status : '',
        ],
        statusFilter,
        getStatus: (item) => normalizeStatus(typeof item.status === 'string' ? item.status : undefined),
        sort: sortBy,
        getName: (item) => requestType(item),
        getDate: (item) => formatCreatedAt(item),
      }),
    [requests, searchQuery, sortBy, statusFilter],
  );

  const filterActive = statusFilter != null || sortBy !== DEFAULT_SORT;

  const pendingCount = useMemo(
    () =>
      String(
        requests.filter((item) => normalizeStatus(typeof item.status === 'string' ? item.status : undefined) !== 'Completed')
          .length,
      ).padStart(2, '0'),
    [requests],
  );

  const detailAttachments = useMemo(() => collectRequestAttachments(detailRequest), [detailRequest]);

  const onOpenAttachment = useCallback(async (attachment: ServiceRequestAttachment) => {
    const key = String(attachment.id ?? attachment.name ?? attachment.url ?? 'attachment');
    try {
      setOpeningAttachmentKey(key);
      await openServiceRequestAttachment(attachment);
    } catch (error) {
      toastAlert(
        'Service Requests',
        error instanceof Error ? error.message : 'Unable to open attachment.',
      );
    } finally {
      setOpeningAttachmentKey(null);
    }
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachmentUri(null);
    setAttachmentName(null);
    setAttachmentType(null);
  }, []);

  const closeTypeMenu = useCallback(() => {
    setTypeMenuOpen(false);
    setTypeMenuAnchor(null);
  }, []);

  const closeRequestModal = useCallback(() => {
    setRequestModalOpen(false);
    closeTypeMenu();
  }, [closeTypeMenu]);

  const openTypeMenu = useCallback(() => {
    if (typeMenuOpen) {
      closeTypeMenu();
      return;
    }

    typeButtonRef.current?.measureInWindow((x, y, width, height) => {
      setTypeMenuAnchor({ top: y + height + 4, left: x, width });
      setTypeMenuOpen(true);
    });
  }, [closeTypeMenu, typeMenuOpen]);

  const onAttachFile = useCallback(async () => {
    try {
      const [file] = await pick({
        type: [types.images, types.pdf],
        allowMultiSelection: false,
        ...(Platform.OS === 'android' ? { allowVirtualFiles: true } : {}),
      });
      if (file.error) {
        toastAlert('Service Requests', file.error);
        return;
      }

      if (typeof file.size === 'number' && file.size > MAX_ATTACHMENT_BYTES) {
        toastAlert('Service Requests', 'File must be 20MB or smaller.');
        return;
      }

      let uri = file.uri;
      const baseName = file.name || 'attachment';

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
          toastAlert('Service Requests', copy.copyError || 'Could not export the selected file.');
          return;
        }
      }

      if (!uri) {
        toastAlert('Service Requests', 'Could not read the selected file.');
        return;
      }

      setAttachmentUri(uri);
      setAttachmentName(baseName);
      setAttachmentType(file.type ?? null);
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      toastAlert('Service Requests', e instanceof Error ? e.message : 'Could not pick a file.');
    }
  }, []);

  const onSubmitRequest = useCallback(async () => {
    const desc = description.trim();
    if (!desc) {
      toastAlert('Service Requests', 'Please enter a description of the service you need.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await portalService.createServiceRequest({
        request_type: selectedType,
        description: desc,
        attachments:
          attachmentUri && attachmentName
            ? [{ uri: attachmentUri, name: attachmentName, type: attachmentType }]
            : undefined,
      });

      if (res.success) {
        setDescription('');
        clearAttachment();
        closeRequestModal();
        await load(true);
        toastAlert('Service Requests', 'Service request submitted successfully.');
      } else {
        toastAlert('Service Requests', res.message || 'Could not submit service request.');
      }
    } catch (e) {
      toastAlert('Service Requests', e instanceof Error ? e.message : 'Could not submit service request.');
    } finally {
      setSubmitting(false);
    }
  }, [
    attachmentName,
    attachmentType,
    attachmentUri,
    clearAttachment,
    closeRequestModal,
    description,
    load,
    selectedType,
  ]);

  if (loading && requests.length === 0) {
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
            placeholder="Search by ID, type, or description"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Service Requests</Text>
          <Text style={styles.heroSub}>Submit new service requests and track status updates in real time.</Text>
          <View style={styles.heroActionsRow}>
            <View style={[styles.heroChip, styles.heroChipMuted]}>
              <Text style={styles.heroChipText} numberOfLines={1} ellipsizeMode="tail">
                {pendingCount} Active Requests
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.heroChip, styles.heroChipOutline, pressed && styles.dim]}
              onPress={() => setRequestModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Request a service"
            >
              <View style={styles.heroChipInner}>
                <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden style={styles.heroChipIcon}>
                  <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                </Svg>
                <Text style={styles.heroChipText} numberOfLines={1} ellipsizeMode="tail">
                  Request a service
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Requested Services</Text>
          {requests.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No service requests yet</Text>
              <Text style={styles.empty}>Tap “Request a service” to submit your first request.</Text>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No matching requests</Text>
              <Text style={styles.empty}>Try a different search or filter.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {filteredRequests.map((item) => {
                const status = normalizeStatus(typeof item.status === 'string' ? item.status : undefined);
                const attachmentName = primaryAttachmentName(item);
                return (
                  <Pressable
                    key={String(item.id)}
                    style={({ pressed }) => [styles.requestCard, pressed && styles.dim]}
                    onPress={() => setDetailRequest(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`View service request ${item.id}`}
                  >
                    <View style={styles.requestTop}>
                      <Text style={styles.requestId}>SR-{item.id}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          status === 'Completed'
                            ? styles.statusCompleted
                            : status === 'In Progress'
                              ? styles.statusProgress
                              : styles.statusPending,
                        ]}
                      >
                        <Text style={styles.statusText}>{status}</Text>
                      </View>
                    </View>
                    <Text style={styles.requestType}>{requestType(item)}</Text>
                    <Text style={styles.requestDesc} numberOfLines={3}>
                      {requestDescription(item)}
                    </Text>
                    <Text style={styles.requestMeta}>
                      {formatCreatedAt(item)}
                      {attachmentName ? ` · ${attachmentName}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={detailRequest != null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailRequest(null)}
      >
        <View style={styles.detailModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDetailRequest(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View style={styles.detailModalSheet}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle}>Service Request Details</Text>
              <Pressable onPress={() => setDetailRequest(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.detailModalClose}>✕</Text>
              </Pressable>
            </View>
            {detailRequest ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailModalBody}>
                <View style={styles.detailPillRow}>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>{requestType(detailRequest)}</Text>
                  </View>
                  <View style={[styles.typePill, styles.statusPillInModal]}>
                    <Text style={styles.statusPillTextInModal}>
                      {normalizeStatus(typeof detailRequest.status === 'string' ? detailRequest.status : undefined)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.detailSectionLabel}>Request ID</Text>
                <Text style={styles.detailValue}>SR-{detailRequest.id}</Text>

                <Text style={styles.detailSectionLabel}>Description</Text>
                <Text style={styles.detailDescription}>{requestDescription(detailRequest)}</Text>

                <Text style={styles.detailSectionLabel}>Created date</Text>
                <Text style={styles.detailValue}>{formatCreatedAt(detailRequest)}</Text>

                <Text style={styles.detailSectionLabel}>Attachments</Text>
                {detailAttachments.length === 0 ? (
                  <Text style={styles.detailMuted}>No attachments</Text>
                ) : (
                  <View style={styles.detailAttachmentsList}>
                    {detailAttachments.map((attachment, index) => {
                      const key = String(attachment.id ?? attachment.url ?? attachment.name ?? index);
                      const isOpening = openingAttachmentKey === String(attachment.id ?? attachment.name ?? attachment.url ?? 'attachment');
                      return (
                        <Pressable
                          key={key}
                          style={({ pressed }) => [styles.attachmentOpenRow, pressed && styles.dim]}
                          onPress={() => void onOpenAttachment(attachment)}
                          disabled={isOpening}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${attachment.name || 'attachment'}`}
                        >
                          <View style={styles.attachmentIconBadge}>
                            <Text style={styles.attachmentIconBadgeText}>{attachmentIconLabel(attachment)}</Text>
                          </View>
                          <Text style={styles.attachmentOpenName} numberOfLines={2}>
                            {attachment.name || 'Attachment'}
                          </Text>
                          {isOpening ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Text style={styles.attachmentOpenAction}>Open</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.detailCloseBtn, pressed && styles.dim]}
              onPress={() => setDetailRequest(null)}
            >
              <Text style={styles.detailCloseBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={requestModalOpen} transparent animationType="slide" onRequestClose={closeRequestModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request a service</Text>
              <Pressable onPress={closeRequestModal} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
              onScrollBeginDrag={closeTypeMenu}
              nestedScrollEnabled
              removeClippedSubviews={false}
            >
              <Text style={styles.label}>Request type</Text>
              <View ref={typeButtonRef} collapsable={false} style={styles.typeSelectWrap}>
                <Pressable style={styles.typeSelect} onPress={openTypeMenu}>
                  <Text style={styles.typeSelectText}>{selectedType}</Text>
                  <Text style={styles.typeChevron}>{typeMenuOpen ? '▴' : '▾'}</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the requested service..."
                placeholderTextColor="#8A93A7"
                multiline
                style={styles.descriptionInput}
              />

              <View style={styles.attachmentRow}>
                <Pressable style={({ pressed }) => [styles.attachmentBtn, pressed && styles.dim]} onPress={onAttachFile}>
                  <Text style={styles.attachmentBtnText}>+ Add Attachment (Optional)</Text>
                </Pressable>
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {attachmentName ?? 'No file selected'}
                </Text>
                {attachmentName ? (
                  <Pressable onPress={clearAttachment} hitSlop={8}>
                    <Text style={styles.clearAttachment}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                style={({ pressed }) => [styles.submitBtn, (pressed || submitting) && styles.dim]}
                onPress={onSubmitRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit request</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>

          {typeMenuOpen && typeMenuAnchor ? (
            <>
              <Pressable
                style={styles.dropdownBackdrop}
                onPress={closeTypeMenu}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              />
              <View
                style={[
                  styles.typeMenuOverlay,
                  { top: typeMenuAnchor.top, left: typeMenuAnchor.left, width: typeMenuAnchor.width },
                ]}
              >
                {REQUEST_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={({ pressed }) => [
                      styles.typeMenuItem,
                      selectedType === type && styles.typeMenuItemActive,
                      pressed && styles.dim,
                    ]}
                    onPress={() => {
                      setSelectedType(type);
                      closeTypeMenu();
                    }}
                  >
                    <Text style={[styles.typeMenuText, selectedType === type && styles.typeMenuTextActive]}>{type}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusOptions={SERVICE_REQUEST_STATUS_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={statusFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setStatusFilter(status);
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
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6, marginRight: 80 },
  heroActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 10,
  },
  heroChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
    flexShrink: 1,
  },
  heroChipMuted: {
    backgroundColor: '#2D74E8',
    flexShrink: 0,
    flexGrow: 0,
  },
  heroChipOutline: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  heroChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    flexShrink: 1,
    minWidth: 0,
  },
  heroChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  heroChipIcon: {
    flexShrink: 0,
  },
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
    marginBottom: 8,
  },
  modalTitle: {
    color: '#1D2D44',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    paddingRight: 12,
  },
  modalClose: {
    color: '#4B5563',
    fontSize: 18,
    fontWeight: '700',
    padding: 4,
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  label: { color: '#344054', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
  },
  typeMenuOverlay: {
    position: 'absolute',
    zIndex: 50,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE3EE',
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  typeSelectWrap: { marginBottom: 4 },
  typeSelect: {
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
  typeSelectText: { color: '#24334E', fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 10 },
  typeChevron: { color: '#24334E', fontSize: 12, fontWeight: '700' },
  typeMenuItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F8' },
  typeMenuItemActive: { backgroundColor: '#EEF4FF' },
  typeMenuText: { color: '#344054', fontSize: 13, fontWeight: '500' },
  typeMenuTextActive: { color: colors.primary, fontWeight: '700' },
  descriptionInput: {
    minHeight: 94,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E0EE',
    backgroundColor: '#F9FBFF',
    color: '#24334E',
    fontSize: 13,
    textAlignVertical: 'top',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attachmentRow: { marginTop: 10 },
  attachmentBtn: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C9DAF5',
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attachmentBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  attachmentName: { marginTop: 6, color: '#6B7280', fontSize: 12 },
  clearAttachment: { marginTop: 4, color: colors.primary, fontSize: 12, fontWeight: '600' },
  submitBtn: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  listSection: { marginTop: 14 },
  listTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyWrap: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 26,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 6,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  listWrap: { gap: 10 },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  requestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requestId: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPending: { backgroundColor: '#FFF2DA' },
  statusProgress: { backgroundColor: '#E8F2FF' },
  statusCompleted: { backgroundColor: '#E8F8EF' },
  statusText: { color: '#394150', fontSize: 11, fontWeight: '700' },
  requestType: { marginTop: 8, color: '#18263F', fontSize: 15, fontWeight: '700' },
  requestDesc: { marginTop: 6, color: '#4F5B73', fontSize: 13, lineHeight: 18 },
  requestMeta: { marginTop: 8, color: '#6A7489', fontSize: 12 },
  detailModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  detailModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    maxHeight: '88%',
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  detailModalTitle: {
    flex: 1,
    color: '#1D2D44',
    fontSize: 18,
    fontWeight: '700',
  },
  detailModalClose: {
    color: '#4B5563',
    fontSize: 18,
    fontWeight: '700',
    padding: 4,
  },
  detailModalBody: {
    paddingBottom: 12,
  },
  detailPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typePill: {
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typePillText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  statusPillInModal: {
    backgroundColor: '#E8F2FF',
  },
  statusPillTextInModal: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  detailSectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 4,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailDescription: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    marginBottom: 4,
  },
  detailMuted: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  detailAttachmentsList: {
    gap: 8,
    marginBottom: 8,
  },
  attachmentOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E0EE',
    backgroundColor: '#F9FBFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attachmentIconBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  attachmentIconBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  attachmentOpenName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  attachmentOpenAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  detailCloseBtn: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  detailCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dim: { opacity: 0.88 },
});
