import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import {
  db,
  getCategoriesWithCounts,
  getPublicSiteStats,
  getSettings,
  initDatabase,
  mapWorkRow,
} from './server/db.ts';
import { getSamplePdf, getSampleWav } from './server/samples.ts';
import {
  createAdminSession,
  getAdminUserByUsername,
  getEnvAdminUsername,
  hasClaimedAdminUser,
  hashPassword,
  inspectExternalMediaUrl,
  isEnvAdminConfigured,
  parseStoredPermissions,
  requireAdmin,
  requirePermission,
  revokeAdminSession,
  safeTextCompare,
  sanitizePermissions,
  verifyAdminToken,
  verifyPasswordHash,
} from './server/security.ts';
import type { AdminRequest } from './server/security.ts';
import { isSafeUrl, normalizeImageUrl, parseMediaUrlClient } from './src/lib/mediaUtils.ts';
import { ALL_ADMIN_PERMISSIONS, SETTING_KEYS } from './src/lib/settingsDefaults.ts';
import { isSafeBackgroundValue, normalizeBackgroundValue } from './src/lib/themePresets.ts';
import type { AdminUserSummary, ContentType, ExtraMediaItem, PublishStatus, SourceMethod } from './src/types.ts';

initDatabase();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '5mb' }));

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
const CUSTOM_WORK_ORDER_SQL =
  'CASE WHEN w.sort_order > 0 THEN 0 ELSE 1 END ASC, w.sort_order ASC, w.publish_date DESC, w.id DESC';

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

function getCategoryTreeIds(categoryId: number): number[] {
  const children = db
    .prepare('SELECT id FROM categories WHERE parent_id = ?')
    .all(categoryId) as Array<{ id: number }>;
  return Array.from(new Set([categoryId, ...children.map((c) => Number(c.id))]));
}

function buildCategoryFilterSql(categoryIds: number[]): { sql: string; params: number[] } {
  const uniqueIds = Array.from(new Set(categoryIds.filter((n) => Number.isInteger(n) && n > 0)));
  if (uniqueIds.length === 0) return { sql: '1 = 0', params: [] };
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const sql = `(
    w.category_id IN (${placeholders})
    OR w.subcategory_id IN (${placeholders})
    OR (json_valid(w.extra_category_ids) AND EXISTS (
      SELECT 1 FROM json_each(w.extra_category_ids)
      WHERE CAST(value AS INTEGER) IN (${placeholders})
    ))
  )`;
  return { sql, params: [...uniqueIds, ...uniqueIds, ...uniqueIds] };
}

