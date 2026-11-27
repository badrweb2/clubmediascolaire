import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type { Category, ContentType, ExtraMediaItem, PlatformSettings, PublicSiteStats, PublishStatus, SourceMethod, WorkItem } from '../src/types.ts';
import { ALL_ADMIN_PERMISSIONS, DEFAULT_PLATFORM_SETTINGS, mergePlatformSettings } from '../src/lib/settingsDefaults.ts';

const dbPath = path.resolve(process.cwd(), 'school_platform.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_items (
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
    );

    CREATE TABLE IF NOT EXISTS platform_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_date TEXT NOT NULL DEFAULT (date('now')),
      path TEXT NOT NULL DEFAULT '/',
      visitor_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureAdminUserColumns();
  ensureWorkSortOrderColumn();
  seedPlatformSettings();
  seedCategories();
  ensureExtraCategoriesOnce();
  seedSampleWorks();
  migrateRealStatsOnce();
}

function ensureAdminUserColumns(): void {
  const cols = db.prepare(`PRAGMA table_info(admin_users)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'display_name')) {
    db.exec(`ALTER TABLE admin_users ADD COLUMN display_name TEXT NOT NULL DEFAULT '';`);
  }
  if (!cols.some((c) => c.name === 'permissions_json')) {
    db.exec(`ALTER TABLE admin_users ADD COLUMN permissions_json TEXT NOT NULL DEFAULT '[]';`);
  }
  if (!cols.some((c) => c.name === 'is_active')) {
    db.exec(`ALTER TABLE admin_users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!cols.some((c) => c.name === 'is_primary')) {
    db.exec(`ALTER TABLE admin_users ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0;`);
  }

  const flag = db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_admin_rbac_migrated'`)
    .get() as { value: string } | undefined;
  if (flag?.value === '1') return;

  const firstAdmin = db
    .prepare('SELECT id FROM admin_users ORDER BY id ASC LIMIT 1')
    .get() as { id: number } | undefined;
  if (firstAdmin) {
    db.prepare(
      `UPDATE admin_users SET is_primary = 1, is_active = 1, permissions_json = ? WHERE id = ?`
    ).run(JSON.stringify([...ALL_ADMIN_PERMISSIONS]), firstAdmin.id);
  }
  db.prepare(
    `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('_internal_admin_rbac_migrated', '1')`
  ).run();
}

function ensureWorkSortOrderColumn(): void {
  const cols = db.prepare(`PRAGMA table_info(work_items)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'sort_order')) {
    db.exec(`ALTER TABLE work_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!cols.some((c) => c.name === 'extra_media')) {
    db.exec(`ALTER TABLE work_items ADD COLUMN extra_media TEXT NOT NULL DEFAULT '[]';`);
  }
  if (!cols.some((c) => c.name === 'extra_category_ids')) {
    db.exec(`ALTER TABLE work_items ADD COLUMN extra_category_ids TEXT NOT NULL DEFAULT '[]';`);
  }
  const flag = db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_work_sort_order_migrated'`)
    .get() as { value: string } | undefined;
  if (flag?.value === '1') return;

  const existing = db
    .prepare('SELECT id FROM work_items ORDER BY publish_date DESC, id DESC')
    .all() as Array<{ id: number }>;
  const upd = db.prepare('UPDATE work_items SET sort_order = ? WHERE id = ?');
  existing.forEach((row, idx) => {
    upd.run(idx + 1, row.id);
  });
  db.prepare(
    `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('_internal_work_sort_order_migrated', '1')`
  ).run();
}

function seedPlatformSettings(): void {
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(DEFAULT_PLATFORM_SETTINGS)) {
    insertSetting.run(key, value);
  }
}

function migrateRealStatsOnce(): void {
  const flag = db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_real_stats_migrated'`)
    .get() as { value: string } | undefined;
  if (flag?.value === '1') return;

  db.prepare('UPDATE work_items SET views_count = 0 WHERE is_sample = 1').run();
  db.prepare(
    `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('_internal_real_stats_migrated', '1')`
  ).run();
}

