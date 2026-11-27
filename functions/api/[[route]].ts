import {
  detectDirectFileType,
  extractGoogleDriveInfo,
  extractYouTubeId,
  isSafeUrl,
  normalizeImageUrl,
  parseMediaUrlClient,
} from '../../src/lib/mediaUtils.ts';
import {
  ALL_ADMIN_PERMISSIONS,
  DEFAULT_PLATFORM_SETTINGS,
  SETTING_KEYS,
  mergePlatformSettings,
} from '../../src/lib/settingsDefaults.ts';
import {
  isSafeBackgroundValue,
  normalizeBackgroundValue,
} from '../../src/lib/themePresets.ts';
import type {
  AdminPermission,
  AdminUserSummary,
  Category,
  ContentType,
  ExtraMediaItem,
  LinkInspectionResult,
  PlatformSettings,
  PublicSiteStats,
  PublishStatus,
  SourceMethod,
  WorkItem,
} from '../../src/types.ts';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { last_row_id?: number; changes?: number } }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
}

interface Env {
  DB?: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
}

interface EventContext {
  request: Request;
  env: Env;
}

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

const encoder = new TextEncoder();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256Bytes(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return new Uint8Array(digest);
}

async function safeTextCompare(a: string, b: string): Promise<boolean> {
  const [da, dbBytes] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
  return constantTimeEqual(da, dbBytes);
}

