export type InvoiceDisplayStatus = 'Paid' | 'Due Soon' | 'Overdue';

export interface CustomerInvoiceRecord {
  id: number | string;
  invoice_number?: string;
  project_id?: number | string | null;
  estimate_id?: number | string | null;
  amount?: number | string | null;
  amount_formatted?: string;
  status?: string;
  display_status?: InvoiceDisplayStatus | string;
  due_date?: string | null;
  due_label?: string;
  title?: string;
  project_address?: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InvoicesSummary {
  open_balance?: number;
  open_balance_formatted?: string;
  total_count?: number;
}

export interface InvoicesListResponse {
  success?: boolean;
  message?: string;
  invoice?: CustomerInvoiceRecord[];
  totalRows?: number;
  summary?: InvoicesSummary;
}

export interface InvoiceDetailResponse {
  success?: boolean;
  message?: string;
  Invoice?: Record<string, unknown>;
  items?: unknown[];
  totals?: Record<string, unknown>;
}
