export interface JobDetailClient {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface JobDetailRecord {
  id: number | string;
  title?: string;
  description?: string | null;
  status?: string;
  lead_address?: string | null;
  client?: JobDetailClient | null;
  roofr?: { id?: number; name?: string } | null;
  created_at?: string;
  updated_at?: string;
  map_image_url?: string | null;
}

export interface JobFileRecord {
  id: number | string;
  original_name?: string;
  file_size?: number | string;
  file_type?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JobProposalRecord {
  id: number | string;
  signature_status?: string;
  status?: string;
  updated_at?: string;
  project_name?: string;
}

export interface JobInvoiceRecord {
  id: number | string;
  status?: string;
  updated_at?: string;
  amount?: number | string;
  due_date?: string;
  claim_reference?: string;
  project_name?: string;
}

export interface JobScheduleRecord {
  id: number | string;
  title?: string;
  type?: string;
  status?: string;
  description?: string;
  start_date_time?: string;
  end_date_time?: string;
  date_words?: string;
  updated_at?: string;
}

export interface JobMaterialOrderRecord {
  id: number | string;
  Ref?: string;
  statut?: string;
  created_at?: string;
  GrandTotal?: number | string;
  project_name?: string;
}

export interface JobContractRecord {
  id: number | string;
  name?: string;
  status?: string;
  updated_at?: string;
}

export interface JobNoteRecord {
  id: number | string;
  note?: string;
  created_at?: string;
}

export interface JobDetailApiResponse {
  success?: boolean;
  message?: string;
  job?: JobDetailRecord;
  proposals?: JobProposalRecord[];
  invoices?: JobInvoiceRecord[];
  contracts?: JobContractRecord[];
  schedules?: JobScheduleRecord[];
  measurements?: JobFileRecord[];
  work_orders?: JobFileRecord[];
  material_order_docs?: JobFileRecord[];
  material_orders?: JobMaterialOrderRecord[];
  inspection_reports?: JobFileRecord[];
  insurance_files?: JobFileRecord[];
  before_pictures?: JobFileRecord[];
  after_pictures?: JobFileRecord[];
  file_upload?: JobFileRecord[];
  project_notes?: JobNoteRecord[];
}