function seedCategories(): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (existing.count > 0) return;

  const insertCat = db.prepare(
    'INSERT INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  const mainCategories: Array<{
    name: string;
    slug: string;
    description: string;
    subs: Array<{ name: string; slug: string }>;
  }> = [
    {
      name: 'الفيديوهات والإنتاجات المرئية',
      slug: 'videos',
      description: 'أفلام تربوية قصيرة، شروحات مبسطة، وتغطيات مصورة لأنشطة المؤسسة.',
      subs: [
        { name: 'تجارب علمية مصورة', slug: 'videos-science' },
        { name: 'تغطيات الاحتفالات والأنشطة', slug: 'videos-events' },
      ],
    },
    {
      name: 'الصوتيات والإذاعة المدرسية',
      slug: 'audio-radio',
      description: 'فقرات الإذاعة الصباحية، البودكاست الطلابي، والقراءات الأدبية.',
      subs: [
        { name: 'الإذاعة المدرسية الصباحية', slug: 'radio-morning' },
        { name: 'بودكاست وقراءات التلاميذ', slug: 'radio-podcast' },
      ],
    },
    {
      name: 'الصور والفنون التشكيلية',
      slug: 'arts-photos',
      description: 'اللوحات الفنية، الخط والزخرفة، والتصوير الفوتوغرافي المدرسي.',
      subs: [
        { name: 'الرسم والألوان المائية', slug: 'arts-painting' },
        { name: 'الزخرفة والخط العربي', slug: 'arts-calligraphy' },
      ],
    },
    {
      name: 'المشاريع والابتكارات',
      slug: 'projects',
      description: 'المشاريع العلمية الفردية والجماعية ونماذج الروبوتيك والطاقة النظيفة.',
      subs: [
        { name: 'الروبوتيك والبرمجة', slug: 'projects-robotics' },
        { name: 'البيئة والطاقة المتجددة', slug: 'projects-environment' },
      ],
    },
    {
      name: 'الأنشطة الثقافية والتربوية',
      slug: 'cultural-activities',
      description: 'نادي القراءة، المسرح المدرسي، والأيام الثقافية والبيئية.',
      subs: [
        { name: 'نادي القراءة والكتابة', slug: 'cultural-reading' },
      ],
    },
    {
      name: 'العروض والبحوث المدرسية',
      slug: 'research-presentations',
      description: 'العروض التقديمية، المجلات الحائطية والرقمية، والبحوث المدرسية.',
      subs: [
        { name: 'المجلة المدرسية الرقمية', slug: 'research-magazine' },
        { name: 'العروض التقديمية', slug: 'research-slides' },
      ],
    },
    {
      name: 'المسابقات والتحديات',
      slug: 'competitions',
      description: 'مشاركات التلاميذ في الأولمبياد، تحدي القراءة، والمسابقات الفنية.',
      subs: [],
    },
    {
      name: 'إبداعات التلاميذ',
      slug: 'student-creations',
      description: 'مساحة مفتوحة للمواهب الفردية والمبادرات الإبداعية المتنوعة.',
      subs: [],
    },
  ];

  mainCategories.forEach((cat, idx) => {
    const res = insertCat.run(cat.name, cat.slug, null, cat.description, idx + 1);
    const parentId = Number(res.lastInsertRowid);
    cat.subs.forEach((sub, sIdx) => {
      insertCat.run(sub.name, sub.slug, parentId, '', sIdx + 1);
    });
  });
}

