export interface ChatContact {
  id: number | string;
  name?: string;
  email?: string;
  last_message_preview?: string;
  unread_count?: number;
  [key: string]: unknown;
}

export interface ChatUsersResponse {
  success?: boolean;
  message?: string;
  admins?: ChatContact[];
  client?: { id?: number | string; name?: string; email?: string; [key: string]: unknown };
  users?: ChatContact[];
}

export interface ChatMessageRecord {
  id: number | string;
  sender_id?: number | string;
  receiver_id?: number | string;
  group_id?: number | string | null;
  message?: string;
  message_type?: string;
  created_at?: string;
  seen?: number | boolean;
  file_url?: string | null;
  file_type?: string | null;
  attachment_url?: string | null;
  attachment_path?: string | null;
  attachment_type?: string | null;
  text?: string;
  sender?: { id?: number | string; name?: string; firstname?: string; lastname?: string };
  sender_name?: string;
}

export interface ChatMessagesResponse {
  success?: boolean;
  message?: string;
  messages?: ChatMessageRecord[];
  pagination?: Record<string, unknown>;
  infinite_scroll?: {
    has_more?: boolean;
    last_message_id?: number | string | null;
    first_message_id?: number | string | null;
  };
}
