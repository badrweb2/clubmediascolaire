import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import type { AdminPermission, ContentType, LinkInspectionResult, SourceMethod } from '../src/types.ts';
import { ALL_ADMIN_PERMISSIONS } from '../src/lib/settingsDefaults.ts';
import {
  detectDirectFileType,
  extractGoogleDriveInfo,
  extractYouTubeId,
  isSafeUrl,
  normalizeImageUrl,
} from '../src/lib/mediaUtils.ts';

const IN_MEMORY_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || IN_MEMORY_SESSION_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasswordHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function safeTextCompare(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function isEnvAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
}

export function getEnvAdminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || 'admin';
}

export function hasClaimedAdminUser(): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
  return row.count > 0;
}

export function createAdminSession(username: string): string {
  const tokenId = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12; // 12 hours

  // Clean expired sessions opportunistically
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO admin_sessions (token_id, username, expires_at) VALUES (?, ?, ?)').run(
    tokenId,
    username,
    expiresAt
  );

  const payload = Buffer.from(JSON.stringify({ tid: tokenId, u: username, exp: expiresAt })).toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string): { valid: boolean; username?: string; tokenId?: string } {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [payload, sig] = parts;
  if (!payload || !sig) return { valid: false };

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  if (!safeTextCompare(sig, expectedSig)) return { valid: false };

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      tid?: string;
      u?: string;
      exp?: number;
    };
    if (!decoded.tid || !decoded.u || !decoded.exp || decoded.exp < Date.now()) {
      return { valid: false };
    }
    const row = db
      .prepare('SELECT token_id, username, expires_at FROM admin_sessions WHERE token_id = ?')
      .get(decoded.tid) as { token_id: string; username: string; expires_at: number } | undefined;

    if (!row || row.expires_at < Date.now()) {
      return { valid: false };
    }
    return { valid: true, username: row.username, tokenId: row.token_id };
  } catch {
    return { valid: false };
  }
}

export function revokeAdminSession(tokenId: string): void {
  db.prepare('DELETE FROM admin_sessions WHERE token_id = ?').run(tokenId);
}

export function sanitizePermissions(raw: unknown): AdminPermission[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(ALL_ADMIN_PERMISSIONS);
  return Array.from(
    new Set(
      raw.filter((p): p is AdminPermission => typeof p === 'string' && allowed.has(p))
    )
  );
}

export function parseStoredPermissions(rawJson: string | undefined, isPrimary: boolean): AdminPermission[] {
  if (isPrimary) return [...ALL_ADMIN_PERMISSIONS];
  try {
    return sanitizePermissions(JSON.parse(rawJson || '[]'));
  } catch {
    return [];
  }
}

export interface DbAdminUserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  permissions_json: string;
  is_active: number;
  is_primary: number;
  created_at: string;
  updated_at: string;
}

export function getAdminUserByUsername(username: string): DbAdminUserRow | undefined {
  return db
    .prepare('SELECT * FROM admin_users WHERE username = ?')
    .get(username) as DbAdminUserRow | undefined;
}

export interface AdminRequest extends Request {
  adminUsername?: string;
  adminDisplayName?: string;
  adminTokenId?: string;
  adminPermissions?: AdminPermission[];
  adminIsPrimary?: boolean;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح بالوصول. يرجى تسجيل دخول المدير أولاً.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const verified = verifyAdminToken(token);
  if (!verified.valid || !verified.username) {
    res.status(401).json({ error: 'انتهت صلاحية الجلسة أو الرمز غير صالح.' });
    return;
  }

  if (isEnvAdminConfigured()) {
    req.adminUsername = verified.username;
    req.adminDisplayName = verified.username;
    req.adminTokenId = verified.tokenId;
    req.adminPermissions = [...ALL_ADMIN_PERMISSIONS];
    req.adminIsPrimary = true;
    next();
    return;
  }