function ensureExtraCategoriesOnce(): void {
  const flag = db
    .prepare(`SELECT value FROM platform_settings WHERE key = '_internal_extra_cats_v2_seeded'`)
    .get() as { value: string } | undefined;
  if (flag?.value === '1') return;

  const insertCat = db.prepare(
    'INSERT OR IGNORE INTO categories (name, slug, parent_id, description, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const existsByNameOrSlug = (name: string, slug: string) =>
    Boolean(db.prepare('SELECT id FROM categories WHERE slug = ? OR name = ?').get(slug, name));

  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').get() as { m: number }
  ).m;

  if (!existsByNameOrSlug('تصاميم وإبداعات', 'designs-creations')) {
    insertCat.run(
      'تصاميم وإبداعات',
      'designs-creations',
      null,
      'تصاميم رقمية، ملصقات إبداعية، وأعمال فنية مختارة للتلاميذ.',
      maxOrder + 1
    );
  }

  const projectsParent = db
    .prepare(`SELECT id FROM categories WHERE slug = 'projects' OR name = 'المشاريع والابتكارات' LIMIT 1`)
    .get() as { id: number } | undefined;

  if (projectsParent) {
    if (!existsByNameOrSlug('ابتكارات النادي العلمي والتكنولوجي', 'projects-science-club')) {
      insertCat.run(
        'ابتكارات النادي العلمي والتكنولوجي',
        'projects-science-club',
        projectsParent.id,
        'ابتكارات وتجارب النادي العلمي والتكنولوجي.',
        10
      );
    }
    if (!existsByNameOrSlug('مشاريع رقمية', 'projects-digital')) {
      insertCat.run(
        'مشاريع رقمية',
        'projects-digital',
        projectsParent.id,
        'برمجة ومشاريع رقمية وتطبيقات تلاميذ المؤسسة.',
        11
      );
    }
  }

  db.prepare(
    `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('_internal_extra_cats_v2_seeded', '1')`
  ).run();
}

