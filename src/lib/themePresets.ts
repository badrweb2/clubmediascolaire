import type React from 'react';
import { isSafeUrl, normalizeImageUrl } from './mediaUtils.ts';
import type { PlatformSettings } from '../types.ts';

export interface BackgroundBankItem {
  id: string;
  label: string;
  category: 'photo' | 'gradient' | 'solid';
  value: string;
  previewImage?: string;
}

export const BACKGROUND_BANK: BackgroundBankItem[] = [
  {
    id: 'photo-library',
    label: 'فضاء المكتبة المدرسية',
    category: 'photo',
    value: '/src/assets/images/hero_school_cover_1795563098821.jpg',
    previewImage: '/src/assets/images/hero_school_cover_1795563098821.jpg',
  },
  {
    id: 'photo-solar',
    label: 'مختبر العلوم والطاقة المتجددة',
    category: 'photo',
    value: '/src/assets/images/thumb_science_solar_1795563099401.jpg',
    previewImage: '/src/assets/images/thumb_science_solar_1795563099401.jpg',
  },
  {
    id: 'photo-robotics',
    label: 'نادي الروبوتيك والابتكار',
    category: 'photo',
    value: '/src/assets/images/thumb_robotics_club_1795563100911.jpg',
    previewImage: '/src/assets/images/thumb_robotics_club_1795563100911.jpg',
  },
  {
    id: 'photo-radio',
    label: 'استوديو الإذاعة المدرسية',
    category: 'photo',
    value: '/src/assets/images/thumb_school_radio_1795563100335.jpg',
    previewImage: '/src/assets/images/thumb_school_radio_1795563100335.jpg',
  },
  {
    id: 'photo-arts',
    label: 'ورشة الفنون والزخرفة المغربية',
    category: 'photo',
    value: '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
    previewImage: '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
  },
  {
    id: 'photo-magazine',
    label: 'ركن المجلة والبحوث المدرسية',
    category: 'photo',
    value: '/src/assets/images/thumb_school_magazine_1795563101388.jpg',
    previewImage: '/src/assets/images/thumb_school_magazine_1795563101388.jpg',
  },
  {
    id: 'grad-sky-paper',
    label: 'تدرج سماوي هادئ (مناسب للصفحات)',
    category: 'gradient',
    value: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 52%, #f0f9ff 100%)',
  },
  {
    id: 'grad-warm-sand',
    label: 'تدرج دافئ بلمسة ورقية',
    category: 'gradient',
    value: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 45%, #fff7ed 100%)',
  },
  {
    id: 'grad-emerald-breeze',
    label: 'تدرج زمردي تربوي ناعم',
    category: 'gradient',
    value: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 55%, #f8fafc 100%)',
  },
  {
    id: 'grad-royal-cards',
    label: 'خلفية بطاقات لؤلؤية ناعمة',
    category: 'gradient',
    value: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
  },
  {
    id: 'solid-slate',
    label: 'أبيض رمادي أكاديمي (#F8FAFC)',
    category: 'solid',
    value: '#F8FAFC',
  },
  {
    id: 'solid-white',
    label: 'أبيض نقي للبطاقات (#FFFFFF)',
    category: 'solid',
    value: '#FFFFFF',
  },
];

export interface SiteThemePreset {
  id: string;
  name: string;
  category: 'classic' | 'kids' | 'educational';
  description: string;
  swatch: [string, string, string];
  values: Partial<PlatformSettings>;
}

