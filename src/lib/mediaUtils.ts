import type { ContentType, SourceMethod } from '../types.ts';

export const GRADE_LEVELS = [
  'السنة الأولى ابتدائي',
  'السنة الثانية ابتدائي',
  'السنة الثالثة ابتدائي',
  'السنة الرابعة ابتدائي',
  'السنة الخامسة ابتدائي',
  'السنة السادسة ابتدائي',
  'الأولى إعدادي',
  'الثانية إعدادي',
  'الثالثة إعدادي',
  'عمل جماعي مشترك',
] as const;

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  video: 'فيديو',
  audio: 'ملف صوتي / إذاعة',
  image: 'صورة / عمل فني',
  pdf: 'ملف PDF / مجلة',
  presentation: 'عرض تقديمي / بحث',
  project: 'مشروع مدرسي',
};

export const SOURCE_METHOD_LABELS: Record<SourceMethod, string> = {
  youtube: 'رابط YouTube',
  gdrive: 'رابط Google Drive',
  direct: 'رابط مباشر',
  project_bundle: 'ملف مشروع متكامل',
};

export function isSafeUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/src/assets/')
  ) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function extractYouTubeId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        const v = url.searchParams.get('v');
        return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
      }
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export interface GoogleDriveParseResult {
  fileId: string;
  kind: 'file' | 'presentation' | 'document' | 'spreadsheets';
  embedUrl: string;
}

export function extractGoogleDriveInfo(rawUrl: string): GoogleDriveParseResult | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'drive.google.com') {
      const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
      if (fileMatch) {
        return {
          fileId: fileMatch[1],
          kind: 'file',
          embedUrl: `https://drive.google.com/file/d/${fileMatch[1]}/preview`,
        };
      }
      const idParam = url.searchParams.get('id');
      if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) {
        return {
          fileId: idParam,
          kind: 'file',
          embedUrl: `https://drive.google.com/file/d/${idParam}/preview`,
        };
      }
    }

    if (host === 'docs.google.com') {
      const presMatch = url.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]{10,})/);
      if (presMatch) {
        return {
          fileId: presMatch[1],
          kind: 'presentation',
          embedUrl: `https://docs.google.com/presentation/d/${presMatch[1]}/embed?start=false&loop=false&delayms=5000`,
        };
      }
      const docMatch = url.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]{10,})/);
      if (docMatch) {
        return {
          fileId: docMatch[1],
          kind: 'document',
          embedUrl: `https://docs.google.com/document/d/${docMatch[1]}/preview`,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function detectDirectFileType(rawUrl: string): {
  contentType: ContentType;
  mime: string;
  extension: string;
} | null {
  const cleaned = rawUrl.trim().split('?')[0].split('#')[0].toLowerCase();
  const extMatch = cleaned.match(/\.([a-z0-9]{2,5})$/);
  const ext = extMatch ? extMatch[1] : '';

  if (['mp4', 'webm', 'm4v', 'mov'].includes(ext)) {
    return {
      contentType: 'video',
      mime: ext === 'webm' ? 'video/webm' : 'video/mp4',
      extension: ext,
    };
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
    };
    return {
      contentType: 'audio',
      mime: mimeMap[ext] || 'audio/mpeg',
      extension: ext,
    };
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
    return {
      contentType: 'image',
      mime: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
      extension: ext,
    };
  }
  if (ext === 'pdf') {
    return {
      contentType: 'pdf',
      mime: 'application/pdf',
      extension: 'pdf',
    };
  }
  if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return {
      contentType: 'presentation',
      mime: 'application/vnd.ms-powerpoint',
      extension: ext,
    };
  }
  return null;
}

export function parseMediaUrlClient(
  rawUrl: string,
  preferredMethod?: SourceMethod,
  preferredType?: ContentType
): {
  valid: boolean;
  sourceMethod: SourceMethod;
  contentType: ContentType;
  embedUrl: string;
  thumbnailUrl: string;
  mediaMime: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!isSafeUrl(trimmed)) {
    return {
      valid: false,
      sourceMethod: preferredMethod || 'direct',
      contentType: preferredType || 'video',
      embedUrl: '',
      thumbnailUrl: '',
      mediaMime: '',
      error: 'الرابط غير صالح. يجب أن يبدأ بـ https:// أو http://',
    };
  }

  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    return {
      valid: true,
      sourceMethod: 'youtube',
      contentType: 'video',
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      mediaMime: 'text/html',
    };
  }

  const drive = extractGoogleDriveInfo(trimmed);
  if (drive) {
    const inferredType: ContentType =
      drive.kind === 'presentation'
        ? 'presentation'
        : drive.kind === 'document'
          ? 'pdf'
          : preferredType || 'video';
    return {
      valid: true,
      sourceMethod: 'gdrive',
      contentType: inferredType,
      embedUrl: drive.embedUrl,
      thumbnailUrl: '',
      mediaMime: 'text/html',
    };
  }

  const direct = detectDirectFileType(trimmed);
  if (direct) {
    return {
      valid: true,
      sourceMethod: 'direct',
      contentType: preferredType === 'project' ? 'project' : direct.contentType,
      embedUrl: trimmed,
      thumbnailUrl: direct.contentType === 'image' ? trimmed : '',
      mediaMime: direct.mime,
    };
  }

  if (preferredMethod === 'youtube') {
    return {
      valid: false,
      sourceMethod: 'youtube',
      contentType: 'video',
      embedUrl: '',
      thumbnailUrl: '',
      mediaMime: '',
      error: 'تعذر استخراج معرّف فيديو YouTube. تأكد من لصق رابط فيديو YouTube صحيح.',
    };
  }

  if (preferredMethod === 'gdrive') {
    return {
      valid: false,
      sourceMethod: 'gdrive',
      contentType: preferredType || 'video',
      embedUrl: '',
      thumbnailUrl: '',
      mediaMime: '',
      error: 'رابط Google Drive غير مكتمل. يرجى نسخ رابط المشاركة الكامل للملف أو العرض التقديمي.',
    };
  }

  return {
    valid: true,
    sourceMethod: preferredMethod || 'direct',
    contentType: preferredType || 'presentation',
    embedUrl: trimmed,
    thumbnailUrl: '',
    mediaMime: '',
  };
}

export function formatArabicDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return new Intl.DateTimeFormat('ar-MA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return isoDate;
  }
}