async function hashPasswordWeb(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

async function verifyPasswordWeb(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const salt = fromHex(parts[1]);
  const expected = fromHex(parts[2]);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

async function signHmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

async function getOrInitSessionSecret(db: D1Database, env: Env): Promise<string> {
  if (env.SESSION_SECRET && env.SESSION_SECRET.trim()) {
    return env.SESSION_SECRET.trim();
  }
  const existing = await db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_session_secret'`)
    .first<{ value: string }>();
  if (existing?.value) return existing.value;

  const generated = toHex(crypto.getRandomValues(new Uint8Array(32)));
  await db
    .prepare(
      `INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('_internal_session_secret', ?)`
    )
    .bind(generated)
    .run();

  const row = await db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_session_secret'`)
    .first<{ value: string }>();
  return row?.value || generated;
}

let initializedD1 = false;

async function ensureD1Ready(db: D1Database): Promise<void> {
  if (initializedD1) return;

  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (
      token_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS work_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      student_name TEXT NOT NULL DEFAULT '',
      grade_level TEXT NOT NULL DEFAULT '',
      class_section TEXT NOT NULL DEFAULT '',
      publish_date TEXT NOT NULL DEFAULT (date('now')),
      content_type TEXT NOT NULL,
      source_method TEXT NOT NULL,
      original_url TEXT NOT NULL,
      embed_url TEXT NOT NULL,
      media_mime TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT NOT NULL DEFAULT '',
      gallery_urls TEXT NOT NULL DEFAULT '[]',
      extra_media TEXT NOT NULL DEFAULT '[]',
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      subcategory_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      extra_category_ids TEXT NOT NULL DEFAULT '[]',
      keywords TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      featured INTEGER NOT NULL DEFAULT 0,
      embed_status TEXT NOT NULL DEFAULT 'ok',
      embed_note TEXT NOT NULL DEFAULT '',
      views_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS platform_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_date TEXT NOT NULL DEFAULT (date('now')),
      path TEXT NOT NULL DEFAULT '/',
      visitor_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
  ]);

  await db.batch(
    Object.entries(DEFAULT_PLATFORM_SETTINGS).map(([k, v]) =>
      db.prepare(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)`).bind(k, v)
    )
  );

  const catCount = await db.prepare('SELECT COUNT(*) as c FROM categories').first<{ c: number }>();
  if (!catCount || Number(catCount.c) === 0) {
    const mainCats = [
      {
        name: 'الفيديوهات والإنتاجات المرئية',
        slug: 'videos',
        desc: 'أفلام تربوية قصيرة، شروحات مبسطة، وتغطيات مصورة لأنشطة المؤسسة.',
        subs: [
          { name: 'تجارب علمية مصورة', slug: 'videos-science' },
          { name: 'تغطيات الاحتفالات والأنشطة', slug: 'videos-events' },
        ],
      },
      {
        name: 'الصوتيات والإذاعة المدرسية',
        slug: 'audio-radio',
        desc: 'فقرات الإذاعة الصباحية، البودكاست الطلابي، والقراءات الأدبية.',
        subs: [
          { name: 'الإذاعة المدرسية الصباحية', slug: 'radio-morning' },
          { name: 'بودكاست وقراءات التلاميذ', slug: 'radio-podcast' },
        ],
      },
      {
        name: 'الصور والفنون التشكيلية',
        slug: 'arts-photos',
        desc: 'اللوحات الفنية، الخط والزخرفة، والتصوير الفوتوغرافي المدرسي.',
        subs: [
          { name: 'الرسم والألوان المائية', slug: 'arts-painting' },
          { name: 'الزخرفة والخط العربي', slug: 'arts-calligraphy' },
        ],
      },
      {
        name: 'المشاريع والابتكارات',
        slug: 'projects',
        desc: 'المشاريع العلمية الفردية والجماعية ونماذج الروبوتيك والطاقة النظيفة.',
        subs: [
          { name: 'الروبوتيك والبرمجة', slug: 'projects-robotics' },
          { name: 'البيئة والطاقة المتجددة', slug: 'projects-environment' },
        ],
      },
      {
        name: 'الأنشطة الثقافية والتربوية',
        slug: 'cultural-activities',
        desc: 'نادي القراءة، المسرح المدرسي، والأيام الثقافية والبيئية.',
        subs: [{ name: 'نادي القراءة والكتابة', slug: 'cultural-reading' }],
      },
      {
        name: 'العروض والبحوث المدرسية',
        slug: 'research-presentations',
        desc: 'العروض التقديمية، المجلات الحائطية والرقمية، والبحوث المدرسية.',
        subs: [
          { name: 'المجلة المدرسية الرقمية', slug: 'research-magazine' },
          { name: 'العروض التقديمية', slug: 'research-slides' },
        ],
      },
      {
        name: 'المسابقات والتحديات',
        slug: 'competitions',
        desc: 'مشاركات التلاميذ في الأولمبياد، تحدي القراءة، والمسابقات الفنية.',
        subs: [],
      },
      {
        name: 'إبداعات التلاميذ',
        slug: 'student-creations',
        desc: 'مساحة مفتوحة للمواهب الفردية والمبادرات الإبداعية المتنوعة.',
        subs: [],
      },
    ];

    for (let i = 0; i < mainCats.length; i++) {
      const cat = mainCats[i];
      const res = await db
        .prepare(
          'INSERT INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, NULL, ?, ?)'
        )
        .bind(cat.name, cat.slug, cat.desc, i + 1)
        .run();
      const parentId = res.meta?.last_row_id;
      for (let j = 0; j < cat.subs.length; j++) {
        await db
          .prepare(
            'INSERT INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(cat.subs[j].name, cat.subs[j].slug, parentId, '', j + 1)
          .run();
      }
    }
  }

  const workCount = await db.prepare('SELECT COUNT(*) as c FROM work_items').first<{ c: number }>();
  if (!workCount || Number(workCount.c) === 0) {
    const slugRow = async (slug: string) => {
      const r = await db.prepare('SELECT id FROM categories WHERE slug = ?').bind(slug).first<{ id: number }>();
      return r ? Number(r.id) : 1;
    };

    const insertSql = `
      INSERT INTO work_items (
        title, description, student_name, grade_level, class_section, publish_date,
        content_type, source_method, original_url, embed_url, media_mime,
        thumbnail_url, gallery_urls, category_id, subcategory_id, keywords,
        status, featured, embed_status, embed_note, views_count, sort_order, is_sample
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', '', ?, ?, 1)
    `;

    const samples = [
      {
        title: 'مشروع الري الذكي بالطاقة الشمسية لحديقة المدرسة',
        description:
          'مشروع علمي تطبيقي يعتمد على لوحة شمسية مصغرة وحساسات رطوبة التربة لتنظيم سقي النباتات العطرية داخل فضاء المدرسة دون هدر المياه، مع تقرير علمي متكامل.',
        student_name: 'سلمى المنصوري ويوسف بنعلي وآدم التازي',
        grade_level: 'السنة السادسة ابتدائي',
        class_section: 'القسم 6/أ',
        publish_date: '2026-11-18',
        content_type: 'project',
        source_method: 'project_bundle',
        original_url: '/api/samples/solar-project-report.pdf',
        embed_url: '/api/samples/solar-project-report.pdf',
        media_mime: 'application/pdf',
        thumbnail_url: '/src/assets/images/thumb_science_solar_1795563099401.jpg',
        gallery_urls: JSON.stringify([
          '/src/assets/images/thumb_science_solar_1795563099401.jpg',
          '/src/assets/images/thumb_robotics_club_1795563100911.jpg',
        ]),
        catId: await slugRow('projects'),
        subId: await slugRow('projects-environment'),
        keywords: 'طاقة شمسية, ري ذكي, علوم, بيئة, ابتكار',
        status: 'published',
        featured: 1,
        views: 342,
      },
      {
        title: 'الروبوت المستكشف وتفادي العقبات بالموجات فوق الصوتية',
        description:
          'عرض مرئي يشرح مراحل تركيب وبرمجة عربة روبوتية ذكية أنجزها تلاميذ نادي الروبوتيك لتفادي الحواجز آلياً باستخدام المتحكم الدقيق والحساسات.',
        student_name: 'نادي الروبوتيك والابتكار',
        grade_level: 'الثانية إعدادي',
        class_section: 'القسم 2/ب',
        publish_date: '2026-11-15',
        content_type: 'video',
        source_method: 'youtube',
        original_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        embed_url: 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=0&modestbranding=1',
        media_mime: 'text/html',
        thumbnail_url: '/src/assets/images/thumb_robotics_club_1795563100911.jpg',
        gallery_urls: '[]',
        catId: await slugRow('videos'),
        subId: await slugRow('videos-science'),
        keywords: 'روبوتيك, برمجة, فيديو تعليمي, نادي العلوم',
        status: 'published',
        featured: 1,
        views: 289,
      },
      {
        title: 'الإذاعة المدرسية الصباحية — حلقة حول قيمة المطالعة والعمل الجماعي',
        description:
          'تسجيل إذاعي أعدّه وقدّمه تلاميذ فريق الإذاعة المدرسية، يتضمن كلمة افتتاحية، فقرة حكمة اليوم، وحواراً قصيراً مع أمينة المكتبة المدرسية.',
        student_name: 'فريق الإذاعة المدرسية (مريم الإدريسي وطارق العلمي)',
        grade_level: 'السنة الخامسة ابتدائي',
        class_section: 'القسم 5/ج',
        publish_date: '2026-11-20',
        content_type: 'audio',
        source_method: 'direct',
        original_url: '/api/samples/radio-ep1.wav',
        embed_url: '/api/samples/radio-ep1.wav',
        media_mime: 'audio/wav',
        thumbnail_url: '/src/assets/images/thumb_school_radio_1795563100335.jpg',
        gallery_urls: '[]',
        catId: await slugRow('audio-radio'),
        subId: await slugRow('radio-morning'),
        keywords: 'إذاعة مدرسية, صوتيات, مطالعة, تواصل',
        status: 'published',
        featured: 0,
        views: 215,
      },
      {
        title: 'معرض اللوحات المائية والزخرفة الهندسية المغربية',
        description:
          'مجموعة مختارة من اللوحات التشكيلية والزخارف الهندسية المنجزة بألوان الأكريليك والألوان المائية خلال ورشة التربية الفنية الأسبوعية.',
        student_name: 'هبة السلاوي ومجموعة ورشة الفن التشكيلي',
        grade_level: 'الأولى إعدادي',
        class_section: 'القسم 1/أ',
        publish_date: '2026-11-12',
        content_type: 'image',
        source_method: 'direct',
        original_url: '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
        embed_url: '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
        media_mime: 'image/jpeg',
        thumbnail_url: '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
        gallery_urls: JSON.stringify([
          '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
          '/src/assets/images/hero_school_cover_1795563098821.jpg',
        ]),
        catId: await slugRow('arts-photos'),
        subId: await slugRow('arts-painting'),
        keywords: 'رسم, ألوان مائية, زخرفة, فنون تشكيلية',
        status: 'published',
        featured: 1,
        views: 264,
      },
      {
        title: 'المجلة المدرسية الرقمية — العدد الرابع: نحو مدرسة خضراء مبدعة',
        description:
          'نسخة رقمية كاملة بصيغة PDF من المجلة الفصلية لمدرسة الحسن الداخل، تضم تقارير التلاميذ حول البيئة، القراءة، ومشاريع الأندية التربوية.',
        student_name: 'لجنة الصحافة المدرسية',
        grade_level: 'عمل جماعي مشترك',
        class_section: 'نادي الصحافة',
        publish_date: '2026-11-10',
        content_type: 'pdf',
        source_method: 'direct',
        original_url: '/api/samples/school-magazine.pdf',
        embed_url: '/api/samples/school-magazine.pdf',
        media_mime: 'application/pdf',
        thumbnail_url: '/src/assets/images/thumb_school_magazine_1795563101388.jpg',
        gallery_urls: '[]',
        catId: await slugRow('research-presentations'),
        subId: await slugRow('research-magazine'),
        keywords: 'مجلة مدرسية, PDF, صحافة, مقالات',
        status: 'published',
        featured: 0,
        views: 198,
      },
      {
        title: 'عرض تقديمي: الهندسة والزخرفة في التراث المغربي الأصيل',
        description:
          'بحث مدرسي مصوّر يربط بين دروس الهندسة في الرياضيات وجماليات الزليج المغربي التقليدي عبر شرائح تفاعلية جاهزة للعرض.',
        student_name: 'أمين الودغيري وسارة الفاسي',
        grade_level: 'الثالثة إعدادي',
        class_section: 'القسم 3/أ',
        publish_date: '2026-11-08',
        content_type: 'presentation',
        source_method: 'direct',
        original_url: '/api/samples/heritage-slides.pdf',
        embed_url: '/api/samples/heritage-slides.pdf',
        media_mime: 'application/pdf',
        thumbnail_url: '/src/assets/images/thumb_school_magazine_1795563101388.jpg',
        gallery_urls: '[]',
        catId: await slugRow('research-presentations'),
        subId: await slugRow('research-slides'),
        keywords: 'عرض تقديمي, تراث, هندسة, بحث مدرسي',
        status: 'published',
        featured: 0,
        views: 152,
      },
      {
        title: 'بودكاست «صفحة من كتاب»: مراجعة صوتية لقصص الناشئة',
        description:
          'حلقة بودكاست مسجلة داخل استوديو الإذاعة المدرسية يشارك فيها التلاميذ انطباعاتهم حول القصص التي قرؤوها خلال شهر القراءة.',
        student_name: 'كنزة الحمزاوي',
        grade_level: 'السنة الرابعة ابتدائي',
        class_section: 'القسم 4/ب',
        publish_date: '2026-11-05',
        content_type: 'audio',
        source_method: 'direct',
        original_url: '/api/samples/podcast-reading.wav',
        embed_url: '/api/samples/podcast-reading.wav',
        media_mime: 'audio/wav',
        thumbnail_url: '/src/assets/images/thumb_school_radio_1795563100335.jpg',
        gallery_urls: '[]',
        catId: await slugRow('cultural-activities'),
        subId: await slugRow('cultural-reading'),
        keywords: 'بودكاست, قراءة, كتاب, صوتي',
        status: 'published',
        featured: 0,
        views: 0,
      },
    ];

    await db.batch(
      samples.map((s, idx) =>
        db
          .prepare(insertSql)
          .bind(
            s.title,
            s.description,
            s.student_name,
            s.grade_level,
            s.class_section,
            s.publish_date,
            s.content_type,
            s.source_method,
            s.original_url,
            s.embed_url,
            s.media_mime,
            s.thumbnail_url,
            s.gallery_urls,
            s.catId,
            s.subId,
            s.keywords,
            s.status,
            s.featured,
            0,
            idx + 1
          )
      )
    );
  }

  const { results: workCols = [] } = await db
    .prepare(`PRAGMA table_info(work_items)`)
    .all<{ name: string }>();
  if (!workCols.some((c) => c.name === 'sort_order')) {
    await db.prepare(`ALTER TABLE work_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`).run();
  }
  if (!workCols.some((c) => c.name === 'extra_media')) {
    await db.prepare(`ALTER TABLE work_items ADD COLUMN extra_media TEXT NOT NULL DEFAULT '[]'`).run();
  }
  if (!workCols.some((c) => c.name === 'extra_category_ids')) {
    await db.prepare(`ALTER TABLE work_items ADD COLUMN extra_category_ids TEXT NOT NULL DEFAULT '[]'`).run();
  }

  const sortOrderMigrated = await db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_work_sort_order_migrated'`)
    .first<{ value: string }>();
  if (sortOrderMigrated?.value !== '1') {
    const { results: existingWorks = [] } = await db
      .prepare('SELECT id FROM work_items ORDER BY publish_date DESC, id DESC')
      .all<{ id: number }>();
    const stmts: D1PreparedStatement[] = existingWorks.map((w, idx) =>
      db.prepare('UPDATE work_items SET sort_order = ? WHERE id = ?').bind(idx + 1, w.id)
    );
    stmts.push(
      db.prepare(
        `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('_internal_work_sort_order_migrated', '1')`
      )
    );
    await db.batch(stmts);
  }

  const realMigrated = await db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_real_stats_migrated'`)
    .first<{ value: string }>();
  if (realMigrated?.value !== '1') {
    await db.batch([
      db.prepare('UPDATE work_items SET views_count = 0 WHERE is_sample = 1'),
      db.prepare(
        `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('_internal_real_stats_migrated', '1')`
      ),
    ]);
  }

  const extraCatsSeeded = await db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_extra_cats_v2_seeded'`)
    .first<{ value: string }>();
  if (extraCatsSeeded?.value !== '1') {
    const [hasDesigns, maxOrderRow, projParent] = await Promise.all([
      db
        .prepare(`SELECT id FROM categories WHERE slug = 'designs-creations' OR name = 'تصاميم وإبداعات' LIMIT 1`)
        .first<{ id: number }>(),
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').first<{ m: number }>(),
      db
        .prepare(`SELECT id FROM categories WHERE slug = 'projects' OR name = 'المشاريع والابتكارات' LIMIT 1`)
        .first<{ id: number }>(),
    ]);

    const extraStmts: D1PreparedStatement[] = [];
    if (!hasDesigns) {
      extraStmts.push(
        db
          .prepare(
            'INSERT OR IGNORE INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, NULL, ?, ?)'
          )
          .bind(
            'تصاميم وإبداعات',
            'designs-creations',
            'تصاميم رقمية، ملصقات إبداعية، وأعمال فنية مختارة للتلاميذ.',
            Number(maxOrderRow?.m || 0) + 1
          )
      );
    }
    if (projParent) {
      const [hasSci, hasDigital] = await Promise.all([
        db
          .prepare(
            `SELECT id FROM categories WHERE slug = 'projects-science-club' OR name = 'ابتكارات النادي العلمي والتكنولوجي' LIMIT 1`
          )
          .first<{ id: number }>(),
        db
          .prepare(`SELECT id FROM categories WHERE slug = 'projects-digital' OR name = 'مشاريع رقمية' LIMIT 1`)
          .first<{ id: number }>(),
      ]);
      if (!hasSci) {
        extraStmts.push(
          db
            .prepare(
              'INSERT OR IGNORE INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(
              'ابتكارات النادي العلمي والتكنولوجي',
              'projects-science-club',
              projParent.id,
              'ابتكارات وتجارب النادي العلمي والتكنولوجي.',
              10
            )
        );
      }
      if (!hasDigital) {
        extraStmts.push(
          db
            .prepare(
              'INSERT OR IGNORE INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(
              'مشاريع رقمية',
              'projects-digital',
              projParent.id,
              'برمجة ومشاريع رقمية وتطبيقات تلاميذ المؤسسة.',
              11
            )
        );
      }
    }
    extraStmts.push(
      db.prepare(
        `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('_internal_extra_cats_v2_seeded', '1')`
      )
    );
    await db.batch(extraStmts);
  }

  const { results: adminCols = [] } = await db
    .prepare(`PRAGMA table_info(admin_users)`)
    .all<{ name: string }>();
  if (!adminCols.some((c) => c.name === 'display_name')) {
    await db.prepare(`ALTER TABLE admin_users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`).run();
  }
  if (!adminCols.some((c) => c.name === 'permissions_json')) {
    await db.prepare(`ALTER TABLE admin_users ADD COLUMN permissions_json TEXT NOT NULL DEFAULT '[]'`).run();
  }
  if (!adminCols.some((c) => c.name === 'is_active')) {
    await db.prepare(`ALTER TABLE admin_users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`).run();
  }
  if (!adminCols.some((c) => c.name === 'is_primary')) {
    await db.prepare(`ALTER TABLE admin_users ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0`).run();
  }

  const rbacMigrated = await db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_admin_rbac_migrated'`)
    .first<{ value: string }>();
  if (rbacMigrated?.value !== '1') {
    const firstAdmin = await db
      .prepare('SELECT id, username FROM admin_users ORDER BY id ASC LIMIT 1')
      .first<{ id: number; username: string }>();
    const stmts: D1PreparedStatement[] = [];
    if (firstAdmin) {
      const allPermsJson = JSON.stringify([...ALL_ADMIN_PERMISSIONS]);
      stmts.push(
        db
          .prepare(
            `UPDATE admin_users
             SET is_primary = 1,
                 is_active = 1,
                 display_name = CASE WHEN TRIM(display_name) = '' THEN username ELSE display_name END,
                 permissions_json = ?
             WHERE id = ?`
          )
          .bind(allPermsJson, firstAdmin.id)
      );
    }
    stmts.push(
      db.prepare(
        `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('_internal_admin_rbac_migrated', '1')`
      )
    );
    await db.batch(stmts);
  }

  initializedD1 = true;
}

function mapWorkRow(row: Record<string, unknown>): WorkItem {
  let gallery: string[] = [];
  try {
    const parsed = JSON.parse(String(row.gallery_urls || '[]'));
    if (Array.isArray(parsed)) gallery = parsed.filter((u): u is string => typeof u === 'string');
  } catch {
    gallery = [];
  }
  let extraMedia: ExtraMediaItem[] = [];
  try {
    const parsedExtra = JSON.parse(String(row.extra_media || '[]'));
    if (Array.isArray(parsedExtra)) {
      extraMedia = parsedExtra.filter(
        (m): m is ExtraMediaItem =>
          Boolean(m && typeof m === 'object' && typeof m.original_url === 'string' && typeof m.embed_url === 'string')
      );
    }
  } catch {
    extraMedia = [];
  }
  let extraCategoryIds: number[] = [];
  try {
    const parsedCatIds = JSON.parse(String(row.extra_category_ids || '[]'));
    if (Array.isArray(parsedCatIds)) {
      extraCategoryIds = Array.from(
        new Set(
          parsedCatIds
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n > 0)
        )
      );
    }
  } catch {
    extraCategoryIds = [];
  }
  return {
    id: Number(row.id),
    title: String(row.title || ''),
    description: String(row.description || ''),
    student_name: String(row.student_name || ''),
    grade_level: String(row.grade_level || ''),
    class_section: String(row.class_section || ''),
    publish_date: String(row.publish_date || ''),
    content_type: row.content_type as ContentType,
    source_method: row.source_method as SourceMethod,
    original_url: String(row.original_url || ''),
    embed_url: String(row.embed_url || ''),
    media_mime: String(row.media_mime || ''),
    thumbnail_url: String(row.thumbnail_url || ''),
    gallery_urls: gallery,
    extra_media: extraMedia,
    category_id: Number(row.category_id),
    subcategory_id:
      row.subcategory_id !== null && row.subcategory_id !== undefined
        ? Number(row.subcategory_id)
        : null,
    extra_category_ids: extraCategoryIds,
    category_name: row.category_name ? String(row.category_name) : undefined,
    subcategory_name: row.subcategory_name ? String(row.subcategory_name) : null,
    keywords: String(row.keywords || ''),
    status: row.status as PublishStatus,
    featured: Boolean(row.featured),
    embed_status: (row.embed_status as 'ok' | 'warning' | 'blocked') || 'ok',
    embed_note: String(row.embed_note || ''),
    views_count: Number(row.views_count || 0),
    sort_order: Number(row.sort_order || 0),
    is_sample: Boolean(row.is_sample),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function sanitizeExtraMediaEdge(raw: unknown): ExtraMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtraMediaItem[] = [];
  for (const rawEntry of raw) {
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
    out.push({
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
  return out;
}

function sanitizeExtraCategoryIdsEdge(
  raw: unknown,
  primaryCatId: number,
  primarySubId: number | null
): number[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0 && n !== primaryCatId && n !== primarySubId)
    )
  );
}

async function getSettingsD1(db: D1Database): Promise<PlatformSettings> {
  const { results = [] } = await db
    .prepare(`SELECT key, value FROM platform_settings WHERE key NOT LIKE '_internal_%'`)
    .all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const r of results) map[r.key] = r.value;
  return mergePlatformSettings(map);
}

async function getPublicSiteStatsD1(db: D1Database): Promise<PublicSiteStats> {
  const [visitRow, viewsRow] = await Promise.all([
    db
      .prepare(`
        SELECT
          COUNT(*) AS total_site_visits,
          SUM(CASE WHEN visit_date = date('now') THEN 1 ELSE 0 END) AS today_site_visits,
          COUNT(DISTINCT NULLIF(visitor_hash, '')) AS unique_visitors
        FROM platform_visits
      `)
      .first<Record<string, number>>(),
    db
      .prepare(`SELECT COALESCE(SUM(views_count), 0) AS total_work_views FROM work_items WHERE status = 'published'`)
      .first<Record<string, number>>(),
  ]);
  return {
    total_site_visits: Number(visitRow?.total_site_visits || 0),
    today_site_visits: Number(visitRow?.today_site_visits || 0),
    unique_visitors: Number(visitRow?.unique_visitors || 0),
    total_work_views: Number(viewsRow?.total_work_views || 0),
  };
}

async function getCategoriesD1(db: D1Database, publishedOnly: boolean): Promise<Category[]> {
  const [{ results: catRows = [] }, { results: workRows = [] }] = await Promise.all([
    db
      .prepare(`SELECT * FROM categories ORDER BY parent_id IS NOT NULL ASC, sort_order ASC, id ASC`)
      .all<Record<string, unknown>>(),
    db
      .prepare(
        publishedOnly
          ? `SELECT id, category_id, subcategory_id, extra_category_ids FROM work_items WHERE status = 'published'`
          : `SELECT id, category_id, subcategory_id, extra_category_ids FROM work_items`
      )
      .all<Record<string, unknown>>(),
  ]);

  const parentById = new Map<number, number | null>();
  for (const r of catRows) {
    parentById.set(
      Number(r.id),
      r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null
    );
  }

  const countMap = new Map<number, Set<number>>();
  const addWorkToCat = (catId: number, workId: number) => {
    let set = countMap.get(catId);
    if (!set) {
      set = new Set<number>();
      countMap.set(catId, set);
    }
    set.add(workId);
    const parentId = parentById.get(catId);
    if (parentId) {
      let pSet = countMap.get(parentId);
      if (!pSet) {
        pSet = new Set<number>();
        countMap.set(parentId, pSet);
      }
      pSet.add(workId);
    }
  };

  for (const w of workRows) {
    const workId = Number(w.id);
    if (w.category_id) addWorkToCat(Number(w.category_id), workId);
    if (w.subcategory_id) addWorkToCat(Number(w.subcategory_id), workId);
    try {
      const extras = JSON.parse(String(w.extra_category_ids || '[]'));
      if (Array.isArray(extras)) {
        for (const rawId of extras) {
          const cid = Number(rawId);
          if (Number.isInteger(cid) && cid > 0) addWorkToCat(cid, workId);
        }
      }
    } catch {
      // ignore malformed json
    }
  }

  return catRows.map((r) => {
    const id = Number(r.id);
    return {
      id,
      name: String(r.name),
      slug: String(r.slug),
      parent_id: r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null,
      description: String(r.description || ''),
      sort_order: Number(r.sort_order || 0),
      created_at: String(r.created_at || ''),
      item_count: countMap.get(id)?.size || 0,
    };
  });
}

async function getCategoryTreeIdsD1(db: D1Database, categoryId: number): Promise<number[]> {
  const { results = [] } = await db
    .prepare('SELECT id FROM categories WHERE parent_id = ?')
    .bind(categoryId)
    .all<{ id: number }>();
  return Array.from(new Set([categoryId, ...results.map((c) => Number(c.id))]));
}

function buildCategoryFilterSqlD1(categoryIds: number[]): { sql: string; params: number[] } {
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

function getCornerIdsFromList(
  cats: Category[],
  matchType: 'audio' | 'art' | 'video' | 'project'
): number[] {
  const mains = cats.filter((c) => c.parent_id === null);
  let targetRoots: number[] = [];
  if (matchType === 'audio') {
    const m = mains.find((c) => c.slug === 'audio-radio') || mains.find((c) => /إذاعة|صوت/.test(c.name));
    if (m) targetRoots = [m.id];
  } else if (matchType === 'art') {
    const m = mains.find((c) => c.slug === 'arts-photos') || mains.find((c) => /فنون|تشكيلية|صور/.test(c.name));
    if (m) targetRoots = [m.id];
  } else if (matchType === 'video') {
    const m = mains.find((c) => c.slug === 'videos') || mains.find((c) => /فيديو/.test(c.name));
    if (m) targetRoots = [m.id];
  } else if (matchType === 'project') {
    targetRoots = mains
      .filter((c) => c.slug === 'projects' || c.slug === 'research-presentations' || /مشاريع|ابتكار|عروض|بحوث/.test(c.name))
      .map((c) => c.id);
  }
  if (targetRoots.length === 0) return [];
  const rootSet = new Set(targetRoots);
  const allIds = [...targetRoots];
  for (const c of cats) {
    if (c.parent_id && rootSet.has(c.parent_id)) allIds.push(c.id);
  }
  return allIds;
}

async function queryWorksD1(
  db: D1Database,
  whereClause: string,
  params: unknown[],
  orderBy: string,
  limit?: number
): Promise<WorkItem[]> {
  const limitSql = typeof limit === 'number' ? `LIMIT ${Math.max(1, Math.min(100, limit))}` : '';
  const sql = `
    SELECT w.*, c.name AS category_name, sc.name AS subcategory_name
    FROM work_items w
    LEFT JOIN categories c ON c.id = w.category_id
    LEFT JOIN categories sc ON sc.id = w.subcategory_id
    ${whereClause}
    ORDER BY ${orderBy}
    ${limitSql}
  `;
  const { results = [] } = await db.prepare(sql).bind(...params).all<Record<string, unknown>>();
  return results.map(mapWorkRow);
}

async function createSessionD1(db: D1Database, env: Env, username: string): Promise<string> {
  const tokenId = toHex(crypto.getRandomValues(new Uint8Array(24)));
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  await db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(Date.now()).run();
  await db
    .prepare('INSERT INTO admin_sessions (token_id, username, expires_at) VALUES (?, ?, ?)')
    .bind(tokenId, username, expiresAt)
    .run();
  const payload = toBase64Url(encoder.encode(JSON.stringify({ tid: tokenId, u: username, exp: expiresAt })));
  const secret = await getOrInitSessionSecret(db, env);
  const sig = await signHmac(payload, secret);
  return `${payload}.${sig}`;
}

async function verifyBearerD1(
  db: D1Database,
  env: Env,
  req: Request
): Promise<{ valid: boolean; username?: string; tokenId?: string }> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return { valid: false };
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [payload, sig] = parts;
  const secret = await getOrInitSessionSecret(db, env);
  const expectedSig = await signHmac(payload, secret);
  if (!(await safeTextCompare(sig, expectedSig))) return { valid: false };
  try {
    const decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      tid?: string;
      u?: string;
      exp?: number;
    };
    if (!decoded.tid || !decoded.u || !decoded.exp || decoded.exp < Date.now()) {
      return { valid: false };
    }
    const row = await db
      .prepare('SELECT token_id, username, expires_at FROM admin_sessions WHERE token_id = ?')
      .bind(decoded.tid)
      .first<{ token_id: string; username: string; expires_at: number }>();
    if (!row || Number(row.expires_at) < Date.now()) return { valid: false };
    return { valid: true, username: row.username, tokenId: row.token_id };
  } catch {
    return { valid: false };
  }
}

interface AdminUserRowD1 {
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

function sanitizePermissionsD1(raw: unknown): AdminPermission[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(ALL_ADMIN_PERMISSIONS);
  const out: AdminPermission[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && allowed.has(item) && !out.includes(item as AdminPermission)) {
      out.push(item as AdminPermission);
    }
  }
  return out;
}

function parseStoredPermissionsD1(rawJson: string | undefined, isPrimary: boolean): AdminPermission[] {
  if (isPrimary) return [...ALL_ADMIN_PERMISSIONS];
  try {
    const parsed = JSON.parse(rawJson || '[]');
    const clean = sanitizePermissionsD1(parsed);
    return clean;
  } catch {
    return [];
  }
}

async function getAdminUserD1(db: D1Database, username: string): Promise<AdminUserRowD1 | null> {
  return db
    .prepare(
      'SELECT id, username, password_hash, display_name, permissions_json, is_active, is_primary, created_at, updated_at FROM admin_users WHERE username = ?'
    )
    .bind(username)
    .first<AdminUserRowD1>();
}

async function listAdminUsersD1(db: D1Database): Promise<AdminUserSummary[]> {
  const { results = [] } = await db
    .prepare(
      'SELECT id, username, display_name, permissions_json, is_active, is_primary, created_at, updated_at FROM admin_users ORDER BY is_primary DESC, id ASC'
    )
    .all<AdminUserRowD1>();
  return results.map((r) => ({
    id: Number(r.id),
    username: String(r.username),
    display_name: String(r.display_name || r.username),
    permissions: parseStoredPermissionsD1(String(r.permissions_json || '[]'), Boolean(r.is_primary)),
    is_active: Boolean(r.is_active),
    is_primary: Boolean(r.is_primary),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  }));
}

interface VerifiedAdminAccessD1 {
  ok: boolean;
  status?: number;
  error?: string;
  username?: string;
  displayName?: string;
  tokenId?: string;
  permissions: AdminPermission[];
  isPrimary: boolean;
}

async function verifyAdminAccessD1(
  db: D1Database,
  env: Env,
  req: Request,
  envConfigured: boolean
): Promise<VerifiedAdminAccessD1> {
  const bearer = await verifyBearerD1(db, env, req);
  if (!bearer.valid || !bearer.username) {
    return {
      ok: false,
      status: 401,
      error: 'غير مصرح بالوصول. يرجى تسجيل دخول المدير أولاً.',
      permissions: [],
      isPrimary: false,
    };
  }

  if (envConfigured) {
    return {
      ok: true,
      username: bearer.username,
      displayName: bearer.username,
      tokenId: bearer.tokenId,
      permissions: [...ALL_ADMIN_PERMISSIONS],
      isPrimary: true,
    };
  }

  const user = await getAdminUserD1(db, bearer.username);
  if (!user || !user.is_active) {
    return {
      ok: false,
      status: 401,
      error: 'تم تعطيل الحساب أو انتهت الجلسة. يرجى إعادة تسجيل الدخول.',
      permissions: [],
      isPrimary: false,
    };
  }

  return {
    ok: true,
    username: user.username,
    displayName: user.display_name || user.username,
    tokenId: bearer.tokenId,
    permissions: parseStoredPermissionsD1(user.permissions_json, Boolean(user.is_primary)),
    isPrimary: Boolean(user.is_primary),
  };
}

function hasPermissionD1(access: VerifiedAdminAccessD1, perm: AdminPermission): boolean {
  return access.isPrimary || access.permissions.includes(perm);
}

function sanitizeWorkPayloadEdge(body: Record<string, unknown>) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const originalUrl = typeof body.original_url === 'string' ? body.original_url.trim() : '';
  if (!title) return { error: 'يرجى كتابة عنوان الإنتاج.' } as const;
  if (!originalUrl || !isSafeUrl(originalUrl)) {
    return { error: 'يرجى إدخال رابط محتوى صالح (يبدأ بـ https:// أو http://).' } as const;
  }

  const preferredMethod = VALID_SOURCE_METHODS.includes(body.source_method as SourceMethod)
    ? (body.source_method as SourceMethod)
    : 'direct';
  const preferredType = VALID_CONTENT_TYPES.includes(body.content_type as ContentType)
    ? (body.content_type as ContentType)
    : 'video';
  const parsed = parseMediaUrlClient(originalUrl, preferredMethod, preferredType);
  if (!parsed.valid) return { error: parsed.error || 'رابط غير صالح.' } as const;

  const contentType: ContentType = VALID_CONTENT_TYPES.includes(body.content_type as ContentType)
    ? (body.content_type as ContentType)
    : parsed.contentType;
  const sourceMethod: SourceMethod = VALID_SOURCE_METHODS.includes(body.source_method as SourceMethod)
    ? (body.source_method as SourceMethod)
    : parsed.sourceMethod;

  const categoryId = Number(body.category_id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: 'يرجى اختيار التصنيف الرئيسي.' } as const;
  }
  const subcategoryId =
    body.subcategory_id !== null && body.subcategory_id !== undefined && body.subcategory_id !== ''
      ? Number(body.subcategory_id)
      : null;
  const validSubId = subcategoryId && Number.isInteger(subcategoryId) ? subcategoryId : null;
  const galleryUrls = Array.isArray(body.gallery_urls)
    ? body.gallery_urls
        .filter((u): u is string => typeof u === 'string' && isSafeUrl(u))
        .map((u) => normalizeImageUrl(u))
    : [];
  const extraMedia = sanitizeExtraMediaEdge(body.extra_media);
  const extraCategoryIds = sanitizeExtraCategoryIdsEdge(body.extra_category_ids, categoryId, validSubId);
  const rawOrder = Number(body.sort_order);
  const sortOrder =
    body.sort_order !== undefined &&
    body.sort_order !== null &&
    body.sort_order !== '' &&
    Number.isFinite(rawOrder) &&
    rawOrder >= 0
      ? Math.floor(rawOrder)
      : 0;
  const publishDate =
    typeof body.publish_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.publish_date.trim())
      ? body.publish_date.trim()
      : new Date().toISOString().slice(0, 10);

  return {
    data: {
      title,
      description: typeof body.description === 'string' ? body.description.trim() : '',
      student_name: typeof body.student_name === 'string' ? body.student_name.trim() : '',
      grade_level: typeof body.grade_level === 'string' ? body.grade_level.trim() : '',
      class_section: typeof body.class_section === 'string' ? body.class_section.trim() : '',
      publish_date: publishDate,
      content_type: contentType,
      source_method: sourceMethod,
      original_url: originalUrl,
      embed_url:
        typeof body.embed_url === 'string' && isSafeUrl(body.embed_url) ? body.embed_url.trim() : parsed.embedUrl,
      media_mime: typeof body.media_mime === 'string' ? body.media_mime : parsed.mediaMime,
      thumbnail_url:
        typeof body.thumbnail_url === 'string' && isSafeUrl(body.thumbnail_url)
          ? normalizeImageUrl(body.thumbnail_url)
          : parsed.thumbnailUrl,
      gallery_urls: JSON.stringify(galleryUrls),
      extra_media: JSON.stringify(extraMedia),
      category_id: categoryId,
      subcategory_id: validSubId,
      extra_category_ids: JSON.stringify(extraCategoryIds),
      keywords: typeof body.keywords === 'string' ? body.keywords.trim() : '',
      status: VALID_STATUSES.includes(body.status as PublishStatus) ? (body.status as PublishStatus) : 'draft',
      featured: body.featured ? 1 : 0,
      embed_status: body.embed_status === 'warning' || body.embed_status === 'blocked' ? body.embed_status : 'ok',
      embed_note: typeof body.embed_note === 'string' ? body.embed_note.trim() : '',
      sort_order: sortOrder,
    },
  } as const;
}