export const THEME_BANK: SiteThemePreset[] = [
  {
    id: 'classic-academic',
    name: 'الأكاديمي الكلاسيكي',
    category: 'classic',
    description: 'أزرق تربوي رصين مع خلفيات ناصعة وتباين مريح للقراءة.',
    swatch: ['#1E40AF', '#F8FAFC', '#FFFFFF'],
    values: {
      active_theme_id: 'classic-academic',
      primary_color: '#1E40AF',
      bg_site: '#F8FAFC',
      bg_home: '',
      bg_pages: '',
      bg_cards: '#FFFFFF',
      bg_work_detail: '',
      font_family: 'ibm',
      card_radius: 'rounded',
    },
  },
  {
    id: 'emerald-oasis',
    name: 'الواحة التربوية الخضراء',
    category: 'educational',
    description: 'أخضر زمردي مشرق يناسب مشاريع البيئة والنادي العلمي.',
    swatch: ['#047857', '#ECFDF5', '#FFFFFF'],
    values: {
      active_theme_id: 'emerald-oasis',
      primary_color: '#047857',
      bg_site: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 55%, #f8fafc 100%)',
      bg_home: 'linear-gradient(180deg, #ecfdf5 0%, #f8fafc 100%)',
      bg_pages: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)',
      bg_cards: '#FFFFFF',
      bg_work_detail: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
      font_family: 'cairo',
      card_radius: 'soft',
    },
  },
  {
    id: 'warm-parchment',
    name: 'دفء المعرفة والكتاب',
    category: 'educational',
    description: 'ألوان دافئة مستوحاة من المكتبات والمجلات الأدبية.',
    swatch: ['#B45309', '#FFFBEB', '#FFFDF7'],
    values: {
      active_theme_id: 'warm-parchment',
      primary_color: '#B45309',
      bg_site: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 45%, #fff7ed 100%)',
      bg_home: 'linear-gradient(180deg, #fffbeb 0%, #fff7ed 100%)',
      bg_pages: '#FFFBEB',
      bg_cards: '#FFFDF8',
      bg_work_detail: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
      font_family: 'tajawal',
      card_radius: 'soft',
    },
  },
  {
    id: 'azure-horizon',
    name: 'الأفق الرقمي الفاتح',
    category: 'educational',
    description: 'طابع تكنولوجي ناعم يناسب الروبوتيك والمشاريع الرقمية.',
    swatch: ['#0369A1', '#EFF6FF', '#FFFFFF'],
    values: {
      active_theme_id: 'azure-horizon',
      primary_color: '#0369A1',
      bg_site: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 52%, #f0f9ff 100%)',
      bg_home: 'linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)',
      bg_pages: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)',
      bg_cards: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      bg_work_detail: '#F0F9FF',
      font_family: 'cairo',
      card_radius: 'rounded',
    },
  },
  {
    id: 'heritage-crimson',
    name: 'الأصالة والزخرفة المغربية',
    category: 'classic',
    description: 'عنابي وقور يعكس الهوية الثقافية والتراثية والفنية للمدرسة.',
    swatch: ['#9F1239', '#FFF1F2', '#FFFFFF'],
    values: {
      active_theme_id: 'heritage-crimson',
      primary_color: '#9F1239',
      bg_site: 'linear-gradient(135deg, #fff1f2 0%, #fff7ed 60%, #f8fafc 100%)',
      bg_home: '#FFF5F6',
      bg_pages: '#FFF8F8',
      bg_cards: '#FFFFFF',
      bg_work_detail: '#FFF5F6',
      font_family: 'ibm',
      card_radius: 'rounded',
    },
  },
  {
    id: 'midnight-slate',
    name: 'الكحلي المؤسسي الوقور',
    category: 'classic',
    description: 'تباين رسمي أنيق بإحساس المنصات الجامعية والمعارض الكبرى.',
    swatch: ['#0F172A', '#F1F5F9', '#FFFFFF'],
    values: {
      active_theme_id: 'midnight-slate',
      primary_color: '#0F172A',
      bg_site: '#F1F5F9',
      bg_home: '#F8FAFC',
      bg_pages: '#F1F5F9',
      bg_cards: '#FFFFFF',
      bg_work_detail: '#F8FAFC',
      font_family: 'tajawal',
      card_radius: 'sharp',
    },
  },
  {
    id: 'sunny-kindergarten',
    name: 'حديقة الطفولة المشرقة',
    category: 'kids',
    description: 'ألوان شمسية دافئة ومبهجة تناسب أنشطة الطفولة المبكرة والمسرح الصغير.',
    swatch: ['#EA580C', '#FFF7ED', '#FEF3C7'],
    values: {
      active_theme_id: 'sunny-kindergarten',
      primary_color: '#EA580C',
      bg_site: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 55%, #fffbeb 100%)',
      bg_home: 'linear-gradient(180deg, #ffedd5 0%, #fffbeb 100%)',
      bg_pages: '#FFF7ED',
      bg_cards: '#FFFFFF',
      bg_work_detail: '#FFFBEB',
      font_family: 'cairo',
      card_radius: 'soft',
    },
  },
  {
    id: 'rainbow-classroom',
    name: 'فصل الإبداع والمرح',
    category: 'kids',
    description: 'طابع طفولي مبهج بدرجات البنفسجي والسماوي اللطيف لتحفيز الخيال والفنون.',
    swatch: ['#7C3AED', '#F5F3FF', '#FDF2F8'],
    values: {
      active_theme_id: 'rainbow-classroom',
      primary_color: '#7C3AED',
      bg_site: 'linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 50%, #eff6ff 100%)',
      bg_home: 'linear-gradient(180deg, #ede9fe 0%, #fdf2f8 100%)',
      bg_pages: 'linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)',
      bg_cards: '#FFFFFF',
      bg_work_detail: '#FAF5FF',
      font_family: 'changa',
      card_radius: 'soft',
    },
  },
  {
    id: 'science-explorer',
    name: 'المستكشف العلمي الصغير',
    category: 'educational',
    description: 'سماوي مشرق مستوحى من التجارب المخبرية ونوادي العلوم والابتكار.',
    swatch: ['#0284C7', '#E0F2FE', '#ECFEFF'],
    values: {
      active_theme_id: 'science-explorer',
      primary_color: '#0284C7',
      bg_site: 'linear-gradient(135deg, #e0f2fe 0%, #ecfeff 50%, #f8fafc 100%)',
      bg_home: 'linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%)',
      bg_pages: '#F0F9FF',
      bg_cards: '#FFFFFF',
      bg_work_detail: '#F0F9FF',
      font_family: 'almarai',
      card_radius: 'soft',
    },
  },
  {
    id: 'reading-garden',
    name: 'حديقة القصص والمطالعة',
    category: 'kids',
    description: 'أخضر طبيعي ناعم ومريح لبصر التلاميذ في ركن القصص والبودكاست.',
    swatch: ['#16A34A', '#DCFCE7', '#F0FDF4'],
    values: {
      active_theme_id: 'reading-garden',
      primary_color: '#16A34A',
      bg_site: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 45%, #fefce8 100%)',
      bg_home: 'linear-gradient(180deg, #dcfce7 0%, #f0fdf4 100%)',
      bg_pages: '#F0FDF4',
      bg_cards: '#FFFDF9',
      bg_work_detail: '#F7FEE7',
      font_family: 'tajawal',
      card_radius: 'soft',
    },
  },
  {
    id: 'space-kids',
    name: 'نادي الفضاء والبرمجة للصغار',
    category: 'kids',
    description: 'نيلي سماوي حيوي يجمع بين متعة الأطفال وشغف الروبوتيك والبرمجة.',
    swatch: ['#4F46E5', '#E0E7FF', '#F0F9FF'],
    values: {
      active_theme_id: 'space-kids',
      primary_color: '#4F46E5',
      bg_site: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 50%, #f0f9ff 100%)',
      bg_home: 'linear-gradient(180deg, #e0e7ff 0%, #eef2ff 100%)',
      bg_pages: '#EEF2FF',
      bg_cards: '#FFFFFF',
      bg_work_detail: '#EEF2FF',
      font_family: 'kufi',
      card_radius: 'soft',
    },
  },
  {
    id: 'crayon-studio',
    name: 'مرسم الألوان والمواهب',
    category: 'kids',
    description: 'وردي مرجاني دافئ ولطيف لإبراز اللوحات الفنية وإبداعات الصغار.',
    swatch: ['#DB2777', '#FCE7F3', '#FFF1F2'],
    values: {
      active_theme_id: 'crayon-studio',
      primary_color: '#DB2777',
      bg_site: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 45%, #fff7ed 100%)',
      bg_home: 'linear-gradient(180deg, #fce7f3 0%, #fff1f2 100%)',
      bg_pages: '#FDF2F8',
      bg_cards: '#FFFFFF',
      bg_work_detail: '#FFF1F2',
      font_family: 'cairo',
      card_radius: 'soft',
    },
  },
];

