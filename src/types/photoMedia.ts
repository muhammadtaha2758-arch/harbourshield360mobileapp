export interface PhotoMediaItem {
  id: number | string;
  project_id?: number | string | null;
  project_name?: string | null;
  original_name?: string;
  file_size?: number | string;
  file_type?: string;
  url?: string;
  display_url?: string;
  created_at?: string;
}

export interface PhotoMediaListResponse {
  success?: boolean;
  message?: string;
  before_pictures?: PhotoMediaItem[];
  after_pictures?: PhotoMediaItem[];
}