  const user = getAdminUserByUsername(verified.username);
  if (!user || !user.is_active) {
    if (verified.tokenId) revokeAdminSession(verified.tokenId);
    res.status(401).json({ error: 'تم تعطيل هذا الحساب أو لم يعد موجوداً.' });
    return;
  }

  req.adminUsername = user.username;
  req.adminDisplayName = user.display_name || user.username;
  req.adminTokenId = verified.tokenId;
  req.adminIsPrimary = Boolean(user.is_primary);
  req.adminPermissions = parseStoredPermissions(user.permissions_json, Boolean(user.is_primary));
  next();
}

export function requirePermission(permission: AdminPermission) {
  return (req: AdminRequest, res: Response, next: NextFunction): void => {
    requireAdmin(req, res, () => {
      if (req.adminIsPrimary || req.adminPermissions?.includes(permission)) {
        next();
        return;
      }
      res.status(403).json({ error: 'ليس لديك الصلاحية المطلوبة لتنفيذ هذه المهمة.' });
    });
  };
}

function isPrivateIpAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    if (lower.startsWith('::ffff:')) {
      return isPrivateIpAddress(lower.replace('::ffff:', ''));
    }
    return false;
  }
  return true;
}

async function assertPublicExternalHost(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('بروتوكول غير مدعوم. يسمح فقط بروابط http أو https.');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('لا يمكن فحص عناوين الشبكة الداخلية.');
  }
  if (net.isIP(host)) {
    if (isPrivateIpAddress(host)) {
      throw new Error('عنوان IP غير مسموح به.');
    }
    return parsed;
  }
  const resolved = await dns.lookup(host, { all: true });
  if (!resolved.length || resolved.some((entry) => isPrivateIpAddress(entry.address))) {
    throw new Error('الوجهة تحل إلى عنوان شبكة خاص غير مسموح به.');
  }
  return parsed;
}