export function isSafeBackgroundValue(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) return true;
  if (/^(linear|radial)-gradient\([^;{}<>]*\)$/i.test(trimmed) && !/url\s*\(/i.test(trimmed)) {
    return true;
  }
  return isSafeUrl(trimmed);
}

export function normalizeBackgroundValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('#') || /^(linear|radial)-gradient\(/i.test(trimmed)) {
    return trimmed;
  }
  return normalizeImageUrl(trimmed);
}

export function resolveBackgroundStyle(
  rawValue: string | undefined,
  options?: { isCard?: boolean }
): React.CSSProperties | undefined {
  const trimmed = (rawValue || '').trim();
  if (!trimmed || !isSafeBackgroundValue(trimmed)) return undefined;

  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return { backgroundColor: trimmed };
  }
  if (/^(linear|radial)-gradient\(/i.test(trimmed)) {
    return { backgroundImage: trimmed };
  }
  const normalizedUrl = normalizeImageUrl(trimmed);
  if (!isSafeUrl(normalizedUrl)) return undefined;

  const overlay = options?.isCard
    ? 'linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.92))'
    : 'linear-gradient(rgba(248,250,252,0.84), rgba(248,250,252,0.88))';

  return {
    backgroundImage: `${overlay}, url("${normalizedUrl.replace(/"/g, '%22')}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: options?.isCard ? undefined : 'fixed',
  };
}

export function resolveFontFamilyStack(fontKey: string | undefined): {
  sans: string;
  display: string;
} {
  switch (fontKey) {
    case 'cairo':
      return {
        sans: "'Cairo', system-ui, sans-serif",
        display: "'Cairo', system-ui, sans-serif",
      };
    case 'tajawal':
      return {
        sans: "'Tajawal', system-ui, sans-serif",
        display: "'Tajawal', system-ui, sans-serif",
      };
    case 'almarai':
      return {
        sans: "'Almarai', system-ui, sans-serif",
        display: "'Almarai', system-ui, sans-serif",
      };
    case 'kufi':
      return {
        sans: "'Noto Kufi Arabic', system-ui, sans-serif",
        display: "'Noto Kufi Arabic', system-ui, sans-serif",
      };
    case 'changa':
      return {
        sans: "'Changa', system-ui, sans-serif",
        display: "'Changa', system-ui, sans-serif",
      };
    case 'amiri':
      return {
        sans: "'Amiri', Georgia, serif",
        display: "'Amiri', Georgia, serif",
      };
    default:
      return {
        sans: "'IBM Plex Sans Arabic', system-ui, -apple-system, sans-serif",
        display: "'Readex Pro', 'IBM Plex Sans Arabic', system-ui, sans-serif",
      };
  }
}

export function resolveCardRadiusClass(radiusSetting: string | undefined): string {
  switch (radiusSetting) {
    case 'sharp':
      return 'rounded-md';
    case 'soft':
      return 'rounded-2xl';
    default:
      return 'rounded-xl';
  }
}
