import { AxiosError } from 'axios';
import { env } from '../../config/env';
import { httpClient } from './httpClient';
import type {
  ClientVendor,
  VendorFormPayload,
  VendorJobOption,
  VendorListPayload,
  VendorRequestFormPayload,
  VendorRequestListPayload,
  VendorRequestMessage,
  VendorRequestRecord,
} from '../../types/vendors';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
};

const getError = (error: unknown, fallback: string): Error => {
  const axiosError = error as AxiosError<ApiEnvelope<unknown>>;
  const data = axiosError.response?.data;
  if (data?.errors && typeof data.errors === 'object') {
    const firstKey = Object.keys(data.errors)[0];
    const firstMsg = firstKey ? data.errors[firstKey]?.[0] : undefined;
    if (firstMsg) {
      return new Error(firstMsg);
    }
  }
  return new Error(data?.message || fallback);
};

const unwrap = <T>(responseData: ApiEnvelope<T> | undefined, fallback: string): T => {
  if (!responseData || responseData.success === false) {
    throw new Error(responseData?.message || fallback);
  }
  if (responseData.data === undefined) {
    throw new Error(fallback);
  }
  return responseData.data;
};

const mockVendors: ClientVendor[] = [
  {
    id: 'mock-v1',
    company_name: 'Summit Roofing Co',
    contact_name: 'Alex Rivera',
    phone: '(214) 555-0142',
    email: 'alex@summitroof.example',
    service_type: 'Roofing',
    website_url: 'https://summitroof.example',
    files: [],
  },
  {
    id: 'mock-v2',
    company_name: 'ClearPath Gutters',
    contact_name: 'Jamie Chen',
    phone: '(469) 555-0199',
    email: 'jamie@clearpath.example',
    service_type: 'Gutters',
    files: [],
  },
];

let mockRequests: VendorRequestRecord[] = [
  {
    id: 'mock-r1',
    title: 'Inspect hail damage',
    status: 'sent',
    description: 'Please review the north slope after last week’s storm.',
    client_vendor_id: 1,
    vendor: mockVendors[0],
    allow_messaging: true,
    created_at: new Date().toISOString(),
    messages: [],
  },
];