function createSampleWavBytes(variant: 'ep1' | 'ep2'): ArrayBuffer {
  const sampleRate = 22050;
  const durationSec = 5.5;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  const notes =
    variant === 'ep1'
      ? [293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 587.33]
      : [261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 329.63, 261.63];
  const noteDur = durationSec / notes.length;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const idx = Math.min(notes.length - 1, Math.floor(t / noteDur));
    const lt = t - idx * noteDur;
    const f = notes[idx];
    const env = Math.min(1, lt / 0.04) * Math.exp(-lt * 2.8) * 0.32;
    const s = Math.max(-1, Math.min(1, env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t))));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return buf;
}

function createSamplePdfBytes(id: string): ArrayBuffer | null {
  const specs: Record<string, { title: string; subtitle: string; lines: string[]; landscape?: boolean }> = {
    'school-magazine.pdf': {
      title: 'Al-Hassan Ad-Dakhil School Digital Magazine',
      subtitle: 'Issue 04 - Science, Culture & Student Voices (2026)',
      lines: [
        'Welcome to the fourth digital issue produced by the Journalism & Reading Club.',
        '01. Solar Smart Irrigation in the School Garden',
        '02. Voices from the Morning School Radio',
        '03. Geometric Art & Watercolor Workshop Highlights',
        '04. Robotics Club Autonomous Rover Challenge',
      ],
    },
    'solar-project-report.pdf': {
      title: 'Solar-Powered Smart Irrigation Prototype',
      subtitle: 'Applied Science & Sustainability Project Documentation',
      lines: [
        'Project Team: Salma El-Mansouri, Youssef Benali, Adam Tazi (Grade 6)',
        'Objective: Autonomous clean-energy irrigation for school garden plants.',
        'Components: 5W Solar Panel, Soil Moisture Sensor, Microcontroller, 5V Pump.',
      ],
    },
    'heritage-slides.pdf': {
      title: 'Architectural & Cultural Heritage Research',
      subtitle: 'Student Presentation Deck - Geometry & Craftsmanship',
      landscape: true,
      lines: [
        '1. Historical Geometry in Moroccan Zellij & Woodwork',
        '2. Color Pigments & Natural Mineral Sources',
        '3. Student Reinterpretations in Watercolor & Design',
      ],
    },
  };
  const spec = specs[id];
  if (!spec) return null;
  const w = spec.landscape ? 842 : 595;
  const h = spec.landscape ? 595 : 842;
  const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const cmds = [
    `0.118 0.251 0.686 rg 0 ${h - 96} ${w} 96 re f`,
    `1 1 1 rg BT /F1 20 Tf 48 ${h - 46} Td (${esc(spec.title)}) Tj ET`,
    `0.90 0.94 1.00 rg BT /F2 11 Tf 48 ${h - 72} Td (${esc(spec.subtitle)}) Tj ET`,
    '0.10 0.14 0.22 rg',
    ...spec.lines.map((l, idx) => `BT /F2 12 Tf 56 ${h - 148 - idx * 26} Td (${esc(l)}) Tj ET`),
  ].join('\n');

  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [5 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
    `6 0 obj\n<< /Length ${encoder.encode(cmds).length} >>\nstream\n${cmds}\nendstream\nendobj\n`,
  ];

  const parts: Uint8Array[] = [encoder.encode('%PDF-1.4\n')];
  const offsets: number[] = [0];
  let off = parts[0].length;
  for (const o of objs) {
    offsets.push(off);
    const b = encoder.encode(o);
    parts.push(b);
    off += b.length;
  }
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  parts.push(encoder.encode(xref));
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const outBuf = new ArrayBuffer(total);
  const merged = new Uint8Array(outBuf);
  let pos = 0;
  for (const p of parts) {
    merged.set(p, pos);
    pos += p.length;
  }
  return outBuf;
}

function isDisallowedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  ) {
    return true;
  }
  return false;
}

async function inspectUrlEdge(
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
      message: 'الرابط المدخل غير صالح. يجب أن يبدأ بـ https:// أو http://.',
      guidance: [],
    };
  }
  if (trimmed.startsWith('/api/samples/') || trimmed.startsWith('/src/assets/') || trimmed.startsWith('/assets/')) {
    const direct = detectDirectFileType(trimmed);
    return {
      valid: true,
      source_method: preferredMethod || 'direct',
      detected_content_type: preferredType === 'project' ? 'project' : direct?.contentType || preferredType || 'pdf',
      original_url: trimmed,
      embed_url: trimmed,
      thumbnail_url: direct?.contentType === 'image' ? trimmed : '',
      media_mime: direct?.mime || '',
      embed_status: 'ok',
      message: 'ملف محلي متاح وجاهز للعرض داخل المنصة.',
      guidance: [],
    };
  }

  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    return {
      valid: true,
      source_method: 'youtube',
      detected_content_type: 'video',
      original_url: trimmed,
      embed_url: `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`,
      thumbnail_url: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      media_mime: 'text/html',
      embed_status: 'ok',
      message: 'تم التعرف على فيديو YouTube بنجاح وهو جاهز للتشغيل المدمج.',
      guidance: [],
    };
  }

  const drive = extractGoogleDriveInfo(trimmed);
  if (drive) {
    const inferredType: ContentType =
      drive.kind === 'presentation' ? 'presentation' : drive.kind === 'document' ? 'pdf' : preferredType || 'video';
    try {
      const resp = await fetch(drive.embedUrl, { method: 'GET', redirect: 'manual' });
      const loc = resp.headers.get('location') || '';
      if (resp.status === 401 || resp.status === 403 || loc.includes('accounts.google.com')) {
        return {
          valid: true,
          source_method: 'gdrive',
          detected_content_type: inferredType,
          original_url: trimmed,
          embed_url: drive.embedUrl,
          thumbnail_url: '',
          media_mime: 'text/html',
          embed_status: 'blocked',
          message: 'تنبيه صلاحيات Google Drive: الملف خاص حالياً ولا يظهر للزوار.',
          guidance: [
            'افتح الملف في Google Drive ثم اضغط «مشاركة» (Share).',
            'غيّر الوصول العام إلى «أي شخص لديه الرابط» (Anyone with the link) بصلاحية «عارض» (Viewer).',
          ],
        };
      }
    } catch {
      // fallback to warning
    }
    return {
      valid: true,
      source_method: 'gdrive',
      detected_content_type: inferredType,
      original_url: trimmed,
      embed_url: drive.embedUrl,
      thumbnail_url: inferredType === 'image' ? normalizeImageUrl(trimmed) : '',
      media_mime: 'text/html',
      embed_status: 'ok',
      message: 'رابط Google Drive متاح للمعاينة العامة وتم تحويله إلى مشغل مدمج.',
      guidance: [],
    };
  }

  const parsedUrl = new URL(trimmed);
  if (isDisallowedHostname(parsedUrl.hostname)) {
    return {
      valid: false,
      source_method: 'direct',
      detected_content_type: preferredType || 'video',
      original_url: trimmed,
      embed_url: '',
      thumbnail_url: '',
      media_mime: '',
      embed_status: 'blocked',
      message: 'عناوين الشبكة الداخلية غير مسموحة.',
      guidance: [],
    };
  }

  const direct = detectDirectFileType(trimmed);
  return {
    valid: true,
    source_method: preferredMethod || 'direct',
    detected_content_type: preferredType === 'project' ? 'project' : direct?.contentType || preferredType || 'pdf',
    original_url: trimmed,
    embed_url: trimmed,
    thumbnail_url: direct?.contentType === 'image' ? trimmed : '',
    media_mime: direct?.mime || '',
    embed_status: 'ok',
    message: 'تم التعرف على الرابط وهو جاهز للمعاينة.',
    guidance: [],
  };
}

