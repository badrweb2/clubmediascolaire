import type { FaqItem, PlatformSettings } from '../types.ts';

export const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    question: 'ما هي المنصة التعليمية لمدرسة الحسن الداخل؟',
    answer:
      'هي فضاء رقمي تربوي وإعلامي دائم يُعنى بعرض وتوثيق إنتاجات التلاميذ وإبداعات الأندية المدرسية في مختلف المجالات العلمية، الثقافية، الفنية، والإذاعية.',
  },
  {
    question: 'كيف يمكن للتلميذ نشر إنتاجه على المنصة؟',
    answer:
      'يسلّم التلميذ عمله (فيديو، تسجيل صوتي، لوحة فنية، بحث أو مشروع) إلى منسق النادي أو الأستاذ المشرف، حيث تتم مراجعته تربوياً ونشره عبر لوحة الإدارة الرسمية للمنصة.',
  },
  {
    question: 'هل تعمل الفيديوهات والتسجيلات الإذاعية مباشرة داخل الموقع؟',
    answer:
      'نعم، توفر المنصة مشغلات مدمجة للفيديو، الإذاعة المدرسية، معرض الصور التفاعلي، وقارئ ملفات PDF والعروض التقديمية دون الحاجة لمغادرة الصفحة.',
  },
  {
    question: 'كيف أبحث عن عمل تلميذ معين أو مستوى دراسي محدد؟',
    answer:
      'يمكنكم التوجه إلى صفحة «إنتاجات» من القائمة الرئيسية، واستخدام شريط البحث الفوري أو خيارات التصفية حسب التصنيف، نوع المحتوى، والمستوى الدراسي.',
  },
];

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  school_name: 'مدرسة الحسن الداخل',
  platform_title: 'المنصة التعليمية لمدرسة الحسن الداخل',
  platform_tagline:
    'معرض رقمي ومكتبة مدرسية تفاعلية لعرض وحفظ وتوثيق إنتاجات وإبداعات التلاميذ في العلوم والفنون والإذاعة والمشاريع التربوية.',
  hero_cover_url: '/src/assets/images/hero_school_cover_1795563098821.jpg',
  logo_url: '/assets/aistudio/LOGO_e619da1e.png',
  academic_year: '2026 / 2027',
  footer_note: 'جميع الحقوق محفوظة لمدرسة الحسن الداخل — معرض الإبداع الطلابي الرقمي',
  hero_badge_text: 'المعرض الرقمي الدائم',
  hero_primary_btn_text: 'تصفح جميع الإنتاجات',
  hero_secondary_btn_text: 'المشاريع والابتكارات',
  footer_publish_note:
    'تُراجع جميع الإنتاجات الطلابية وتُنشر بإشراف إدارة المؤسسة والنادي الإعلامي لضمان جودة المحتوى التربوي.',
  primary_color: '#1E40AF',
  nav_home_label: 'الرئيسية',
  nav_videos_label: 'الفيديوهات',
  nav_audio_label: 'الإذاعة المدرسية',
  nav_innovations_label: 'ابتكارات',
  nav_projects_label: 'مشاريع',
  nav_activities_label: 'أنشطة',
  nav_works_label: 'إنتاجات',
  show_stats_bar: '1',
  show_categories_section: '1',
  categories_section_title: 'استكشف الإنتاجات حسب المجال',
  show_latest_section: '1',
  latest_section_title: 'أحدث الإنتاجات المنشورة',
  show_featured_section: '1',
  featured_section_title: 'المشاريع المدرسية المتميزة',
  show_most_viewed_section: '1',
  most_viewed_section_title: 'الإنتاجات الأكثر مشاهدة',
  show_radio_corner: '1',
  radio_corner_title: 'ركن الإذاعة المدرسية والبودكاست',
  show_art_corner: '1',
  art_corner_title: 'معرض الصور والإبداعات الفنية',
  show_video_corner: '1',
  video_corner_title: 'ركن الفيديوهات التعليمية والإبداعية',
  show_project_corner: '1',
  project_corner_title: 'ركن المشاريع والبحوث والمجلة الرقمية',
  show_view_counts: '1',
  show_share_button: '1',
  about_button_label: 'حول المنصة',
  about_title: 'حول المنصة التعليمية لمدرسة الحسن الداخل',
  about_definition:
    'المنصة التعليمية لمدرسة الحسن الداخل هي مكتبة رقمية ومعرض تفاعلي دائم يهدف إلى تثمين مواهب المتعلمات والمتعلمين، وتوثيق مشاريعهم التربوية والعلمية والفنية والإذاعية في بيئة رقمية آمنة وسهلة التصفح للتلاميذ والأطر التربوية والأسر.',
  about_contents: [
    'ركن الفيديوهات التعليمية والتجارب العلمية المصورة وتغطيات الأنشطة.',
    'ركن الإذاعة المدرسية الصباحية والبودكاست والقراءات الصوتية للتلاميذ.',
    'قسم الابتكارات ونوادي الروبوتيك والبرمجة والطاقات المتجددة.',
    'ركن المشاريع المدرسية، المجلات الرقمية (PDF)، والعروض التقديمية والبحوث.',
    'ركن الأنشطة الثقافية والتربوية، المعرض الفني، والمسابقات المدرسية.',
  ].join('\n'),
  about_objectives: [
    'تشجيع التلاميذ على الإبداع والبحث العلمي والتعبير الإعلامي والشفهي.',
    'حفظ الذاكرة الرقمية لأنشطة المدرسة وإنتاجات الأندية التربوية عبر المواسم الدراسية.',
    'تنمية المهارات الرقمية والعمل الجماعي وروح المبادرة والابتكار لدى المتعلمين.',
    'مد جسور التواصل التربوي بين المؤسسة التعليمية والأسرة والمحيط الثقافي.',
  ].join('\n'),
  supervisor_name: 'الأستاذ بدر الريمش',
  supervisor_title: 'المشرف العام على المنصة ومنسق النادي الإعلامي والرقمي',
  supervisor_bio:
    'يتولى الإشراف التربوي والتقني على المنصة، ومواكبة التلاميذ في إعداد ومراجعة الإنتاجات الإعلامية والعلمية والفنية قبل نشرها في المعرض الرقمي.',
  about_faq_json: JSON.stringify(DEFAULT_FAQ_ITEMS),
};

export const SETTING_KEYS = Object.keys(DEFAULT_PLATFORM_SETTINGS) as Array<keyof PlatformSettings>;

export function mergePlatformSettings(rawMap: Record<string, string | undefined>): PlatformSettings {
  const out: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const val = rawMap[key];
    out[key] = typeof val === 'string' && val !== '' ? val : DEFAULT_PLATFORM_SETTINGS[key];
    // Preserve explicit empty string for toggle/optional text fields if stored intentionally
    if (typeof val === 'string' && key.startsWith('show_')) {
      out[key] = val;
    }
  }
  return out as unknown as PlatformSettings;
}

export function parseFaqJson(raw: string): FaqItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_FAQ_ITEMS;
    const valid = parsed.filter(
      (item): item is FaqItem =>
        Boolean(item) &&
        typeof item.question === 'string' &&
        typeof item.answer === 'string' &&
        (item.question.trim().length > 0 || item.answer.trim().length > 0)
    );
    return valid.length > 0 ? valid : DEFAULT_FAQ_ITEMS;
  } catch {
    return DEFAULT_FAQ_ITEMS;
  }
}

export function parseMultilineList(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isSettingEnabled(val: string | undefined): boolean {
  return val !== '0' && val !== 'false';
}
