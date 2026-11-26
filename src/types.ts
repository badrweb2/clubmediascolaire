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

export interface FaqItem {
  question: string;
  answer: string;
}

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
  // Extended hero & footer
  hero_badge_text: string;
  hero_primary_btn_text: string;
  hero_secondary_btn_text: string;
  footer_publish_note: string;
  primary_color: string;
  // Main navigation labels
  nav_home_label: string;
  nav_videos_label: string;
  nav_audio_label: string;
  nav_innovations_label: string;
  nav_projects_label: string;
  nav_activities_label: string;
  nav_works_label: string;
  // Homepage section titles & visibility toggles ('1' or '0')
  show_stats_bar: string;
  show_categories_section: string;
  categories_section_title: string;
  show_latest_section: string;
  latest_section_title: string;
  show_featured_section: string;
  featured_section_title: string;
  show_most_viewed_section: string;
  most_viewed_section_title: string;
  show_radio_corner: string;
  radio_corner_title: string;
  show_art_corner: string;
  art_corner_title: string;
  show_video_corner: string;
  video_corner_title: string;
  show_project_corner: string;
  project_corner_title: string;
  // Display preferences
  show_view_counts: string;
  show_share_button: string;
  // About page & supervisor
  about_button_label: string;
  about_title: string;
  about_definition: string;
  about_contents: string;
  about_objectives: string;
  supervisor_name: string;
  supervisor_title: string;
  supervisor_bio: string;
  about_faq_json: string;
}

export interface PublicSiteStats {
  total_site_visits: number;
  today_site_visits: number;
  unique_visitors: number;
  total_work_views: number;
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
  total_site_visits: number;
  today_site_visits: number;
  unique_visitors: number;
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