function getCornerCategoryIds(matchType: 'audio' | 'art' | 'video' | 'project'): number[] {
  const cats = db.prepare('SELECT id, slug, name, parent_id FROM categories').all() as Array<{
    id: number;
    slug: string;
    name: string;
    parent_id: number | null;
  }>;
  const mains = cats.filter((c) => c.parent_id === null);
  let targetRoots: number[] = [];
  if (matchType === 'audio') {
    const m = mains.find((c) => c.slug === 'audio-radio') || mains.find((c) => /إذاعة|صوت/.test(c.name));
    if (m) targetRoots = [Number(m.id)];
  } else if (matchType === 'art') {
    const m = mains.find((c) => c.slug === 'arts-photos') || mains.find((c) => /فنون|تشكيلية|صور/.test(c.name));
    if (m) targetRoots = [Number(m.id)];
  } else if (matchType === 'video') {
    const m = mains.find((c) => c.slug === 'videos') || mains.find((c) => /فيديو/.test(c.name));
    if (m) targetRoots = [Number(m.id)];
  } else if (matchType === 'project') {
    targetRoots = mains
      .filter((c) => c.slug === 'projects' || c.slug === 'research-presentations' || /مشاريع|ابتكار|عروض|بحوث/.test(c.name))
      .map((c) => Number(c.id));
  }
  if (targetRoots.length === 0) return [];
  const rootSet = new Set(targetRoots);
  const allIds = [...targetRoots];
  for (const c of cats) {
    if (c.parent_id && rootSet.has(Number(c.parent_id))) {
      allIds.push(Number(c.id));
    }
  }
  return allIds;
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
    CUSTOM_WORK_ORDER_SQL,
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
    CUSTOM_WORK_ORDER_SQL,
    6
  );
  const radioIds = getCornerCategoryIds('audio');
  const radioFilter = buildCategoryFilterSql(radioIds);
  const radioCorner = radioIds.length
    ? queryWorksWithJoins(
        `WHERE w.status = 'published' AND w.embed_status != 'blocked' AND ${radioFilter.sql}`,
        radioFilter.params,
        CUSTOM_WORK_ORDER_SQL,
        4
      )
    : [];

  const artIds = getCornerCategoryIds('art');
  const artFilter = buildCategoryFilterSql(artIds);
  const artCorner = artIds.length
    ? queryWorksWithJoins(
        `WHERE w.status = 'published' AND w.embed_status != 'blocked' AND ${artFilter.sql}`,
        artFilter.params,
        CUSTOM_WORK_ORDER_SQL,
        6
      )
    : [];

  const videoIds = getCornerCategoryIds('video');
  const videoFilter = buildCategoryFilterSql(videoIds);
  const videoCorner = videoIds.length
    ? queryWorksWithJoins(
        `WHERE w.status = 'published' AND w.embed_status != 'blocked' AND ${videoFilter.sql}`,
        videoFilter.params,
        CUSTOM_WORK_ORDER_SQL,
        4
      )
    : [];

  const projectIds = getCornerCategoryIds('project');
  const projectFilter = buildCategoryFilterSql(projectIds);
  const projectCorner = projectIds.length
    ? queryWorksWithJoins(
        `WHERE w.status = 'published' AND w.embed_status != 'blocked' AND ${projectFilter.sql}`,
        projectFilter.params,
        CUSTOM_WORK_ORDER_SQL,
        6
      )
    : [];

  const siteStats = getPublicSiteStats();

  res.json({
    settings,
    categories,
    siteStats,
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

app.post('/api/public/visit', (req, res) => {
  const pathVal = typeof req.body?.path === 'string' ? req.body.path.slice(0, 120) : '/';
  const visitorHash =
    typeof req.body?.visitor_id === 'string' ? req.body.visitor_id.trim().slice(0, 64) : '';
  db.prepare(`INSERT INTO platform_visits (visit_date, path, visitor_hash) VALUES (date('now'), ?, ?)`).run(
    pathVal,
    visitorHash
  );
  res.json({ ok: true, siteStats: getPublicSiteStats() });
});

app.get('/api/public/works', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
  const contentType = typeof req.query.contentType === 'string' ? req.query.contentType.trim() : '';
  const gradeLevel = typeof req.query.gradeLevel === 'string' ? req.query.gradeLevel.trim() : '';
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'custom';

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
    const catFilter = buildCategoryFilterSql(getCategoryTreeIds(categoryId));
    conditions.push(catFilter.sql);
    params.push(...catFilter.params);
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

  let orderBy = CUSTOM_WORK_ORDER_SQL;
  if (sort === 'newest') orderBy = 'w.publish_date DESC, w.id DESC';
  else if (sort === 'views') orderBy = 'w.views_count DESC, w.id DESC';
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
  const relIds = [item.category_id, ...(item.subcategory_id ? [item.subcategory_id] : []), ...item.extra_category_ids];
  const relFilter = buildCategoryFilterSql(relIds);
  const related = queryWorksWithJoins(
    `WHERE w.id != ? AND w.status = 'published' AND w.embed_status != 'blocked' AND ${relFilter.sql}`,
    [item.id, ...relFilter.params],
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
  const row = db
    .prepare('SELECT views_count FROM work_items WHERE id = ?')
    .get(id) as { views_count: number } | undefined;
  res.json({ ok: result.changes > 0, views_count: Number(row?.views_count || 0) });
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
      if (envConfigured) {
        res.json({
          needsSetup: false,
          authenticated: true,
          username: verified.username,
          displayName: verified.username,
          permissions: [...ALL_ADMIN_PERMISSIONS],
          isPrimary: true,
          envManaged: true,
        });
        return;
      }
      const user = getAdminUserByUsername(verified.username);
      if (user && user.is_active) {
        res.json({
          needsSetup: false,
          authenticated: true,
          username: user.username,
          displayName: user.display_name || user.username,
          permissions: parseStoredPermissions(user.permissions_json, Boolean(user.is_primary)),
          isPrimary: Boolean(user.is_primary),
          envManaged: false,
        });
        return;
      }
    }
  }

  res.json({
    needsSetup,
    authenticated: false,
    username: null,
    permissions: [],
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
  const allPermsJson = JSON.stringify([...ALL_ADMIN_PERMISSIONS]);
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
    if (existing.count > 0) {
      db.exec('ROLLBACK');
      res.status(409).json({ error: 'تم إنشاء حساب المدير مسبقاً.' });
      return;
    }
    db.prepare(
      'INSERT INTO admin_users (username, password_hash, display_name, permissions_json, is_active, is_primary) VALUES (?, ?, ?, ?, 1, 1)'
    ).run(username, passwordHash, username, allPermsJson);
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
  res.status(201).json({
    token,
    username,
    displayName: username,
    permissions: [...ALL_ADMIN_PERMISSIONS],
    isPrimary: true,
    envManaged: false,
  });
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
      res.json({
        token,
        username: expectedUser,
        displayName: expectedUser,
        permissions: [...ALL_ADMIN_PERMISSIONS],
        isPrimary: true,
        envManaged: true,
      });
      return;
    }
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    return;
  }

  const row = getAdminUserByUsername(username);
  if (!row || !verifyPasswordHash(password, row.password_hash)) {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    return;
  }
  if (!row.is_active) {
    res.status(403).json({ error: 'هذا الحساب معطل حالياً. يرجى التواصل مع المدير العام للمنصة.' });
    return;
  }

  const permissions = parseStoredPermissions(row.permissions_json, Boolean(row.is_primary));
  const token = createAdminSession(row.username);
  res.json({
    token,
    username: row.username,
    displayName: row.display_name || row.username,
    permissions,
    isPrimary: Boolean(row.is_primary),
    envManaged: false,
  });
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

  const currentUser = getAdminUserByUsername(req.adminUsername || '');
  if (!currentUser || !verifyPasswordHash(currentPassword, currentUser.password_hash)) {
    res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
    return;
  }

  const targetUsername = newUsername.length >= 3 ? newUsername : currentUser.username;
  if (newUsername && (newUsername.length < 3 || newUsername.length > 40)) {
    res.status(400).json({ error: 'يجب أن يتكون اسم المستخدم من 3 إلى 40 حرفاً.' });
    return;
  }
  if (newPassword && (newPassword.length < 6 || newPassword.length > 128)) {
    res.status(400).json({ error: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل.' });
    return;
  }

  if (targetUsername !== currentUser.username && getAdminUserByUsername(targetUsername)) {
    res.status(409).json({ error: 'اسم المستخدم الجديد مستخدم بالفعل.' });
    return;
  }

  const nextHash = newPassword ? hashPassword(newPassword) : currentUser.password_hash;
  db.prepare(
    `UPDATE admin_users SET username = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(targetUsername, nextHash, currentUser.id);
  if (targetUsername !== currentUser.username) {
    db.prepare(`UPDATE admin_sessions SET username = ? WHERE username = ?`).run(
      targetUsername,
      currentUser.username
    );
  }

  res.json({
    ok: true,
    username: targetUsername,
    displayName: currentUser.display_name || targetUsername,
    permissions: parseStoredPermissions(currentUser.permissions_json, Boolean(currentUser.is_primary)),
    isPrimary: Boolean(currentUser.is_primary),
  });
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
  const siteStats = getPublicSiteStats();

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
    total_site_visits: siteStats.total_site_visits,
    today_site_visits: siteStats.today_site_visits,
    unique_visitors: siteStats.unique_visitors,
    latest_items: latestItems,
  });
});

app.post('/api/admin/stats/reset', requirePermission('manage_settings'), (_req, res) => {
  db.prepare('DELETE FROM platform_visits').run();
  db.prepare('UPDATE work_items SET views_count = 0').run();
  res.json({ ok: true });
});

// ---------- Admin Multi-User Management ----------
function listAdminUserSummaries(): AdminUserSummary[] {
  const rows = db
    .prepare(
      'SELECT id, username, display_name, permissions_json, is_active, is_primary, created_at, updated_at FROM admin_users ORDER BY is_primary DESC, id ASC'
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: Number(r.id),
    username: String(r.username),
    display_name: String(r.display_name || r.username),
    permissions: parseStoredPermissions(String(r.permissions_json || '[]'), Boolean(r.is_primary)),
    is_active: Boolean(r.is_active),
    is_primary: Boolean(r.is_primary),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  }));
}

app.get('/api/admin/users', requirePermission('manage_users'), (_req, res) => {
  res.json({ users: listAdminUserSummaries(), envManaged: isEnvAdminConfigured() });
});

app.post('/api/admin/users', requirePermission('manage_users'), (req, res) => {
  if (isEnvAdminConfigured()) {
    res.status(400).json({ error: 'إدارة المستخدمين غير متاحة عند ضبط الحساب عبر متغيرات البيئة.' });
    return;
  }
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const displayName =
    typeof req.body?.display_name === 'string' ? req.body.display_name.trim().slice(0, 80) : '';
  const permissions = sanitizePermissions(req.body?.permissions);
  const isActive = req.body?.is_active !== false;

  if (username.length < 3 || username.length > 40) {
    res.status(400).json({ error: 'يجب أن يتكون اسم المستخدم من 3 إلى 40 حرفاً.' });
    return;
  }
  if (password.length < 6 || password.length > 128) {
    res.status(400).json({ error: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.' });
    return;
  }
  if (permissions.length === 0) {
    res.status(400).json({ error: 'يرجى تحديد مهمة واحدة على الأقل للمستخدم الجديد.' });
    return;
  }
  if (getAdminUserByUsername(username)) {
    res.status(409).json({ error: 'اسم المستخدم مسجل مسبقاً. اختر اسماً آخر.' });
    return;
  }

  const hash = hashPassword(password);
  db.prepare(
    `INSERT INTO admin_users (username, password_hash, display_name, permissions_json, is_active, is_primary)
     VALUES (?, ?, ?, ?, ?, 0)`
  ).run(username, hash, displayName || username, JSON.stringify(permissions), isActive ? 1 : 0);

  res.status(201).json({ users: listAdminUserSummaries() });
});

app.put('/api/admin/users/:id', requirePermission('manage_users'), (req: AdminRequest, res) => {
  if (isEnvAdminConfigured()) {
    res.status(400).json({ error: 'إدارة المستخدمين غير متاحة عند ضبط الحساب عبر متغيرات البيئة.' });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'معرف المستخدم غير صالح.' });
    return;
  }
  const existing = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as
    | {
        id: number;
        username: string;
        password_hash: string;
        display_name: string;
        permissions_json: string;
        is_active: number;
        is_primary: number;
      }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'المستخدم غير موجود.' });
    return;
  }

  const nextDisplayName =
    typeof req.body?.display_name === 'string'
      ? req.body.display_name.trim().slice(0, 80) || existing.username
      : existing.display_name;
  const nextPassword = typeof req.body?.password === 'string' ? req.body.password : '';
  const nextActive = req.body?.is_active !== undefined ? Boolean(req.body.is_active) : Boolean(existing.is_active);
  const nextPermissions =
    existing.is_primary === 1
      ? [...ALL_ADMIN_PERMISSIONS]
      : req.body?.permissions !== undefined
        ? sanitizePermissions(req.body.permissions)
        : parseStoredPermissions(existing.permissions_json, false);

  if (existing.is_primary === 1 && !nextActive) {
    res.status(400).json({ error: 'لا يمكن تعطيل حساب المدير الرئيسي للمنصة.' });
    return;
  }
  if (existing.username === req.adminUsername && (!nextActive || !nextPermissions.includes('manage_users'))) {
    res.status(400).json({ error: 'لا يمكنك إزالة صلاحية إدارة المستخدمين أو تعطيل حسابك الحالي.' });
    return;
  }
  if (nextPermissions.length === 0) {
    res.status(400).json({ error: 'يجب تحديد مهمة واحدة على الأقل للمستخدم.' });
    return;
  }
  if (nextPassword && (nextPassword.length < 6 || nextPassword.length > 128)) {
    res.status(400).json({ error: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل.' });
    return;
  }

  const nextHash = nextPassword ? hashPassword(nextPassword) : existing.password_hash;
  db.prepare(
    `UPDATE admin_users
     SET display_name = ?, password_hash = ?, permissions_json = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(nextDisplayName, nextHash, JSON.stringify(nextPermissions), nextActive ? 1 : 0, id);

  if (!nextActive) {
    db.prepare('DELETE FROM admin_sessions WHERE username = ?').run(existing.username);
  }

  res.json({ users: listAdminUserSummaries() });
});

app.delete('/api/admin/users/:id', requirePermission('manage_users'), (req: AdminRequest, res) => {
  if (isEnvAdminConfigured()) {
    res.status(400).json({ error: 'إدارة المستخدمين غير متاحة عند ضبط الحساب عبر متغيرات البيئة.' });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'معرف المستخدم غير صالح.' });
    return;
  }
  const existing = db
    .prepare('SELECT id, username, is_primary FROM admin_users WHERE id = ?')
    .get(id) as { id: number; username: string; is_primary: number } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'المستخدم غير موجود.' });
    return;
  }
  if (existing.is_primary) {
    res.status(400).json({ error: 'لا يمكن حذف حساب المدير الرئيسي للمنصة.' });
    return;
  }
  if (existing.username === req.adminUsername) {
    res.status(400).json({ error: 'لا يمكنك حذف حسابك أثناء تسجيل الدخول به.' });
    return;
  }

  db.prepare('DELETE FROM admin_sessions WHERE username = ?').run(existing.username);
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
  res.json({ users: listAdminUserSummaries() });
});

