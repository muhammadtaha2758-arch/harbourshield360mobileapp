import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import Svg, { Circle, Path } from 'react-native-svg';
import { portalService } from '../../services/api/portalService';
import { downloadCustomerDocument, viewCustomerDocument } from '../../utils/documentDownload';
import { colors } from '../../theme/colors';
import { portalScreenLayout, PORTAL_HEADER_TOP_PADDING } from '../../theme/portalScreenLayout';
import type { CustomerDocument } from '../../types/portal';
import type { AppDrawerParamList, AppTabParamList } from '../../navigation/types';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { SearchResultsEmpty } from '../../components/SearchResultsEmpty';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { DOCUMENT_TYPE_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters, matchesSearchQuery } from '../../utils/listFiltering';

type DocumentsScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'DocumentsTab'>,
  DrawerNavigationProp<AppDrawerParamList>
>;

type MenuAnchor = {
  top: number;
  left: number;
  width: number;
};

const DOC_ACTIONS_MENU_WIDTH = 168;

function formatFileSize(size: unknown): string {
  if (size == null || size === '') {
    return '—';
  }
  const n = typeof size === 'number' ? size : Number(size);
  if (!Number.isFinite(n) || n < 0) {
    return '—';
  }
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtensionFromName(name: string): string {
  const trimmed = name.trim();
  const i = trimmed.lastIndexOf('.');
  if (i <= 0 || i === trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(i + 1).toLowerCase();
}

function formatDocumentDate(iso: string | undefined): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function documentSubtitleKind(doc: CustomerDocument): string {
  const r = doc as Record<string, unknown>;
  for (const key of ['category', 'document_type', 'type_label'] as const) {
    const v = r[key];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return documentKindLabel(doc);
}

function DocumentViewIcon(): React.JSX.Element {
  const stroke = colors.primary;
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} stroke={stroke} strokeWidth={1.75} />
    </Svg>
  );
}

function documentKindLabel(doc: CustomerDocument): string {
  const mime = String(doc.file_type || '').toLowerCase();
  const ext = fileExtensionFromName(String(doc.original_name || ''));
  if (mime.includes('pdf') || ext === 'pdf') {
    return 'PDF';
  }
  if (mime.includes('word') || mime.includes('msword') || mime.includes('wordprocessingml') || ext === 'doc' || ext === 'docx') {
    return 'Word';
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)) {
    return 'Image';
  }
  if (mime.includes('zip') || ext === 'zip') {
    return 'Zip';
  }
  if (mime.includes('plain') || ext === 'txt') {
    return 'Text';
  }
  if (ext) {
    return ext.toUpperCase();
  }
  return 'File';
}

function documentIconAccent(doc: CustomerDocument): { bg: string; fg: string; label: string } {
  const mime = String(doc.file_type || '').toLowerCase();
  const ext = fileExtensionFromName(String(doc.original_name || ''));
  if (mime.includes('pdf') || ext === 'pdf') {
    return { bg: '#FDECEC', fg: '#DC2626', label: 'PDF' };
  }
  if (mime.includes('word') || mime.includes('msword') || mime.includes('wordprocessingml') || ext === 'doc' || ext === 'docx') {
    return { bg: '#DBEAFE', fg: '#1D4ED8', label: ext === 'doc' ? 'DOC' : 'DOCX' };
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return { bg: '#DCFCE7', fg: '#15803D', label: 'IMG' };
  }
  if (mime.includes('zip') || ext === 'zip') {
    return { bg: '#F3E8FF', fg: '#7C3AED', label: 'ZIP' };
  }
  if (mime.includes('plain') || ext === 'txt') {
    return { bg: '#E7E5E4', fg: '#57534E', label: 'TXT' };
  }
  return { bg: '#EEF2F6', fg: '#475569', label: (ext || 'FILE').slice(0, 4).toUpperCase() };
}

