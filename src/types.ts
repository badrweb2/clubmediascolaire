export type ContentType =
  | 'video'
  | 'audio'
  | 'image'
  | 'pdf'
  | 'presentation'
  | 'project';

export type SourceMethod = 'gdrive' | 'direct' | 'youtube' | 'project_bundle';

export type PublishStatus = 'published' | 'draft';

export type EmbedHealth = 'ok' | 'warning' | 'blocked';

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description: string;
  sort_order: number;
  created_at: string;
  item_count?: number;
}

export interface WorkItem {
  id: number;
  title: string;
  description: string;
  student_name: string;
  grade_level: string;
  class_section: string;
  publish_date: string;
  content_type: ContentType;
  source_method: SourceMethod;
  original_url: string;
  embed_url: string;
  media_mime: string;
  thumbnail_url: string;
  gallery_urls: string[];
  category_id: number;
  subcategory_id: number | null;
  category_name?: string;
  subcategory_name?: string | null;
  keywords: string;
  status: PublishStatus;
  featured: boolean;
  embed_status: EmbedHealth;
  embed_note: string;
  views_count: number;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformSettings {
  school_name: string;
  platform_title: string;
  platform_tagline: string;
  hero_cover_url: string;
  logo_url: string;
  academic_year: string;
  footer_note: string;
}

export interface AdminStats {
  total_items: number;
  total_videos: number;
  total_audio: number;
  total_images: number;
  total_projects: number;
  total_pdfs: number;
  total_presentations: number;
  published_count: number;
  draft_count: number;
  total_views: number;
  latest_items: WorkItem[];
}

export interface LinkInspectionResult {
  valid: boolean;
  source_method: SourceMethod;
  detected_content_type: ContentType;
  original_url: string;
  embed_url: string;
  thumbnail_url: string;
  media_mime: string;
  embed_status: EmbedHealth;
  message: string;
  guidance: string[];
}

export interface AuthState {
  needsSetup: boolean;
  authenticated: boolean;
  username: string | null;
  envManaged?: boolean;
}
