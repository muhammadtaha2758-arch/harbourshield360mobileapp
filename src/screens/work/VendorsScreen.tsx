import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmModal } from '../../components/ConfirmModal';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { SearchResultsEmpty } from '../../components/SearchResultsEmpty';
import { vendorService } from '../../services/api/vendorService';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import type {
  ClientVendor,
  VendorFormPayload,
  VendorJobOption,
  VendorRequestRecord,
} from '../../types/vendors';

type TabKey = 'vendors' | 'requests';

const EMPTY_VENDOR_FORM: VendorFormPayload = {
  company_name: '',
  contact_name: '',
  phone: '',
  email: '',
  website_url: '',
  service_type: '',
  notes: '',
};

function vendorInitials(v: ClientVendor): string {
  const name = (v.company_name || '').trim();
  if (!name) {
    return '?';
  }
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDate(raw?: string | null): string {
  if (!raw) {
    return '—';
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return raw;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusTone(status: string): { bg: string; text: string } {
  const s = status.toLowerCase();
  if (s === 'sent' || s === 'viewed') {
    return { bg: '#DBEAFE', text: '#1D4ED8' };
  }
  if (s === 'completed' || s === 'accepted') {
    return { bg: '#DCFCE7', text: '#15803D' };
  }
  if (s === 'cancelled' || s === 'declined') {
    return { bg: '#E5E7EB', text: '#6B7280' };
  }
  return { bg: '#FEF3C7', text: '#B45309' };
}

function isClosedStatus(status: string): boolean {
  return ['cancelled', 'declined', 'completed'].includes(status.toLowerCase());
}

function HamburgerGlyph(): React.JSX.Element {
  return (
    <View style={styles.hamburger}>
      <View style={[styles.hamburgerLine, styles.hamburgerLineFirst]} />
      <View style={styles.hamburgerLine} />
      <View style={styles.hamburgerLine} />
    </View>
  );
}

export function VendorsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [tab, setTab] = useState<TabKey>('vendors');
  const [searchQuery, setSearchQuery] = useState('');
  const [vendors, setVendors] = useState<ClientVendor[]>([]);
  const [requests, setRequests] = useState<VendorRequestRecord[]>([]);
  const [jobOptions, setJobOptions] = useState<VendorJobOption[]>([]);
  const [vendorsTotal, setVendorsTotal] = useState(0);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<ClientVendor | null>(null);
  const [vendorForm, setVendorForm] = useState<VendorFormPayload>(EMPTY_VENDOR_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ClientVendor | null>(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestVendorId, setRequestVendorId] = useState<string>('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestAddress, setRequestAddress] = useState('');
  const [requestProjectId, setRequestProjectId] = useState<string>('');
  const [requestCustomMessage, setRequestCustomMessage] = useState('');
  const [shareAddress, setShareAddress] = useState(true);
  const [shareFiles, setShareFiles] = useState(true);
  const [allowMessaging, setAllowMessaging] = useState(true);
  const [allowUploads, setAllowUploads] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<VendorRequestRecord | null>(null);
  const [messageBody, setMessageBody] = useState('');

  const loadAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [vendorsPayload, requestsPayload, jobs] = await Promise.all([
        vendorService.listVendors({ search: searchQuery }),
        vendorService.listRequests({ search: searchQuery }),
        vendorService.jobOptions().catch(() => [] as VendorJobOption[]),
      ]);
      setVendors(vendorsPayload.items ?? []);
      setVendorsTotal(vendorsPayload.total ?? 0);
      setRequests(requestsPayload.items ?? []);
      setRequestsTotal(requestsPayload.total ?? 0);
      setJobOptions(jobs);
    } catch (error) {
      toastAlert('Vendors', error instanceof Error ? error.message : 'Unable to load vendors.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [loadAll]);

  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const openAddVendor = useCallback(() => {
    setEditingVendor(null);
    setVendorForm(EMPTY_VENDOR_FORM);
    setVendorModalOpen(true);
  }, []);

  const openEditVendor = useCallback((v: ClientVendor) => {
    setEditingVendor(v);
    setVendorForm({
      company_name: v.company_name || '',
      contact_name: v.contact_name || '',
      phone: v.phone || '',
      email: v.email || '',
      website_url: v.website_url || '',
      service_type: v.service_type || '',
      notes: v.notes || '',
    });
    setVendorModalOpen(true);
  }, []);

  const saveVendor = useCallback(async () => {
    if (!vendorForm.company_name.trim()) {
      toastAlert('Vendors', 'Company name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editingVendor) {
        await vendorService.updateVendor(editingVendor.id, vendorForm);
        toastAlert('Vendors', 'Vendor updated.');
      } else {
        await vendorService.createVendor(vendorForm);
        toastAlert('Vendors', 'Vendor added.');
      }
      setVendorModalOpen(false);
      await loadAll(true);
    } catch (error) {
      toastAlert('Vendors', error instanceof Error ? error.message : 'Unable to save vendor.');
    } finally {
      setSaving(false);
    }
  }, [editingVendor, loadAll, vendorForm]);

  const confirmDeleteVendor = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    setSaving(true);
    try {
      await vendorService.deleteVendor(deleteTarget.id);
      setDeleteTarget(null);
      toastAlert('Vendors', 'Vendor deleted.');
      await loadAll(true);
    } catch (error) {
      toastAlert('Vendors', error instanceof Error ? error.message : 'Unable to delete vendor.');
    } finally {
      setSaving(false);
    }
  }, [deleteTarget, loadAll]);

  const openNewRequest = useCallback((vendor?: ClientVendor | null) => {
    setRequestVendorId(vendor ? String(vendor.id) : '');
    setRequestTitle('');
    setRequestDescription('');
    setRequestAddress('');
    setRequestProjectId('');
    setRequestCustomMessage('');
    setShareAddress(true);
    setShareFiles(true);
    setAllowMessaging(true);
    setAllowUploads(true);
    setRequestModalOpen(true);
  }, []);

  const selectedJob = useMemo(
    () => jobOptions.find((j) => String(j.id) === requestProjectId) ?? null,
    [jobOptions, requestProjectId],
  );

  useEffect(() => {
    if (selectedJob?.customer_address && !requestAddress.trim()) {
      setRequestAddress(selectedJob.customer_address);
    }
  }, [requestAddress, selectedJob]);

  const submitRequest = useCallback(async () => {
    if (!requestVendorId) {
      toastAlert('Vendors', 'Select a vendor.');
      return;
    }
    if (!requestTitle.trim()) {
      toastAlert('Vendors', 'Title is required.');
      return;
    }
    setSaving(true);
    try {
      await vendorService.createRequest({
        client_vendor_id: requestVendorId,
        project_id: requestProjectId || null,
        title: requestTitle.trim(),
        description: requestDescription.trim() || undefined,
        address: requestAddress.trim() || undefined,
        custom_message: requestCustomMessage.trim() || undefined,
        share_address: shareAddress,
        share_files: shareFiles,
        allow_messaging: allowMessaging,
        allow_uploads: allowUploads,
      });
      setRequestModalOpen(false);
      setTab('requests');
      toastAlert('Vendors', 'Vendor request sent.');
      await loadAll(true);
    } catch (error) {
      toastAlert('Vendors', error instanceof Error ? error.message : 'Unable to send request.');
    } finally {
      setSaving(false);
    }
  }, [
    allowMessaging,
    allowUploads,
    loadAll,
    requestAddress,
    requestCustomMessage,
    requestDescription,
    requestProjectId,
    requestTitle,
    requestVendorId,
    shareAddress,
    shareFiles,
  ]);

  const openRequestDetail = useCallback(async (id: number | string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setMessageBody('');
    try {
      const row = await vendorService.getRequest(id);
      setDetail(row);
    } catch (error) {
      setDetailOpen(false);
      toastAlert('Vendors', error instanceof Error ? error.message : 'Unable to load request.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const cancelRequest = useCallback(async () => {
    if (!detail) {
      return;
    }
    setSaving(true);
    try {
      const updated = await vendorService.cancelRequest(detail.id);
      setDetail(updated);
      toastAlert('Vendors', 'Request cancelled.');
      await loadAll(true);
    } catch (error) {
      toastAlert('Vendors', error instanceof Error ? error.message : 'Unable to cancel.');
    } finally {
      setSaving(false);
    }
  }, [detail, loadAll]);

  const resendRequest = useCallback(async () => {
    if (!detail) {
      return;
    }
    setSaving(true);
    try {
      const updated = await vendorService.resendRequest(detail.id);
      setDetail(updated);
      toastAlert('Vendors', 'Invite resent.');
      await loadAll(true);
    } catch (error) {
      toastAlert('Vendors', error instanceof Error ? error.message : 'Unable to resend.');
    } finally {
      setSaving(false);
    }
  }, [detail, loadAll]);

  const sendDetailMessage = useCallback(async () => {
    if (!detail || !messageBody.trim()) {
      return;
    }
    setSaving(true);
    try {
      await vendorService.sendMessage(detail.id, messageBody.trim());
      setMessageBody('');
      const refreshed = await vendorService.getRequest(detail.id);
      setDetail(refreshed);
    } catch (error) {
      toastAlert('Vendors', error instanceof Error ? error.message : 'Unable to send message.');
    } finally {
      setSaving(false);
    }
  }, [detail, messageBody]);

  const filterActive = false;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={portalScreenLayout.chrome}>
        <View style={portalScreenLayout.profileRow}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable style={({ pressed }) => [styles.iconTile, pressed && styles.dim]} />
        </View>
        <View style={styles.searchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            onPress={openDrawer}
            style={({ pressed }) => [styles.iconTile, pressed && styles.dim]}
          >
            <HamburgerGlyph />
          </Pressable>
          <PortalSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search vendors or requests"
            filterActive={filterActive}
            onFilterPress={() => undefined}
          />
        </View>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>My Vendors</Text>
        <Text style={styles.subtitle}>Your private list of contractors and service partners.</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{vendorsTotal}</Text>
            <Text style={styles.statLabel}>Vendors</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{requestsTotal}</Text>
            <Text style={styles.statLabel}>Requests</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'vendors' && styles.tabActive]}
          onPress={() => setTab('vendors')}
        >
          <Text style={[styles.tabText, tab === 'vendors' && styles.tabTextActive]}>
            Vendors ({vendorsTotal})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'requests' && styles.tabActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            Requests ({requestsTotal})
          </Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        {tab === 'vendors' ? (
          <Pressable style={styles.primaryBtn} onPress={openAddVendor}>
            <Text style={styles.primaryBtnText}>+ Add Vendor</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={() => openNewRequest(null)}>
            <Text style={styles.primaryBtnText}>New request</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.primary} />
          }
        >
          {tab === 'vendors' ? (
            vendors.length === 0 ? (
              <SearchResultsEmpty
                query={searchQuery}
                message={
                  searchQuery.trim()
                    ? 'No vendors match your search.'
                    : 'Add contractors and partners you work with.'
                }
                onClear={searchQuery.trim() ? () => setSearchQuery('') : openAddVendor}
              />
            ) : (
              vendors.map((v) => (
                <View key={String(v.id)} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{vendorInitials(v)}</Text>
                    </View>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.cardName}>{v.company_name}</Text>
                      <Text style={styles.cardMeta}>{v.service_type || 'Service partner'}</Text>
                    </View>
                    <Pressable onPress={() => openEditVendor(v)} hitSlop={8}>
                      <Text style={styles.linkAction}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => setDeleteTarget(v)} hitSlop={8} style={styles.deleteLink}>
                      <Text style={styles.deleteAction}>Delete</Text>
                    </Pressable>
                  </View>
                  {v.contact_name ? <Text style={styles.rowText}>{v.contact_name}</Text> : null}
                  {v.phone ? (
                    <Pressable onPress={() => Linking.openURL(`tel:${String(v.phone).replace(/\s/g, '')}`)}>
                      <Text style={styles.linkRow}>{v.phone}</Text>
                    </Pressable>
                  ) : null}
                  {v.email ? (
                    <Pressable onPress={() => Linking.openURL(`mailto:${v.email}`)}>
                      <Text style={styles.linkRow}>{v.email}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.muted}>No email on file</Text>
                  )}
                  <Pressable
                    style={styles.cardCta}
                    onPress={() => openNewRequest(v)}
                    disabled={!v.email}
                  >
                    <Text style={[styles.cardCtaText, !v.email && styles.cardCtaDisabled]}>New Request</Text>
                  </Pressable>
                </View>
              ))
            )
          ) : requests.length === 0 ? (
            <SearchResultsEmpty
              query={searchQuery}
              message={
                searchQuery.trim()
                  ? 'No requests match your search.'
                  : 'When you send a request from a vendor card, it will appear here.'
              }
              onClear={searchQuery.trim() ? () => setSearchQuery('') : () => openNewRequest(null)}
            />
          ) : (
            requests.map((r) => {
              const tone = statusTone(r.status);
              return (
                <Pressable
                  key={String(r.id)}
                  style={styles.card}
                  onPress={() => openRequestDetail(r.id)}
                >
                  <Text style={styles.cardName}>{r.title}</Text>
                  <Text style={styles.cardMeta}>{r.vendor?.company_name || '—'}</Text>
                  <View style={styles.requestMetaRow}>
                    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.pillText, { color: tone.text }]}>{r.status}</Text>
                    </View>
                    <Text style={styles.muted}>{formatDate(r.created_at)}</Text>
                  </View>
                  <Text style={styles.linkAction}>View</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Vendor form */}
      <Modal visible={vendorModalOpen} animationType="slide" transparent onRequestClose={() => setVendorModalOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setVendorModalOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editingVendor ? 'Edit vendor' : 'Add vendor'}</Text>
            <ScrollView>
              {(
                [
                  ['company_name', 'Company name *'],
                  ['contact_name', 'Contact name'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['service_type', 'Service type'],
                  ['website_url', 'Website'],
                  ['notes', 'Notes'],
                ] as Array<[keyof VendorFormPayload, string]>
              ).map(([key, label]) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={[styles.input, key === 'notes' && styles.inputMultiline]}
                    value={String(vendorForm[key] ?? '')}
                    onChangeText={(text) => setVendorForm((prev) => ({ ...prev, [key]: text }))}
                    multiline={key === 'notes'}
                    autoCapitalize={key === 'email' || key === 'website_url' ? 'none' : 'sentences'}
                    keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'}
                  />
                </View>
              ))}
            </ScrollView>
            <Pressable style={[styles.primaryBtn, styles.sheetBtn]} onPress={saveVendor} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* New request form */}
      <Modal visible={requestModalOpen} animationType="slide" transparent onRequestClose={() => setRequestModalOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRequestModalOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New vendor request</Text>
            <ScrollView>
              <Text style={styles.fieldLabel}>Vendor *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {vendors.map((v) => (
                  <Pressable
                    key={String(v.id)}
                    style={[styles.chip, String(v.id) === requestVendorId && styles.chipActive]}
                    onPress={() => setRequestVendorId(String(v.id))}
                  >
                    <Text style={[styles.chipText, String(v.id) === requestVendorId && styles.chipTextActive]}>
                      {v.company_name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Related job (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, !requestProjectId && styles.chipActive]}
                  onPress={() => setRequestProjectId('')}
                >
                  <Text style={[styles.chipText, !requestProjectId && styles.chipTextActive]}>None</Text>
                </Pressable>
                {jobOptions.map((j) => (
                  <Pressable
                    key={j.id}
                    style={[styles.chip, String(j.id) === requestProjectId && styles.chipActive]}
                    onPress={() => setRequestProjectId(String(j.id))}
                  >
                    <Text style={[styles.chipText, String(j.id) === requestProjectId && styles.chipTextActive]}>
                      {j.title || `Job #${j.id}`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Title *</Text>
                <TextInput style={styles.input} value={requestTitle} onChangeText={setRequestTitle} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={requestDescription}
                  onChangeText={setRequestDescription}
                  multiline
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Address</Text>
                <TextInput style={styles.input} value={requestAddress} onChangeText={setRequestAddress} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Custom message</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={requestCustomMessage}
                  onChangeText={setRequestCustomMessage}
                  multiline
                />
              </View>

              {(
                [
                  ['Share address', shareAddress, setShareAddress],
                  ['Share files', shareFiles, setShareFiles],
                  ['Allow messaging', allowMessaging, setAllowMessaging],
                  ['Allow uploads', allowUploads, setAllowUploads],
                ] as Array<[string, boolean, (v: boolean) => void]>
              ).map(([label, value, setter]) => (
                <View key={label} style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{label}</Text>
                  <Switch value={value} onValueChange={setter} trackColor={{ true: colors.primary }} />
                </View>
              ))}
            </ScrollView>
            <Pressable style={[styles.primaryBtn, styles.sheetBtn]} onPress={submitRequest} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send request</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Request detail */}
      <Modal visible={detailOpen} animationType="slide" transparent onRequestClose={() => setDetailOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDetailOpen(false)} />
          <View style={styles.sheet}>
            {detailLoading || !detail ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView>
                <Text style={styles.sheetTitle}>{detail.title}</Text>
                <Text style={styles.cardMeta}>{detail.vendor?.company_name || '—'}</Text>
                <View style={[styles.pill, { backgroundColor: statusTone(detail.status).bg, alignSelf: 'flex-start', marginVertical: 8 }]}>
                  <Text style={[styles.pillText, { color: statusTone(detail.status).text }]}>{detail.status}</Text>
                </View>
                {detail.description ? <Text style={styles.rowText}>{detail.description}</Text> : null}
                {detail.address ? <Text style={styles.muted}>Address: {detail.address}</Text> : null}

                {!isClosedStatus(detail.status) ? (
                  <View style={styles.detailActions}>
                    <Pressable style={styles.secondaryBtn} onPress={resendRequest} disabled={saving}>
                      <Text style={styles.secondaryBtnText}>Resend invite</Text>
                    </Pressable>
                    <Pressable style={styles.dangerBtn} onPress={cancelRequest} disabled={saving}>
                      <Text style={styles.dangerBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : null}

                {detail.allow_messaging ? (
                  <View style={styles.messagesBlock}>
                    <Text style={styles.fieldLabel}>Messages</Text>
                    {(detail.messages ?? []).length === 0 ? (
                      <Text style={styles.muted}>No messages yet.</Text>
                    ) : (
                      (detail.messages ?? []).map((m) => (
                        <View key={String(m.id)} style={styles.messageBubble}>
                          <Text style={styles.messageBody}>{m.body}</Text>
                          <Text style={styles.messageMeta}>
                            {m.sender_type || 'owner'} · {formatDate(m.created_at)}
                          </Text>
                        </View>
                      ))
                    )}
                    {!isClosedStatus(detail.status) ? (
                      <>
                        <TextInput
                          style={[styles.input, styles.inputMultiline]}
                          value={messageBody}
                          onChangeText={setMessageBody}
                          placeholder="Write a message…"
                          placeholderTextColor={colors.textSecondary}
                          multiline
                        />
                        <Pressable style={[styles.primaryBtn, styles.sheetBtn]} onPress={sendDetailMessage} disabled={saving}>
                          {saving ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.primaryBtnText}>Send message</Text>
                          )}
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </ScrollView>
            )}
            <Pressable style={styles.closeBtn} onPress={() => setDetailOpen(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete vendor"
        message={`Remove ${deleteTarget?.company_name || 'this vendor'} from your list?`}
        confirmLabel="Delete"
        destructive
        confirming={saving}
        onConfirm={() => {
          confirmDeleteVendor().catch(() => undefined);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

const headerLift =
  Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }
    : { elevation: 2 };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...headerLift,
  },
  dim: { opacity: 0.88 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  hamburger: { justifyContent: 'center' },
  hamburgerLine: {
    width: 18,
    height: 2,
    borderRadius: 14,
    backgroundColor: '#1F2937',
    marginTop: 4,
  },
  hamburgerLineFirst: { marginTop: 0 },
  intro: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  stat: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 90,
    ...headerLift,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#E8EEF7',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, alignItems: 'flex-end' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    ...headerLift,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.avatarSoftFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: colors.primaryDark, fontSize: 13 },
  cardTitleBlock: { flex: 1, marginLeft: 10, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  linkAction: { color: colors.primary, fontWeight: '600', fontSize: 13, marginLeft: 8 },
  deleteLink: { marginLeft: 8 },
  deleteAction: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  rowText: { fontSize: 13, color: colors.textPrimary, marginTop: 4 },
  linkRow: { fontSize: 13, color: colors.primary, marginTop: 4 },
  muted: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  cardCta: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cardCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cardCtaDisabled: { opacity: 0.5 },
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    padding: 16,
    paddingBottom: 24,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  sheetBtn: { marginTop: 12 },
  chipRow: { marginBottom: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 14, color: colors.textPrimary },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '700' },
  dangerBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerBtnText: { color: colors.danger, fontWeight: '700' },
  messagesBlock: { marginTop: 16 },
  messageBubble: {
    backgroundColor: '#F3F6FB',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  messageBody: { fontSize: 14, color: colors.textPrimary },
  messageMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  closeBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  closeBtnText: { color: colors.textSecondary, fontWeight: '600' },
});
