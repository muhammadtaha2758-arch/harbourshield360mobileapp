import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppDrawerParamList, AppTabParamList } from '../../navigation/types';
import { portalService } from '../../services/api/portalService';
import type { CustomerJob, FinancingApplication, FinancingPlan } from '../../types/portal';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { FINANCING_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';

type FinancingScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'FinancingTab'>,
  DrawerNavigationProp<AppDrawerParamList>
>;

type DisplayStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';

/** Same options as financing.vue */
const PROJECT_TYPES = [
  { value: 'roofing', label: 'Roofing' },
  { value: 'siding', label: 'Siding' },
  { value: 'windows', label: 'Windows' },
  { value: 'gutters', label: 'Gutters' },
  { value: 'other', label: 'Other' },
] as const;

type OpenSelect = null | 'plan' | 'project' | 'address';

type MenuAnchor = {
  top: number;
  left: number;
  width: number;
};

function normalizeStatus(raw: string | undefined): DisplayStatus {
  const value = String(raw ?? 'pending').toLowerCase();
  if (value === 'approved') {
    return 'Approved';
  }
  if (value === 'rejected') {
    return 'Rejected';
  }
  if (value === 'pending') {
    return 'Submitted';
  }
  return 'Under Review';
}

function formatCurrency(amount: number | string | undefined): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '').replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) {
    return '$0.00';
  }
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) {
    return null;
  }
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function getPlanDisplay(app: FinancingApplication, plans: FinancingPlan[]): string {
  const direct =
    app.plan_display ||
    app.plan_name ||
    (app.plan && typeof app.plan === 'object' && 'name' in app.plan ? String(app.plan.name) : '');
  if (direct) {
    return direct;
  }
  const planId = Number(app.plan_id);
  if (!Number.isNaN(planId)) {
    const matched = plans.find((p) => Number(p.id) === planId);
    if (matched?.name) {
      return matched.name;
    }
  }
  return 'N/A';
}

