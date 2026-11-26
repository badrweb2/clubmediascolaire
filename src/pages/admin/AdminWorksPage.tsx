import React, { useCallback, useEffect, useState } from 'react';
import {
  Edit3,
  Eye,
  EyeOff,
  PlusCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { MediaPlayer } from '../../components/MediaPlayer.tsx';
import { CONTENT_TYPE_LABELS, formatArabicDate, GRADE_LEVELS } from '../../lib/mediaUtils.ts';
import type { Category, PublishStatus, WorkItem } from '../../types.ts';

export function AdminWorksPage() {
  const { apiFetch, navigate, refreshPublicBootstrap } = useApp();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [previewItem, setPreviewItem] = useState<WorkItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkItem | null>(null);
  const [confirmClearSamples, setConfirmClearSamples] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (filterCat) params.set('categoryId', filterCat);
      if (filterType) params.set('contentType', filterType);
      if (filterGrade) params.set('gradeLevel', filterGrade);
      if (filterStatus) params.set('status', filterStatus);

      const res = await apiFetch<{ items: WorkItem[] }>(`/api/admin/works?${params.toString()}`);
      setItems(res.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch, query, filterCat, filterType, filterGrade, filterStatus]);

  useEffect(() => {
    apiFetch<{ categories: Category[] }>('/api/admin/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    const t = setTimeout(loadWorks, 140);
    return () => clearTimeout(t);
  }, [loadWorks]);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiFetch(`/api/admin/works/${deleteTarget.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      setDeleteTarget(null);
      await refreshPublicBootstrap();
    } finally {
      setBusyId(null);
    }
  };

  const handleClearSamples = async () => {
    await apiFetch('/api/admin/works/samples', { method: 'DELETE' });
    setConfirmClearSamples(false);
    await loadWorks();
    await refreshPublicBootstrap();
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
              معاينة، تعديل، نشر أو إلغاء نشر، وحذف الإنتاجات المخزنة في المنصة.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {hasSamples && (
              <button
                type="button"
                onClick={() => setConfirmClearSamples(true)}
                className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                حذف البيانات التجريبية
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/admin/add')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة محتوى جديد</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
          >
            <option value="">كل التصنيفات</option>
            {categories
              .filter((c) => c.parent_id === null)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
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
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
          >
            <option value="">كل الحالات</option>
            <option value="published">منشور</option>
            <option value="draft">مسودة</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
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
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      جاري تحميل المحتويات...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 space-y-2">
                      <div>لا توجد إنتاجات مطابقة حالياً.</div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 max-w-[260px] truncate">
                          {item.title}
                        </div>
                        {item.student_name && (
                          <div className="text-xs text-slate-500 truncate max-w-[260px]">
                            {item.student_name}
                          </div>
                        )}
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
                            onClick={() => navigate(`/admin/edit/${item.id}`)}
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
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            title="حذف"
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
              isAdminPreview
            />
          </div>
        </div>
      )}

      {/* Single Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">تأكيد الحذف</h3>
            <p className="text-sm text-slate-600">
              هل تريد حذف «{deleteTarget.title}» نهائياً من قاعدة البيانات؟
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 cursor-pointer"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Sample Works Modal */}
      {confirmClearSamples && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">
              حذف البيانات التجريبية
            </h3>
            <p className="text-sm text-slate-600">
              سيتم حذف جميع الإنتاجات التجريبية الأولية مع الإبقاء على المحتويات التي قمت بإضافتها.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearSamples(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleClearSamples}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 cursor-pointer"
              >
                حذف التجريبية
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