function seedSampleWorks(): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM work_items').get() as { count: number };
  if (existing.count > 0) return;

  const catBySlug = (slug: string): number => {
    const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as { id: number } | undefined;
    return row ? row.id : 1;
  };

  const insertWork = db.prepare(`
    INSERT INTO work_items (
      title, description, student_name, grade_level, class_section, publish_date,
      content_type, source_method, original_url, embed_url, media_mime,
      thumbnail_url, gallery_urls, category_id, subcategory_id, keywords,
      status, featured, embed_status, embed_note, views_count, sort_order, is_sample
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const samples: Array<{
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
    catSlug: string;
    subSlug: string | null;
    keywords: string;
    status: PublishStatus;
    featured: number;
    views_count: number;
  }> = [
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
      gallery_urls: [
        '/src/assets/images/thumb_science_solar_1795563099401.jpg',
        '/src/assets/images/thumb_robotics_club_1795563100911.jpg',
      ],
      catSlug: 'projects',
      subSlug: 'projects-environment',
      keywords: 'طاقة شمسية, ري ذكي, علوم, بيئة, ابتكار',
      status: 'published',
      featured: 1,
      views_count: 0,
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
      gallery_urls: [],
      catSlug: 'videos',
      subSlug: 'videos-science',
      keywords: 'روبوتيك, برمجة, فيديو تعليمي, نادي العلوم',
      status: 'published',
      featured: 1,
      views_count: 0,
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
      gallery_urls: [],
      catSlug: 'audio-radio',
      subSlug: 'radio-morning',
      keywords: 'إذاعة مدرسية, صوتيات, مطالعة, تواصل',
      status: 'published',
      featured: 0,
      views_count: 0,
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
      gallery_urls: [
        '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
        '/src/assets/images/hero_school_cover_1795563098821.jpg',
      ],
      catSlug: 'arts-photos',
      subSlug: 'arts-painting',
      keywords: 'رسم, ألوان مائية, زخرفة, فنون تشكيلية',
      status: 'published',
      featured: 1,
      views_count: 0,
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
      gallery_urls: [],
      catSlug: 'research-presentations',
      subSlug: 'research-magazine',
      keywords: 'مجلة مدرسية, PDF, صحافة, مقالات',
      status: 'published',
      featured: 0,
      views_count: 0,
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
      gallery_urls: [],
      catSlug: 'research-presentations',
      subSlug: 'research-slides',
      keywords: 'عرض تقديمي, تراث, هندسة, بحث مدرسي',
      status: 'published',
      featured: 0,
      views_count: 0,
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
      gallery_urls: [],
      catSlug: 'cultural-activities',
      subSlug: 'cultural-reading',
      keywords: 'بودكاست, قراءة, كتاب, صوتي',
      status: 'published',
      featured: 0,
      views_count: 0,
    },
    {
      title: 'ملف تحضيري: تغطية اليوم الوطني للتعاون المدرسي (مسودة)',
      description:
        'مادة إعلامية قيد المراجعة توثق فقرات اليوم الثقافي والتطوعي لتجميل فضاءات المؤسسة.',
      student_name: 'نادي البيئة والمواطنة',
      grade_level: 'عمل جماعي مشترك',
      class_section: 'جميع الأقسام',
      publish_date: '2026-11-22',
      content_type: 'project',
      source_method: 'project_bundle',
      original_url: '/api/samples/solar-project-report.pdf',
      embed_url: '/api/samples/solar-project-report.pdf',
      media_mime: 'application/pdf',
      thumbnail_url: '/src/assets/images/hero_school_cover_1795563098821.jpg',
      gallery_urls: ['/src/assets/images/hero_school_cover_1795563098821.jpg'],
      catSlug: 'student-creations',
      subSlug: null,
      keywords: 'تعاون مدرسي, أنشطة, مسودة',
      status: 'draft',
      featured: 0,
      views_count: 0,
    },
  ];

  samples.forEach((s, idx) => {
    const catId = catBySlug(s.catSlug);
    const subId = s.subSlug ? catBySlug(s.subSlug) : null;
    insertWork.run(
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
      JSON.stringify(s.gallery_urls),
      catId,
      subId,
      s.keywords,
      s.status,
      s.featured,
      'ok',
      '',
      s.views_count,
      idx + 1
    );
  });
}

export function getSettings(): PlatformSettings {
  const rows = db
    .prepare(`SELECT key, value FROM platform_settings WHERE key NOT LIKE '_internal_%'`)
    .all() as Array<{
    key: string;
    value: string;
  }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return mergePlatformSettings(map);
}

export function getPublicSiteStats(): PublicSiteStats {
  const visitRow = db
    .prepare(`
      SELECT
        COUNT(*) AS total_site_visits,
        SUM(CASE WHEN visit_date = date('now') THEN 1 ELSE 0 END) AS today_site_visits,
        COUNT(DISTINCT NULLIF(visitor_hash, '')) AS unique_visitors
      FROM platform_visits
    `)
    .get() as Record<string, number> | undefined;

  const viewsRow = db
    .prepare(`SELECT COALESCE(SUM(views_count), 0) AS total_work_views FROM work_items WHERE status = 'published'`)
    .get() as Record<string, number> | undefined;

  return {
    total_site_visits: Number(visitRow?.total_site_visits || 0),
    today_site_visits: Number(visitRow?.today_site_visits || 0),
    unique_visitors: Number(visitRow?.unique_visitors || 0),
    total_work_views: Number(viewsRow?.total_work_views || 0),
  };
}

export function mapWorkRow(row: Record<string, unknown>): WorkItem {
  let gallery: string[] = [];
  try {
    const parsed = JSON.parse(String(row.gallery_urls || '[]'));
    if (Array.isArray(parsed)) {
      gallery = parsed.filter((u): u is string => typeof u === 'string');
    }
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
    subcategory_id: row.subcategory_id !== null && row.subcategory_id !== undefined ? Number(row.subcategory_id) : null,
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

export function getCategoriesWithCounts(publishedOnly: boolean): Category[] {
  const catRows = db
    .prepare(
      `SELECT * FROM categories ORDER BY parent_id IS NOT NULL ASC, sort_order ASC, id ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const parentById = new Map<number, number | null>();
  for (const r of catRows) {
    parentById.set(
      Number(r.id),
      r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null
    );
  }

  const workRows = db
    .prepare(
      publishedOnly
        ? `SELECT id, category_id, subcategory_id, extra_category_ids FROM work_items WHERE status = 'published'`
        : `SELECT id, category_id, subcategory_id, extra_category_ids FROM work_items`
    )
    .all() as Array<Record<string, unknown>>;

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