export async function inspectExternalMediaUrl(
  rawUrl: string,
  preferredMethod?: SourceMethod,
  preferredType?: ContentType
): Promise<LinkInspectionResult> {
  const trimmed = rawUrl.trim();
  if (!isSafeUrl(trimmed)) {
    return {
      valid: false,
      source_method: preferredMethod || 'direct',
      detected_content_type: preferredType || 'video',
      original_url: trimmed,
      embed_url: '',
      thumbnail_url: '',
      media_mime: '',
      embed_status: 'blocked',
      message: 'الرابط المدخل غير صالح. تأكد من البدء بـ https:// أو اختيار مسار صحيح.',
      guidance: ['انسخ الرابط كاملاً من شريط المتصفح أو من نافذة المشاركة.'],
    };
  }

  // Internal sample media
  if (trimmed.startsWith('/api/samples/') || trimmed.startsWith('/src/assets/') || trimmed.startsWith('/assets/')) {
    const direct = detectDirectFileType(trimmed);
    const detectedType: ContentType =
      preferredType === 'project' ? 'project' : direct?.contentType || preferredType || 'pdf';
    return {
      valid: true,
      source_method: preferredMethod || 'direct',
      detected_content_type: detectedType,
      original_url: trimmed,
      embed_url: trimmed,
      thumbnail_url: direct?.contentType === 'image' ? trimmed : '',
      media_mime: direct?.mime || '',
      embed_status: 'ok',
      message: 'ملف محلي متاح وجاهز للعرض داخل المنصة.',
      guidance: [],
    };
  }

  // YouTube handling
  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    const embedUrl = `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`;
    const thumbUrl = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    try {
      const oembedTarget = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}&format=json`;
      await assertPublicExternalHost(oembedTarget);
      const resp = await fetch(oembedTarget, { signal: AbortSignal.timeout(4500) });
      if (resp.ok) {
        return {
          valid: true,
          source_method: 'youtube',
          detected_content_type: 'video',
          original_url: trimmed,
          embed_url: embedUrl,
          thumbnail_url: thumbUrl,
          media_mime: 'text/html',
          embed_status: 'ok',
          message: 'تم التعرف على فيديو YouTube بنجاح وهو جاهز للتشغيل المدمج داخل المنصة.',
          guidance: [],
        };
      }
      return {
        valid: true,
        source_method: 'youtube',
        detected_content_type: 'video',
        original_url: trimmed,
        embed_url: embedUrl,
        thumbnail_url: thumbUrl,
        media_mime: 'text/html',
        embed_status: 'warning',
        message: 'تم استخراج معرّف الفيديو، لكن قد يكون الفيديو غير مدرج أو محظور التضمين.',
        guidance: [
          'تأكد في إعدادات الفيديو على YouTube من تفعيل خيار "السماح بالتضمين" (Allow embedding).',
          'تأكد أن الفيديو ليس مضبوطاً على حالة "خاص" (Private).',
        ],
      };
    } catch {
      return {
        valid: true,
        source_method: 'youtube',
        detected_content_type: 'video',
        original_url: trimmed,
        embed_url: embedUrl,
        thumbnail_url: thumbUrl,
        media_mime: 'text/html',
        embed_status: 'warning',
        message: 'تم التعرف على رابط YouTube، وتعذر التحقق الشبكي التلقائي حالياً. راجع المعاينة المباشرة.',
        guidance: ['تحقق من ظهور الفيديو في نافذة المعاينة أدناه قبل النشر.'],
      };
    }
  }

  // Google Drive / Google Docs / Google Slides
  const driveInfo = extractGoogleDriveInfo(trimmed);
  if (driveInfo) {
    const inferredType: ContentType =
      driveInfo.kind === 'presentation'
        ? 'presentation'
        : driveInfo.kind === 'document'
          ? 'pdf'
          : preferredType || 'video';

    try {
      await assertPublicExternalHost(driveInfo.embedUrl);
      const resp = await fetch(driveInfo.embedUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });

      const locationHeader = resp.headers.get('location') || '';
      if (
        resp.status === 401 ||
        resp.status === 403 ||
        locationHeader.includes('accounts.google.com')
      ) {
        return {
          valid: true,
          source_method: 'gdrive',
          detected_content_type: inferredType,
          original_url: trimmed,
          embed_url: driveInfo.embedUrl,
          thumbnail_url: '',
          media_mime: 'text/html',
          embed_status: 'blocked',
          message:
            'تنبيه صلاحيات Google Drive: هذا الملف خاص حالياً ولا يظهر للزوار بدون تسجيل الدخول.',
          guidance: [
            'افتح الملف في Google Drive ثم اضغط على زر «مشاركة» (Share).',
            'من قسم «الوصول العام» (General access)، غيّر الإعداد من «حصري» إلى «أي شخص لديه الرابط» (Anyone with the link).',
            'تأكد أن الصلاحية هي «عارض» (Viewer) ثم احفظ وأعد الفحص.',
          ],
        };
      }

      return {
        valid: true,
        source_method: 'gdrive',
        detected_content_type: inferredType,
        original_url: trimmed,
        embed_url: driveInfo.embedUrl,
        thumbnail_url: inferredType === 'image' ? normalizeImageUrl(trimmed) : '',
        media_mime: 'text/html',
        embed_status: 'ok',
        message: 'رابط Google Drive متاح للمعاينة العامة وتم تحويله إلى مشغل مدمج.',
        guidance: [
          'تحقق في المعاينة أدناه من أن الملف يظهر بوضوح قبل الضغط على زر النشر.',
        ],
      };
    } catch {
      return {
        valid: true,
        source_method: 'gdrive',
        detected_content_type: inferredType,
        original_url: trimmed,
        embed_url: driveInfo.embedUrl,
        thumbnail_url: inferredType === 'image' ? normalizeImageUrl(trimmed) : '',
        media_mime: 'text/html',
        embed_status: 'warning',
        message: 'تم تحويل رابط Google Drive إلى صيغة التضمين الرسمية. يُرجى التأكد من صلاحيات المشاركة.',
        guidance: [
          'اجعل الملف متاحاً للعرض لـ «أي شخص لديه الرابط» (Viewer) حتى يتمكن الزوار من مشاهدته.',
        ],
      };
    }
  }

  // Direct media URL
  const direct = detectDirectFileType(trimmed);
  try {
    await assertPublicExternalHost(trimmed);
    const resp = await fetch(trimmed, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });

    const contentTypeHeader = (resp.headers.get('content-type') || '').toLowerCase();
    const xfo = (resp.headers.get('x-frame-options') || '').toLowerCase();
    const csp = (resp.headers.get('content-security-policy') || '').toLowerCase();

    let detectedType: ContentType = direct?.contentType || preferredType || 'pdf';
    if (contentTypeHeader.startsWith('video/')) detectedType = 'video';
    else if (contentTypeHeader.startsWith('audio/')) detectedType = 'audio';
    else if (contentTypeHeader.startsWith('image/')) detectedType = 'image';
    else if (contentTypeHeader.includes('application/pdf')) detectedType = 'pdf';

    if (preferredType === 'project') detectedType = 'project';

    if (!resp.ok) {
      return {
        valid: true,
        source_method: 'direct',
        detected_content_type: detectedType,
        original_url: trimmed,
        embed_url: trimmed,
        thumbnail_url: detectedType === 'image' ? trimmed : '',
        media_mime: direct?.mime || contentTypeHeader,
        embed_status: 'blocked',
        message: `تعذر الوصول للملف المباشر (رمز الاستجابة ${resp.status}). قد يكون الرابط معطلاً أو يتطلب صلاحيات دخول.`,
        guidance: ['تأكد أن الرابط مباشر وينتهي بصيغة الملف (مثل .mp4 أو .mp3 أو .pdf) ومتاح للعامة.'],
      };
    }

    const blocksFraming =
      (detectedType === 'pdf' || detectedType === 'presentation') &&
      (xfo.includes('deny') || xfo.includes('sameorigin') || csp.includes('frame-ancestors'));

    if (blocksFraming) {
      return {
        valid: true,
        source_method: 'direct',
        detected_content_type: detectedType,
        original_url: trimmed,
        embed_url: trimmed,
        thumbnail_url: '',
        media_mime: direct?.mime || contentTypeHeader,
        embed_status: 'warning',
        message: 'المصدر الخارجي يمنع التضمين داخل إطار (X-Frame-Options). يُنصح برفع الملف إلى Google Drive ومشاركته للعرض.',
        guidance: [
          'بعض المواقع تمنع عرض ملفات PDF أو العروض داخل منصات أخرى.',
          'الحل الأفضل: ارفع الملف إلى Google Drive واجعل مشاركته «أي شخص لديه الرابط» ثم الصق رابط Drive.',
        ],
      };
    }

    return {
      valid: true,
      source_method: 'direct',
      detected_content_type: detectedType,
      original_url: trimmed,
      embed_url: trimmed,
      thumbnail_url: detectedType === 'image' ? trimmed : '',
      media_mime: direct?.mime || contentTypeHeader,
      embed_status: 'ok',
      message: 'تم التحقق من الرابط المباشر والتعرف على نوع المحتوى بنجاح.',
      guidance: [],
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'تعذر الاتصال بالمصدر الخارجي';
    return {
      valid: Boolean(direct),
      source_method: preferredMethod || 'direct',
      detected_content_type: direct?.contentType || preferredType || 'video',
      original_url: trimmed,
      embed_url: trimmed,
      thumbnail_url: direct?.contentType === 'image' ? trimmed : '',
      media_mime: direct?.mime || '',
      embed_status: 'warning',
      message: `ملاحظة فحص الرابط: ${errMsg}`,
      guidance: ['تحقق من المعاينة المباشرة للتأكد من عمل الملف في المتصفح.'],
    };
  }
}
