import type { FilterOption, SortFilterOption } from '../types/listFilters';

export const STANDARD_SORT_OPTIONS: SortFilterOption[] = [
  { label: 'Date (newest)', value: 'date_newest' },
  { label: 'Date (oldest)', value: 'date_oldest' },
  { label: 'Name (A–Z)', value: 'name_asc' },
  { label: 'Name (Z–A)', value: 'name_desc' },
];

export const PROJECT_STATUS_OPTIONS: FilterOption[] = [
  { label: 'Completed', value: 'Completed' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'On Hold', value: 'On Hold' },
  { label: 'Pending Approval', value: 'Pending Approval' },
];

export const SERVICE_REQUEST_STATUS_OPTIONS: FilterOption[] = [
  { label: 'Pending', value: 'Pending' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Completed', value: 'Completed' },
];

export const SERVICE_REQUEST_TYPE_OPTIONS: FilterOption[] = [
  { label: 'Repair', value: 'Repair' },
  { label: 'Inspection', value: 'Inspection' },
  { label: 'Emergency', value: 'Emergency' },
];

export const AGREEMENT_STATUS_OPTIONS: FilterOption[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Signed', value: 'signed' },
];

export const INVOICE_STATUS_OPTIONS: FilterOption[] = [
  { label: 'Open', value: 'open' },
  { label: 'Paid', value: 'paid' },
];

export const DOCUMENT_TYPE_OPTIONS: FilterOption[] = [
  { label: 'PDF', value: 'pdf' },
  { label: 'Images', value: 'image' },
  { label: 'Word', value: 'word' },
  { label: 'Large files', value: 'large' },
];

export const MESSAGE_STATUS_OPTIONS: FilterOption[] = [
  { label: 'Unread only', value: 'unread' },
];

export const SCHEDULE_STATUS_OPTIONS: FilterOption[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past', value: 'past' },
];

export const PHOTO_MEDIA_OPTIONS: FilterOption[] = [
  { label: 'Before photos', value: 'before' },
  { label: 'After photos', value: 'after' },
];

export const PROJECT_TIMELINE_OPTIONS: FilterOption[] = [
  { label: 'Documents only', value: 'documents' },
];

export const PROFILE_SECTION_OPTIONS: FilterOption[] = [
  { label: 'Personal information', value: 'personal' },
  { label: 'Property details', value: 'property' },
  { label: 'Vehicle details', value: 'vehicle' },
];

export const FAQ_CATEGORY_OPTIONS: FilterOption[] = [
  { label: 'General', value: 'General' },
  { label: 'Billing', value: 'Billing' },
  { label: 'Technical', value: 'Technical' },
  { label: 'Account', value: 'Account' },
  { label: 'Documents', value: 'Documents' },
];

export const BILL_STATUS_OPTIONS: FilterOption[] = [
  { label: 'Paid', value: 'Paid' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Overdue', value: 'Overdue' },
];

export const DASHBOARD_HAIL_OPTIONS: FilterOption[] = [
  { label: 'Hail events only', value: 'hail' },
];

export const FINANCING_STATUS_OPTIONS: FilterOption[] = [
  { label: 'Approved', value: 'approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Declined', value: 'declined' },
];
