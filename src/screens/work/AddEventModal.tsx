import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { portalService } from '../../services/api/portalService';
import { colors } from '../../theme/colors';
import type { CustomerJob } from '../../types/portal';

const EVENT_TYPES = [
  'Inspection',
  'Repair',
  'Installation',
  'Replacement',
  'Maintenance',
  'Consultation',
  'Emergency',
  'Upgrade',
  'Other',
] as const;

const EVENT_STATUSES = ['Confirmed', 'Pending', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const;

export type EventTypeOption = (typeof EVENT_TYPES)[number];
export type EventStatusOption = (typeof EVENT_STATUSES)[number];

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function jobDisplayName(job: CustomerJob): string {
  const title = job.jobs || job.job;
  if (typeof title === 'string' && title.trim()) {
    return title.trim();
  }
  if (job.id != null) {
    return `Project #${job.id}`;
  }
  return 'Project';
}

function pickJobString(job: CustomerJob, keys: string[]): string {
  for (const k of keys) {
    const v = job[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

function combineDateTime(dateYmd: string, timeHm: string): Date | null {
  const datePart = dateYmd.trim();
  const timePart = timeHm.trim();
  if (!datePart || !timePart) {
    return null;
  }
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!dm) {
    return null;
  }
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timePart);
  if (!tm) {
    return null;
  }
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if ([y, mo, d, hh, mm].some((n) => Number.isNaN(n))) {
    return null;
  }
  const dt = new Date(y, mo - 1, d, hh, mm, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

type OpenSelect = null | 'type' | 'job' | 'status';

type MenuAnchor = {
  top: number;
  left: number;
  width: number;
};

export type AddEventModalProps = {
  visible: boolean;
  calendarDate: Date;
  onClose: () => void;
  onCreated: () => void;
};

export function AddEventModal({ visible, calendarDate, onClose, onCreated }: AddEventModalProps): React.JSX.Element {
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const [eventType, setEventType] = useState<EventTypeOption>('Inspection');
  const [eventName, setEventName] = useState('');
  const [selectedJob, setSelectedJob] = useState<CustomerJob | null>(null);
  const [eventStatus, setEventStatus] = useState<EventStatusOption>('Confirmed');
  const [dateYmd, setDateYmd] = useState(() => formatLocalYmd(stripTime(new Date())));
  const [timeHm, setTimeHm] = useState('09:00');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerZip, setCustomerZip] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const typeButtonRef = useRef<View>(null);
  const jobButtonRef = useRef<View>(null);
  const statusButtonRef = useRef<View>(null);

  const closeSelects = useCallback(() => {
    setOpenSelect(null);
    setMenuAnchor(null);
  }, []);

  const applyJobAutofill = useCallback((job: CustomerJob | null) => {
    if (!job) {
      return;
    }
    setCustomerName(pickJobString(job, ['customer_name', 'customerName', 'client_name', 'name']));
    setCustomerAddress(pickJobString(job, ['customer_address', 'address', 'project_address', 'street']));
    setCustomerZip(pickJobString(job, ['customer_zip', 'zip', 'zip_code', 'postal_code']));
    setCustomerPhone(pickJobString(job, ['customer_phone', 'phone', 'phone_number']));
  }, []);

  const resetForm = useCallback(
    (seedDate: Date) => {
      setEventType('Inspection');
      setEventName('');
      setSelectedJob(null);
      setEventStatus('Confirmed');
      setDateYmd(formatLocalYmd(stripTime(seedDate)));
      setTimeHm('09:00');
      setCustomerName('');
      setCustomerAddress('');
      setCustomerZip('');
      setCustomerPhone('');
      setOpenSelect(null);
      setMenuAnchor(null);
    },
    [],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    resetForm(calendarDate);
  }, [visible, calendarDate, resetForm]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    (async () => {
      setJobsLoading(true);
      try {
        const payload = await portalService.getJobs();
        if (!cancelled) {
          setJobs(payload.jobs || []);
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
        }
      } finally {
        if (!cancelled) {
          setJobsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const onPickJob = useCallback(
    (job: CustomerJob | null) => {
      setSelectedJob(job);
      if (job) {
        applyJobAutofill(job);
      } else {
        setCustomerName('');
        setCustomerAddress('');
        setCustomerZip('');
        setCustomerPhone('');
      }
      setOpenSelect(null);
    },
    [applyJobAutofill],
  );

  const onSubmit = useCallback(async () => {
    const title = eventName.trim();
    if (!title) {
      toastAlert('Add event', 'Please enter an event name.');
      return;
    }
    if (selectedJob?.id == null) {
      toastAlert('Add event', 'Please select a job.');
      return;
    }
    const startAt = combineDateTime(dateYmd, timeHm);
    if (!startAt) {
      toastAlert('Add event', 'Use date YYYY-MM-DD and time HH:MM (24h), e.g. 09:00.');
      return;
    }

    const endAt = new Date(startAt.getTime() + 3600000);
    const body: Record<string, unknown> = {
      title,
      type: eventType,
      status: eventStatus,
      start_date_time: startAt.toISOString(),
      end_date_time: endAt.toISOString(),
      customer_name: customerName.trim() || undefined,
      customer_address: customerAddress.trim() || undefined,
      customer_zip: customerZip.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
    };
    body.project_id = selectedJob.id;
    body.priority = 'Medium';

    try {
      setSubmitting(true);
      const res = await portalService.createScheduleEvent(body);
      if (res.success) {
        onCreated();
        onClose();
      } else {
        toastAlert('Add event', res.message || 'Could not create event.');
      }
    } catch (e) {
      toastAlert('Add event', e instanceof Error ? e.message : 'Could not create event.');
    } finally {
      setSubmitting(false);
    }
  }, [
    customerAddress,
    customerName,
    customerPhone,
    customerZip,
    dateYmd,
    eventName,
    eventStatus,
    eventType,
    onClose,
    onCreated,
    selectedJob,
    timeHm,
  ]);

  const openDropdown = useCallback(
    (key: Exclude<OpenSelect, null>, anchorRef: React.RefObject<View | null>) => {
      if (openSelect === key) {
        closeSelects();
        return;
      }

      anchorRef.current?.measureInWindow((x, y, width, height) => {
        setMenuAnchor({ top: y + height + 4, left: x, width });
        setOpenSelect(key);
      });
    },
    [closeSelects, openSelect],
  );

  const renderSelectMenu = (): React.JSX.Element | null => {
    if (!openSelect) {
      return null;
    }

    if (openSelect === 'type') {
      return (
        <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {EVENT_TYPES.map((t) => (
            <Pressable
              key={t}
              style={styles.selectItem}
              onPress={() => {
                setEventType(t);
                closeSelects();
              }}
            >
              <Text style={styles.selectItemText}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      );
    }

    if (openSelect === 'job') {
      if (jobsLoading) {
        return (
          <View style={styles.menuLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        );
      }
      if (jobs.length === 0) {
        return (
          <View style={styles.menuLoading}>
            <Text style={styles.selectItemText}>No projects available</Text>
          </View>
        );
      }
      return (
        <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <Pressable style={styles.selectItem} onPress={() => onPickJob(null)}>
            <Text style={styles.selectItemText}>None</Text>
          </Pressable>
          {jobs.map((job, idx) => (
            <Pressable key={String(job.id ?? idx)} style={styles.selectItem} onPress={() => onPickJob(job)}>
              <Text style={styles.selectItemText}>{jobDisplayName(job)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {EVENT_STATUSES.map((s) => (
          <Pressable
            key={s}
            style={styles.selectItem}
            onPress={() => {
              setEventStatus(s);
              closeSelects();
            }}
          >
            <Text style={styles.selectItemText}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add event</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
            onScrollBeginDrag={closeSelects}
            nestedScrollEnabled
            removeClippedSubviews={false}
          >
            <Text style={styles.fieldLabel}>Select event type</Text>
            <View ref={typeButtonRef} collapsable={false} style={styles.selectWrap}>
              <Pressable style={styles.selectButton} onPress={() => openDropdown('type', typeButtonRef)}>
                <Text style={styles.selectText}>{eventType}</Text>
                <Text style={styles.selectChevron}>{openSelect === 'type' ? '▴' : '▾'}</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Event name *</Text>
            <TextInput
              value={eventName}
              onChangeText={setEventName}
              placeholder="Enter event name"
              placeholderTextColor="#8A93A7"
              style={styles.fieldInput}
            />

            <Text style={styles.fieldLabel}>Select job</Text>
            <View ref={jobButtonRef} collapsable={false} style={styles.selectWrap}>
              <Pressable style={styles.selectButton} onPress={() => openDropdown('job', jobButtonRef)}>
                <Text style={[styles.selectText, !selectedJob && styles.selectPlaceholder]}>
                  {selectedJob ? jobDisplayName(selectedJob) : 'Choose job'}
                </Text>
                <Text style={styles.selectChevron}>{openSelect === 'job' ? '▴' : '▾'}</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Select status *</Text>
            <View ref={statusButtonRef} collapsable={false} style={styles.selectWrap}>
              <Pressable style={styles.selectButton} onPress={() => openDropdown('status', statusButtonRef)}>
                <Text style={styles.selectText}>{eventStatus}</Text>
                <Text style={styles.selectChevron}>{openSelect === 'status' ? '▴' : '▾'}</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Select a date and time *</Text>
            <Text style={styles.fieldHint}>Date (YYYY-MM-DD) and time (24h)</Text>
            <View style={styles.dateRow}>
              <TextInput
                value={dateYmd}
                onChangeText={setDateYmd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#8A93A7"
                style={[styles.fieldInput, styles.dateField]}
                autoCapitalize="none"
              />
              <TextInput
                value={timeHm}
                onChangeText={setTimeHm}
                placeholder="09:00"
                placeholderTextColor="#8A93A7"
                style={[styles.fieldInput, styles.timeField]}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.fieldLabel}>Customer name</Text>
            <Text style={styles.fieldHint}>Select a project to auto-fill</Text>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Customer name"
              placeholderTextColor="#8A93A7"
              style={styles.fieldInput}
            />

            <Text style={styles.fieldLabel}>Customer address</Text>
            <Text style={styles.fieldHint}>Select a project to auto-fill</Text>
            <TextInput
              value={customerAddress}
              onChangeText={setCustomerAddress}
              placeholder="Street, city, state"
              placeholderTextColor="#8A93A7"
              style={styles.fieldInput}
            />

            <Text style={styles.fieldLabel}>Customer ZIP code</Text>
            <Text style={styles.fieldHint}>Select a project to auto-fill</Text>
            <TextInput
              value={customerZip}
              onChangeText={setCustomerZip}
              placeholder="ZIP"
              placeholderTextColor="#8A93A7"
              style={styles.fieldInput}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Customer phone</Text>
            <TextInput
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="Phone number"
              placeholderTextColor="#8A93A7"
              style={styles.fieldInput}
              keyboardType="phone-pad"
            />

            <Pressable
              style={({ pressed }) => [styles.submitBtn, (pressed || submitting) && styles.dim]}
              onPress={() => {
                if (!submitting) {
                  void onSubmit();
                }
              }}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Create event</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>

        {openSelect && menuAnchor ? (
          <>
            <Pressable
              style={styles.dropdownBackdrop}
              onPress={closeSelects}
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
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    maxHeight: '92%',
  },
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
  modalScrollContent: { paddingBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#4B5563', fontSize: 18, fontWeight: '700', padding: 4 },
  fieldLabel: { color: '#344054', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  fieldHint: { color: colors.textSecondary, fontSize: 11, fontWeight: '400', marginBottom: 6, marginTop: -2 },
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
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1.4 },
  timeField: { flex: 1 },
  selectWrap: {
    marginBottom: 4,
  },
  selectButton: {
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
  selectText: { color: '#24334E', fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 10 },
  selectPlaceholder: { color: '#8A93A7', fontWeight: '500' },
  selectChevron: { color: '#24334E', fontSize: 12, fontWeight: '700' },
  selectMenuScroll: { maxHeight: 220 },
  selectItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F8' },
  selectItemText: { color: '#344054', fontSize: 13, fontWeight: '500' },
  menuLoading: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitBtn: {
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dim: { opacity: 0.88 },
});