function formatApplicationDate(raw: string | undefined): string {
  if (!raw) {
    return '—';
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return raw;
}

function projectTypeLabel(value: string | undefined): string {
  const match = PROJECT_TYPES.find((t) => t.value === value);
  return match?.label ?? value ?? 'N/A';
}

function jobAddress(job: CustomerJob): string {
  const addr = job.customer_address ?? job.address;
  if (typeof addr === 'string' && addr.trim()) {
    return addr.trim();
  }
  if (job.id != null) {
    return `Project #${job.id}`;
  }
  return 'Unknown address';
}

export function FinancingScreen(): React.JSX.Element {
  const navigation = useNavigation<FinancingScreenNavigation>();

  const [applications, setApplications] = useState<FinancingApplication[]>([]);
  const [plans, setPlans] = useState<FinancingPlan[]>([]);
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailApplication, setDetailApplication] = useState<FinancingApplication | null>(null);

  const [requestedAmount, setRequestedAmount] = useState('');
  const [planId, setPlanId] = useState<string>('');
  const [projectType, setProjectType] = useState<(typeof PROJECT_TYPES)[number]['value']>('roofing');
  const [projectId, setProjectId] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const planButtonRef = useRef<View>(null);
  const projectButtonRef = useRef<View>(null);
  const addressButtonRef = useRef<View>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((p) => String(p.id) === planId) ?? null,
    [planId, plans],
  );

  const selectedJob = useMemo(
    () => jobs.find((j) => String(j.id) === projectId) ?? null,
    [jobs, projectId],
  );

  const load = useCallback(async (isRefresh: boolean) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [apps, planList, jobsPayload] = await Promise.all([
        portalService.getFinancingApplications(),
        portalService.getFinancingPlans(),
        portalService.getJobs(),
      ]);

      setApplications(apps);
      setPlans(planList);
      setJobs(jobsPayload.jobs ?? []);

      setPlanId((prev) => (prev ? prev : planList.length > 0 ? String(planList[0].id) : ''));
      const jobList = jobsPayload.jobs ?? [];
      setProjectId((prev) => (prev ? prev : jobList.length > 0 ? String(jobList[0].id ?? '') : ''));
    } catch (error) {
      toastAlert('Financing', error instanceof Error ? error.message : 'Failed to load financing data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false).catch(() => setLoading(false));
  }, [load]);

  const filteredApplications = useMemo(() => {
    let list = applications;
    if (statusFilter === 'approved') {
      list = list.filter(
        (item) => normalizeStatus(typeof item.status === 'string' ? item.status : undefined) === 'Approved',
      );
    } else if (statusFilter === 'pending') {
      list = list.filter((item) => {
        const status = normalizeStatus(typeof item.status === 'string' ? item.status : undefined);
        return status === 'Submitted' || status === 'Under Review';
      });
    } else if (statusFilter === 'declined') {
      list = list.filter(
        (item) => normalizeStatus(typeof item.status === 'string' ? item.status : undefined) === 'Rejected',
      );
    }

    return applyListFilters(list, {
      searchQuery,
      searchFields: (item) => [
        String(item.id ?? ''),
        getPlanDisplay(item, plans),
        projectTypeLabel(item.project_type),
        formatCurrency(item.requested_amount),
        typeof item.status === 'string' ? item.status : '',
      ],
      sort: sortBy,
      getName: (item) => getPlanDisplay(item, plans),
      getDate: (item) => formatApplicationDate(item.created_at),
    });
  }, [applications, plans, searchQuery, sortBy, statusFilter]);

  const filterActive = statusFilter != null || sortBy !== DEFAULT_SORT;

  const activeCount = useMemo(
    () =>
      String(
        applications.filter((item) => normalizeStatus(typeof item.status === 'string' ? item.status : undefined) !== 'Approved')
          .length,
      ).padStart(2, '0'),
    [applications],
  );

  const closeDropdowns = useCallback(() => {
    setOpenSelect(null);
    setMenuAnchor(null);
  }, []);

  const closeFinancingModal = useCallback(() => {
    setModalOpen(false);
    closeDropdowns();
  }, [closeDropdowns]);

  const openDropdown = useCallback(
    (key: Exclude<OpenSelect, null>, anchorRef: React.RefObject<View | null>) => {
      if (openSelect === key) {
        closeDropdowns();
        return;
      }

      anchorRef.current?.measureInWindow((x, y, width, height) => {
        setMenuAnchor({ top: y + height + 4, left: x, width });
        setOpenSelect(key);
      });
    },
    [closeDropdowns, openSelect],
  );

  const resetForm = useCallback((): void => {
    setRequestedAmount('');
    setAdditionalNotes('');
    setProjectType('roofing');
    if (plans.length > 0) {
      setPlanId(String(plans[0].id));
    }
    if (jobs.length > 0) {
      setProjectId(String(jobs[0].id ?? ''));
    }
    closeDropdowns();
  }, [closeDropdowns, jobs, plans]);

  const renderSelectMenu = (): React.JSX.Element | null => {
    if (!openSelect) {
      return null;
    }

    if (openSelect === 'plan') {
      return (
        <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {plans.map((plan) => (
            <Pressable
              key={String(plan.id)}
              style={styles.selectItem}
              onPress={() => {
                setPlanId(String(plan.id));
                closeDropdowns();
              }}
            >
              <Text style={styles.selectItemText}>
                {plan.name}
                {plan.interest_rate != null ? ` (${plan.interest_rate}% APR)` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      );
    }

    if (openSelect === 'project') {
      return (
        <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {PROJECT_TYPES.map((type) => (
            <Pressable
              key={type.value}
              style={styles.selectItem}
              onPress={() => {
                setProjectType(type.value);
                closeDropdowns();
              }}
            >
              <Text style={styles.selectItemText}>{type.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      );
    }

    if (jobs.length === 0) {
      return (
        <View style={styles.selectItem}>
          <Text style={styles.selectItemText}>No projects found</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {jobs.map((job) => (
          <Pressable
            key={String(job.id)}
            style={styles.selectItem}
            onPress={() => {
              setProjectId(String(job.id ?? ''));
              closeDropdowns();
            }}
          >
            <Text style={styles.selectItemText}>{jobAddress(job)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  const openCreateModal = useCallback(() => {
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const onSubmitRequest = useCallback(async () => {
    const amount = parseAmountInput(requestedAmount);
    if (amount == null || amount < 1) {
      toastAlert('Financing', 'Please enter a valid requested amount.');
      return;
    }
    if (!planId) {
      toastAlert('Financing', 'Please select a financing plan.');
      return;
    }
    if (!projectType) {
      toastAlert('Financing', 'Please select a project type.');
      return;
    }
    if (!projectId) {
      toastAlert('Financing', 'Please select a project address.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await portalService.createFinancingApplication({
        amount,
        plan_id: planId,
        project_type: projectType,
        project_id: projectId,
        notes: additionalNotes.trim() || undefined,
      });

      if (res.success) {
        closeFinancingModal();
        await load(true);
        toastAlert(
          'Financing',
          'Financing request submitted successfully. We will review your application and get back to you within 2–3 business days.',
        );
      } else {
        toastAlert('Financing', res.message || 'Could not submit financing request.');
      }
    } catch (e) {
      toastAlert('Financing', e instanceof Error ? e.message : 'Could not submit financing request.');
    } finally {
      setSubmitting(false);
    }
  }, [additionalNotes, closeFinancingModal, load, planId, projectId, projectType, requestedAmount]);

  if (loading && applications.length === 0) {
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
            placeholder="Search financing by plan, amount, or status"
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
          <Text style={styles.heroTitle}>Financing</Text>
          <Text style={styles.heroSub}>Apply for project financing and track all financing request statuses.</Text>
          <View style={styles.heroActionsRow}>
            <View style={[styles.heroChip, styles.heroChipMuted]}>
              <Text style={styles.heroChipText} numberOfLines={1} ellipsizeMode="tail">
                {activeCount} Active Requests
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.heroChip, styles.heroChipOutline, pressed && styles.dim]}
              onPress={openCreateModal}
              accessibilityRole="button"
              accessibilityLabel="Request financing"
            >
              <View style={styles.heroChipInner}>
                <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden style={styles.heroChipIcon}>
                  <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                </Svg>
                <Text style={styles.heroChipText} numberOfLines={1} ellipsizeMode="tail">
                  Request financing
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Financing Requests</Text>
          {applications.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No financing requests yet</Text>
              <Text style={styles.empty}>Tap “Request financing” to submit your first application.</Text>
            </View>
          ) : filteredApplications.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No matching requests</Text>
              <Text style={styles.empty}>Try a different search or filter.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {filteredApplications.map((item) => {
                const status = normalizeStatus(typeof item.status === 'string' ? item.status : undefined);
                return (
                  <Pressable
                    key={String(item.id)}
                    style={({ pressed }) => [styles.requestCard, pressed && styles.dim]}
                    onPress={() => setDetailApplication(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`View financing request ${item.id}`}
                  >
                    <View style={styles.requestTop}>
                      <Text style={styles.requestId}>#{item.id}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          status === 'Approved'
                            ? styles.statusApproved
                            : status === 'Under Review'
                              ? styles.statusReview
                              : status === 'Rejected'
                                ? styles.statusRejected
                                : styles.statusSubmitted,
                        ]}
                      >
                        <Text style={styles.statusText}>{status}</Text>
                      </View>
                    </View>

                    <Text style={styles.requestAmount}>{formatCurrency(item.requested_amount)}</Text>
                    <Text style={styles.requestMeta}>
                      {getPlanDisplay(item, plans)} · {projectTypeLabel(item.project_type)}
                    </Text>
                    <Text style={styles.requestMeta} numberOfLines={2}>
                      {typeof item.project_address === 'string' ? item.project_address : 'N/A'}
                    </Text>
                    {item.notes ? <Text style={styles.requestNotes} numberOfLines={2}>{String(item.notes)}</Text> : null}
                    <Text style={styles.requestDate}>Requested: {formatApplicationDate(item.application_date)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={detailApplication != null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailApplication(null)}
      >
        <View style={styles.detailModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDetailApplication(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View style={styles.detailModalSheet}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle}>Financing Request #{detailApplication?.id ?? ''}</Text>
              <Pressable onPress={() => setDetailApplication(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.detailModalClose}>✕</Text>
              </Pressable>
            </View>
            {detailApplication ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailModalBody}>
                <Text style={styles.detailSectionHeading}>Request information</Text>
                <Text style={styles.detailLabel}>Amount</Text>
                <Text style={styles.detailValue}>{formatCurrency(detailApplication.requested_amount)}</Text>
                <Text style={styles.detailLabel}>Plan</Text>
                <Text style={styles.detailValue}>{getPlanDisplay(detailApplication, plans)}</Text>
                <Text style={styles.detailLabel}>Project type</Text>
                <Text style={styles.detailValue}>{projectTypeLabel(detailApplication.project_type)}</Text>
                <Text style={styles.detailLabel}>Project address</Text>
                <Text style={styles.detailValue}>
                  {typeof detailApplication.project_address === 'string' ? detailApplication.project_address : 'N/A'}
                </Text>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>
                  {normalizeStatus(typeof detailApplication.status === 'string' ? detailApplication.status : undefined)}
                </Text>
                <Text style={styles.detailLabel}>Requested date</Text>
                <Text style={styles.detailValue}>{formatApplicationDate(detailApplication.application_date)}</Text>

                {detailApplication.approved_amount != null ? (
                  <>
                    <Text style={[styles.detailSectionHeading, styles.detailSectionSpacing]}>Approval details</Text>
                    <Text style={styles.detailLabel}>Approved amount</Text>
                    <Text style={styles.detailValue}>{formatCurrency(detailApplication.approved_amount)}</Text>
                  </>
                ) : null}
                {detailApplication.monthly_payment != null ? (
                  <>
                    <Text style={styles.detailLabel}>Monthly payment</Text>
                    <Text style={styles.detailValue}>{formatCurrency(detailApplication.monthly_payment)}</Text>
                  </>
                ) : null}
                {detailApplication.approval_date ? (
                  <>
                    <Text style={styles.detailLabel}>Approval date</Text>
                    <Text style={styles.detailValue}>{formatApplicationDate(detailApplication.approval_date)}</Text>
                  </>
                ) : null}
                {detailApplication.start_date ? (
                  <>
                    <Text style={styles.detailLabel}>Start date</Text>
                    <Text style={styles.detailValue}>{formatApplicationDate(detailApplication.start_date)}</Text>
                  </>
                ) : null}
                {detailApplication.end_date ? (
                  <>
                    <Text style={styles.detailLabel}>End date</Text>
                    <Text style={styles.detailValue}>{formatApplicationDate(detailApplication.end_date)}</Text>
                  </>
                ) : null}

                {detailApplication.notes ? (
                  <>
                    <Text style={[styles.detailSectionHeading, styles.detailSectionSpacing]}>Additional notes</Text>
                    <Text style={styles.detailNotes}>{String(detailApplication.notes)}</Text>
                  </>
                ) : null}
              </ScrollView>
            ) : null}
            <Pressable style={({ pressed }) => [styles.detailCloseBtn, pressed && styles.dim]} onPress={() => setDetailApplication(null)}>
              <Text style={styles.detailCloseBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeFinancingModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Financing</Text>
              <Pressable onPress={closeFinancingModal} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
              onScrollBeginDrag={closeDropdowns}
              nestedScrollEnabled
              removeClippedSubviews={false}
            >
              <Text style={styles.fieldLabel}>Requested Amount *</Text>
              <TextInput
                value={requestedAmount}
                onChangeText={setRequestedAmount}
                placeholder="0.00"
                placeholderTextColor="#8A93A7"
                keyboardType="decimal-pad"
                style={styles.fieldInput}
              />

              <Text style={styles.fieldLabel}>Financing Plan *</Text>
              <View ref={planButtonRef} collapsable={false} style={styles.selectWrap}>
                <Pressable style={styles.selectButton} onPress={() => openDropdown('plan', planButtonRef)}>
                  <Text style={styles.selectText} numberOfLines={1}>
                    {selectedPlan
                      ? `${selectedPlan.name}${selectedPlan.interest_rate != null ? ` (${selectedPlan.interest_rate}% APR)` : ''}`
                      : 'Select financing plan'}
                  </Text>
                  <Text style={styles.selectChevron}>{openSelect === 'plan' ? '▴' : '▾'}</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Project Type *</Text>
              <View ref={projectButtonRef} collapsable={false} style={styles.selectWrap}>
                <Pressable style={styles.selectButton} onPress={() => openDropdown('project', projectButtonRef)}>
                  <Text style={styles.selectText}>{projectTypeLabel(projectType)}</Text>
                  <Text style={styles.selectChevron}>{openSelect === 'project' ? '▴' : '▾'}</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Project Address *</Text>
              <View ref={addressButtonRef} collapsable={false} style={styles.selectWrap}>
                <Pressable style={styles.selectButton} onPress={() => openDropdown('address', addressButtonRef)}>
                  <Text style={styles.selectText} numberOfLines={2}>
                    {selectedJob ? jobAddress(selectedJob) : jobs.length === 0 ? 'No projects available' : 'Select project'}
                  </Text>
                  <Text style={styles.selectChevron}>{openSelect === 'address' ? '▴' : '▾'}</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Additional Notes</Text>
              <TextInput
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                placeholder="Describe your project or any additional information..."
                placeholderTextColor="#8A93A7"
                multiline
                maxLength={500}
                style={styles.notesInput}
              />

              <Pressable
                style={({ pressed }) => [styles.submitBtn, (pressed || submitting) && styles.dim]}
                onPress={onSubmitRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>

          {openSelect && menuAnchor ? (
            <>
              <Pressable
                style={styles.dropdownBackdrop}
                onPress={closeDropdowns}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              />
              <View
                style={[
                  styles.selectMenuOverlay,
                  { top: menuAnchor.top, left: menuAnchor.left, width: menuAnchor.width },
                ]}
              >
                {renderSelectMenu()}
              </View>
            </>
          ) : null}
        </View>
      </Modal>
      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusOptions={FINANCING_STATUS_OPTIONS}
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
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  menuGlyph: { width: 18, gap: 4 },
  menuLine: { width: 18, height: 2, borderRadius: 2, backgroundColor: colors.textPrimary },
  searchShell: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingLeft: 12, paddingRight: 6, marginLeft: 10, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, paddingVertical: 10, paddingHorizontal: 8 },
  innerFilterBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.innerFilterBg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  heroCard: { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6, marginRight: 80 },
  heroActionsRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', gap: 10 },
  heroChip: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, justifyContent: 'center', alignItems: 'center', minWidth: 0, flexShrink: 1 },
  heroChipMuted: { backgroundColor: '#2D74E8', flexShrink: 0, flexGrow: 0 },
  heroChipOutline: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', flexGrow: 1, flexShrink: 1, minWidth: 0 },
  heroChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 18, flexShrink: 1, minWidth: 0 },
  heroChipInner: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  heroChipIcon: { flexShrink: 0 },
  listSection: { marginTop: 14 },
  listTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyWrap: { borderRadius: 16, backgroundColor: '#FFFFFF', paddingVertical: 26, paddingHorizontal: 16, alignItems: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '500', marginBottom: 6 },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  listWrap: { gap: 10 },
  requestCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E3EAF6', paddingHorizontal: 14, paddingVertical: 12 },
  requestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requestId: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusSubmitted: { backgroundColor: '#FFF2DA' },
  statusReview: { backgroundColor: '#E8F2FF' },
  statusApproved: { backgroundColor: '#E8F8EF' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusText: { color: '#394150', fontSize: 11, fontWeight: '700' },
  requestAmount: { marginTop: 8, color: '#18263F', fontSize: 18, fontWeight: '700' },
  requestMeta: { marginTop: 6, color: '#4F5B73', fontSize: 13 },
  requestNotes: { marginTop: 6, color: '#4F5B73', fontSize: 12, lineHeight: 17 },
  requestDate: { marginTop: 8, color: '#6A7489', fontSize: 12 },
  detailModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  detailModalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, maxHeight: '88%' },
  detailModalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  detailModalTitle: { flex: 1, color: '#1D2D44', fontSize: 18, fontWeight: '700' },
  detailModalClose: { color: '#4B5563', fontSize: 18, fontWeight: '700', padding: 4 },
  detailModalBody: { paddingBottom: 12 },
  detailSectionHeading: { color: colors.primary, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  detailSectionSpacing: { marginTop: 12 },
  detailLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
  detailValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '500', marginBottom: 2 },
  detailNotes: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  detailCloseBtn: { marginTop: 4, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  detailCloseBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingVertical: 14, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#4B5563', fontSize: 18, fontWeight: '700', padding: 4 },
  modalScrollContent: { paddingBottom: 8 },
  fieldLabel: { color: '#344054', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  fieldInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EE', backgroundColor: '#F9FBFF', color: '#24334E', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
  },
  selectMenuOverlay: {
    position: 'absolute',
    zIndex: 50,
    maxHeight: 220,
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
  selectMenuScroll: { maxHeight: 220 },
  selectWrap: { marginBottom: 4 },
  selectButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EE', backgroundColor: '#F9FBFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: '#24334E', fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 10 },
  selectChevron: { color: '#24334E', fontSize: 12, fontWeight: '700' },
  selectItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F8' },
  selectItemText: { color: '#344054', fontSize: 13, fontWeight: '500' },
  notesInput: { minHeight: 90, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EE', backgroundColor: '#F9FBFF', color: '#24334E', fontSize: 13, textAlignVertical: 'top', paddingHorizontal: 12, paddingVertical: 10 },
  submitBtn: { marginTop: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dim: { opacity: 0.88 },
});