export const vendorService = {
  async listVendors(params?: { search?: string; page?: number }): Promise<VendorListPayload> {
    if (env.useMockData) {
      const q = (params?.search ?? '').trim().toLowerCase();
      const items = q
        ? mockVendors.filter((v) =>
            [v.company_name, v.contact_name, v.email, v.phone, v.service_type]
              .filter(Boolean)
              .some((f) => String(f).toLowerCase().includes(q)),
          )
        : mockVendors;
      return { items, total: items.length, current_page: 1, per_page: 25, last_page: 1 };
    }

    try {
      const response = await httpClient.get<ApiEnvelope<VendorListPayload>>(env.mobileVendors.list, {
        params: {
          search: params?.search || undefined,
          page: params?.page || 1,
          per_page: 50,
        },
      });
      return unwrap(response.data, 'Unable to load vendors.');
    } catch (error) {
      throw getError(error, 'Unable to load vendors.');
    }
  },

  async createVendor(payload: VendorFormPayload): Promise<ClientVendor> {
    if (env.useMockData) {
      const row: ClientVendor = {
        id: `mock-v-${Date.now()}`,
        ...payload,
        files: [],
      };
      mockVendors.unshift(row);
      return row;
    }

    try {
      const response = await httpClient.post<ApiEnvelope<ClientVendor>>(env.mobileVendors.list, payload);
      return unwrap(response.data, 'Unable to add vendor.');
    } catch (error) {
      throw getError(error, 'Unable to add vendor.');
    }
  },

  async updateVendor(id: number | string, payload: VendorFormPayload): Promise<ClientVendor> {
    if (env.useMockData) {
      const idx = mockVendors.findIndex((v) => String(v.id) === String(id));
      if (idx < 0) {
        throw new Error('Vendor not found.');
      }
      mockVendors[idx] = { ...mockVendors[idx], ...payload };
      return mockVendors[idx];
    }

    try {
      const response = await httpClient.put<ApiEnvelope<ClientVendor>>(env.mobileVendors.detail(id), payload);
      return unwrap(response.data, 'Unable to update vendor.');
    } catch (error) {
      throw getError(error, 'Unable to update vendor.');
    }
  },

  async deleteVendor(id: number | string): Promise<void> {
    if (env.useMockData) {
      const idx = mockVendors.findIndex((v) => String(v.id) === String(id));
      if (idx >= 0) {
        mockVendors.splice(idx, 1);
      }
      return;
    }

    try {
      const response = await httpClient.delete<ApiEnvelope<{ id?: number }>>(env.mobileVendors.detail(id));
      if (response.data?.success === false) {
        throw new Error(response.data.message || 'Unable to delete vendor.');
      }
    } catch (error) {
      throw getError(error, 'Unable to delete vendor.');
    }
  },

  async listRequests(params?: { search?: string; page?: number }): Promise<VendorRequestListPayload> {
    if (env.useMockData) {
      const q = (params?.search ?? '').trim().toLowerCase();
      const items = q
        ? mockRequests.filter((r) =>
            [r.title, r.description, r.vendor?.company_name]
              .filter(Boolean)
              .some((f) => String(f).toLowerCase().includes(q)),
          )
        : mockRequests;
      return { items, total: items.length, current_page: 1, per_page: 25, last_page: 1 };
    }

    try {
      const response = await httpClient.get<ApiEnvelope<VendorRequestListPayload>>(env.mobileVendorRequests.list, {
        params: {
          search: params?.search || undefined,
          page: params?.page || 1,
          per_page: 50,
        },
      });
      return unwrap(response.data, 'Unable to load vendor requests.');
    } catch (error) {
      throw getError(error, 'Unable to load vendor requests.');
    }
  },

  async getRequest(id: number | string): Promise<VendorRequestRecord> {
    if (env.useMockData) {
      const row = mockRequests.find((r) => String(r.id) === String(id));
      if (!row) {
        throw new Error('Vendor request not found.');
      }
      return row;
    }

    try {
      const response = await httpClient.get<ApiEnvelope<VendorRequestRecord>>(
        env.mobileVendorRequests.detail(id),
      );
      return unwrap(response.data, 'Unable to load request.');
    } catch (error) {
      throw getError(error, 'Unable to load request.');
    }
  },

  async jobOptions(): Promise<VendorJobOption[]> {
    if (env.useMockData) {
      return [
        {
          id: 101,
          title: 'Sample roof inspection',
          customer_address: '12 Oaks Mall Rd, Novi, MI',
        },
      ];
    }

    try {
      const response = await httpClient.get<ApiEnvelope<{ items: VendorJobOption[] }>>(
        env.mobileVendorRequests.jobOptions,
      );
      const data = unwrap(response.data, 'Unable to load jobs.');
      return Array.isArray(data.items) ? data.items : [];
    } catch (error) {
      throw getError(error, 'Unable to load jobs.');
    }
  },

  async createRequest(payload: VendorRequestFormPayload): Promise<VendorRequestRecord> {
    if (env.useMockData) {
      const vendor = mockVendors.find((v) => String(v.id) === String(payload.client_vendor_id));
      const row: VendorRequestRecord = {
        id: `mock-r-${Date.now()}`,
        title: payload.title,
        description: payload.description,
        address: payload.address,
        status: 'sent',
        client_vendor_id: Number(payload.client_vendor_id),
        vendor: vendor ?? null,
        allow_messaging: payload.allow_messaging !== false,
        messages: [],
        created_at: new Date().toISOString(),
      };
      mockRequests.unshift(row);
      return row;
    }

    try {
      const response = await httpClient.post<ApiEnvelope<VendorRequestRecord>>(
        env.mobileVendorRequests.list,
        payload,
      );
      return unwrap(response.data, 'Unable to send vendor request.');
    } catch (error) {
      throw getError(error, 'Unable to send vendor request.');
    }
  },

  async cancelRequest(id: number | string): Promise<VendorRequestRecord> {
    if (env.useMockData) {
      const row = mockRequests.find((r) => String(r.id) === String(id));
      if (!row) {
        throw new Error('Vendor request not found.');
      }
      row.status = 'cancelled';
      return row;
    }

    try {
      const response = await httpClient.post<ApiEnvelope<VendorRequestRecord>>(
        env.mobileVendorRequests.cancel(id),
      );
      return unwrap(response.data, 'Unable to cancel request.');
    } catch (error) {
      throw getError(error, 'Unable to cancel request.');
    }
  },

  async resendRequest(id: number | string, customMessage?: string): Promise<VendorRequestRecord> {
    if (env.useMockData) {
      const row = mockRequests.find((r) => String(r.id) === String(id));
      if (!row) {
        throw new Error('Vendor request not found.');
      }
      return row;
    }

    try {
      const response = await httpClient.post<ApiEnvelope<VendorRequestRecord>>(
        env.mobileVendorRequests.resend(id),
        customMessage ? { custom_message: customMessage } : {},
      );
      return unwrap(response.data, 'Unable to resend invite.');
    } catch (error) {
      throw getError(error, 'Unable to resend invite.');
    }
  },

  async sendMessage(id: number | string, body: string): Promise<VendorRequestMessage> {
    if (env.useMockData) {
      const row = mockRequests.find((r) => String(r.id) === String(id));
      if (!row) {
        throw new Error('Vendor request not found.');
      }
      const message: VendorRequestMessage = {
        id: `mock-m-${Date.now()}`,
        body,
        sender_type: 'owner',
        created_at: new Date().toISOString(),
      };
      row.messages = [...(row.messages ?? []), message];
      return message;
    }

    try {
      const response = await httpClient.post<ApiEnvelope<VendorRequestMessage>>(
        env.mobileVendorRequests.messages(id),
        { body },
      );
      return unwrap(response.data, 'Unable to send message.');
    } catch (error) {
      throw getError(error, 'Unable to send message.');
    }
  },
};
