import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ListOrdered,
  PlusCircle,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { MediaPlayer } from '../../components/MediaPlayer.tsx';
import { ConfirmDeleteDropdown } from '../../components/ConfirmDeleteDropdown.tsx';
import {
  CONTENT_TYPE_LABELS,
  formatArabicDate,
  GRADE_LEVELS,
  isSafeUrl,
  normalizeImageUrl,
} from '../../lib/mediaUtils.ts';
import type { Category, PublishStatus, WorkItem } from '../../types.ts';

function AdminRowThumb({ title, thumbnailUrl }: { title: string; thumbnailUrl: string }) {
  const [failed, setFailed] = useState(false);
  const resolved = normalizeImageUrl(thumbnailUrl);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const valid = Boolean(resolved && isSafeUrl(resolved) && !failed);

  return (
    <div className="w-16 h-11 rounded-lg bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
      {valid ? (
        <img
          key={resolved}
          src={resolved}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain rounded"
        />
      ) : (
        <ImageIcon className="w-4 h-4 text-slate-400" />
      )}
    </div>
  );
}

export function AdminWorksPage() {
  const { apiFetch, navigate, refreshPublicBootstrap, searchParams } = useApp();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [filterCat, setFilterCat] = useState(() => searchParams.get('categoryId') || '');
  const [filterSubCat, setFilterSubCat] = useState(() => searchParams.get('subCategoryId') || '');
  const [filterType, setFilterType] = useState(() => searchParams.get('contentType') || '');
  const [filterGrade, setFilterGrade] = useState(() => searchParams.get('gradeLevel') || '');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || '');

  const searchParamsKey = searchParams.toString();
  useEffect(() => {
    const sp = new URLSearchParams(searchParamsKey);
    setQuery(sp.get('q') || '');
    setFilterCat(sp.get('categoryId') || '');
    setFilterSubCat(sp.get('subCategoryId') || '');
    setFilterType(sp.get('contentType') || '');
    setFilterGrade(sp.get('gradeLevel') || '');
    setFilterStatus(sp.get('status') || '');
  }, [searchParamsKey]);

  const currentFilterQuery = useMemo(() => {
    const sp = new URLSearchParams();
    if (query.trim()) sp.set('q', query.trim());
    if (filterCat) sp.set('categoryId', filterCat);
    if (filterSubCat) sp.set('subCategoryId', filterSubCat);
    if (filterType) sp.set('contentType', filterType);
    if (filterGrade) sp.set('gradeLevel', filterGrade);
    if (filterStatus) sp.set('status', filterStatus);
    return sp.toString();
  }, [query, filterCat, filterSubCat, filterType, filterGrade, filterStatus]);

  useEffect(() => {
    const nextUrl = currentFilterQuery ? `/admin/works?${currentFilterQuery}` : '/admin/works';
    const currentUrl = window.location.pathname + window.location.search;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
  }, [currentFilterQuery]);

  const [draftOrders, setDraftOrders] = useState<Record<number, string>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [previewItem, setPreviewItem] = useState<WorkItem | null>(null);
  const [clearingSamples, setClearingSamples] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const mainCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );

  const availableSubCategories = useMemo(() => {
    if (filterCat) {
      return categories.filter((c) => c.parent_id === Number(filterCat));
    }
    return categories.filter((c) => c.parent_id !== null);
  }, [categories, filterCat]);

  const selectedMainCatObj = useMemo(
    () => mainCategories.find((c) => String(c.id) === filterCat) || null,
    [mainCategories, filterCat]
  );

  const hasActiveFilters = Boolean(
    query.trim() || filterCat || filterSubCat || filterType || filterGrade || filterStatus
  );

  const syncDraftOrders = (list: WorkItem[]) => {
    const next: Record<number, string> = {};
    for (const w of list) {
      next[w.id] = String(w.sort_order || 0);
    }
    setDraftOrders(next);
  };

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (filterSubCat || filterCat) params.set('categoryId', filterSubCat || filterCat);
      if (filterType) params.set('contentType', filterType);
      if (filterGrade) params.set('gradeLevel', filterGrade);
      if (filterStatus) params.set('status', filterStatus);

      const res = await apiFetch<{ items: WorkItem[] }>(`/api/admin/works?${params.toString()}`);
      setItems(res.items);
      syncDraftOrders(res.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch, query, filterCat, filterSubCat, filterType, filterGrade, filterStatus]);

  useEffect(() => {
    apiFetch<{ categories: Category[] }>('/api/admin/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    const t = setTimeout(loadWorks, 140);
    return () => clearTimeout(t);
  }, [loadWorks]);

  const hasOrderChanges = useMemo(
    () =>
      items.some((item) => {
        const val = draftOrders[item.id];
        return val !== undefined && Number(val) !== item.sort_order;
      }),
    [items, draftOrders]
  );

  const persistOrders = async (orders: Array<{ id: number; sort_order: number }>) => {
    setSavingOrder(true);
    setOrderFeedback(null);
    try {
      await apiFetch('/api/admin/works/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders }),
      });
      await loadWorks();
      await refreshPublicBootstrap();
      setOrderFeedback({
        type: 'success',
        text: 'تم حفظ الترتيب الجديد للمواضيع وتحديث العرض في المنصة.',
      });
    } catch (err) {
      setOrderFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حفظ الترتيب الجديد.',
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSaveManualOrders = async () => {
    const orders: Array<{ id: number; sort_order: number }> = [];
    for (const item of items) {
      const raw = draftOrders[item.id] ?? String(item.sort_order || 0);
      const parsed = Math.max(0, Math.floor(Number(raw)));
      if (!Number.isFinite(parsed)) {
        setOrderFeedback({ type: 'error', text: 'يرجى إدخال أرقام صحيحة فقط في خانات الترتيب.' });
        return;
      }
      orders.push({ id: item.id, sort_order: parsed });
    }
    await persistOrders(orders);
  };

  const handleMoveRow = async (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= items.length || savingOrder) return;

    // Ensure distinct sequential numbers before swapping so ties/zeros still reorder cleanly
    const currentOrders = items.map((it) => it.sort_order);
    const hasZeroOrDuplicate =
      currentOrders.some((n) => n <= 0) || new Set(currentOrders).size !== currentOrders.length;

    const baseList = hasZeroOrDuplicate
      ? items.map((it, idx) => ({ id: it.id, sort_order: idx + 1 }))
      : items.map((it) => ({ id: it.id, sort_order: it.sort_order }));

    const aOrder = baseList[index].sort_order;
    baseList[index].sort_order = baseList[targetIdx].sort_order;
    baseList[targetIdx].sort_order = aOrder;

    await persistOrders(baseList);
  };

  const handleNormalizeSequential = async () => {
    if (items.length === 0 || savingOrder) return;
    const orders = items.map((item, idx) => ({ id: item.id, sort_order: idx + 1 }));
    await persistOrders(orders);
  };

  const togglePublish = async (item: WorkItem) => {
    const nextStatus: PublishStatus = item.status === 'published' ? 'draft' : 'published';
    setBusyId(item.id);
    try {
      const res = await apiFetch<{ item: WorkItem }>(`/api/admin/works/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setItems((prev) => prev.map((w) => (w.id === item.id ? res.item : w)));
      await refreshPublicBootstrap();
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteWork = async (id: number) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/works/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((w) => w.id !== id));
      await refreshPublicBootstrap();
    } finally {
      setBusyId(null);
    }
  };

  const handleClearSamples = async () => {
    setClearingSamples(true);
    try {
      await apiFetch('/api/admin/works/samples', { method: 'DELETE' });
      await loadWorks();
      await refreshPublicBootstrap();
    } finally {
      setClearingSamples(false);
    }
  };

  const hasSamples = items.some((i) => i.is_sample);

  return (
    <AdminLayout title="إدارة المحتويات">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              جدول إدارة الإنتاجات والمحتويات
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              رتّب ظهور المواضيع في المنصة عبر الرقم الترتيبي أو الأسهم، وتحكم في المعاينة والنشر والتعديل.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {items.length > 1 && (
              <button
                type="button"
                disabled={savingOrder}
                onClick={handleNormalizeSequential}
                title="توزيع الأرقام الترتيبية بالتسلسل من 1 إلى آخر موضوع"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                <ListOrdered className="w-4 h-4 text-[#1E40AF]" />
                <span>ترقيم تسلسلي (1، 2...)</span>
              </button>
            )}
            {hasSamples && (
              <ConfirmDeleteDropdown
                title="حذف البيانات التجريبية"
                message="سيتم حذف جميع الإنتاجات التجريبية الأولية مع الإبقاء على المحتويات التي أضفتها."
                confirmLabel="حذف التجريبية"
                busy={clearingSamples}
                onConfirm={handleClearSamples}
                renderTrigger={({ onClick }) => (
                  <button
                    type="button"
                    onClick={onClick}
                    className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    حذف البيانات التجريبية
                  </button>
                )}
              />
            )}
            <button
              type="button"
              onClick={() =>
                navigate(
                  currentFilterQuery
                    ? `/admin/add?from=${encodeURIComponent(currentFilterQuery)}`
                    : '/admin/add'
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة محتوى جديد</span>
            </button>
          </div>
        </div>

        {/* Order Save / Feedback Banner */}
        {(hasOrderChanges || orderFeedback) && (
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              orderFeedback?.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : hasOrderChanges
                  ? 'bg-blue-50 border-blue-200 text-slate-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {hasOrderChanges
                  ? 'تم تعديل الأرقام الترتيبية. اضغط «حفظ الترتيب الجديد» أو Enter لتطبيق الترتيب في المنصة.'
                  : orderFeedback?.text}
              </span>
            </div>
            {hasOrderChanges && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={savingOrder}
                  onClick={() => syncDraftOrders(items)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  disabled={savingOrder}
                  onClick={handleSaveManualOrders}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1E40AF] text-white text-xs font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingOrder ? 'جاري الحفظ...' : 'حفظ الترتيب الجديد'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث بالعنوان أو التلميذ..."
                className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <select
              value={filterCat}
              onChange={(e) => {
                setFilterCat(e.target.value);
                setFilterSubCat('');
              }}
              aria-label="تصفية حسب التصنيف الرئيسي"
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
            >
              <option value="">كل التصنيفات الرئيسية</option>
              {mainCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={filterSubCat}
              onChange={(e) => setFilterSubCat(e.target.value)}
              aria-label="تصفية حسب التصنيف الفرعي"
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
            >
              <option value="">
                {filterCat ? 'كل التصنيفات الفرعية' : 'تصفية بالتصنيف الفرعي'}
              </option>
              {availableSubCategories.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="تصفية حسب نوع المحتوى"
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
            >
              <option value="">كل الأنواع</option>
              {Object.entries(CONTENT_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              aria-label="تصفية حسب المستوى"
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
            >
              <option value="">كل المستويات</option>
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="تصفية حسب الحالة"
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
            >
              <option value="">كل الحالات</option>
              <option value="published">منشور</option>
              <option value="draft">مسودة</option>
            </select>
          </div>

          {/* Quick clickable subcategory filter buttons when a main category has subcategories */}
          {(availableSubCategories.length > 0 && filterCat) || hasActiveFilters ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {filterCat && availableSubCategories.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    التصنيفات الفرعية في {selectedMainCatObj?.name}:
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterSubCat('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      !filterSubCat
                        ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    الكل
                  </button>
                  {availableSubCategories.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setFilterSubCat(String(sub.id))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        filterSubCat === String(sub.id)
                          ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div />
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setFilterCat('');
                    setFilterSubCat('');
                    setFilterType('');
                    setFilterGrade('');
                    setFilterStatus('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إعادة ضبط الفلترة</span>
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3.5 px-3 font-medium whitespace-nowrap">الرقم الترتيبي</th>
                  <th className="py-3.5 px-4 font-medium">العنوان</th>
                  <th className="py-3.5 px-4 font-medium">النوع</th>
                  <th className="py-3.5 px-4 font-medium">التصنيف</th>
                  <th className="py-3.5 px-4 font-medium">تاريخ الإضافة</th>
                  <th className="py-3.5 px-4 font-medium">الحالة</th>
                  <th className="py-3.5 px-4 font-medium">المشاهدات</th>
                  <th className="py-3.5 px-4 font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      جاري تحميل المحتويات...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 space-y-2">
                      <div>لا توجد إنتاجات مطابقة حالياً.</div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            aria-label={`الرقم الترتيبي للموضوع ${item.title}`}
                            value={draftOrders[item.id] ?? String(item.sort_order || 0)}
                            onChange={(e) =>
                              setDraftOrders((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveManualOrders();
                              }
                            }}
                            className="w-14 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-center font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                          />
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0 || savingOrder}
                              onClick={() => handleMoveRow(idx, -1)}
                              title="تقديم للأعلى"
                              aria-label="تقديم للأعلى"
                              className="p-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-[#1E40AF] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === items.length - 1 || savingOrder}
                              onClick={() => handleMoveRow(idx, 1)}
                              title="تأخير للأسفل"
                              aria-label="تأخير للأسفل"
                              className="p-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-[#1E40AF] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <AdminRowThumb title={item.title} thumbnailUrl={item.thumbnail_url} />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 max-w-[240px] truncate">
                              {item.title}
                            </div>
                            {item.student_name && (
                              <div className="text-xs text-slate-500 truncate max-w-[240px]">
                                {item.student_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {CONTENT_TYPE_LABELS[item.content_type]}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {item.category_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                        {formatArabicDate(item.publish_date)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${
                            item.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {item.status === 'published' ? 'منشور' : 'مسودة'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                        {item.views_count}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            title="معاينة المشغل"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                currentFilterQuery
                                  ? `/admin/edit/${item.id}?from=${encodeURIComponent(currentFilterQuery)}`
                                  : `/admin/edit/${item.id}`
                              )
                            }
                            title="تعديل"
                            className="p-1.5 rounded-lg border border-slate-200 text-[#1E40AF] hover:bg-blue-50 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => togglePublish(item)}
                            title={item.status === 'published' ? 'إلغاء النشر' : 'نشر'}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            {item.status === 'published' ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4 text-emerald-700" />
                            )}
                          </button>
                          <ConfirmDeleteDropdown
                            title="تأكيد المسح"
                            message={`هل تريد حذف «${item.title}» نهائياً من قاعدة البيانات؟`}
                            confirmLabel="تأكيد المسح"
                            busy={busyId === item.id}
                            onConfirm={() => handleDeleteWork(item.id)}
                            renderTrigger={({ onClick }) => (
                              <button
                                type="button"
                                onClick={onClick}
                                title="حذف"
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs text-slate-500">
                  معاينة إدارية · {CONTENT_TYPE_LABELS[previewItem.content_type]}
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-1">
                  {previewItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <MediaPlayer
              title={previewItem.title}
              contentType={previewItem.content_type}
              sourceMethod={previewItem.source_method}
              embedUrl={previewItem.embed_url}
              originalUrl={previewItem.original_url}
              thumbnailUrl={previewItem.thumbnail_url}
              galleryUrls={previewItem.gallery_urls}
              extraMedia={previewItem.extra_media}
              isAdminPreview
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
