import { env } from '../config/env';
import type {
  JobContractRecord,
  JobDetailApiResponse,
  JobFileRecord,
  JobInvoiceRecord,
  JobMaterialOrderRecord,
  JobNoteRecord,
  JobProposalRecord,
  JobScheduleRecord,
} from '../types/jobDetail';

export type ProjectStepId =
  | 'new-job'
  | 'inspection-appointment'
  | 'proposal-sent'
  | 'proposal-signed'
  | 'contract-sent'
  | 'contract-signed'
  | 'material-order'
  | 'work-order'
  | 'appointment-scheduled'
  | 'invoicing-payment'
  | 'job-completed'
  | 'lost'
  | 'unqualified';

export type ProjectPipelineFilterId = 'all' | ProjectStepId;

export type ProjectPipelineFilter = {
  id: ProjectStepId;
  label: string;
  patterns: string[];
};

export type ProjectStep = {
  id: ProjectStepId;
  order: number;
  heading: string;
  statusKey: string;
};

export type TimelineStepItem = {
  id: string;
  title: string;
  lines: string[];
  url?: string;
};

export type TimelineStepView = {
  step: ProjectStep;
  summary: string;
  items: TimelineStepItem[];
};

export const PROJECT_STEPS: ProjectStep[] = [
  { id: 'new-job', order: 1, heading: 'New Job', statusKey: 'todo' },
  { id: 'inspection-appointment', order: 2, heading: 'Inspection Appointment', statusKey: 'inspection-appointment' },
  { id: 'proposal-sent', order: 3, heading: 'Proposal Sent', statusKey: 'proposal-sent' },
  { id: 'proposal-signed', order: 4, heading: 'Proposal Signed', statusKey: 'proposal-signed' },
  { id: 'contract-sent', order: 5, heading: 'Contract Sent', statusKey: 'contract-sent' },
  { id: 'contract-signed', order: 6, heading: 'Contract Signed', statusKey: 'contract-signed' },
  { id: 'material-order', order: 7, heading: 'Material Order', statusKey: 'material-ordered' },
  { id: 'work-order', order: 8, heading: 'Work Order', statusKey: 'work-order' },
  { id: 'appointment-scheduled', order: 9, heading: 'Appointment Scheduled', statusKey: 'appointment-schedule' },
  { id: 'invoicing-payment', order: 10, heading: 'Invoicing & Payment', statusKey: 'invoicing-payment' },
  { id: 'job-completed', order: 11, heading: 'Job Completed', statusKey: 'job-completed' },
  { id: 'lost', order: 12, heading: 'Lost', statusKey: 'lost' },
  { id: 'unqualified', order: 13, heading: 'Unqualified', statusKey: 'unqualified' },
];

/** Pipeline filters shown on the projects list (matches web job stages). */
export const PROJECT_PIPELINE_FILTERS: ProjectPipelineFilter[] = [
  { id: 'inspection-appointment', label: 'Inspection Appointment', patterns: ['inspection appointment', 'inspection-appointment'] },
  { id: 'proposal-sent', label: 'Proposal sent/presented', patterns: ['proposal sent', 'proposal-sent', 'proposal presented'] },
  { id: 'proposal-signed', label: 'Proposal signed', patterns: ['proposal signed', 'proposal-signed'] },
  { id: 'contract-sent', label: 'Contract sent', patterns: ['contract sent', 'contract-sent'] },
  { id: 'contract-signed', label: 'Contract signed', patterns: ['contract signed', 'contract-signed'] },
  { id: 'material-order', label: 'Material ordered', patterns: ['material ordered', 'material-ordered', 'material order'] },
  { id: 'work-order', label: 'Work order', patterns: ['work order', 'work-order'] },
  {
    id: 'appointment-scheduled',
    label: 'Appointment schedule',
    patterns: ['appointment schedule', 'appointment-schedule', 'appointment scheduled'],
  },
  { id: 'invoicing-payment', label: 'Invoicing payment', patterns: ['invoicing payment', 'invoicing-payment', 'invoicing'] },
  { id: 'job-completed', label: 'Job completed', patterns: ['job completed', 'job-completed', 'completed'] },
  { id: 'lost', label: 'Lost', patterns: ['lost', 'cancelled', 'canceled'] },
  { id: 'unqualified', label: 'Unqualified', patterns: ['unqualified'] },
];

