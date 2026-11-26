import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import {
  db,
  getCategoriesWithCounts,
  getSettings,
  initDatabase,
  mapWorkRow,
} from './server/db.ts';
import { getSamplePdf, getSampleWav } from './server/samples.ts';
import {
  createAdminSession,
  getEnvAdminUsername,
  hasClaimedAdminUser,
  hashPassword,
  inspectExternalMediaUrl,
  isEnvAdminConfigured,
  requireAdmin,
  revokeAdminSession,
  safeTextCompare,
  verifyAdminToken,
  verifyPasswordHash,
} from './server/security.ts';
import type { AdminRequest } from './server/security.ts';
import { isSafeUrl, parseMediaUrlClient } from './src/lib/mediaUtils.ts';
import type { ContentType, PublishStatus, SourceMethod } from './src/types.ts';

initDatabase();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));

const VALID_CONTENT_TYPES: ContentType[] = [
  'video',
  'audio',
  'image',
  'pdf',
  'presentation',
  'project',
];
const VALID_SOURCE_METHODS: SourceMethod[] = ['gdrive', 'direct', 'youtube', 'project_bundle'];
const VALID_STATUSES: PublishStatus[] = ['published', 'draft'];

function queryWorksWithJoins(whereClause: string, params: Array<string | number>, orderBy: string, limit?: number) {
  const limitSql = typeof limit === 'number' ? `LIMIT ${Math.max(1, Math.min(100, limit))}` : '';
  const sql = `
    SELECT w.*,
           c.name AS category_name,
           sc.name AS subcategory_name
    FROM work_items w
    LEFT JOIN categories c ON c.id = w.category_id
    LEFT JOIN categories sc ON sc.id = w.subcategory_id
    ${whereClause}
    ORDER BY ${orderBy}
    ${limitSql}
  `;
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map(mapWorkRow);
}

// ---------- Self-contained Sample Media Endpoints ----------
app.get('/api/samples/:filename', (req, res) => {
  const filename = path.basename(req.params.filename || '');
  if (filename.endsWith('.wav')) {
    const wav = getSampleWav(filename);
    if (!wav) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(wav.length));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(wav);
    return;
  }
  if (filename.endsWith('.pdf')) {
    const pdf = getSamplePdf(filename);
    if (!pdf) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.send(pdf);
    return;
  }
  res.status(404).send('Not found');
});

// ---------- Public Visitor Endpoints (Published Content Only) ----------
app.get('/api/public/bootstrap', (_req, res) => {
  const settings = getSettings();
  const categories = getCategoriesWithCounts(true);

  const latest = queryWorksWithJoins(
    `WHERE w.status = 'published' AND w.embed_status != 'blocked'`,
    [],
    'w.publish_date DESC, w.id DESC',
    8
  );
  const mostViewed = queryWorksWithJoins(
    `WHERE w.status = 'published' AND w.embed_status != 'blocked'`,
    [],
    'w.views_count DESC, w.id DESC',
    6
  );
  const featured = queryWorksWithJoins(
    `WHERE w.status = 'published' AND w.featured = 1 AND w.embed_status != 'blocked'`,
    [],
    'w.publish_date DESC, w.id DESC',
    6
  );
  const radioCorner = queryWorksWithJoins(
    `WHERE w.status = 'published' AND w.content_type = 'audio' AND w.embed_status != 'blocked'`,
    [],
    'w.publish_date DESC, w.id DESC',
    4
  );
  const artCorner = queryWorksWithJoins(
    `WHERE w.status = 'published' AND w.content_type = 'image' AND w.embed_status != 'blocked'`,
    [],
    'w.publish_date DESC, w.id DESC',
    6
  );
  const videoCorner = queryWorksWithJoins(
    `WHERE w.status = 'published' AND w.content_type = 'video' AND w.embed_status != 'blocked'`,
    [],
    'w.publish_date DESC, w.id DESC',
    4
  );
  const projectCorner = queryWorksWithJoins(
    `WHERE w.status = 'published' AND w.content_type IN ('project', 'presentation', 'pdf') AND w.embed_status != 'blocked'`,
    [],
    'w.publish_date DESC, w.id DESC',
    6
  );

  res.json({
    settings,
    categories,
    sections: {
      latest,
      mostViewed,
      featured,
      radioCorner,
      artCorner,
      videoCorner,
      projectCorner,
    },
  });
});

