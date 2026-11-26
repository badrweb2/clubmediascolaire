import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  FolderKanban,
  Headphones,
  Image as ImageIcon,
  Layers,
  Play,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { WorkCard } from '../../components/WorkCard.tsx';
import { AudioRadioPlayer } from '../../components/MediaPlayer.tsx';
import { isSafeUrl } from '../../lib/mediaUtils.ts';
import type { Category, PlatformSettings, WorkItem } from '../../types.ts';

interface BootstrapPayload {
  settings: PlatformSettings;
  categories: Category[];
  sections: {
    latest: WorkItem[];
    mostViewed: WorkItem[];
    featured: WorkItem[];
    radioCorner: WorkItem[];
    artCorner: WorkItem[];
    videoCorner: WorkItem[];
    projectCorner: WorkItem[];
  };
}

export function HomePage() {
  const { navigate, settings: ctxSettings, categories: ctxCategories } = useApp();
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroImgError, setHeroImgError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/public/bootstrap')
      .then((r) => r.json())
      .then((payload: BootstrapPayload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        // fallback handled cleanly
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const settings = data?.settings || ctxSettings;
  const allCategories = data?.categories || ctxCategories;
  const mainCategories = allCategories.filter((c) => c.parent_id === null);
  const sections = data?.sections;

  const totalPublishedCount = mainCategories.reduce((sum, c) => sum + (c.item_count || 0), 0);

  return (
    <div className="space-y-16 md:space-y-20">
      {/* 1. Split Editorial Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            {/* Hero Copy */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-3">
                {isSafeUrl(settings.logo_url) && (
                  <img
                    src={settings.logo_url}
                    alt={settings.school_name}
                    referrerPolicy="no-referrer"
                    className="h-14 w-auto object-contain mix-blend-multiply shrink-0"
                  />
                )}
                <div className="text-xs sm:text-sm font-medium text-slate-500">
                  <span>{settings.school_name}</span>
                  <span className="mx-2" aria-hidden="true">·</span>
                  <span>المعرض الرقمي الدائم {settings.academic_year}</span>
                </div>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold text-slate-900 leading-[1.22] text-balance">
                {settings.platform_title}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                {settings.platform_tagline}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/works')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>تصفح جميع الإنتاجات</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FolderKanban className="w-4 h-4 text-[#1E40AF]" />
                  <span>المشاريع والابتكارات</span>
                </button>
              </div>
            </div>

            {/* Hero Cover Image */}
            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[280px] lg:min-h-[380px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                {isSafeUrl(settings.hero_cover_url) && !heroImgError ? (
                  <img
                    src={settings.hero_cover_url}
                    alt={settings.platform_title}
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full lg:h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-8 text-slate-500">
                    <BookOpen className="w-12 h-12 text-[#1E40AF] mb-3" />
                    <span className="text-sm font-medium">{settings.platform_title}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Column Institutional Summary Row below hero split */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10 pt-8 border-t border-slate-200">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">إنتاجات منشورة</div>
              <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                {totalPublishedCount}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">تصنيفات الإبداع</div>
              <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                {mainCategories.length}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">ركن الإذاعة والمرئيات</div>
              <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                {(sections?.radioCorner.length || 0) + (sections?.videoCorner.length || 0)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">مشاهدة مباشرة</div>
              <div className="font-display text-lg sm:text-xl font-bold text-[#1E40AF]">
                داخل المنصة 100%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Categories Directory */}
      <section className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-medium text-[#1E40AF] mb-1">التصنيفات التربوية</div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              استكشف الإنتاجات حسب المجال
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/works')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>عرض كل الأرشيف</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {mainCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(`/works?categoryId=${cat.id}`)}
              className="text-right bg-white border border-slate-200 rounded-xl p-5 hover:border-[#1E40AF]/50 hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <Layers className="w-5 h-5 text-[#1E40AF]" />
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {cat.item_count || 0} عمل
                </span>
              </div>
              <h3 className="font-semibold text-sm sm:text-base text-slate-900 group-hover:text-[#1E40AF] transition-colors">
                {cat.name}
              </h3>
              {cat.description && (
                <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Latest Published Works */}
      <section className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-medium text-[#1E40AF] mb-1">مضاف حديثاً</div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              أحدث الإنتاجات المنشورة
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/works?sort=newest')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>المزيد</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {loading && !sections ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(sections?.latest || []).slice(0, 6).map((item) => (
              <WorkCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Featured Projects & Most Viewed */}
      {((sections?.featured && sections.featured.length > 0) ||
        (sections?.mostViewed && sections.mostViewed.length > 0)) && (
        <section className="bg-white border-y border-slate-200 py-14">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 space-y-14">
            {sections?.featured && sections.featured.length > 0 && (
              <div>
                <div className="flex items-end justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <Award className="w-5 h-5 text-[#D97706]" />
                    <h2 className="font-display text-2xl font-bold text-slate-900">
                      المشاريع المدرسية المتميزة
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/projects')}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>ركن المشاريع</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sections.featured.slice(0, 3).map((item) => (
                    <WorkCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {sections?.mostViewed && sections.mostViewed.length > 0 && (
              <div>
                <div className="flex items-end justify-between gap-4 mb-6">
                  <div>
                    <div className="text-xs font-medium text-[#1E40AF] mb-1">الأكثر تفاعلاً</div>
                    <h2 className="font-display text-2xl font-bold text-slate-900">
                      الإنتاجات الأكثر مشاهدة
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/works?sort=views')}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>الترتيب حسب المشاهدات</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sections.mostViewed.slice(0, 3).map((item) => (
                    <WorkCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. School Radio Corner (Inline Audio Playback) */}
      {sections?.radioCorner && sections.radioCorner.length > 0 && (
        <section className="max-w-[1240px] mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <Headphones className="w-5 h-5 text-[#1E40AF]" />
              <h2 className="font-display text-2xl font-bold text-slate-900">
                ركن الإذاعة المدرسية والبودكاست
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/audio')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>كل التسجيلات الصوتية</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sections.radioCorner.slice(0, 2).map((audio) => (
              <div key={audio.id} className="space-y-2">
                {audio.source_method === 'direct' ? (
                  <AudioRadioPlayer
                    src={audio.embed_url}
                    title={audio.title}
                    thumbnailUrl={audio.thumbnail_url}
                    compact
                  />
                ) : (
                  <WorkCard item={audio} />
                )}
                <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                  <span>{audio.student_name || 'فريق الإذاعة المدرسية'}</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/work/${audio.id}`)}
                    className="text-[#1E40AF] hover:underline cursor-pointer"
                  >
                    عرض التفاصيل الكاملة
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Art Gallery & Videos & Projects Corners */}
      <section className="max-w-[1240px] mx-auto px-4 sm:px-6 space-y-16">
        {sections?.artCorner && sections.artCorner.length > 0 && (
          <div>
            <div className="flex items-end justify-between gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="w-5 h-5 text-[#1E40AF]" />
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  معرض الصور والإبداعات الفنية
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/gallery')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>دخول المعرض الفني</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sections.artCorner.slice(0, 3).map((item) => (
                <WorkCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {sections?.videoCorner && sections.videoCorner.length > 0 && (
          <div>
            <div className="flex items-end justify-between gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <Play className="w-5 h-5 text-[#1E40AF]" />
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  ركن الفيديوهات التعليمية والإبداعية
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/videos')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>كل الفيديوهات</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sections.videoCorner.slice(0, 3).map((item) => (
                <WorkCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {sections?.projectCorner && sections.projectCorner.length > 0 && (
          <div>
            <div className="flex items-end justify-between gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <FolderKanban className="w-5 h-5 text-[#1E40AF]" />
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  ركن المشاريع والبحوث والمجلة الرقمية
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>استكشاف المشاريع</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sections.projectCorner.slice(0, 3).map((item) => (
                <WorkCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