const DEFAULT_STEP_SUMMARY: Record<ProjectStepId, string> = {
  'new-job': 'Job has been created and is ready for processing.',
  'inspection-appointment': 'Scheduled inspection with certified roofing inspector.',
  'proposal-sent': 'Detailed proposal has been sent to the customer.',
  'proposal-signed': 'Customer has signed and approved the proposal.',
  'contract-sent': 'Contract has been sent to the customer.',
  'contract-signed': 'Contract has been signed by the customer.',
  'material-order': 'Materials have been ordered for the project.',
  'work-order': 'Work order has been created and assigned.',
  'appointment-scheduled': 'Project start date has been scheduled.',
  'invoicing-payment': 'Invoice sent and payment processing.',
  'job-completed': 'Project has been completed successfully.',
  lost: 'Job was lost to competition or customer declined.',
  unqualified: 'Job does not meet qualification criteria.',
};

function publicProposalUrl(id: string | number): string {
  return `${env.portalPublicUrl.replace(/\/+$/, '')}/p/${id}`;
}

function publicContractUrl(id: string | number): string {
  return `${env.portalPublicUrl.replace(/\/+$/, '')}/c/${id}`;
}

function asArray<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'object') {
    return Object.values(value);
  }
  return [];
}

/** Normalize Laravel collections / keyed objects into arrays. */
export function normalizeJobDetailResponse(raw: JobDetailApiResponse): JobDetailApiResponse {
  return {
    ...raw,
    proposals: asArray(raw.proposals),
    invoices: asArray(raw.invoices),
    contracts: asArray(raw.contracts),
    schedules: asArray(raw.schedules),
    measurements: asArray(raw.measurements),
    work_orders: asArray(raw.work_orders),
    material_order_docs: asArray(raw.material_order_docs),
    material_orders: asArray(raw.material_orders),
    inspection_reports: asArray(raw.inspection_reports),
    insurance_files: asArray(raw.insurance_files),
    before_pictures: asArray(raw.before_pictures),
    after_pictures: asArray(raw.after_pictures),
    file_upload: asArray(raw.file_upload),
    project_notes: asArray(raw.project_notes),
  };
}

export function mapJobStatusToTimelineKey(status?: string | null): string {
  const raw = (status ?? '').trim();
  const statusMap: Record<string, string> = {
    Completed: 'job-completed',
    'In Progress': 'inspection-appointment',
    Scheduled: 'appointment-schedule',
    'On Hold': 'todo',
    New: 'todo',
    Pending: 'todo',
    Active: 'inspection-appointment',
    Finished: 'job-completed',
    Cancelled: 'lost',
    'Inspection Appointment': 'inspection-appointment',
    'Proposal Sent': 'proposal-sent',
    'Proposal sent/presented': 'proposal-sent',
    'Proposal Signed': 'proposal-signed',
    'Proposal signed': 'proposal-signed',
    'Contract Sent': 'contract-sent',
    'Contract sent': 'contract-sent',
    'Contract Signed': 'contract-signed',
    'Contract signed': 'contract-signed',
    'Material Order': 'material-ordered',
    'Material ordered': 'material-ordered',
    'Work Order': 'work-order',
    'Appointment Scheduled': 'appointment-schedule',
    'Appointment schedule': 'appointment-schedule',
    'Invoicing & Payment': 'invoicing-payment',
    'Invoicing payment': 'invoicing-payment',
    'Job Completed': 'job-completed',
    'Job completed': 'job-completed',
    Lost: 'lost',
    Unqualified: 'unqualified',
  };

  if (statusMap[raw]) {
    return statusMap[raw];
  }

  return raw.toLowerCase() || 'todo';
}

