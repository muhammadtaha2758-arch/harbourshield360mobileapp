export type VendorAttachment = {
  id: number | string;
  original_name?: string;
  file_type?: string;
  file_size?: number;
  role?: string;
};

export type ClientVendor = {
  id: number | string;
  company_name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  service_type?: string | null;
  notes?: string | null;
  claim_status?: string | null;
  files?: VendorAttachment[];
  created_at?: string;
  updated_at?: string;
};

export type VendorJobOption = {
  id: number;
  title?: string | null;
  description?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
};

export type VendorRequestMessage = {
  id: number | string;
  body: string;
  sender_type?: string;
  sender_user_id?: number;
  created_at?: string;
};

export type VendorRequestActivity = {
  id: number | string;
  event?: string;
  actor_type?: string;
  meta?: Record<string, unknown> | null;
  created_at?: string;
};

export type VendorRequestRecord = {
  id: number | string;
  title: string;
  description?: string | null;
  address?: string | null;
  status: string;
  share_address?: boolean;
  share_files?: boolean;
  allow_messaging?: boolean;
  allow_uploads?: boolean;
  client_vendor_id?: number;
  project_id?: number | null;
  vendor?: ClientVendor | null;
  project?: { id?: number; title?: string; client?: { name?: string } | null } | null;
  messages?: VendorRequestMessage[];
  activity?: VendorRequestActivity[];
  attachments?: VendorAttachment[];
  created_at?: string;
  updated_at?: string;
};

export type VendorListPayload = {
  items: ClientVendor[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
};

export type VendorRequestListPayload = {
  items: VendorRequestRecord[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
};

export type VendorFormPayload = {
  company_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  website_url?: string;
  service_type?: string;
  notes?: string;
};

export type VendorRequestFormPayload = {
  client_vendor_id: number | string;
  project_id?: number | string | null;
  title: string;
  description?: string;
  address?: string;
  custom_message?: string;
  share_address?: boolean;
  share_files?: boolean;
  allow_messaging?: boolean;
  allow_uploads?: boolean;
};