app.get('/api/admin/works', requirePermission('manage_works'), (req, res) => {
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
    const catFilter = buildCategoryFilterSql(getCategoryTreeIds(categoryId));
    conditions.push(catFilter.sql);
    params.push(...catFilter.params);
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
  const items = queryWorksWithJoins(whereClause, params, CUSTOM_WORK_ORDER_SQL);
  res.json({ items });
});

app.get('/api/admin/works/:id', requirePermission('manage_works'), (req, res) => {
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

app.post('/api/admin/inspect-link', requirePermission('manage_works'), async (req, res) => {
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
      ? normalizeImageUrl(body.thumbnail_url)
      : parsed.thumbnailUrl;

  const galleryUrlsRaw = Array.isArray(body.gallery_urls) ? body.gallery_urls : [];
  const galleryUrls = galleryUrlsRaw
    .filter((u): u is string => typeof u === 'string' && isSafeUrl(u))
    .map((u) => normalizeImageUrl(u));

  const extraMediaRaw = Array.isArray(body.extra_media) ? body.extra_media : [];
  const extraMedia: ExtraMediaItem[] = [];
  for (const rawEntry of extraMediaRaw) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as Record<string, unknown>;
    const rawUrl = typeof entry.original_url === 'string' ? entry.original_url.trim() : '';
    if (!rawUrl || !isSafeUrl(rawUrl)) continue;
    const eMethod = VALID_SOURCE_METHODS.includes(entry.source_method as SourceMethod)
      ? (entry.source_method as SourceMethod)
      : undefined;
    const eType = VALID_CONTENT_TYPES.includes(entry.content_type as ContentType)
      ? (entry.content_type as ContentType)
      : undefined;
    const eParsed = parseMediaUrlClient(rawUrl, eMethod, eType);
    if (!eParsed.valid) continue;
    extraMedia.push({
      title: typeof entry.title === 'string' ? entry.title.trim().slice(0, 140) : '',
      content_type: eType || eParsed.contentType,
      source_method: eMethod && eMethod !== 'project_bundle' ? eMethod : eParsed.sourceMethod,
      original_url: rawUrl,
      embed_url:
        typeof entry.embed_url === 'string' && isSafeUrl(entry.embed_url)
          ? entry.embed_url.trim()
          : eParsed.embedUrl,
      media_mime: eParsed.mediaMime,
    });
  }

  const categoryId = Number(body.category_id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: 'يرجى اختيار التصنيف الرئيسي.' } as const;
  }
  const subcategoryId =
    body.subcategory_id !== null && body.subcategory_id !== undefined && body.subcategory_id !== ''
      ? Number(body.subcategory_id)
      : null;

  const validSubId = subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : null;
  const extraCategoryIdsRaw = Array.isArray(body.extra_category_ids) ? body.extra_category_ids : [];
  const extraCategoryIds = Array.from(
    new Set(
      extraCategoryIdsRaw
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0 && n !== categoryId && n !== validSubId)
    )
  );

  const keywords = typeof body.keywords === 'string' ? body.keywords.trim() : '';
  const status: PublishStatus = VALID_STATUSES.includes(body.status as PublishStatus)
    ? (body.status as PublishStatus)
    : 'draft';
  const featured = body.featured ? 1 : 0;
  const embedStatus =
    body.embed_status === 'warning' || body.embed_status === 'blocked' ? body.embed_status : 'ok';
  const embedNote = typeof body.embed_note === 'string' ? body.embed_note.trim() : '';
  const rawOrder = Number(body.sort_order);
  const sortOrder =
    body.sort_order !== undefined &&
    body.sort_order !== null &&
    body.sort_order !== '' &&
    Number.isFinite(rawOrder) &&
    rawOrder >= 0
      ? Math.floor(rawOrder)
      : 0;

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
      extra_media: JSON.stringify(extraMedia),
      category_id: categoryId,
      subcategory_id: validSubId,
      extra_category_ids: JSON.stringify(extraCategoryIds),
      keywords,
      status,
      featured,
      embed_status: embedStatus,
      embed_note: embedNote,
      sort_order: sortOrder,
    },
  } as const;
}