export async function onRequest(context: EventContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // Sample media routes work even without DB
  if (method === 'GET' && path.startsWith('/api/samples/')) {
    const filename = path.split('/').pop() || '';
    if (filename === 'radio-ep1.wav' || filename === 'podcast-reading.wav') {
      const wav = createSampleWavBytes(filename === 'podcast-reading.wav' ? 'ep2' : 'ep1');
      return new Response(wav, {
        headers: { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' },
      });
    }
    if (filename.endsWith('.pdf')) {
      const pdf = createSamplePdfBytes(filename);
      if (!pdf) return new Response('Not found', { status: 404 });
      return new Response(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
        },
      });
    }
    return new Response('Not found', { status: 404 });
  }

  if (!env.DB) {
    return jsonResponse(
      {
        error:
          'لم يتم ربط قاعدة بيانات Cloudflare D1 بعد. يرجى إنشاء قاعدة بيانات D1 وربطها بالاسم DB في إعدادات Pages.',
      },
      503
    );
  }

  const db = env.DB;
  await ensureD1Ready(db);

  // Public bootstrap
  if (method === 'GET' && path === '/api/public/bootstrap') {
    const [settings, categories, siteStats, latest, mostViewed, featured] = await Promise.all([
      getSettingsD1(db),
      getCategoriesD1(db, true),
      getPublicSiteStatsD1(db),
      queryWorksD1(db, `WHERE w.status = 'published' AND w.embed_status != 'blocked'`, [], CUSTOM_WORK_ORDER_SQL, 8),
      queryWorksD1(db, `WHERE w.status = 'published' AND w.embed_status != 'blocked'`, [], 'w.views_count DESC, w.id DESC', 6),
      queryWorksD1(db, `WHERE w.status = 'published' AND w.featured = 1 AND w.embed_status != 'blocked'`, [], CUSTOM_WORK_ORDER_SQL, 6),
    ]);

    const radioIds = getCornerIdsFromList(categories, 'audio');
    const artIds = getCornerIdsFromList(categories, 'art');
    const videoIds = getCornerIdsFromList(categories, 'video');
    const projectIds = getCornerIdsFromList(categories, 'project');

    const radioFilter = buildCategoryFilterSqlD1(radioIds);
    const artFilter = buildCategoryFilterSqlD1(artIds);
    const videoFilter = buildCategoryFilterSqlD1(videoIds);
    const projectFilter = buildCategoryFilterSqlD1(projectIds);

    const [radioCorner, artCorner, videoCorner, projectCorner] = await Promise.all([
      radioIds.length
        ? queryWorksD1(db, `WHERE w.status = 'published' AND w.embed_status != 'blocked' AND ${radioFilter.sql}`, radioFilter.params, CUSTOM_WORK_ORDER_SQL, 4)
        : Promise.resolve([]),
      artIds.length
        ? queryWorksD1(db, `WHERE w.status = 'published' AND w.embed_status != 'blocked' AND ${artFilter.sql}`, artFilter.params, CUSTOM_WORK_ORDER_SQL, 6)
        : Promise.resolve([]),
      videoIds.length
        ? queryWorksD1(db, `WHERE w.status = 'published' AND w.embed_status != 'blocked' AND ${videoFilter.sql}`, videoFilter.params, CUSTOM_WORK_ORDER_SQL, 4)
        : Promise.resolve([]),
      projectIds.length
        ? queryWorksD1(db, `WHERE w.status = 'published' AND w.embed_status != 'blocked' AND ${projectFilter.sql}`, projectFilter.params, CUSTOM_WORK_ORDER_SQL, 6)
        : Promise.resolve([]),
    ]);

    return jsonResponse({
      settings,
      categories,
      siteStats,
      sections: { latest, mostViewed, featured, radioCorner, artCorner, videoCorner, projectCorner },
    });
  }

  // Record real public platform visit
  if (method === 'POST' && path === '/api/public/visit') {
    const body = (await request.json().catch(() => ({}))) as { path?: string; visitor_id?: string };
    const pathVal = typeof body.path === 'string' ? body.path.slice(0, 120) : '/';
    const visitorHash = typeof body.visitor_id === 'string' ? body.visitor_id.trim().slice(0, 64) : '';
    await db
      .prepare(`INSERT INTO platform_visits (visit_date, path, visitor_hash) VALUES (date('now'), ?, ?)`)
      .bind(pathVal, visitorHash)
      .run();
    return jsonResponse({ ok: true, siteStats: await getPublicSiteStatsD1(db) });
  }

  // Public works search
  if (method === 'GET' && path === '/api/public/works') {
    const q = (url.searchParams.get('q') || '').trim();
    const categoryId = url.searchParams.get('categoryId') ? Number(url.searchParams.get('categoryId')) : null;
    const contentType = (url.searchParams.get('contentType') || '').trim();
    const gradeLevel = (url.searchParams.get('gradeLevel') || '').trim();
    const dateFrom = (url.searchParams.get('dateFrom') || '').trim();
    const dateTo = (url.searchParams.get('dateTo') || '').trim();
    const sort = (url.searchParams.get('sort') || 'custom').trim();

    const conditions = [`w.status = 'published'`, `w.embed_status != 'blocked'`];
    const params: unknown[] = [];

    if (q) {
      conditions.push(`(w.title LIKE ? OR w.description LIKE ? OR w.student_name LIKE ? OR w.keywords LIKE ?)`);
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (categoryId && Number.isFinite(categoryId)) {
      const catFilter = buildCategoryFilterSqlD1(await getCategoryTreeIdsD1(db, categoryId));
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

    const items = await queryWorksD1(db, `WHERE ${conditions.join(' AND ')}`, params, orderBy);
    return jsonResponse({ items });
  }

  // Public single work + view counter
  const workViewMatch = path.match(/^\/api\/public\/works\/(\d+)\/view$/);
  if (method === 'POST' && workViewMatch) {
    const id = Number(workViewMatch[1]);
    await db
      .prepare(`UPDATE work_items SET views_count = views_count + 1 WHERE id = ? AND status = 'published'`)
      .bind(id)
      .run();
    const row = await db
      .prepare('SELECT views_count FROM work_items WHERE id = ?')
      .bind(id)
      .first<{ views_count: number }>();
    return jsonResponse({ ok: true, views_count: Number(row?.views_count || 0) });
  }

  const workSingleMatch = path.match(/^\/api\/public\/works\/(\d+)$/);
  if (method === 'GET' && workSingleMatch) {
    const id = Number(workSingleMatch[1]);
    const items = await queryWorksD1(
      db,
      `WHERE w.id = ? AND w.status = 'published' AND w.embed_status != 'blocked'`,
      [id],
      'w.id DESC',
      1
    );
    if (!items.length) return jsonResponse({ error: 'الإنتاج المطلوب غير متاح.' }, 404);
    const item = items[0];
    const relIds = [item.category_id, ...(item.subcategory_id ? [item.subcategory_id] : []), ...item.extra_category_ids];
    const relFilter = buildCategoryFilterSqlD1(relIds);
    const related = await queryWorksD1(
      db,
      `WHERE w.id != ? AND w.status = 'published' AND w.embed_status != 'blocked' AND ${relFilter.sql}`,
      [item.id, ...relFilter.params],
      'w.views_count DESC, w.publish_date DESC',
      4
    );
    return jsonResponse({ item, related });
  }

  // Auth routes
  const envConfigured = Boolean(env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.trim().length > 0);

  if (method === 'GET' && path === '/api/auth/status') {
    const row = await db.prepare('SELECT COUNT(*) as count FROM admin_users').first<{ count: number }>();
    const hasDbAdmin = Number(row?.count || 0) > 0;
    const access = await verifyAdminAccessD1(db, env, request, envConfigured);
    if (access.ok && access.username) {
      return jsonResponse({
        needsSetup: false,
        authenticated: true,
        username: access.username,
        displayName: access.displayName || access.username,
        permissions: access.permissions,
        isPrimary: access.isPrimary,
        envManaged: envConfigured,
      });
    }
    return jsonResponse({
      needsSetup: !envConfigured && !hasDbAdmin,
      authenticated: false,
      username: null,
      permissions: [],
      envManaged: envConfigured,
    });
  }

  if (method === 'POST' && path === '/api/auth/setup') {
    if (envConfigured) {
      return jsonResponse({ error: 'تم إعداد حساب المدير مسبقاً عبر إعدادات البيئة.' }, 409);
    }
    const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (username.length < 3 || username.length > 40 || password.length < 6 || password.length > 128) {
      return jsonResponse({ error: 'اسم المستخدم (3+ أحرف) وكلمة المرور (6+ أحرف) مطلوبان.' }, 400);
    }
    const existing = await db.prepare('SELECT COUNT(*) as count FROM admin_users').first<{ count: number }>();
    if (Number(existing?.count || 0) > 0) {
      return jsonResponse({ error: 'تم إنشاء حساب المدير مسبقاً.' }, 409);
    }
    const hash = await hashPasswordWeb(password);
    const allPermsJson = JSON.stringify([...ALL_ADMIN_PERMISSIONS]);
    await db
      .prepare(
        'INSERT INTO admin_users (username, password_hash, display_name, permissions_json, is_active, is_primary) VALUES (?, ?, ?, ?, 1, 1)'
      )
      .bind(username, hash, username, allPermsJson)
      .run();
    const token = await createSessionD1(db, env, username);
    return jsonResponse(
      {
        token,
        username,
        displayName: username,
        permissions: [...ALL_ADMIN_PERMISSIONS],
        isPrimary: true,
        envManaged: false,
      },
      201
    );
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) {
      return jsonResponse({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' }, 400);
    }
    if (envConfigured) {
      const expectedUser = env.ADMIN_USERNAME?.trim() || 'admin';
      const expectedPass = env.ADMIN_PASSWORD || '';
      if ((await safeTextCompare(username, expectedUser)) && (await safeTextCompare(password, expectedPass))) {
        const token = await createSessionD1(db, env, expectedUser);
        return jsonResponse({
          token,
          username: expectedUser,
          displayName: expectedUser,
          permissions: [...ALL_ADMIN_PERMISSIONS],
          isPrimary: true,
          envManaged: true,
        });
      }
      return jsonResponse({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }, 401);
    }
    const userRow = await getAdminUserD1(db, username);
    if (!userRow || !(await verifyPasswordWeb(password, userRow.password_hash))) {
      return jsonResponse({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }, 401);
    }
    if (!userRow.is_active) {
      return jsonResponse({ error: 'هذا الحساب معطل حالياً. يرجى التواصل مع المدير العام للمنصة.' }, 403);
    }
    const permissions = parseStoredPermissionsD1(userRow.permissions_json, Boolean(userRow.is_primary));
    const token = await createSessionD1(db, env, userRow.username);
    return jsonResponse({
      token,
      username: userRow.username,
      displayName: userRow.display_name || userRow.username,
      permissions,
      isPrimary: Boolean(userRow.is_primary),
      envManaged: false,
    });
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const auth = await verifyBearerD1(db, env, request);
    if (!auth.valid) return jsonResponse({ error: 'غير مصرح بالوصول.' }, 401);
    if (auth.tokenId) {
      await db.prepare('DELETE FROM admin_sessions WHERE token_id = ?').bind(auth.tokenId).run();
    }
    return jsonResponse({ ok: true });
  }

  // Protected Admin Routes
  if (path.startsWith('/api/admin/') || path === '/api/auth/change-password') {
    const auth = await verifyAdminAccessD1(db, env, request, envConfigured);
    if (!auth.ok || !auth.username) {
      return jsonResponse({ error: auth.error || 'غير مصرح بالوصول. يرجى تسجيل دخول المدير أولاً.' }, auth.status || 401);
    }

    if (method === 'POST' && path === '/api/auth/change-password') {
      if (envConfigured) {
        return jsonResponse({ error: 'بيانات الدخول مضبوطة عبر متغيرات البيئة.' }, 400);
      }
      const body = (await request.json().catch(() => ({}))) as {
        currentPassword?: string;
        newUsername?: string;
        newPassword?: string;
      };
      const row = await getAdminUserD1(db, auth.username);
      if (!row || !(await verifyPasswordWeb(body.currentPassword || '', row.password_hash))) {
        return jsonResponse({ error: 'كلمة المرور الحالية غير صحيحة.' }, 401);
      }
      const newUsername = typeof body.newUsername === 'string' ? body.newUsername.trim() : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
      if (newUsername && (newUsername.length < 3 || newUsername.length > 40)) {
        return jsonResponse({ error: 'يجب أن يتكون اسم المستخدم من 3 إلى 40 حرفاً.' }, 400);
      }
      if (newPassword && (newPassword.length < 6 || newPassword.length > 128)) {
        return jsonResponse({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.' }, 400);
      }
      const targetUsername = newUsername.length >= 3 ? newUsername : row.username;
      if (targetUsername !== row.username && (await getAdminUserD1(db, targetUsername))) {
        return jsonResponse({ error: 'اسم المستخدم الجديد مستخدم بالفعل.' }, 409);
      }
      const nextHash = newPassword ? await hashPasswordWeb(newPassword) : row.password_hash;
      const stmts: D1PreparedStatement[] = [
        db
          .prepare(`UPDATE admin_users SET username = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(targetUsername, nextHash, row.id),
      ];
      if (targetUsername !== row.username) {
        stmts.push(
          db.prepare(`UPDATE admin_sessions SET username = ? WHERE username = ?`).bind(targetUsername, row.username)
        );
      }
      await db.batch(stmts);
      return jsonResponse({
        ok: true,
        username: targetUsername,
        displayName: row.display_name || targetUsername,
        permissions: parseStoredPermissionsD1(row.permissions_json, Boolean(row.is_primary)),
        isPrimary: Boolean(row.is_primary),
      });
    }

    if (method === 'GET' && path === '/api/admin/stats') {
      const [counts, latestItems, siteStats] = await Promise.all([
        db
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
          .first<Record<string, number>>(),
        queryWorksD1(db, '', [], 'w.created_at DESC, w.id DESC', 6),
        getPublicSiteStatsD1(db),
      ]);
      return jsonResponse({
        total_items: Number(counts?.total_items || 0),
        total_videos: Number(counts?.total_videos || 0),
        total_audio: Number(counts?.total_audio || 0),
        total_images: Number(counts?.total_images || 0),
        total_projects: Number(counts?.total_projects || 0),
        total_pdfs: Number(counts?.total_pdfs || 0),
        total_presentations: Number(counts?.total_presentations || 0),
        published_count: Number(counts?.published_count || 0),
        draft_count: Number(counts?.draft_count || 0),
        total_views: Number(counts?.total_views || 0),
        total_site_visits: siteStats.total_site_visits,
        today_site_visits: siteStats.today_site_visits,
        unique_visitors: siteStats.unique_visitors,
        latest_items: latestItems,
      });
    }

    if (method === 'POST' && path === '/api/admin/stats/reset') {
      if (!hasPermissionD1(auth, 'manage_settings')) {
        return jsonResponse({ error: 'ليس لديك صلاحية تنفيذ هذه المهمة.' }, 403);
      }
      await db.batch([
        db.prepare('DELETE FROM platform_visits'),
        db.prepare('UPDATE work_items SET views_count = 0'),
      ]);
      return jsonResponse({ ok: true });
    }

    // Admin Users Management
    if (path === '/api/admin/users') {
      if (!hasPermissionD1(auth, 'manage_users')) {
        return jsonResponse({ error: 'ليس لديك صلاحية إدارة المستخدمين.' }, 403);
      }
      if (method === 'GET') {
        return jsonResponse({ users: await listAdminUsersD1(db), envManaged: envConfigured });
      }
      if (method === 'POST') {
        if (envConfigured) {
          return jsonResponse({ error: 'إدارة المستخدمين غير متاحة عند ضبط الحساب عبر متغيرات البيئة.' }, 400);
        }
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const username = typeof body.username === 'string' ? body.username.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const displayName = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 80) : '';
        const permissions = sanitizePermissionsD1(body.permissions);
        const isActive = body.is_active !== false;

        if (username.length < 3 || username.length > 40) {
          return jsonResponse({ error: 'يجب أن يتكون اسم المستخدم من 3 إلى 40 حرفاً.' }, 400);
        }
        if (password.length < 6 || password.length > 128) {
          return jsonResponse({ error: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.' }, 400);
        }
        if (permissions.length === 0) {
          return jsonResponse({ error: 'يرجى تحديد مهمة واحدة على الأقل للمستخدم الجديد.' }, 400);
        }
        if (await getAdminUserD1(db, username)) {
          return jsonResponse({ error: 'اسم المستخدم مسجل مسبقاً. اختر اسماً آخر.' }, 409);
        }

        const hash = await hashPasswordWeb(password);
        await db
          .prepare(
            `INSERT INTO admin_users (username, password_hash, display_name, permissions_json, is_active, is_primary)
             VALUES (?, ?, ?, ?, ?, 0)`
          )
          .bind(username, hash, displayName || username, JSON.stringify(permissions), isActive ? 1 : 0)
          .run();
        return jsonResponse({ users: await listAdminUsersD1(db) }, 201);
      }
    }

    const adminUserIdMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
    if (adminUserIdMatch) {
      if (!hasPermissionD1(auth, 'manage_users')) {
        return jsonResponse({ error: 'ليس لديك صلاحية إدارة المستخدمين.' }, 403);
      }
      if (envConfigured) {
        return jsonResponse({ error: 'إدارة المستخدمين غير متاحة عند ضبط الحساب عبر متغيرات البيئة.' }, 400);
      }
      const id = Number(adminUserIdMatch[1]);
      const existing = await db
        .prepare('SELECT * FROM admin_users WHERE id = ?')
        .bind(id)
        .first<AdminUserRowD1>();
      if (!existing) {
        return jsonResponse({ error: 'المستخدم غير موجود.' }, 404);
      }

      if (method === 'PUT') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const nextDisplayName =
          typeof body.display_name === 'string'
            ? body.display_name.trim().slice(0, 80) || existing.username
            : existing.display_name;
        const nextPassword = typeof body.password === 'string' ? body.password : '';
        const nextActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(existing.is_active);
        const nextPermissions =
          existing.is_primary === 1
            ? [...ALL_ADMIN_PERMISSIONS]
            : body.permissions !== undefined
              ? sanitizePermissionsD1(body.permissions)
              : parseStoredPermissionsD1(existing.permissions_json, false);

        if (existing.is_primary === 1 && !nextActive) {
          return jsonResponse({ error: 'لا يمكن تعطيل حساب المدير الرئيسي للمنصة.' }, 400);
        }
        if (existing.username === auth.username && (!nextActive || !nextPermissions.includes('manage_users'))) {
          return jsonResponse({ error: 'لا يمكنك إزالة صلاحية إدارة المستخدمين أو تعطيل حسابك الحالي.' }, 400);
        }
        if (nextPermissions.length === 0) {
          return jsonResponse({ error: 'يجب تحديد مهمة واحدة على الأقل للمستخدم.' }, 400);
        }
        if (nextPassword && (nextPassword.length < 6 || nextPassword.length > 128)) {
          return jsonResponse({ error: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل.' }, 400);
        }
        const nextHash = nextPassword ? await hashPasswordWeb(nextPassword) : existing.password_hash;
        const stmts: D1PreparedStatement[] = [
          db
            .prepare(
              `UPDATE admin_users
               SET display_name = ?, password_hash = ?, permissions_json = ?, is_active = ?, updated_at = datetime('now')
               WHERE id = ?`
            )
            .bind(nextDisplayName, nextHash, JSON.stringify(nextPermissions), nextActive ? 1 : 0, id),
        ];
        if (!nextActive) {
          stmts.push(db.prepare('DELETE FROM admin_sessions WHERE username = ?').bind(existing.username));
        }
        await db.batch(stmts);
        return jsonResponse({ users: await listAdminUsersD1(db) });
      }

      if (method === 'DELETE') {
        if (existing.is_primary) {
          return jsonResponse({ error: 'لا يمكن حذف حساب المدير الرئيسي للمنصة.' }, 400);
        }
        if (existing.username === auth.username) {
          return jsonResponse({ error: 'لا يمكنك حذف حسابك أثناء تسجيل الدخول به.' }, 400);
        }
        await db.batch([
          db.prepare('DELETE FROM admin_sessions WHERE username = ?').bind(existing.username),
          db.prepare('DELETE FROM admin_users WHERE id = ?').bind(id),
        ]);
        return jsonResponse({ users: await listAdminUsersD1(db) });
      }
    }

    if (method === 'POST' && path === '/api/admin/inspect-link') {
      if (!hasPermissionD1(auth, 'manage_works')) {
        return jsonResponse({ error: 'ليس لديك صلاحية تنفيذ هذه المهمة.' }, 403);
      }
      const body = (await request.json().catch(() => ({}))) as {
        url?: string;
        source_method?: SourceMethod;
        content_type?: ContentType;
      };
      if (!body.url?.trim()) return jsonResponse({ error: 'يرجى إدخال الرابط أولاً.' }, 400);
      const result = await inspectUrlEdge(body.url, body.source_method, body.content_type);
      return jsonResponse(result);
    }

    if (method === 'GET' && path === '/api/admin/works') {
      if (!hasPermissionD1(auth, 'manage_works')) {
        return jsonResponse({ error: 'ليس لديك صلاحية إدارة المحتويات.' }, 403);
      }
      const q = (url.searchParams.get('q') || '').trim();
      const categoryId = url.searchParams.get('categoryId') ? Number(url.searchParams.get('categoryId')) : null;
      const contentType = (url.searchParams.get('contentType') || '').trim();
      const gradeLevel = (url.searchParams.get('gradeLevel') || '').trim();
      const status = (url.searchParams.get('status') || '').trim();

      const conditions: string[] = [];
      const params: unknown[] = [];
      if (q) {
        conditions.push(`(w.title LIKE ? OR w.student_name LIKE ? OR w.keywords LIKE ?)`);
        const like = `%${q}%`;
        params.push(like, like, like);
      }
      if (categoryId && Number.isFinite(categoryId)) {
        const catFilter = buildCategoryFilterSqlD1(await getCategoryTreeIdsD1(db, categoryId));
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
      const items = await queryWorksD1(db, whereClause, params, CUSTOM_WORK_ORDER_SQL);
      return jsonResponse({ items });
    }

    if (method === 'PUT' && path === '/api/admin/works/reorder') {
      if (!hasPermissionD1(auth, 'manage_works')) {
        return jsonResponse({ error: 'ليس لديك صلاحية ترتيب المحتويات.' }, 403);
      }
      const body = (await request.json().catch(() => ({}))) as {
        orders?: Array<{ id?: unknown; sort_order?: unknown }>;
      };
      const orders = Array.isArray(body.orders) ? body.orders : null;
      if (!orders || orders.length === 0) {
        return jsonResponse({ error: 'بيانات الترتيب غير صالحة.' }, 400);
      }
      const stmts: D1PreparedStatement[] = [];
      for (const entry of orders) {
        const id = Number(entry?.id);
        const sortOrder = Number(entry?.sort_order);
        if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(sortOrder) || sortOrder < 0) {
          return jsonResponse({ error: 'أرقام الترتيب غير صالحة.' }, 400);
        }
        stmts.push(
          db
            .prepare(`UPDATE work_items SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(Math.floor(sortOrder), id)
        );
      }
      await db.batch(stmts);
      return jsonResponse({ ok: true });
    }

    if (method === 'POST' && path === '/api/admin/works/bulk') {
      if (!hasPermissionD1(auth, 'manage_works')) {
        return jsonResponse({ error: 'ليس لديك صلاحية إضافة المحتويات.' }, 403);
      }
      const body = (await request.json().catch(() => ({}))) as { items?: unknown[] };
      const rawItems = Array.isArray(body.items) ? body.items : null;
      if (!rawItems || rawItems.length === 0) {
        return jsonResponse({ error: 'يرجى إرسال قائمة مشاريع صالحة للاستيراد.' }, 400);
      }
      if (rawItems.length > 100) {
        return jsonResponse({ error: 'الحد الأقصى للاستيراد في الدفعة الواحدة هو 100 موضوع.' }, 400);
      }

      const prepared: Array<Extract<ReturnType<typeof sanitizeWorkPayloadEdge>, { data: unknown }>> = [];
      for (let i = 0; i < rawItems.length; i++) {
        const parsed = sanitizeWorkPayloadEdge((rawItems[i] || {}) as Record<string, unknown>);
        if ('error' in parsed) {
          return jsonResponse({ error: `السطر رقم ${i + 1}: ${parsed.error}` }, 400);
        }
        prepared.push(parsed);
      }

      const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM work_items').first<{ m: number }>();
      let nextOrder = Number(maxRow?.m || 0) + 1;

      const insertSql = `
        INSERT INTO work_items (
          title, description, student_name, grade_level, class_section, publish_date,
          content_type, source_method, original_url, embed_url, media_mime,
          thumbnail_url, gallery_urls, extra_media, category_id, subcategory_id, extra_category_ids, keywords,
          status, featured, embed_status, embed_note, sort_order, is_sample
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `;

      const stmts = prepared.map((entry) => {
        const d = entry.data;
        const effectiveOrder = d.sort_order > 0 ? d.sort_order : nextOrder++;
        return db
          .prepare(insertSql)
          .bind(
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
      });

      await db.batch(stmts);
      return jsonResponse({ inserted: prepared.length }, 201);
    }

    if (method === 'POST' && path === '/api/admin/works') {
      if (!hasPermissionD1(auth, 'manage_works')) {
        return jsonResponse({ error: 'ليس لديك صلاحية إضافة المحتويات.' }, 403);
      }
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const parsed = sanitizeWorkPayloadEdge(body);
      if ('error' in parsed) return jsonResponse({ error: parsed.error }, 400);
      const d = parsed.data;
      let effectiveOrder = d.sort_order;
      if (effectiveOrder <= 0) {
        const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM work_items').first<{ m: number }>();
        effectiveOrder = Number(maxRow?.m || 0) + 1;
      }

      const res = await db
        .prepare(`
          INSERT INTO work_items (
            title, description, student_name, grade_level, class_section, publish_date,
            content_type, source_method, original_url, embed_url, media_mime,
            thumbnail_url, gallery_urls, extra_media, category_id, subcategory_id, extra_category_ids, keywords,
            status, featured, embed_status, embed_note, sort_order, is_sample
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `)
        .bind(
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
        )
        .run();
      const created = (await queryWorksD1(db, 'WHERE w.id = ?', [res.meta?.last_row_id], 'w.id DESC', 1))[0];
      return jsonResponse({ item: created }, 201);
    }

    if (method === 'DELETE' && path === '/api/admin/works/samples') {
      if (!hasPermissionD1(auth, 'delete_works')) {
        return jsonResponse({ error: 'ليس لديك صلاحية مسح المحتويات.' }, 403);
      }
      const res = await db.prepare('DELETE FROM work_items WHERE is_sample = 1').run();
      return jsonResponse({ deleted: Number(res.meta?.changes || 0) });
    }

    const adminWorkStatusMatch = path.match(/^\/api\/admin\/works\/(\d+)\/status$/);
    if (method === 'PATCH' && adminWorkStatusMatch) {
      if (!hasPermissionD1(auth, 'manage_works')) {
        return jsonResponse({ error: 'ليس لديك صلاحية تعديل حالة المحتويات.' }, 403);
      }
      const id = Number(adminWorkStatusMatch[1]);
      const body = (await request.json().catch(() => ({}))) as { status?: PublishStatus };
      if (!VALID_STATUSES.includes(body.status as PublishStatus)) {
        return jsonResponse({ error: 'حالة غير صالحة.' }, 400);
      }
      await db
        .prepare(`UPDATE work_items SET status = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(body.status, id)
        .run();
      const updated = (await queryWorksD1(db, 'WHERE w.id = ?', [id], 'w.id DESC', 1))[0];
      return jsonResponse({ item: updated });
    }

    const adminWorkIdMatch = path.match(/^\/api\/admin\/works\/(\d+)$/);
    if (adminWorkIdMatch) {
      const id = Number(adminWorkIdMatch[1]);
      if (method === 'GET') {
        if (!hasPermissionD1(auth, 'manage_works')) {
          return jsonResponse({ error: 'ليس لديك صلاحية عرض تفاصيل التعديل.' }, 403);
        }
        const items = await queryWorksD1(db, 'WHERE w.id = ?', [id], 'w.id DESC', 1);
        if (!items.length) return jsonResponse({ error: 'المحتوى غير موجود.' }, 404);
        return jsonResponse({ item: items[0] });
      }
      if (method === 'PUT') {
        if (!hasPermissionD1(auth, 'manage_works')) {
          return jsonResponse({ error: 'ليس لديك صلاحية تعديل المحتويات.' }, 403);
        }
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const parsed = sanitizeWorkPayloadEdge(body);
        if ('error' in parsed) return jsonResponse({ error: parsed.error }, 400);
        const d = parsed.data;
        await db
          .prepare(`
            UPDATE work_items SET
              title = ?, description = ?, student_name = ?, grade_level = ?, class_section = ?,
              publish_date = ?, content_type = ?, source_method = ?, original_url = ?,
              embed_url = ?, media_mime = ?, thumbnail_url = ?, gallery_urls = ?, extra_media = ?,
              category_id = ?, subcategory_id = ?, extra_category_ids = ?, keywords = ?, status = ?, featured = ?,
              embed_status = ?, embed_note = ?, sort_order = ?, updated_at = datetime('now')
            WHERE id = ?
          `)
          .bind(
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
          )
          .run();
        const updated = (await queryWorksD1(db, 'WHERE w.id = ?', [id], 'w.id DESC', 1))[0];
        return jsonResponse({ item: updated });
      }
      if (method === 'DELETE') {
        if (!hasPermissionD1(auth, 'delete_works')) {
          return jsonResponse({ error: 'ليس لديك صلاحية مسح المحتويات.' }, 403);
        }
        await db.prepare('DELETE FROM work_items WHERE id = ?').bind(id).run();
        return jsonResponse({ ok: true });
      }
    }

    if (path === '/api/admin/categories') {
      if (method === 'GET') {
        return jsonResponse({ categories: await getCategoriesD1(db, false) });
      }
      if (method === 'POST') {
        if (!hasPermissionD1(auth, 'manage_categories')) {
          return jsonResponse({ error: 'ليس لديك صلاحية إدارة التصنيفات.' }, 403);
        }
        const body = (await request.json().catch(() => ({}))) as {
          name?: string;
          description?: string;
          parent_id?: number | null;
        };
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return jsonResponse({ error: 'يرجى إدخال اسم التصنيف.' }, 400);
        const slug = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM categories').first<{ m: number }>();
        const res = await db
          .prepare('INSERT INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, ?, ?, ?)')
          .bind(name, slug, body.parent_id ? Number(body.parent_id) : null, body.description?.trim() || '', Number(maxRow?.m || 0) + 1)
          .run();
        return jsonResponse({ id: res.meta?.last_row_id, categories: await getCategoriesD1(db, false) }, 201);
      }
    }

    if (method === 'PUT' && path === '/api/admin/categories/reorder') {
      if (!hasPermissionD1(auth, 'manage_categories')) {
        return jsonResponse({ error: 'ليس لديك صلاحية إدارة التصنيفات.' }, 403);
      }
      const body = (await request.json().catch(() => ({}))) as {
        orders?: Array<{ id?: unknown; sort_order?: unknown }>;
      };
      const orders = Array.isArray(body.orders) ? body.orders : null;
      if (!orders || orders.length === 0) {
        return jsonResponse({ error: 'بيانات ترتيب التصنيفات غير صالحة.' }, 400);
      }
      const stmts: D1PreparedStatement[] = [];
      for (const entry of orders) {
        const id = Number(entry?.id);
        const sortOrder = Number(entry?.sort_order);
        if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(sortOrder) || sortOrder < 0) {
          return jsonResponse({ error: 'أرقام ترتيب التصنيفات غير صالحة.' }, 400);
        }
        stmts.push(db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(Math.floor(sortOrder), id));
      }
      await db.batch(stmts);
      return jsonResponse({ categories: await getCategoriesD1(db, false) });
    }

    const catIdMatch = path.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (catIdMatch) {
      if (!hasPermissionD1(auth, 'manage_categories')) {
        return jsonResponse({ error: 'ليس لديك صلاحية إدارة التصنيفات.' }, 403);
      }
      const id = Number(catIdMatch[1]);
      if (method === 'PUT') {
        const body = (await request.json().catch(() => ({}))) as { name?: string; description?: string };
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return jsonResponse({ error: 'اسم التصنيف مطلوب.' }, 400);
        await db
          .prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?')
          .bind(name, body.description?.trim() || '', id)
          .run();
        return jsonResponse({ categories: await getCategoriesD1(db, false) });
      }
      if (method === 'DELETE') {
        const usage = await db.prepare('SELECT COUNT(*) as c FROM work_items WHERE category_id = ?').bind(id).first<{ c: number }>();
        if (Number(usage?.c || 0) > 0) {
          return jsonResponse({ error: 'لا يمكن حذف تصنيف يحتوي على إنتاجات مرتبطة به.' }, 409);
        }
        const removedIds = new Set(await getCategoryTreeIdsD1(db, id));
        const { results: worksWithExtras = [] } = await db
          .prepare(`SELECT id, extra_category_ids FROM work_items WHERE extra_category_ids != '[]'`)
          .all<{ id: number; extra_category_ids: string }>();
        const stmts: D1PreparedStatement[] = [];
        for (const w of worksWithExtras) {
          try {
            const parsed = JSON.parse(w.extra_category_ids);
            if (Array.isArray(parsed)) {
              const filtered = parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0 && !removedIds.has(n));
              if (filtered.length !== parsed.length) {
                stmts.push(
                  db.prepare('UPDATE work_items SET extra_category_ids = ? WHERE id = ?').bind(JSON.stringify(filtered), w.id)
                );
              }
            }
          } catch {
            // ignore
          }
        }
        stmts.push(
          db.prepare('UPDATE work_items SET subcategory_id = NULL WHERE subcategory_id = ?').bind(id),
          db.prepare('DELETE FROM categories WHERE parent_id = ?').bind(id),
          db.prepare('DELETE FROM categories WHERE id = ?').bind(id)
        );
        await db.batch(stmts);
        return jsonResponse({ categories: await getCategoriesD1(db, false) });
      }
    }

    if (path === '/api/admin/settings') {
      if (!hasPermissionD1(auth, 'manage_settings')) {
        return jsonResponse({ error: 'ليس لديك صلاحية إدارة إعدادات المنصة.' }, 403);
      }
      if (method === 'GET') {
        return jsonResponse({ settings: await getSettingsD1(db) });
      }
      if (method === 'PUT') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const stmts: D1PreparedStatement[] = [];
        for (const k of SETTING_KEYS) {
          const val = body[k];
          if (typeof val === 'string') {
            let trimmed = val.trim();
            if ((k === 'hero_cover_url' || k === 'logo_url') && trimmed) {
              if (!isSafeUrl(trimmed)) {
                return jsonResponse({ error: `الرابط المدخل للحقل ${k} غير صالح.` }, 400);
              }
              trimmed = normalizeImageUrl(trimmed);
            }
            if (k.startsWith('bg_') && trimmed) {
              if (!isSafeBackgroundValue(trimmed)) {
                return jsonResponse({ error: `قيمة الخلفية للحقل ${k} غير صالحة.` }, 400);
              }
              trimmed = normalizeBackgroundValue(trimmed);
            }
            if (
              (k === 'primary_color' || k === 'announcement_bg_color') &&
              trimmed &&
              !/^#[0-9a-fA-F]{6}$/.test(trimmed)
            ) {
              return jsonResponse({ error: `صيغة اللون المدخل للحقل ${k} غير صالحة.` }, 400);
            }
            stmts.push(
              db
                .prepare(
                  'INSERT INTO platform_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
                )
                .bind(k, trimmed)
            );
          }
        }
        if (stmts.length) await db.batch(stmts);
        return jsonResponse({ settings: await getSettingsD1(db) });
      }
    }
  }

  return jsonResponse({ error: 'المسار غير موجود.' }, 404);
}
