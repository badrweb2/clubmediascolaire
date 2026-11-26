import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type { Category, ContentType, PlatformSettings, PublishStatus, SourceMethod, WorkItem } from '../src/types.ts';

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
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      subcategory_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      keywords TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      featured INTEGER NOT NULL DEFAULT 0,
      embed_status TEXT NOT NULL DEFAULT 'ok',
      embed_note TEXT NOT NULL DEFAULT '',
      views_count INTEGER NOT NULL DEFAULT 0,
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedPlatformSettings();
  seedCategories();
  seedSampleWorks();
}

function seedPlatformSettings(): void {
  const defaults: Record<string, string> = {
    school_name: 'مدرسة الحسن الداخل',
    platform_title: 'المنصة التعليمية لمدرسة الحسن الداخل',
    platform_tagline:
      'معرض رقمي ومكتبة مدرسية تفاعلية لعرض وحفظ وتوثيق إنتاجات وإبداعات التلاميذ في العلوم والفنون والإذاعة والمشاريع التربوية.',
    hero_cover_url: '/src/assets/images/hero_school_cover_1795563098821.jpg',
    logo_url: '/assets/aistudio/LOGO_e619da1e.png',
    academic_year: '2026 / 2027',
    footer_note: 'جميع الحقوق محفوظة لمدرسة الحسن الداخل — معرض الإبداع الطلابي الرقمي',
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run(key, value);
  }
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
      status, featured, embed_status, embed_note, views_count, is_sample
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
      views_count: 342,
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
      views_count: 289,
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
      views_count: 215,
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
      views_count: 264,
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
      views_count: 198,
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
      views_count: 152,
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
      views_count: 134,
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

  for (const s of samples) {
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
      s.views_count
    );
  }
}

export function getSettings(): PlatformSettings {
  const rows = db.prepare('SELECT key, value FROM platform_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    school_name: map.school_name || 'مدرسة الحسن الداخل',
    platform_title: map.platform_title || 'المنصة التعليمية لمدرسة الحسن الداخل',
    platform_tagline: map.platform_tagline || '',
    hero_cover_url: map.hero_cover_url || '/src/assets/images/hero_school_cover_1795563098821.jpg',
    logo_url: map.logo_url || '/assets/aistudio/LOGO_e619da1e.png',
    academic_year: map.academic_year || '2026 / 2027',
    footer_note: map.footer_note || '',
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
    category_id: Number(row.category_id),
    subcategory_id: row.subcategory_id !== null && row.subcategory_id !== undefined ? Number(row.subcategory_id) : null,
    category_name: row.category_name ? String(row.category_name) : undefined,
    subcategory_name: row.subcategory_name ? String(row.subcategory_name) : null,
    keywords: String(row.keywords || ''),
    status: row.status as PublishStatus,
    featured: Boolean(row.featured),
    embed_status: (row.embed_status as 'ok' | 'warning' | 'blocked') || 'ok',
    embed_note: String(row.embed_note || ''),
    views_count: Number(row.views_count || 0),
    is_sample: Boolean(row.is_sample),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export function getCategoriesWithCounts(publishedOnly: boolean): Category[] {
  const countJoin = publishedOnly
    ? `LEFT JOIN work_items w ON (w.category_id = c.id OR w.subcategory_id = c.id) AND w.status = 'published'`
    : `LEFT JOIN work_items w ON (w.category_id = c.id OR w.subcategory_id = c.id)`;

  const rows = db
    .prepare(
      `
      SELECT c.*, COUNT(DISTINCT w.id) as item_count
      FROM categories c
      ${countJoin}
      GROUP BY c.id
      ORDER BY c.parent_id IS NOT NULL ASC, c.sort_order ASC, c.id ASC
    `
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    slug: String(r.slug),
    parent_id: r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null,
    description: String(r.description || ''),
    sort_order: Number(r.sort_order || 0),
    created_at: String(r.created_at || ''),
    item_count: Number(r.item_count || 0),
  }));
}
