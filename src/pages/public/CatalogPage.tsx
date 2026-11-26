import React, { useEffect, useMemo, useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { WorkCard } from '../../components/WorkCard.tsx';
import { CONTENT_TYPE_LABELS, GRADE_LEVELS } from '../../lib/mediaUtils.ts';
import type { ContentType, WorkItem } from '../../types.ts';

interface CatalogPageProps {
  mode: 'all' | 'videos' | 'audio' | 'gallery' | 'projects';
}

const MODE_META: Record<
  CatalogPageProps['mode'],
  { title: string; subtitle: string; lockedType?: ContentType }
> = {
  all: {
    title: 'جميع الإنتاجات الطلابية',
    subtitle: 'ابحث واستكشف جميع الفيديوهات، التسجيلات الإذاعية، اللوحات الفنية، والمشاريع المدرسية.',
  },
  videos: {
    title: 'ركن الفيديوهات والإنتاجات المرئية',
    subtitle: 'أفلام تعليمية، تجارب علمية مصورة، وتغطيات الأنشطة المدرسية للمشاهدة المباشرة.',
    lockedType: 'video',
  },
  audio: {
    title: 'صفحة الصوتيات والإذاعة المدرسية',
    subtitle: 'حلقات الإذاعة الصباحية، البودكاست الطلابي، والقراءات الصوتية للاستماع المباشر.',
    lockedType: 'audio',
  },
  gallery: {
    title: 'معرض الصور والإبداعات الفنية',
    subtitle: 'لوحات تشكيلية، خطوط وزخارف، وتوثيق فوتوغرافي لإبداعات المتعلمين.',
    lockedType: 'image',
  },
  projects: {
    title: 'صفحة المشاريع المدرسية والبحوث',
    subtitle: 'المشاريع العلمية والابتكارات، المجلات الرقمية، والعروض التقديمية للتلاميذ.',
  },
};

export function CatalogPage({ mode }: CatalogPageProps) {
  const { searchParams, categories } = useApp();
  const meta = MODE_META[mode];

  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    () => searchParams.get('categoryId') || ''
  );
  const [selectedType, setSelectedType] = useState<string>(meta.lockedType || '');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [sort, setSort] = useState<string>(() => searchParams.get('sort') || 'newest');

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Sync mode changes cleanly
  useEffect(() => {
    setSelectedType(meta.lockedType || '');
    const catParam = searchParams.get('categoryId');
    if (catParam) setSelectedCategoryId(catParam);
    const sortParam = searchParams.get('sort');
    if (sortParam) setSort(sortParam);
  }, [mode, meta.lockedType, searchParams]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (selectedCategoryId) params.set('categoryId', selectedCategoryId);
      if (selectedType) params.set('contentType', selectedType);
      if (selectedGrade) params.set('gradeLevel', selectedGrade);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (sort) params.set('sort', sort);

      fetch(`/api/public/works?${params.toString()}`)
        .then((r) => r.json())
        .then((res: { items?: WorkItem[] }) => {
          if (!active) return;
          let list = res.items || [];
          if (mode === 'projects' && !selectedType) {
            list = list.filter(
              (item) =>
                item.content_type === 'project' ||
                item.content_type === 'pdf' ||
                item.content_type === 'presentation'
            );
          }
          setItems(list);
        })
        .catch(() => {
          if (active) setItems([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 140);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selectedCategoryId, selectedType, selectedGrade, dateFrom, sort, mode]);

  const mainCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );

  const resetFilters = () => {
    setQuery('');
    setSelectedCategoryId('');
    setSelectedType(meta.lockedType || '');
    setSelectedGrade('');
    setDateFrom('');
    setSort('newest');
  };

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              {meta.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl">{meta.subtitle}</p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
            النتائج المعروضة: <strong className="text-slate-900">{items.length}</strong>
          </div>
        </div>

        {/* Instant Search & Filter Controls */}
        <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بعنوان الإنتاج، اسم التلميذ، أو كلمة مفتاحية..."
                className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showFilters
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>خيارات التصفية</span>
            </button>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="الترتيب"
              className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
            >
              <option value="newest">الأحدث نشراً</option>
              <option value="views">الأكثر مشاهدة</option>
              <option value="oldest">الأقدم نشراً</option>
            </select>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  التصنيف
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800"
                >
                  <option value="">جميع التصنيفات</option>
                  {mainCategories.map((cat) => {
                    const subs = categories.filter((s) => s.parent_id === cat.id);
                    return (
                      <React.Fragment key={cat.id}>
                        <option value={cat.id}>{cat.name}</option>
                        {subs.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            — {sub.name}
                          </option>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </select>
              </div>

              {!meta.lockedType && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    نوع المحتوى
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800"
                  >
                    <option value="">جميع الأنواع</option>
                    {Object.entries(CONTENT_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  المستوى الدراسي
                </label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800"
                >
                  <option value="">جميع المستويات</option>
                  {GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  من تاريخ نشر
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={resetFilters}
                    title="إعادة ضبط البحث"
                    className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <p className="text-base font-medium text-slate-800">
            لا توجد إنتاجات مطابقة لمعايير البحث المحددة.
          </p>
          <p className="text-sm text-slate-500">
            جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر لعرض جميع الأعمال المتاحة.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة ضبط التصفية</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <WorkCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