app.put('/api/admin/works/reorder', requirePermission('manage_works'), (req, res) => {
  const orders = Array.isArray(req.body?.orders) ? req.body.orders : null;
  if (!orders || orders.length === 0) {
    res.status(400).json({ error: 'بيانات الترتيب غير صالحة.' });
    return;
  }

  const validEntries: Array<{ id: number; sort_order: number }> = [];
  for (const entry of orders) {
    const id = Number((entry as { id?: unknown })?.id);
    const sortOrder = Number((entry as { sort_order?: unknown })?.sort_order);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(sortOrder) || sortOrder < 0) {
      res.status(400).json({ error: 'أرقام الترتيب غير صالحة.' });
      return;
    }
    validEntries.push({ id, sort_order: Math.floor(sortOrder) });
  }

  try {
    db.exec('BEGIN IMMEDIATE');
    const upd = db.prepare(`UPDATE work_items SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`);
    for (const item of validEntries) {
      upd.run(item.sort_order, item.id);
    }
    db.exec('COMMIT');
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    res.status(500).json({ error: 'تعذر حفظ الترتيب الجديد.' });
    return;
  }

  res.json({ ok: true });
});

app.post('/api/admin/works/bulk', requirePermission('manage_works'), (req, res) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!rawItems || rawItems.length === 0) {
    res.status(400).json({ error: 'يرجى إرسال قائمة مشاريع صالحة للاستيراد.' });
    return;
  }
  if (rawItems.length > 100) {
    res.status(400).json({ error: 'الحد الأقصى للاستيراد في الدفعة الواحدة هو 100 موضوع.' });
    return;
  }

  const prepared: Array<ReturnType<typeof sanitizeWorkPayload> & { data: NonNullable<unknown> }> = [];
  for (let i = 0; i < rawItems.length; i++) {
    const parsed = sanitizeWorkPayload((rawItems[i] || {}) as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: `السطر رقم ${i + 1}: ${parsed.error}` });
      return;
    }
    prepared.push(parsed as ReturnType<typeof sanitizeWorkPayload> & { data: NonNullable<unknown> });
  }

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM work_items')
    .get() as { m: number };
  let nextOrder = Number(maxOrderRow?.m || 0) + 1;

  const insertStmt = db.prepare(`
    INSERT INTO work_items (
      title, description, student_name, grade_level, class_section, publish_date,
      content_type, source_method, original_url, embed_url, media_mime,
      thumbnail_url, gallery_urls, extra_media, category_id, subcategory_id, extra_category_ids, keywords,
      status, featured, embed_status, embed_note, sort_order, is_sample
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  try {
    db.exec('BEGIN IMMEDIATE');
    for (const entry of prepared) {
      if (!('data' in entry)) continue;
      const d = entry.data;
      const effectiveOrder = d.sort_order > 0 ? d.sort_order : nextOrder++;
      insertStmt.run(
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
        d.extra_media,
        d.category_id,
        d.subcategory_id,
        d.extra_category_ids,
        d.keywords,
        d.status,
        d.featured,
        d.embed_status,
        d.embed_note,
        effectiveOrder
      );
    }
    db.exec('COMMIT');
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    res.status(500).json({ error: 'تعذر حفظ الدفعة في قاعدة البيانات. تحقق من التصنيفات المختارة.' });
    return;
  }

  res.status(201).json({ inserted: prepared.length });
});

app.post('/api/admin/works', requirePermission('manage_works'), (req, res) => {
  const parsed = sanitizeWorkPayload((req.body || {}) as Record<string, unknown>);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const d = parsed.data;
  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM work_items')
    .get() as { m: number };
  const effectiveOrder = d.sort_order > 0 ? d.sort_order : Number(maxOrderRow?.m || 0) + 1;

  const result = db
    .prepare(`
      INSERT INTO work_items (
        title, description, student_name, grade_level, class_section, publish_date,
        content_type, source_method, original_url, embed_url, media_mime,
        thumbnail_url, gallery_urls, extra_media, category_id, subcategory_id, extra_category_ids, keywords,
        status, featured, embed_status, embed_note, sort_order, is_sample
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
      d.extra_media,
      d.category_id,
      d.subcategory_id,
      d.extra_category_ids,
      d.keywords,
      d.status,
      d.featured,
      d.embed_status,
      d.embed_note,
      effectiveOrder
    );

  const created = queryWorksWithJoins('WHERE w.id = ?', [Number(result.lastInsertRowid)], 'w.id DESC', 1)[0];
  res.status(201).json({ item: created });
});