app.get('/api/public/works', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
  const contentType = typeof req.query.contentType === 'string' ? req.query.contentType.trim() : '';
  const gradeLevel = typeof req.query.gradeLevel === 'string' ? req.query.gradeLevel.trim() : '';
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'newest';

  const conditions: string[] = [`w.status = 'published'`, `w.embed_status != 'blocked'`];
  const params: Array<string | number> = [];

  if (q) {
    conditions.push(`(
      w.title LIKE ? OR
      w.description LIKE ? OR
      w.student_name LIKE ? OR
      w.keywords LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (categoryId && Number.isFinite(categoryId)) {
    conditions.push(`(w.category_id = ? OR w.subcategory_id = ?)`);
    params.push(categoryId, categoryId);
  }
  if (contentType && VALID_CONTENT_TYPES.includes(contentType as ContentType)) {
    conditions.push(`w.content_type = ?`);
    params.push(contentType);
  }
  if (gradeLevel) {
    conditions.push(`w.grade_level = ?`);
    params.push(gradeLevel);
  }
  if (dateFrom) {
    conditions.push(`w.publish_date >= ?`);
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`w.publish_date <= ?`);
    params.push(dateTo);
  }

  let orderBy = 'w.publish_date DESC, w.id DESC';
  if (sort === 'views') orderBy = 'w.views_count DESC, w.id DESC';
  else if (sort === 'oldest') orderBy = 'w.publish_date ASC, w.id ASC';

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const items = queryWorksWithJoins(whereClause, params, orderBy);
  res.json({ items });
});

app.get('/api/public/works/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'معرف الإنتاج غير صالح.' });
    return;
  }
  const items = queryWorksWithJoins(
    `WHERE w.id = ? AND w.status = 'published' AND w.embed_status != 'blocked'`,
    [id],
    'w.id DESC',
    1
  );
  if (!items.length) {
    res.status(404).json({ error: 'الإنتاج المطلوب غير متاح.' });
    return;
  }
  const item = items[0];
  const related = queryWorksWithJoins(
    `WHERE w.id != ? AND w.status = 'published' AND w.embed_status != 'blocked' AND (w.category_id = ? OR w.content_type = ?)`,
    [item.id, item.category_id, item.content_type],
    'w.views_count DESC, w.publish_date DESC',
    4
  );
  res.json({ item, related });
});

app.post('/api/public/works/:id/view', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }
  const result = db
    .prepare(`UPDATE work_items SET views_count = views_count + 1 WHERE id = ? AND status = 'published'`)
    .run(id);
  res.json({ ok: result.changes > 0 });
});

// ---------- Authentication Endpoints ----------
app.get('/api/auth/status', (req, res) => {
  const envConfigured = isEnvAdminConfigured();
  const hasDbAdmin = hasClaimedAdminUser();
  const needsSetup = !envConfigured && !hasDbAdmin;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const verified = verifyAdminToken(authHeader.slice(7).trim());
    if (verified.valid && verified.username) {
      res.json({
        needsSetup: false,
        authenticated: true,
        username: verified.username,
        envManaged: envConfigured,
      });
      return;
    }
  }

  res.json({
    needsSetup,
    authenticated: false,
    username: null,
    envManaged: envConfigured,
  });
});

app.post('/api/auth/setup', (req, res) => {
  if (isEnvAdminConfigured()) {
    res.status(409).json({ error: 'تم إعداد حساب المدير مسبقاً عبر إعدادات البيئة.' });
    return;
  }
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (username.length < 3 || username.length > 40) {
    res.status(400).json({ error: 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل.' });
    return;
  }
  if (password.length < 6 || password.length > 128) {
    res.status(400).json({ error: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.' });
    return;
  }

  const passwordHash = hashPassword(password);
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
    if (existing.count > 0) {
      db.exec('ROLLBACK');
      res.status(409).json({ error: 'تم إنشاء حساب المدير مسبقاً.' });
      return;
    }
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(
      username,
      passwordHash
    );
    db.exec('COMMIT');
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    res.status(500).json({ error: 'تعذر إتمام الإعداد الأولي لحساب المدير.' });
    return;
  }

  const token = createAdminSession(username);
  res.status(201).json({ token, username, envManaged: false });
});

app.post('/api/auth/login', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' });
    return;
  }

  if (isEnvAdminConfigured()) {
    const expectedUser = getEnvAdminUsername();
    const expectedPass = process.env.ADMIN_PASSWORD || '';
    if (safeTextCompare(username, expectedUser) && safeTextCompare(password, expectedPass)) {
      const token = createAdminSession(expectedUser);
      res.json({ token, username: expectedUser, envManaged: true });
      return;
    }
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    return;
  }

  const row = db
    .prepare('SELECT username, password_hash FROM admin_users WHERE username = ?')
    .get(username) as { username: string; password_hash: string } | undefined;

  if (!row || !verifyPasswordHash(password, row.password_hash)) {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    return;
  }

  const token = createAdminSession(row.username);
  res.json({ token, username: row.username, envManaged: false });
});

app.post('/api/auth/logout', requireAdmin, (req: AdminRequest, res) => {
  if (req.adminTokenId) {
    revokeAdminSession(req.adminTokenId);
  }
  res.json({ ok: true });
});

app.post('/api/auth/change-password', requireAdmin, (req: AdminRequest, res) => {
  if (isEnvAdminConfigured()) {
    res.status(400).json({
      error: 'بيانات المدير مضبوطة عبر متغيرات البيئة في الخادم ولا يمكن تعديلها من الواجهة.',
    });
    return;
  }
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newUsername = typeof req.body?.newUsername === 'string' ? req.body.newUsername.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  const currentUser = db
    .prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?')
    .get(req.adminUsername || '') as { id: number; username: string; password_hash: string } | undefined;

  if (!currentUser || !verifyPasswordHash(currentPassword, currentUser.password_hash)) {
    res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
    return;
  }

  const targetUsername = newUsername.length >= 3 ? newUsername : currentUser.username;
  if (newPassword && newPassword.length < 6) {
    res.status(400).json({ error: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل.' });
    return;
  }

  const nextHash = newPassword ? hashPassword(newPassword) : currentUser.password_hash;
  db.prepare(
    `UPDATE admin_users SET username = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(targetUsername, nextHash, currentUser.id);

  res.json({ ok: true, username: targetUsername });
});

// ---------- Protected Admin Endpoints ----------
app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const counts = db
    .prepare(`
      SELECT
        COUNT(*) AS total_items,
        SUM(CASE WHEN content_type = 'video' THEN 1 ELSE 0 END) AS total_videos,
        SUM(CASE WHEN content_type = 'audio' THEN 1 ELSE 0 END) AS total_audio,
        SUM(CASE WHEN content_type = 'image' THEN 1 ELSE 0 END) AS total_images,
        SUM(CASE WHEN content_type = 'project' THEN 1 ELSE 0 END) AS total_projects,
        SUM(CASE WHEN content_type = 'pdf' THEN 1 ELSE 0 END) AS total_pdfs,
        SUM(CASE WHEN content_type = 'presentation' THEN 1 ELSE 0 END) AS total_presentations,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
        COALESCE(SUM(views_count), 0) AS total_views
      FROM work_items
    `)
    .get() as Record<string, number>;

  const latestItems = queryWorksWithJoins('', [], 'w.created_at DESC, w.id DESC', 6);

  res.json({
    total_items: Number(counts.total_items || 0),
    total_videos: Number(counts.total_videos || 0),
    total_audio: Number(counts.total_audio || 0),
    total_images: Number(counts.total_images || 0),
    total_projects: Number(counts.total_projects || 0),
    total_pdfs: Number(counts.total_pdfs || 0),
    total_presentations: Number(counts.total_presentations || 0),
    published_count: Number(counts.published_count || 0),
    draft_count: Number(counts.draft_count || 0),
    total_views: Number(counts.total_views || 0),
    latest_items: latestItems,
  });
});

