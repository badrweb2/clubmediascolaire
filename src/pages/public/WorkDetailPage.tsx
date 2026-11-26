import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Eye, Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { MediaPlayer } from '../../components/MediaPlayer.tsx';
import { WorkCard } from '../../components/WorkCard.tsx';
import { CONTENT_TYPE_LABELS, formatArabicDate } from '../../lib/mediaUtils.ts';
import { isSettingEnabled } from '../../lib/settingsDefaults.ts';
import type { ContentType, WorkItem } from '../../types.ts';

function getCornerForContentType(contentType: ContentType): { path: string; label: string } {
  switch (contentType) {
    case 'audio':
      return { path: '/audio', label: 'العودة إلى الإذاعة المدرسية' };
    case 'video':
      return { path: '/videos', label: 'العودة إلى الفيديوهات' };
    case 'image':
      return { path: '/gallery', label: 'العودة إلى المعرض الفني' };
    case 'project':
    case 'pdf':
    case 'presentation':
      return { path: '/projects', label: 'العودة إلى المشاريع' };
    default:
      return { path: '/works', label: 'العودة إلى الإنتاجات' };
  }
}

export function WorkDetailPage({ workId }: { workId: number }) {
  const { navigate, lastPublicRoute, settings } = useApp();
  const [item, setItem] = useState<WorkItem | null>(null);
  const [related, setRelated] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const countedWorkIdRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetch(`/api/public/works/${workId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'الإنتاج المطلوب غير متاح.');
        }
        return res.json() as Promise<{ item: WorkItem; related: WorkItem[] }>;
      })
      .then((data) => {
        if (!active) return;
        setItem(data.item);
        setRelated(data.related || []);

        if (countedWorkIdRef.current !== workId) {
          countedWorkIdRef.current = workId;
          fetch(`/api/public/works/${workId}/view`, { method: 'POST' })
            .then((r) => (r.ok ? r.json() : null))
            .then((vData: { ok?: boolean; views_count?: number } | null) => {
              if (active && vData && typeof vData.views_count === 'number') {
                setItem((prev) =>
                  prev ? { ...prev, views_count: vData.views_count as number } : prev
                );
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'تعذر تحميل الإنتاج.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workId]);

  const backTarget = useMemo(() => {
    if (lastPublicRoute && !lastPublicRoute.startsWith('/work/')) {
      if (lastPublicRoute.startsWith('/audio')) {
        return { path: lastPublicRoute, label: 'العودة إلى الإذاعة المدرسية' };
      }
      if (lastPublicRoute.startsWith('/videos')) {
        return { path: lastPublicRoute, label: 'العودة إلى الفيديوهات' };
      }
      if (lastPublicRoute.startsWith('/innovations')) {
        return { path: lastPublicRoute, label: 'العودة إلى الابتكارات' };
      }
      if (lastPublicRoute.startsWith('/projects')) {
        return { path: lastPublicRoute, label: 'العودة إلى المشاريع' };
      }
      if (lastPublicRoute.startsWith('/activities')) {
        return { path: lastPublicRoute, label: 'العودة إلى الأنشطة' };
      }
      if (lastPublicRoute.startsWith('/gallery')) {
        return { path: lastPublicRoute, label: 'العودة إلى المعرض الفني' };
      }
      if (lastPublicRoute.startsWith('/works')) {
        return { path: lastPublicRoute, label: 'العودة إلى الإنتاجات' };
      }
      if (lastPublicRoute === '/') {
        if (item?.content_type === 'audio') {
          return { path: '/audio', label: 'العودة إلى الإذاعة المدرسية' };
        }
        return { path: '/', label: 'العودة إلى الرئيسية' };
      }
    }
    if (item) {
      return getCornerForContentType(item.content_type);
    }
    return { path: '/works', label: 'العودة إلى المعرض' };
  }, [lastPublicRoute, item]);

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard restriction
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="h-[420px] bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 space-y-4">
          <h1 className="font-display text-xl font-bold text-slate-900">
            {error || 'الإنتاج غير موجود'}
          </h1>
          <p className="text-sm text-slate-600">
            قد يكون هذا المحتوى غير منشور أو تم نقله من المعرض.
          </p>
          <button
            type="button"
            onClick={() => navigate(backTarget.path)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{backTarget.label}</span>
          </button>
        </div>
      </div>
    );
  }

  const keywordsList = item.keywords
    ? item.keywords
        .split(/[،,]/)
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  const typeCorner = getCornerForContentType(item.content_type);
  const showViews = isSettingEnabled(settings.show_view_counts);
  const showShare = isSettingEnabled(settings.show_share_button);

  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Top Distraction-Free Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(backTarget.path)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>{backTarget.label}</span>
        </button>

        {showShare && (
          <button
            type="button"
            onClick={handleCopyShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ رابط المشاركة' : 'مشاركة رابط الإنتاج'}</span>
          </button>
        )}
      </div>

      {/* Editorial Production Header */}
      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
            <a
              href={`/works?categoryId=${item.category_id}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/works?categoryId=${item.category_id}`);
              }}
              className="font-medium text-[#1E40AF] hover:underline underline-offset-4 cursor-pointer"
            >
              {item.category_name || CONTENT_TYPE_LABELS[item.content_type]}
            </a>
            {item.subcategory_name && item.subcategory_id && (
              <>
                <span aria-hidden="true">/</span>
                <a
                  href={`/works?categoryId=${item.subcategory_id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/works?categoryId=${item.subcategory_id}`);
                  }}
                  className="font-medium text-slate-700 hover:text-[#1E40AF] hover:underline underline-offset-4 cursor-pointer"
                >
                  {item.subcategory_name}
                </a>
              </>
            )}
            <span aria-hidden="true">·</span>
            <a
              href={typeCorner.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(typeCorner.path);
              }}
              className="hover:text-[#1E40AF] hover:underline underline-offset-4 cursor-pointer"
            >
              {CONTENT_TYPE_LABELS[item.content_type]}
            </a>
            {showViews && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Eye className="w-3.5 h-3.5" />
                  {item.views_count} مشاهدة
                </span>
              </>
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight text-balance">
            {item.title}
          </h1>
        </header>

        {/* Built-in Platform Player / Viewer */}
        <MediaPlayer
          title={item.title}
          contentType={item.content_type}
          sourceMethod={item.source_method}
          embedUrl={item.embed_url}
          originalUrl={item.original_url}
          thumbnailUrl={item.thumbnail_url}
          galleryUrls={item.gallery_urls}
        />

        {/* Description & Structured Accession Metadata */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              نبذة عن الإنتاج
            </h2>
            <p className="text-sm sm:text-base text-slate-700 leading-loose whitespace-pre-line">
              {item.description || 'إنتاج تربوي منشور ضمن أرشيف إبداعات التلاميذ في مدرسة الحسن الداخل.'}
            </p>

            {keywordsList.length > 0 && (
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
                <span className="font-medium text-slate-700 ml-2">الكلمات المفتاحية:</span>
                <span>{keywordsList.join(' · ')}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-slate-900 mb-4">
              بطاقة التوثيق
            </h2>
            <dl className="divide-y divide-slate-100 text-sm">
              {item.student_name && (
                <div className="py-3 flex items-start justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">صاحب الإنتاج</dt>
                  <dd className="font-medium text-slate-900 text-left">{item.student_name}</dd>
                </div>
              )}
              {item.grade_level && (
                <div className="py-3 flex items-start justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">المستوى الدراسي</dt>
                  <dd className="font-medium text-slate-900 text-left">{item.grade_level}</dd>
                </div>
              )}
              {item.class_section && (
                <div className="py-3 flex items-start justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">القسم / النادي</dt>
                  <dd className="font-medium text-slate-900 text-left">{item.class_section}</dd>
                </div>
              )}
              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-slate-500 shrink-0">تاريخ النشر</dt>
                <dd className="font-medium text-slate-900 text-left tabular-nums">
                  {formatArabicDate(item.publish_date)}
                </dd>
              </div>
              <div className="py-3 flex items-start justify-between gap-4">
                <dt className="text-slate-500 shrink-0">نوع المحتوى</dt>
                <dd className="font-medium text-slate-900 text-left">
                  <a
                    href={typeCorner.path}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(typeCorner.path);
                    }}
                    className="text-[#1E40AF] hover:underline"
                  >
                    {CONTENT_TYPE_LABELS[item.content_type]}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </article>

      {/* Related Works */}
      {related.length > 0 && (
        <section className="pt-8 border-t border-slate-200 space-y-6">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            إنتاجات مشابهة ومرتبطة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.slice(0, 3).map((rel) => (
              <WorkCard key={rel.id} item={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
