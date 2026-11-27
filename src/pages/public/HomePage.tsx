import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Headphones,
  Image as ImageIcon,
  Layers,
  Megaphone,
  Play,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { WorkCard } from '../../components/WorkCard.tsx';
import { AudioRadioPlayer } from '../../components/MediaPlayer.tsx';
import { isSafeUrl, normalizeImageUrl } from '../../lib/mediaUtils.ts';
import { isSettingEnabled, parseHeroExtraCoversJson } from '../../lib/settingsDefaults.ts';
import { resolveBackgroundStyle, resolveCardRadiusClass } from '../../lib/themePresets.ts';
import type { Category, PlatformSettings, PublicSiteStats, WorkItem } from '../../types.ts';

interface BootstrapPayload {
  settings: PlatformSettings;
  categories: Category[];
  siteStats?: PublicSiteStats;
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
  const {
    navigate,
    settings: ctxSettings,
    categories: ctxCategories,
    siteStats: ctxSiteStats,
  } = useApp();
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failedHeroUrls, setFailedHeroUrls] = useState<Record<string, boolean>>({});
  const [heroSlideIdx, setHeroSlideIdx] = useState(0);
  const [heroHovered, setHeroHovered] = useState(false);

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
  const siteStats =
    ctxSiteStats.total_site_visits >= (data?.siteStats?.total_site_visits || 0)
      ? ctxSiteStats
      : data?.siteStats || ctxSiteStats;

  const totalPublishedCount = mainCategories.reduce((sum, c) => sum + (c.item_count || 0), 0);
  const accentColor = settings.primary_color || '#1E40AF';
  const heroZoom = isSettingEnabled(settings.hero_zoom_enabled);
  const animationsEnabled = isSettingEnabled(settings.enable_animations);
  const cardBgStyle = resolveBackgroundStyle(settings.bg_cards, { isCard: true });
  const radiusClass = resolveCardRadiusClass(settings.card_radius);
  const homeBgStyle = resolveBackgroundStyle(settings.bg_home || settings.bg_site);
  const isFourCols = settings.cards_per_row === '4';
  const cardsGridClass = isFourCols ? 'lg:grid-cols-4' : 'lg:grid-cols-3';
  const featuredLimit = isFourCols ? 4 : 3;

  const heroImages = useMemo(() => {
    const primary = normalizeImageUrl(settings.hero_cover_url);
    const extras = parseHeroExtraCoversJson(settings.hero_extra_covers_json);
    const merged = [primary, ...extras].filter(
      (url, idx, arr) => Boolean(url) && isSafeUrl(url) && arr.indexOf(url) === idx && !failedHeroUrls[url]
    );
    return merged;
  }, [settings.hero_cover_url, settings.hero_extra_covers_json, failedHeroUrls]);

  useEffect(() => {
    if (heroSlideIdx >= heroImages.length) {
      setHeroSlideIdx(0);
    }
  }, [heroSlideIdx, heroImages.length]);

  useEffect(() => {
    if (heroImages.length <= 1 || heroHovered || !animationsEnabled) return;
    const timer = window.setInterval(() => {
      setHeroSlideIdx((prev) => (prev + 1) % heroImages.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [heroImages.length, heroHovered, animationsEnabled]);

  const announcementText = (settings.announcement_text || '').trim();
  const showAnnouncement = isSettingEnabled(settings.announcement_enabled) && announcementText.length > 0;
  const announcementIsArabic = /[\u0600-\u06FF]/.test(announcementText);
  const announcementColor = settings.announcement_bg_color || accentColor;
  const tickerDurationSec = Math.max(14, Math.min(34, Math.round(announcementText.length * 0.24)));

  return (
    <div className="space-y-16 md:space-y-20">
      {/* 1. Split Editorial Hero Section */}
      <section style={homeBgStyle} className="bg-white/90 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            {/* Hero Copy */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-3">
                {isSafeUrl(normalizeImageUrl(settings.logo_url)) && (
                  <img
                    src={normalizeImageUrl(settings.logo_url)}
                    alt={settings.school_name}
                    referrerPolicy="no-referrer"
                    className="h-14 w-auto object-contain mix-blend-multiply shrink-0"
                  />
                )}
                <div className="text-xs sm:text-sm font-medium text-slate-500">
                  <span>{settings.school_name}</span>
                  <span className="mx-2" aria-hidden="true">·</span>
                  <span>
                    {settings.hero_badge_text || 'المعرض الرقمي الدائم'} {settings.academic_year}
                  </span>
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
                  style={{ backgroundColor: accentColor }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-white text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-md active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>{settings.hero_primary_btn_text || 'تصفح جميع الإنتاجات'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium transition-all duration-300 hover:bg-slate-50 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-sm active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FolderKanban className="w-4 h-4 text-[#1E40AF]" />
                  <span>{settings.hero_secondary_btn_text || 'المشاريع والابتكارات'}</span>
                </button>
              </div>
            </div>

            {/* Hero Cover Image / Multi-Image Carousel */}
            <div className="lg:col-span-6">
              <div
                onMouseEnter={() => setHeroHovered(true)}
                onMouseLeave={() => setHeroHovered(false)}
                className="group relative h-full min-h-[280px] lg:min-h-[380px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs"
              >
                {heroImages.length > 0 ? (
                  <>
                    {heroImages.map((imgUrl, idx) => {
                      const isActive = idx === heroSlideIdx;
                      return (
                        <img
                          key={imgUrl}
                          src={imgUrl}
                          alt={`${settings.platform_title} (${idx + 1})`}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedHeroUrls((prev) => ({ ...prev, [imgUrl]: true }))
                          }
                          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                            isActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
                          } ${heroZoom && isActive ? 'animate-hero-zoom' : ''}`}
                        />
                      );
                    })}

                    {heroImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setHeroSlideIdx(
                              (prev) => (prev - 1 + heroImages.length) % heroImages.length
                            )
                          }
                          aria-label="الصورة السابقة"
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-900/55 text-white hover:bg-slate-900/80 backdrop-blur-xs flex items-center justify-center transition-all opacity-85 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setHeroSlideIdx((prev) => (prev + 1) % heroImages.length)
                          }
                          aria-label="الصورة التالية"
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-900/55 text-white hover:bg-slate-900/80 backdrop-blur-xs flex items-center justify-center transition-all opacity-85 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="absolute bottom-3 inset-x-0 z-20 flex items-center justify-center gap-2 px-4">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/55 backdrop-blur-xs">
                            {heroImages.map((imgUrl, idx) => (
                              <button
                                key={imgUrl}
                                type="button"
                                onClick={() => setHeroSlideIdx(idx)}
                                aria-label={`الانتقال إلى الصورة ${idx + 1}`}
                                className={`h-2 rounded-full transition-all cursor-pointer ${
                                  idx === heroSlideIdx
                                    ? 'w-6 bg-white'
                                    : 'w-2 bg-white/55 hover:bg-white/85'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full min-h-[280px] lg:min-h-[380px] bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-8 text-slate-500">
                    <BookOpen className="w-12 h-12 text-[#1E40AF] mb-3" />
                    <span className="text-sm font-medium">{settings.platform_title}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* News Ticker Announcement Bar — HomePage Only, Below Hero Image */}
          {showAnnouncement && (
            <div
              role="region"
              aria-label="شريط الإعلانات والتنبيهات"
              style={{ backgroundColor: announcementColor }}
              className="mt-7 rounded-xl text-white shadow-sm overflow-hidden border border-black/10"
            >
              <div className="flex items-stretch">
                <div className="bg-black/20 px-3.5 sm:px-4 py-2.5 flex items-center gap-2 shrink-0 border-l border-white/15">
                  <Megaphone className="w-4 h-4 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
                    {announcementIsArabic ? 'إعلان هام' : 'Annonce'}
                  </span>
                </div>
                <div className="ticker-viewport flex-1 py-2.5 flex items-center min-w-0">
                  <div
                    dir={announcementIsArabic ? 'rtl' : 'ltr'}
                    style={{ '--ticker-duration': `${tickerDurationSec}s` } as React.CSSProperties}
                    className={`ticker-track text-xs sm:text-sm font-medium px-4 ${
                      announcementIsArabic ? 'animate-ticker-ltr' : 'animate-ticker-rtl'
                    }`}
                  >
                    {announcementText}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4-Column Real Institutional Statistics Row */}
          {isSettingEnabled(settings.show_stats_bar) && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10 pt-8 border-t border-slate-200 animate-fade-up">
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
                <div className="text-xs text-slate-500">زيارات المنصة</div>
                <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                  {siteStats.total_site_visits}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">مشاهدات الإنتاجات</div>
                <div
                  style={{ color: accentColor }}
                  className="font-display text-2xl font-bold tabular-nums"
                >
                  {siteStats.total_work_views}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. Categories Directory */}
      {isSettingEnabled(settings.show_categories_section) && (
        <section className="max-w-[1240px] mx-auto px-4 sm:px-6 animate-fade-up">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-medium text-[#1E40AF] mb-1">التصنيفات التربوية</div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {settings.categories_section_title || 'استكشف الإنتاجات حسب المجال'}
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
                style={cardBgStyle}
                className={`text-right bg-white border border-slate-200 ${radiusClass} p-5 hover:border-[#1E40AF]/50 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] transition-all duration-300 cursor-pointer group`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Layers className="w-5 h-5 text-[#1E40AF] transition-transform duration-300 group-hover:scale-110" />
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
      )}

      {/* 3. Latest Published Works */}
      {isSettingEnabled(settings.show_latest_section) && (
        <section className="max-w-[1240px] mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-medium text-[#1E40AF] mb-1">مضاف حديثاً</div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {settings.latest_section_title || 'أحدث الإنتاجات المنشورة'}
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
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${cardsGridClass} gap-6`}>
              {(sections?.latest || []).slice(0, isFourCols ? 8 : 6).map((item) => (
                <WorkCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. Featured Projects & Most Viewed */}
      {((isSettingEnabled(settings.show_featured_section) &&
        sections?.featured &&
        sections.featured.length > 0) ||
        (isSettingEnabled(settings.show_most_viewed_section) &&
          sections?.mostViewed &&
          sections.mostViewed.length > 0)) && (
        <section className="bg-white border-y border-slate-200 py-14">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 space-y-14">
            {isSettingEnabled(settings.show_featured_section) &&
              sections?.featured &&
              sections.featured.length > 0 && (
                <div>
                  <div className="flex items-end justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2.5">
                      <Award className="w-5 h-5 text-[#D97706]" />
                      <h2 className="font-display text-2xl font-bold text-slate-900">
                        {settings.featured_section_title || 'المشاريع المدرسية المتميزة'}
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
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${cardsGridClass} gap-6`}>
                    {sections.featured.slice(0, featuredLimit).map((item) => (
                      <WorkCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

            {isSettingEnabled(settings.show_most_viewed_section) &&
              sections?.mostViewed &&
              sections.mostViewed.length > 0 && (
                <div>
                  <div className="flex items-end justify-between gap-4 mb-6">
                    <div>
                      <div className="text-xs font-medium text-[#1E40AF] mb-1">الأكثر تفاعلاً</div>
                      <h2 className="font-display text-2xl font-bold text-slate-900">
                        {settings.most_viewed_section_title || 'الإنتاجات الأكثر مشاهدة'}
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
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${cardsGridClass} gap-6`}>
                    {sections.mostViewed.slice(0, featuredLimit).map((item) => (
                      <WorkCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
          </div>
        </section>
      )}

      {/* 5. School Radio Corner (Inline Audio Playback) */}
      {isSettingEnabled(settings.show_radio_corner) &&
        sections?.radioCorner &&
        sections.radioCorner.length > 0 && (
          <section className="max-w-[1240px] mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <Headphones className="w-5 h-5 text-[#1E40AF]" />
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  {settings.radio_corner_title || 'ركن الإذاعة المدرسية والبودكاست'}
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
        {isSettingEnabled(settings.show_art_corner) &&
          sections?.artCorner &&
          sections.artCorner.length > 0 && (
            <div>
              <div className="flex items-end justify-between gap-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="w-5 h-5 text-[#1E40AF]" />
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    {settings.art_corner_title || 'معرض الصور والإبداعات الفنية'}
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
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${cardsGridClass} gap-6`}>
                {sections.artCorner.slice(0, featuredLimit).map((item) => (
                  <WorkCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

        {isSettingEnabled(settings.show_video_corner) &&
          sections?.videoCorner &&
          sections.videoCorner.length > 0 && (
            <div>
              <div className="flex items-end justify-between gap-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <Play className="w-5 h-5 text-[#1E40AF]" />
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    {settings.video_corner_title || 'ركن الفيديوهات التعليمية والإبداعية'}
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
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${cardsGridClass} gap-6`}>
                {sections.videoCorner.slice(0, featuredLimit).map((item) => (
                  <WorkCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

        {isSettingEnabled(settings.show_project_corner) &&
          sections?.projectCorner &&
          sections.projectCorner.length > 0 && (
            <div>
              <div className="flex items-end justify-between gap-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <FolderKanban className="w-5 h-5 text-[#1E40AF]" />
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    {settings.project_corner_title || 'ركن المشاريع والبحوث والمجلة الرقمية'}
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
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${cardsGridClass} gap-6`}>
                {sections.projectCorner.slice(0, featuredLimit).map((item) => (
                  <WorkCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
      </section>
    </div>
  );
}