export function jobStatusRaw(job: { status?: string; [key: string]: unknown }): string {
  for (const key of ['status', 'pipeline_status', 'job_status', 'stage', 'job_stage'] as const) {
    const value = job[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export function jobMatchesPipelineFilter(
  job: { status?: string; [key: string]: unknown },
  filter: ProjectPipelineFilter,
): boolean {
  const raw = jobStatusRaw(job);
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  const timelineKey = mapJobStatusToTimelineKey(raw);
  const step = PROJECT_STEPS.find((s) => s.id === filter.id);

  if (timelineKey === filter.id || timelineKey === step?.statusKey) {
    return true;
  }

  return filter.patterns.some((pattern) => {
    const p = pattern.trim().toLowerCase();
    return normalized === p || normalized.includes(p) || p.includes(normalized);
  });
}

export function isCurrentTimelineStep(step: ProjectStep, jobStatus?: string | null): boolean {
  const raw = (jobStatus ?? '').trim();
  if (raw === 'Pending') {
    return step.statusKey === 'todo';
  }

  const timelineKey = mapJobStatusToTimelineKey(raw);
  return timelineKey === step.statusKey || raw === step.statusKey || raw === step.id;
}

function fileItem(file: JobFileRecord, fallbackLabel: string): TimelineStepItem {
  const lines: string[] = [];
  if (file.file_type) {
    lines.push(file.file_type);
  }
  if (file.created_at) {
    lines.push(String(file.created_at));
  }

  return {
    id: `file-${file.id}`,
    title: file.original_name?.trim() || fallbackLabel,
    lines,
    url: file.url,
  };
}

function proposalItem(proposal: JobProposalRecord): TimelineStepItem {
  const lines: string[] = [];
  if (proposal.status) {
    lines.push(`Status: ${proposal.status}`);
  }
  if (proposal.signature_status) {
    lines.push(`Signature: ${proposal.signature_status}`);
  }
  if (proposal.updated_at) {
    lines.push(proposal.updated_at);
  }
  if (proposal.project_name) {
    lines.push(proposal.project_name);
  }

  return {
    id: `proposal-${proposal.id}`,
    title: `Proposal #${proposal.id}`,
    lines,
    url: publicProposalUrl(proposal.id),
  };
}

function invoiceItem(invoice: JobInvoiceRecord): TimelineStepItem {
  const lines: string[] = [];
  if (invoice.status) {
    lines.push(`Status: ${invoice.status}`);
  }
  if (invoice.amount != null && invoice.amount !== '') {
    lines.push(`Amount: $${invoice.amount}`);
  }
  if (invoice.due_date) {
    lines.push(`Due: ${invoice.due_date}`);
  }
  if (invoice.claim_reference) {
    lines.push(`Claim: ${invoice.claim_reference}`);
  }
  if (invoice.updated_at) {
    lines.push(invoice.updated_at);
  }

  return {
    id: `invoice-${invoice.id}`,
    title: `Invoice #${invoice.id}`,
    lines,
  };
}

function scheduleItem(schedule: JobScheduleRecord): TimelineStepItem {
  const lines: string[] = [];
  if (schedule.type) {
    lines.push(`Type: ${schedule.type}`);
  }
  if (schedule.status) {
    lines.push(`Status: ${schedule.status}`);
  }
  if (schedule.date_words) {
    lines.push(schedule.date_words);
  } else if (schedule.start_date_time) {
    lines.push(String(schedule.start_date_time));
  }
  if (schedule.description?.trim()) {
    lines.push(schedule.description.trim());
  }

  return {
    id: `schedule-${schedule.id}`,
    title: schedule.title?.trim() || `Appointment #${schedule.id}`,
    lines,
  };
}

function materialOrderItem(order: JobMaterialOrderRecord): TimelineStepItem {
  const lines: string[] = [];
  if (order.Ref) {
    lines.push(`Ref: ${order.Ref}`);
  }
  if (order.statut) {
    lines.push(`Status: ${order.statut}`);
  }
  if (order.GrandTotal != null && order.GrandTotal !== '') {
    lines.push(`Total: $${order.GrandTotal}`);
  }
  if (order.created_at) {
    lines.push(order.created_at);
  }

  return {
    id: `material-${order.id}`,
    title: order.Ref ? `Material order ${order.Ref}` : `Material order #${order.id}`,
    lines,
  };
}

function contractItem(contract: JobContractRecord): TimelineStepItem {
  const lines: string[] = [];
  if (contract.status) {
    lines.push(`Status: ${contract.status}`);
  }
  if (contract.updated_at) {
    lines.push(contract.updated_at);
  }

  return {
    id: `contract-${contract.id}`,
    title: contract.name || `Contract #${contract.id}`,
    lines,
    url: publicContractUrl(contract.id),
  };
}

function noteItem(note: JobNoteRecord): TimelineStepItem {
  const lines: string[] = [];
  if (note.created_at) {
    lines.push(String(note.created_at));
  }

  return {
    id: `note-${note.id}`,
    title: note.note?.trim() || 'Project note',
    lines,
  };
}

function splitProposals(proposals: JobProposalRecord[]): {
  sent: JobProposalRecord[];
  signed: JobProposalRecord[];
} {
  const sent: JobProposalRecord[] = [];
  const signed: JobProposalRecord[] = [];

  proposals.forEach((p) => {
    const sig = (p.signature_status ?? '').toUpperCase();
    const st = (p.status ?? '').toUpperCase();
    if (sig.includes('SIGNED') || st.includes('SIGNED')) {
      signed.push(p);
    } else {
      sent.push(p);
    }
  });

  return { sent, signed };
}

function summarizeItems(items: TimelineStepItem[], emptyFallback: string): string {
  if (items.length === 0) {
    return emptyFallback;
  }
  if (items.length === 1) {
    return items[0].title;
  }
  return `${items.length} items — ${items[0].title}${items.length > 1 ? ', …' : ''}`;
}

function buildItemsForStep(stepId: ProjectStepId, detail: JobDetailApiResponse): TimelineStepItem[] {
  const proposals = asArray(detail.proposals);
  const { sent, signed } = splitProposals(proposals);

  switch (stepId) {
    case 'new-job':
      return [
        ...asArray(detail.project_notes).map(noteItem),
        ...asArray(detail.insurance_files).map((f) => fileItem(f, 'Insurance file')),
        ...asArray(detail.file_upload).map((f) => fileItem(f, 'Uploaded file')),
      ];
    case 'inspection-appointment':
      return [
        ...asArray(detail.inspection_reports).map((f) => fileItem(f, 'Inspection report')),
        ...asArray(detail.measurements).map((f) => fileItem(f, 'Measurement')),
      ];
    case 'proposal-sent':
      return sent.map(proposalItem);
    case 'proposal-signed':
      return signed.map(proposalItem);
    case 'contract-sent':
    case 'contract-signed':
      return asArray(detail.contracts).map(contractItem);
    case 'material-order':
      return [
        ...asArray(detail.material_orders).map(materialOrderItem),
        ...asArray(detail.material_order_docs).map((f) => fileItem(f, 'Material order document')),
      ];
    case 'work-order':
      return asArray(detail.work_orders).map((f) => fileItem(f, 'Work order'));
    case 'appointment-scheduled':
      return asArray(detail.schedules).map(scheduleItem);
    case 'invoicing-payment':
      return asArray(detail.invoices).map(invoiceItem);
    case 'job-completed':
      return [
        ...asArray(detail.before_pictures).map((f) => fileItem(f, 'Before picture')),
        ...asArray(detail.after_pictures).map((f) => fileItem(f, 'After picture')),
        ...asArray(detail.contracts).map(contractItem),
      ];
    case 'lost':
    case 'unqualified':
      return [];
    default:
      return [];
  }
}

export function buildTimelineStepViews(detail: JobDetailApiResponse): TimelineStepView[] {
  const normalized = normalizeJobDetailResponse(detail);

  return PROJECT_STEPS.map((step) => {
    const items = buildItemsForStep(step.id, normalized);
    const summary = summarizeItems(items, DEFAULT_STEP_SUMMARY[step.id]);

    return { step, summary, items };
  });
}

export function getTimelineStepView(
  views: TimelineStepView[],
  stepId: ProjectStepId,
): TimelineStepView | undefined {
  return views.find((v) => v.step.id === stepId);
}
