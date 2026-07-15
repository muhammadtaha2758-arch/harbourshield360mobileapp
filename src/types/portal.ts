export interface CustomerJob {
  id?: number | string;
  jobs?: string;
  job?: string;
  description?: string;
  status?: string;
  customer_name?: string;
  customer_address?: string;
  customer_id?: number | string;
  /** Satellite map URL from API (Google Static Maps, per job address). */
  map_image_url?: string | null;
  updated_at?: string;
  [key: string]: unknown;
}

export interface JobsApiPayload {
  jobs: CustomerJob[];
  suggestions: unknown[];
  google_maps_api_key?: string;
}

export interface CustomerDocument {
  id: number | string;
  original_name?: string;
  file_type?: string;
  file_size?: number | string;
  created_at?: string;
  [key: string]: unknown;
}

export interface CustomerAgreement {
  id: number | string;
  title?: string;
  status?: string;
  signature_status?: string;
  created_at?: string;
  content?: string;
  body?: string;
  cover_photo?: string;
  signature_date?: string;
  signature_name?: string;
  [key: string]: unknown;
}

export interface ScheduleApiPayload {
  success: boolean;
  message?: string;
  events?: ScheduleEvent[];
  projects?: unknown[];
}

export interface ServiceRequestAttachment {
  id?: number | string | null;
  name?: string;
  url?: string;
  type?: string;
  size?: number | string;
}

export interface ServiceRequestJob {
  id?: number | string;
  request_type?: string;
  description?: string;
  status?: string;
  startDate?: string;
  lastUpdated?: string;
  attachment?: ServiceRequestAttachment | null;
  attachments?: ServiceRequestAttachment[];
  [key: string]: unknown;
}

export interface FinancingPlan {
  id: number | string;
  name: string;
  term_months?: number;
  interest_rate?: number | string;
  description?: string;
  features?: string[];
  [key: string]: unknown;
}

export interface FinancingApplication {
  id?: number | string;
  requested_amount?: number | string;
  approved_amount?: number | string;
  monthly_payment?: number | string;
  plan_id?: number | string;
  plan?: FinancingPlan | null;
  plan_display?: string;
  plan_name?: string;
  project_type?: string;
  project_id?: number | string;
  project_address?: string;
  notes?: string;
  status?: string;
  application_date?: string;
  approval_date?: string;
  start_date?: string;
  end_date?: string;
  term_months?: number;
  [key: string]: unknown;
}

export interface FinancingApplicationsPayload {
  success?: boolean;
  message?: string;
  data?: FinancingApplication[];
}

export interface FinancingPlansPayload {
  success?: boolean;
  message?: string;
  data?: FinancingPlan[];
}

export interface ServiceRequestsListPayload {
  success?: boolean;
  message?: string;
  jobs?: ServiceRequestJob[];
  totalRows?: number;
}

export interface ScheduleEvent {
  id?: number | string;
  title?: string;
  type?: string;
  start_date_time?: string;
  end_date_time?: string;
  startDateTime?: string;
  endDateTime?: string;
  date?: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ChatContact {
  id: number | string;
  name?: string;
  email?: string;
  last_message_preview?: string;
  last_message_time?: string;
  last_message_is_mine?: boolean;
  unread_count?: number;
  [key: string]: unknown;
}

export interface ChatUsersPayload {
  admins?: ChatContact[];
  client?: { id?: number | string; name?: string; email?: string; [key: string]: unknown } | null;
  users?: ChatContact[];
  /** @deprecated Web API uses `admins` array */
  admin?: { id?: number; name?: string; email?: string; [key: string]: unknown } | null;
}

export interface ChatGroupMember {
  id: number | string;
  username?: string;
  email?: string;
  user_type?: string;
  [key: string]: unknown;
}

export interface ChatGroupInvitation {
  id?: number | string;
  invitee_email?: string;
  invitee_name?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ChatGroup {
  id: number | string;
  name?: string;
  title?: string;
  members?: ChatGroupMember[];
  members_count?: number;
  deleted_at?: string | null;
  pending_invitations?: ChatGroupInvitation[];
  created_by?: number | string;
  [key: string]: unknown;
}