app.put('/api/admin/works/:id', requirePermission('manage_works'), (req, res) => {
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
        embed_url = ?, media_mime = ?, thumbnail_url = ?, gallery_urls = ?, extra_media = ?,
        category_id = ?, subcategory_id = ?, extra_category_ids = ?, keywords = ?, status = ?, featured = ?,
        embed_status = ?, embed_note = ?, sort_order = ?, updated_at = datetime('now')
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
      d.extra_media,
      d.category_id,
      d.subcategory_id,
      d.extra_category_ids,
      d.keywords,
      d.status,
      d.featured,
      d.embed_status,
      d.embed_note,
      d.sort_order,
      id
    );

  if (result.changes === 0) {
    res.status(404).json({ error: 'المحتوى غير موجود.' });
    return;
  }
  const updated = queryWorksWithJoins('WHERE w.id = ?', [id], 'w.id DESC', 1)[0];
  res.json({ item: updated });
});

app.patch('/api/admin/works/:id/status', requirePermission('manage_works'), (req, res) => {
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

app.delete('/api/admin/works/samples', requirePermission('delete_works'), (_req, res) => {
  const result = db.prepare('DELETE FROM work_items WHERE is_sample = 1').run();
  res.json({ deleted: Number(result.changes || 0) });
});

app.delete('/api/admin/works/:id', requirePermission('delete_works'), (req, res) => {
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

app.post('/api/admin/categories', requirePermission('manage_categories'), (req, res) => {
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

app.put('/api/admin/categories/:id', requirePermission('manage_categories'), (req, res) => {
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

app.delete('/api/admin/categories/:id', requirePermission('manage_categories'), (req, res) => {
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
  const removedIds = new Set(getCategoryTreeIds(id));
  const worksWithExtras = db
    .prepare(`SELECT id, extra_category_ids FROM work_items WHERE extra_category_ids != '[]'`)
    .all() as Array<{ id: number; extra_category_ids: string }>;
  const updExtras = db.prepare(`UPDATE work_items SET extra_category_ids = ? WHERE id = ?`);
  for (const w of worksWithExtras) {
    try {
      const parsed = JSON.parse(w.extra_category_ids);
      if (Array.isArray(parsed)) {
        const filtered = parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0 && !removedIds.has(n));
        if (filtered.length !== parsed.length) {
          updExtras.run(JSON.stringify(filtered), w.id);
        }
      }
    } catch {
      // ignore
    }
  }
  db.prepare('UPDATE work_items SET subcategory_id = NULL WHERE subcategory_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ categories: getCategoriesWithCounts(false) });
});

// ---------- Admin Settings ----------
app.get('/api/admin/settings', requirePermission('manage_settings'), (_req, res) => {
  res.json({ settings: getSettings() });
});

app.put('/api/admin/settings', requirePermission('manage_settings'), (req, res) => {
  const upsert = db.prepare(
    'INSERT INTO platform_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  for (const key of SETTING_KEYS) {
    const val = req.body?.[key];
    if (typeof val === 'string') {
      let trimmed = val.trim();
      if ((key === 'hero_cover_url' || key === 'logo_url') && trimmed) {
        if (!isSafeUrl(trimmed)) {
          res.status(400).json({ error: `الرابط المدخل للحقل ${key} غير صالح.` });
          return;
        }
        trimmed = normalizeImageUrl(trimmed);
      }
      if (key.startsWith('bg_') && trimmed) {
        if (!isSafeBackgroundValue(trimmed)) {
          res.status(400).json({ error: `قيمة الخلفية للحقل ${key} غير صالحة.` });
          return;
        }
        trimmed = normalizeBackgroundValue(trimmed);
      }
      if (key === 'primary_color' && trimmed && !/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
        res.status(400).json({ error: 'صيغة اللون الأساسي غير صالحة.' });
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