export function DocumentsScreen(): React.JSX.Element {
  const navigation = useNavigation<DocumentsScreenNavigation>();
  const [items, setItems] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState('');
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [pickedSize, setPickedSize] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | number | null>(null);
  const [viewingId, setViewingId] = useState<string | number | null>(null);
  const [actionsMenuDoc, setActionsMenuDoc] = useState<CustomerDocument | null>(null);
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState<MenuAnchor | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const moreMenuAnchorRefs = useRef<Record<string, View | null>>({});

  const onViewAllRecentDocuments = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  const load = useCallback(async (isRefresh: boolean) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const files = await portalService.getDocuments();
      setItems(files);
    } catch (error) {
      toastAlert('Documents', error instanceof Error ? error.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const resetUploadForm = useCallback(() => {
    setPickedUri(null);
    setPickedName('');
    setPickedType(null);
    setPickedSize(null);
  }, []);

  const onChooseFile = useCallback(async () => {
    try {
      const [file] = await pick({
        type: [types.pdf, types.doc, types.docx, types.images, types.plainText, types.zip],
        allowMultiSelection: false,
        ...(Platform.OS === 'android' ? { allowVirtualFiles: true } : {}),
      });
      if (file.error) {
        toastAlert('Documents', file.error);
        return;
      }
      let uri = file.uri;
      const baseName = file.name || 'document';

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
          toastAlert('Documents', copy.copyError || 'Could not export the selected file.');
          return;
        }
      }

      if (!uri) {
        toastAlert('Documents', 'Could not read the selected file.');
        return;
      }
      setPickedUri(uri);
      setPickedName(baseName);
      setPickedType(file.type);
      setPickedSize(typeof file.size === 'number' ? file.size : null);
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      toastAlert('Documents', e instanceof Error ? e.message : 'Could not pick a file.');
    }
  }, []);

  const onSubmitUpload = useCallback(async () => {
    if (!pickedUri) {
      toastAlert('Documents', 'Choose a file to upload.');
      return;
    }
    const nameForUpload = pickedName.trim() || 'document';
    try {
      setUploading(true);
      const result = await portalService.uploadDocument({
        uri: pickedUri,
        name: nameForUpload,
        type: pickedType,
        size: pickedSize,
      });
      if (result.success) {
        await load(true);
        setUploadModalOpen(false);
        resetUploadForm();
      } else {
        toastAlert('Documents', result.message || 'Upload failed.');
      }
    } catch (error) {
      toastAlert('Documents', error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }, [load, pickedName, pickedSize, pickedType, pickedUri, resetUploadForm]);

  const openDocumentView = useCallback(async (item: CustomerDocument) => {
    const docId = item.id ?? item.original_name;
    try {
      setViewingId(docId ?? 'view');
      await viewCustomerDocument(item);
    } catch (error) {
      toastAlert(
        'Could not open file',
        error instanceof Error ? error.message : 'Unable to open this document.',
      );
    } finally {
      setViewingId(null);
    }
  }, []);

  const openDocumentDownload = useCallback(async (item: CustomerDocument) => {
    const docId = item.id ?? item.original_name;
    try {
      setDownloadingId(docId ?? 'download');
      await downloadCustomerDocument(item);
      if (Platform.OS === 'android') {
        toastAlert('Download started', 'Check your Downloads folder or notification shade.');
      }
    } catch (error) {
      toastAlert(
        'Download failed',
        error instanceof Error ? error.message : 'Could not download this file.',
      );
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const closeActionsMenu = useCallback(() => {
    setActionsMenuDoc(null);
    setActionsMenuAnchor(null);
  }, []);

  const openDocumentActionsMenu = useCallback(
    (item: CustomerDocument) => {
      const key = String(item.id ?? item.original_name ?? '');
      const openKey = actionsMenuDoc ? String(actionsMenuDoc.id ?? actionsMenuDoc.original_name ?? '') : '';
      if (actionsMenuDoc && openKey === key) {
        closeActionsMenu();
        return;
      }

      const anchorNode = moreMenuAnchorRefs.current[key];
      if (!anchorNode) {
        return;
      }

      anchorNode.measureInWindow((x, y, width, height) => {
        setActionsMenuAnchor({
          top: y + height + 4,
          left: Math.max(12, x + width - DOC_ACTIONS_MENU_WIDTH),
          width: DOC_ACTIONS_MENU_WIDTH,
        });
        setActionsMenuDoc(item);
      });
    },
    [actionsMenuDoc, closeActionsMenu],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const filteredItems = useMemo(() => {
    let list = items;

    if (typeFilter === 'pdf') {
      list = list.filter((doc) => documentKindLabel(doc) === 'PDF');
    } else if (typeFilter === 'image') {
      list = list.filter((doc) => documentKindLabel(doc) === 'Image');
    } else if (typeFilter === 'word') {
      list = list.filter((doc) => documentKindLabel(doc) === 'Word');
    } else if (typeFilter === 'large') {
      list = list.filter((doc) => Number(doc.file_size ?? 0) >= 1024 * 1024);
    }

    const searched = searchQuery.trim()
      ? list.filter((doc) =>
          matchesSearchQuery(searchQuery, [
            String(doc.original_name ?? ''),
            documentSubtitleKind(doc),
            String(doc.id ?? ''),
          ]),
        )
      : list;

    return applyListFilters(searched, {
      sort: sortBy,
      getName: (doc) => String(doc.original_name ?? ''),
      getDate: (doc) => String(doc.created_at ?? ''),
    });
  }, [items, searchQuery, sortBy, typeFilter]);

  const filterActive = typeFilter != null || sortBy !== DEFAULT_SORT;

  const totalFiles = String(items.length).padStart(2, '0');
  const totalSize = useMemo(() => {
    const bytes = items.reduce((sum, item) => sum + (Number(item.file_size ?? 0) || 0), 0);
    return formatFileSize(bytes);
  }, [items]);

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[portalScreenLayout.chrome, styles.chrome]}>
        <View style={[portalScreenLayout.profileRow, styles.profileRow]}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable
            style={({ pressed }) => [styles.iconTile, pressed && styles.dim]}
            iconWidth={22}
            iconHeight={23}
          />
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
            placeholder="Search documents by name or type"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={closeActionsMenu}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Documents</Text>
          <Text style={styles.heroSub}>All files for projects, agreements and invoices in one secure place.</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalFiles}</Text>
              <Text style={styles.statLabel}>Total files</Text>
            </View>
            <View style={styles.statCard}>
              <Pressable
                style={({ pressed }) => [styles.uploadCta, pressed && styles.dim]}
                onPress={() => {
                  resetUploadForm();
                  setUploadModalOpen(true);
                }}
              >
                <Text style={styles.uploadCtaText}>+ Upload document</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent documents</Text>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.sectionCount}>{String(filteredItems.length).padStart(2, '0')}</Text>
              <Pressable
                onPress={onViewAllRecentDocuments}
                hitSlop={8}
                disabled={filteredItems.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Scroll to all recent documents"
                accessibilityState={{ disabled: filteredItems.length === 0 }}
              >
  
              </Pressable>
            </View>
          </View>
          <View style={styles.listWrap}>
            {filteredItems.length === 0 && items.length > 0 ? (
              <SearchResultsEmpty
                query={searchQuery}
                onClear={() => {
                  setSearchQuery('');
                  setTypeFilter(null);
                  setSortBy(DEFAULT_SORT);
                }}
              />
            ) : (
            filteredItems.map((item, index) => {
              const accent = documentIconAccent(item);
              const name = String(item.original_name || 'Untitled');
              const dateStr = formatDocumentDate(item.created_at);
              const kind = documentSubtitleKind(item);
              const metaParts = [kind, dateStr, formatFileSize(item.file_size)].filter((p) => p.length > 0);
              const docKey = item.id ?? item.original_name;
              const docBusy = downloadingId != null || viewingId != null;
              return (
                <View key={String(item.id ?? index)} style={styles.docCard}>
                  <View style={[styles.docIconWrap, { backgroundColor: accent.bg }]}>
                    <Text
                      style={[
                        styles.docIconLabel,
                        { color: accent.fg, fontSize: accent.label.length > 3 ? 8 : 10 },
                      ]}
                      numberOfLines={1}
                    >
                      {accent.label}
                    </Text>
                  </View>
                  <View style={styles.docTextCol}>
                    <Text style={styles.docTitle} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.docSubtitle} numberOfLines={1}>
                      {metaParts.join(' • ')}
                    </Text>
                  </View>
                  <View style={styles.docActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View document"
                      disabled={docBusy}
                      onPress={() => void openDocumentView(item)}
                      style={({ pressed }) => [
                        styles.docActionSquare,
                        pressed && styles.dim,
                        viewingId === docKey && styles.docActionBusy,
                      ]}
                    >
                      {viewingId === docKey ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <DocumentViewIcon />
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Download"
                      disabled={docBusy}
                      onPress={() => void openDocumentDownload(item)}
                      style={({ pressed }) => [
                        styles.docActionSquare,
                        pressed && styles.dim,
                        downloadingId === docKey && styles.docActionBusy,
                      ]}
                    >
                      {downloadingId === docKey ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={styles.docDownloadIcon}>↓</Text>
                      )}
                    </Pressable>
                    <View
                      ref={(node) => {
                        moreMenuAnchorRefs.current[String(docKey)] = node;
                      }}
                      collapsable={false}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="More options"
                        onPress={() => openDocumentActionsMenu(item)}
                        style={({ pressed }) => [
                          styles.docMoreHit,
                          pressed && styles.dim,
                          actionsMenuDoc &&
                            String(actionsMenuDoc.id ?? actionsMenuDoc.original_name) === String(docKey) &&
                            styles.docMoreHitActive,
                        ]}
                        hitSlop={6}
                      >
                        <Text style={styles.docMoreIcon}>⋮</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
            )}
          </View>
        </View>

      </ScrollView>

      <Modal visible={uploadModalOpen} transparent animationType="slide" onRequestClose={() => setUploadModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload document</Text>
              <Pressable
                onPress={() => {
                  setUploadModalOpen(false);
                  resetUploadForm();
                }}
                hitSlop={8}
              >
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>File</Text>
            <Pressable style={({ pressed }) => [styles.pickFileBtn, pressed && styles.dim]} onPress={onChooseFile}>
              <Text style={styles.pickFileBtnText}>{pickedName ? 'Change file' : 'Choose file'}</Text>
            </Pressable>
            {pickedName ? (
              <Text style={styles.pickedFileMeta} numberOfLines={2}>
                {pickedName}
                {pickedSize != null ? ` · ${formatFileSize(pickedSize)}` : ''}
              </Text>
            ) : (
              <Text style={styles.fieldHint}>PDF, Word, images, text, or zip</Text>
            )}

            <Text style={styles.fieldLabel}>Display name (optional)</Text>
            <TextInput
              value={pickedName}
              onChangeText={setPickedName}
              placeholder="File name shown in the list"
              placeholderTextColor="#8A93A7"
              style={styles.fieldInput}
            />

            <Pressable
              style={({ pressed }) => [styles.submitBtn, (pressed || uploading) && styles.dim]}
              onPress={() => {
                if (!uploading) {
                  void onSubmitUpload();
                }
              }}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Upload</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter documents"
        statusOptions={DOCUMENT_TYPE_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={typeFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setTypeFilter(status);
          setSortBy(sort);
        }}
      />

      {actionsMenuDoc && actionsMenuAnchor ? (
        <>
          <Pressable
            style={styles.screenDropdownBackdrop}
            onPress={closeActionsMenu}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
          <View
            style={[
              styles.docActionsMenu,
              {
                top: actionsMenuAnchor.top,
                left: actionsMenuAnchor.left,
                width: actionsMenuAnchor.width,
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [styles.docActionsMenuItem, pressed && styles.dim]}
              onPress={() => {
                const doc = actionsMenuDoc;
                closeActionsMenu();
                void openDocumentView(doc);
              }}
            >
              <Text style={styles.docActionsMenuText}>View</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.docActionsMenuItem, styles.docActionsMenuItemLast, pressed && styles.dim]}
              onPress={() => {
                const doc = actionsMenuDoc;
                closeActionsMenu();
                void openDocumentDownload(doc);
              }}
            >
              <Text style={styles.docActionsMenuText}>Download</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dashboardCanvas,
  },
  screenDropdownBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 90,
  },
  docActionsMenu: {
    position: 'absolute',
    zIndex: 100,
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
  docActionsMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F8',
  },
  docActionsMenuItemLast: {
    borderBottomWidth: 0,
  },
  docActionsMenuText: {
    color: '#24334E',
    fontSize: 14,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  chrome: {
    paddingHorizontal: 14,
    paddingTop: PORTAL_HEADER_TOP_PADDING,
    paddingBottom: 10,
  },
  profileRow: {
    marginBottom: 8,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.avatarSoftFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A5568',
    marginLeft: 8,
  },
  chevron: {
    fontSize: 10,
    color: colors.primary,
    marginLeft: 4,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  menuGlyph: { width: 18, gap: 4 },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.textPrimary,
  },
  searchShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingLeft: 10,
    paddingRight: 4,
    marginLeft: 8,
    minHeight: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  innerFilterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.innerFilterBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroSub: {
    color: '#DFE9FF',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginRight: 120,
  },

  sectionBlock: { marginTop: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700' },
  sectionCount: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  viewAllText: { color: colors.primary, fontSize: 13, fontWeight: '600', marginLeft: 12 },
  viewAllTextDisabled: { color: '#94A3B8', opacity: 0.65 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
   
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#2D74E8',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: '#DCE7FF',
    fontSize: 11,
    marginTop: 1,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  filterPill: {
    backgroundColor: '#E9EDF5',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: '#425067',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listWrap: {
    marginTop: 0,
    gap: 6,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EDF4',
    shadowColor: '#1A2848',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  docIconLabel: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.15,
  },
  docTextCol: {
    flex: 1,
    minWidth: 0,
  },
  docTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  docSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
  },
  docActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    gap: 6,
  },
  docActionBusy: {
    opacity: 0.85,
  },
  docActionSquare: {
    width: 34,
    height: 34,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E3EAF6',
    backgroundColor: '#FAFBFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docDownloadIcon: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: -1,
  },
  docMoreHit: {
    minWidth: 32,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  docMoreHitActive: {
    backgroundColor: '#EEF4FF',
  },
  docMoreIcon: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '700',
  },
  emptyWrap: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#24334E',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  uploadCta: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E0EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCtaText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
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
  },
  modalClose: {
    color: '#4B5563',
    fontSize: 18,
    fontWeight: '700',
    padding: 4,
  },
  fieldLabel: {
    color: '#344054',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  fieldHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  pickFileBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#F0F6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickFileBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  pickedFileMeta: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E0EE',
    backgroundColor: '#F9FBFF',
    color: '#24334E',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitBtn: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dim: { opacity: 0.88 },
});