app.get('/api/admin/works', requireAdmin, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
  const contentType = typeof req.query.contentType === 'string' ? req.query.contentType.trim() : '';
  const gradeLevel = typeof req.query.gradeLevel === 'string' ? req.query.gradeLevel.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (q) {
    conditions.push(`(w.title LIKE ? OR w.student_name LIKE ? OR w.keywords LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (categoryId && Number.isFinite(categoryId)) {
    conditions.push(`(w.category_id = ? OR w.subcategory_id = ?)`);
    params.push(categoryId, categoryId);
  }
  if (contentType && VALID_CONTENT_TYPES.includes(contentType as ContentType)) {
    conditions.push(`w.content_type = ?`);
    params.push(contentType);
  }
  if (gradeLevel) {
    conditions.push(`w.grade_level = ?`);
    params.push(gradeLevel);
  }
  if (status && VALID_STATUSES.includes(status as PublishStatus)) {
    conditions.push(`w.status = ?`);
    params.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const items = queryWorksWithJoins(whereClause, params, 'w.created_at DESC, w.id DESC');
  res.json({ items });
});

app.get('/api/admin/works/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'معرف غير صالح.' });
    return;
  }
  const items = queryWorksWithJoins('WHERE w.id = ?', [id], 'w.id DESC', 1);
  if (!items.length) {
    res.status(404).json({ error: 'المحتوى غير موجود.' });
    return;
  }
  res.json({ item: items[0] });
});

app.post('/api/admin/inspect-link', requireAdmin, async (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const preferredMethod = VALID_SOURCE_METHODS.includes(req.body?.source_method)
    ? (req.body.source_method as SourceMethod)
    : undefined;
  const preferredType = VALID_CONTENT_TYPES.includes(req.body?.content_type)
    ? (req.body.content_type as ContentType)
    : undefined;

  if (!url) {
    res.status(400).json({ error: 'يرجى إدخال الرابط أولاً.' });
    return;
  }
  const result = await inspectExternalMediaUrl(url, preferredMethod, preferredType);
  res.json(result);
});

function sanitizeWorkPayload(body: Record<string, unknown>) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const studentName = typeof body.student_name === 'string' ? body.student_name.trim() : '';
  const gradeLevel = typeof body.grade_level === 'string' ? body.grade_level.trim() : '';
  const classSection = typeof body.class_section === 'string' ? body.class_section.trim() : '';
  const publishDate =
    typeof body.publish_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.publish_date.trim())
      ? body.publish_date.trim()
      : new Date().toISOString().slice(0, 10);

  const originalUrl = typeof body.original_url === 'string' ? body.original_url.trim() : '';
  const preferredMethod = VALID_SOURCE_METHODS.includes(body.source_method as SourceMethod)
    ? (body.source_method as SourceMethod)
    : 'direct';
  const preferredType = VALID_CONTENT_TYPES.includes(body.content_type as ContentType)
    ? (body.content_type as ContentType)
    : 'video';

  if (!title) return { error: 'يرجى كتابة عنوان الإنتاج.' } as const;
  if (!originalUrl || !isSafeUrl(originalUrl)) {
    return { error: 'يرجى إدخال رابط محتوى صالح (يبدأ بـ https:// أو http://).' } as const;
  }

  const parsed = parseMediaUrlClient(originalUrl, preferredMethod, preferredType);
  if (!parsed.valid) {
    return { error: parsed.error || 'تعذر معالجة الرابط المدخل.' } as const;
  }

  const contentType: ContentType = VALID_CONTENT_TYPES.includes(body.content_type as ContentType)
    ? (body.content_type as ContentType)
    : parsed.contentType;
  const sourceMethod: SourceMethod = VALID_SOURCE_METHODS.includes(body.source_method as SourceMethod)
    ? (body.source_method as SourceMethod)
    : parsed.sourceMethod;

  const embedUrl =
    typeof body.embed_url === 'string' && isSafeUrl(body.embed_url)
      ? body.embed_url.trim()
      : parsed.embedUrl;

  const thumbnailUrl =
    typeof body.thumbnail_url === 'string' && isSafeUrl(body.thumbnail_url)
      ? body.thumbnail_url.trim()
      : parsed.thumbnailUrl;

  const galleryUrlsRaw = Array.isArray(body.gallery_urls) ? body.gallery_urls : [];
  const galleryUrls = galleryUrlsRaw
    .filter((u): u is string => typeof u === 'string' && isSafeUrl(u))
    .map((u) => u.trim());

  const categoryId = Number(body.category_id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: 'يرجى اختيار التصنيف الرئيسي.' } as const;
  }
  const subcategoryId =
    body.subcategory_id !== null && body.subcategory_id !== undefined && body.subcategory_id !== ''
      ? Number(body.subcategory_id)
      : null;

  const keywords = typeof body.keywords === 'string' ? body.keywords.trim() : '';
  const status: PublishStatus = VALID_STATUSES.includes(body.status as PublishStatus)
    ? (body.status as PublishStatus)
    : 'draft';
  const featured = body.featured ? 1 : 0;
  const embedStatus =
    body.embed_status === 'warning' || body.embed_status === 'blocked' ? body.embed_status : 'ok';
  const embedNote = typeof body.embed_note === 'string' ? body.embed_note.trim() : '';

  return {
    data: {
      title,
      description,
      student_name: studentName,
      grade_level: gradeLevel,
      class_section: classSection,
      publish_date: publishDate,
      content_type: contentType,
      source_method: sourceMethod,
      original_url: originalUrl,
      embed_url: embedUrl,
      media_mime: typeof body.media_mime === 'string' ? body.media_mime : parsed.mediaMime,
      thumbnail_url: thumbnailUrl,
      gallery_urls: JSON.stringify(galleryUrls),
      category_id: categoryId,
      subcategory_id: subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : null,
      keywords,
      status,
      featured,
      embed_status: embedStatus,
      embed_note: embedNote,
    },
  } as const;
}

app.post('/api/admin/works', requireAdmin, (req, res) => {
  const parsed = sanitizeWorkPayload((req.body || {}) as Record<string, unknown>);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const d = parsed.data;
  const result = db
    .prepare(`
      INSERT INTO work_items (
        title, description, student_name, grade_level, class_section, publish_date,
        content_type, source_method, original_url, embed_url, media_mime,
        thumbnail_url, gallery_urls, category_id, subcategory_id, keywords,
        status, featured, embed_status, embed_note, is_sample
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `)
    .run(
      d.title,
      d.description,
      d.student_name,
      d.grade_level,
      d.class_section,
      d.publish_date,
      d.content_type,
      d.source_method,
      d.original_url,
      d.embed_url,
      d.media_mime,
      d.thumbnail_url,
      d.gallery_urls,
      d.category_id,
      d.subcategory_id,
      d.keywords,
      d.status,
      d.featured,
      d.embed_status,
      d.embed_note
    );

  const created = queryWorksWithJoins('WHERE w.id = ?', [Number(result.lastInsertRowid)], 'w.id DESC', 1)[0];
  res.status(201).json({ item: created });
});

app.put('/api/admin/works/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'معرف غير صالح.' });
    return;
  }
  const parsed = sanitizeWorkPayload((req.body || {}) as Record<string, unknown>);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const d = parsed.data;
  const result = db
    .prepare(`
      UPDATE work_items SET
        title = ?, description = ?, student_name = ?, grade_level = ?, class_section = ?,
        publish_date = ?, content_type = ?, source_method = ?, original_url = ?,
        embed_url = ?, media_mime = ?, thumbnail_url = ?, gallery_urls = ?,
        category_id = ?, subcategory_id = ?, keywords = ?, status = ?, featured = ?,
        embed_status = ?, embed_note = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    .run(
      d.title,
      d.description,
      d.student_name,
      d.grade_level,
      d.class_section,
      d.publish_date,
      d.content_type,
      d.source_method,
      d.original_url,
      d.embed_url,
      d.media_mime,
      d.thumbnail_url,
      d.gallery_urls,
      d.category_id,
      d.subcategory_id,
      d.keywords,
      d.status,
      d.featured,
      d.embed_status,
      d.embed_note,
      id
    );

  if (result.changes === 0) {
    res.status(404).json({ error: 'المحتوى غير موجود.' });
    return;
  }
  const updated = queryWorksWithJoins('WHERE w.id = ?', [id], 'w.id DESC', 1)[0];
  res.json({ item: updated });
});

app.patch('/api/admin/works/:id/status', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isInteger(id) || id <= 0 || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'بيانات الحالة غير صالحة.' });
    return;
  }
  const result = db
    .prepare(`UPDATE work_items SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'المحتوى غير موجود.' });
    return;
  }
  const updated = queryWorksWithJoins('WHERE w.id = ?', [id], 'w.id DESC', 1)[0];
  res.json({ item: updated });
});

app.delete('/api/admin/works/samples', requireAdmin, (_req, res) => {
  const result = db.prepare('DELETE FROM work_items WHERE is_sample = 1').run();
  res.json({ deleted: Number(result.changes || 0) });
});

app.delete('/api/admin/works/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'معرف غير صالح.' });
    return;
  }
  const result = db.prepare('DELETE FROM work_items WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'المحتوى غير موجود.' });
    return;
  }
  res.json({ ok: true });
});

// ---------- Admin Categories ----------
app.get('/api/admin/categories', requireAdmin, (_req, res) => {
  res.json({ categories: getCategoriesWithCounts(false) });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const parentId =
    req.body?.parent_id !== null && req.body?.parent_id !== undefined && req.body?.parent_id !== ''
      ? Number(req.body.parent_id)
      : null;

  if (!name) {
    res.status(400).json({ error: 'يرجى إدخال اسم التصنيف.' });
    return;
  }

  const slug = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM categories').get() as { m: number };
  const result = db
    .prepare('INSERT INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(name, slug, parentId, description, Number(maxOrder.m) + 1);

  res.status(201).json({
    id: Number(result.lastInsertRowid),
    categories: getCategoriesWithCounts(false),
  });
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

  if (!Number.isInteger(id) || id <= 0 || !name) {
    res.status(400).json({ error: 'يرجى إدخال اسم تصنيف صالح.' });
    return;
  }

  const result = db
    .prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?')
    .run(name, description, id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'التصنيف غير موجود.' });
    return;
  }
  res.json({ categories: getCategoriesWithCounts(false) });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'معرف غير صالح.' });
    return;
  }
  const usage = db
    .prepare('SELECT COUNT(*) as c FROM work_items WHERE category_id = ?')
    .get(id) as { c: number };
  if (usage.c > 0) {
    res.status(409).json({
      error: 'لا يمكن حذف تصنيف يحتوي على إنتاجات مرتبطة به. يرجى نقل الإنتاجات أولاً.',
    });
    return;
  }
  db.prepare('UPDATE work_items SET subcategory_id = NULL WHERE subcategory_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ categories: getCategoriesWithCounts(false) });
});

// ---------- Admin Settings ----------
app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json({ settings: getSettings() });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const allowedKeys = [
    'school_name',
    'platform_title',
    'platform_tagline',
    'hero_cover_url',
    'logo_url',
    'academic_year',
    'footer_note',
  ] as const;

  const upsert = db.prepare(
    'INSERT INTO platform_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  for (const key of allowedKeys) {
    const val = req.body?.[key];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if ((key === 'hero_cover_url' || key === 'logo_url') && trimmed && !isSafeUrl(trimmed)) {
        res.status(400).json({ error: `الرابط المدخل للحقل ${key} غير صالح.` });
        return;
      }
      upsert.run(key, trimmed);
    }
  }

  res.json({ settings: getSettings() });
});

// ---------- Vite / Production Static Setup ----------
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
