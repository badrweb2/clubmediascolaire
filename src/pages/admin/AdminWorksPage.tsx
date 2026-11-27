import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  ListOrdered,
  PlusCircle,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { MediaPlayer } from '../../components/MediaPlayer.tsx';
import { ConfirmDeleteDropdown } from '../../components/ConfirmDeleteDropdown.tsx';
import { ConfirmActionDropdown } from '../../components/ConfirmActionDropdown.tsx';
import {
  downloadLiveWorksExcel,
  parseWorksSpreadsheetFile,
  type ParsedBulkWorkRow,
} from '../../lib/excelWorks.ts';
import {
  CONTENT_TYPE_LABELS,
  formatArabicDate,
  GRADE_LEVELS,
  isSafeUrl,
  normalizeImageUrl,
  parseMediaUrlClient,
} from '../../lib/mediaUtils.ts';
import type {
  Category,
  ContentType,
  PublishStatus,
  SourceMethod,
  WorkItem,
} from '../../types.ts';

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
  const { apiFetch, navigate, refreshPublicBootstrap, searchParams, hasPermission } = useApp();
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

  // Live Excel export & Bulk Import state
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTab, setBulkTab] = useState<'file' | 'quick'>('file');
  const [bulkRows, setBulkRows] = useState<ParsedBulkWorkRow[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkFileName, setBulkFileName] = useState('');

  // Quick multi-line paste state
  const [quickText, setQuickText] = useState('');
  const [quickCatId, setQuickCatId] = useState<number>(1);
  const [quickSubCatId, setQuickSubCatId] = useState<string>('');
  const [quickContentType, setQuickContentType] = useState<ContentType>('project');
  const [quickSourceMethod, setQuickSourceMethod] = useState<SourceMethod>('gdrive');
  const [quickGradeLevel, setQuickGradeLevel] = useState<string>(GRADE_LEVELS[5]);
  const [quickStatus, setQuickStatus] = useState<PublishStatus>('published');

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
      .then((res) => {
        setCategories(res.categories);
        const firstMain = res.categories.find((c) => c.parent_id === null);
        if (firstMain) {
          setQuickCatId((prev) =>
            res.categories.some((c) => c.id === prev && c.parent_id === null) ? prev : firstMain.id
          );
        }
      })
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

  const handleDownloadLiveExcel = async (includeExistingWorks: boolean) => {
    setExportingExcel(true);
    setOrderFeedback(null);
    try {
      const catRes = await apiFetch<{ categories: Category[] }>('/api/admin/categories');
      const liveCats = catRes.categories;
      setCategories(liveCats);

      let liveWorks: WorkItem[] = [];
      if (includeExistingWorks) {
        const worksRes = await apiFetch<{ items: WorkItem[] }>('/api/admin/works');
        liveWorks = worksRes.items;
      }

      await downloadLiveWorksExcel({
        categories: liveCats,
        works: liveWorks,
        includeExistingWorks,
      });

      setOrderFeedback({
        type: 'success',
        text: includeExistingWorks
          ? `تم تصدير ${liveWorks.length} موضوعاً من المنصة إلى ملف Excel مع القوائم المنسدلة الحية.`
          : 'تم تصدير قالب Excel متزامن مع التصنيفات والقوائم المنسدلة للمنصة المنشورة.',
      });
    } catch (err) {
      setOrderFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر إنشاء ملف Excel.',
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkParsing(true);
    setBulkErrors([]);
    setBulkFileName(file.name);
    try {
      const catRes = await apiFetch<{ categories: Category[] }>('/api/admin/categories');
      setCategories(catRes.categories);
      const result = await parseWorksSpreadsheetFile(file, catRes.categories);
      setBulkRows(result.rows);
      setBulkErrors(result.errors);
    } catch (err) {
      setBulkRows([]);
      setBulkErrors([err instanceof Error ? err.message : 'تعذر قراءة الملف المحدد.']);
    } finally {
      setBulkParsing(false);
      e.target.value = '';
    }
  };

  const handleParseQuickLines = () => {
    const lines = quickText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setBulkRows([]);
      setBulkErrors(['يرجى كتابة أو لصق سطر واحد على الأقل لتحليله.']);
      return;
    }

    const nextRows: ParsedBulkWorkRow[] = [];
    const nextErrors: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    lines.forEach((line, idx) => {
      const sep = line.includes('|') ? '|' : '\t';
      const parts = line.split(sep).map((p) => p.trim());
      const title = parts[0] || '';
      const rawUrl = parts[1] || '';
      const studentName = parts[2] || '';
      const gradeRaw = parts[3] || quickGradeLevel;
      const desc = parts[4] || '';

      if (!title) {
        nextErrors.push(`السطر ${idx + 1}: العنوان مفقود.`);
        return;
      }
      if (!rawUrl || !isSafeUrl(rawUrl)) {
        nextErrors.push(`السطر ${idx + 1} («${title}»): الرابط مفقود أو غير صالح.`);
        return;
      }
      const parsed = parseMediaUrlClient(rawUrl, quickSourceMethod, quickContentType);
      if (!parsed.valid) {
        nextErrors.push(`السطر ${idx + 1} («${title}»): ${parsed.error || 'تعذر قراءة الرابط.'}`);
        return;
      }

      nextRows.push({
        sort_order: idx + 1,
        title,
        student_name: studentName,
        grade_level: gradeRaw,
        class_section: '',
        content_type: quickContentType === 'project' ? 'project' : parsed.contentType,
        source_method: quickSourceMethod === 'project_bundle' ? 'project_bundle' : parsed.sourceMethod,
        original_url: rawUrl,
        embed_url: parsed.embedUrl,
        media_mime: parsed.mediaMime,
        category_id: quickCatId,
        subcategory_id: quickSubCatId ? Number(quickSubCatId) : null,
        extra_category_ids: [],
        thumbnail_url: parsed.thumbnailUrl,
        gallery_urls: [],
        extra_media: [],
        publish_date: today,
        status: quickStatus,
        featured: false,
        description: desc,
        keywords: '',
      });
    });

    setBulkRows(nextRows);
    setBulkErrors(nextErrors);
  };

  const handleConfirmBulkImport = async () => {
    if (bulkRows.length === 0) return;
    setBulkImporting(true);
    setBulkErrors([]);
    try {
      let insertedTotal = 0;
      const allServerErrors: string[] = [];

      // Split into batches of up to 100 works
      for (let offset = 0; offset < bulkRows.length; offset += 100) {
        const chunk = bulkRows.slice(offset, offset + 100);
        const res = await apiFetch<{
          ok: boolean;
          inserted_count: number;
          errors?: string[];
        }>('/api/admin/works/bulk', {
          method: 'POST',
          body: JSON.stringify({ items: chunk }),
        });
        insertedTotal += res.inserted_count || 0;
        if (Array.isArray(res.errors) && res.errors.length > 0) {
          allServerErrors.push(...res.errors);
        }
      }

      await loadWorks();
      await refreshPublicBootstrap();

      if (allServerErrors.length > 0) {
        setBulkErrors(allServerErrors);
        setOrderFeedback({
          type: 'success',
          text: `تم استيراد ${insertedTotal} موضوعاً بنجاح مع وجود ${allServerErrors.length} ملاحظات.`,
        });
      } else {
        setShowBulkModal(false);
        setBulkRows([]);
        setQuickText('');
        setBulkFileName('');
        setOrderFeedback({
          type: 'success',
          text: `تم استيراد ونشر ${insertedTotal} موضوعاً ومشروعاً دفعة واحدة في المنصة بنجاح.`,
        });
      }
    } catch (err) {
      setBulkErrors([err instanceof Error ? err.message : 'تعذر تنفيذ الاستيراد الجماعي.']);
    } finally {
      setBulkImporting(false);
    }
  };

  const hasSamples = items.some((i) => i.is_sample);
  const quickSubCategories = useMemo(
    () => categories.filter((c) => c.parent_id === quickCatId),
    [categories, quickCatId]
  );
  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  return (
    <AdminLayout title="إدارة المحتويات">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              جدول إدارة الإنتاجات والمحتويات
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              رتّب ظهور المواضيع في المنصة، صدّر قوالب Excel الحية بالقوائم المنسدلة، أو استورد 40+ مشروعاً دفعة واحدة.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={exportingExcel}
              onClick={() => handleDownloadLiveExcel(false)}
              title="تحميل قالب Excel يحتوي على قوائم التصنيفات والمستويات من المنصة المنشورة حالياً"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exportingExcel ? 'جاري التجهيز...' : 'قالب Excel الحي'}</span>
            </button>

            <button
              type="button"
              disabled={exportingExcel}
              onClick={() => handleDownloadLiveExcel(true)}
              title="تصدير جميع الإنتاجات المنشورة الحالية إلى ملف Excel قابل للتعديل وإعادة الرفع"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#1E40AF]" />
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkErrors([]);
                setShowBulkModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-[#1E40AF]/30 bg-blue-50 text-xs font-medium text-[#1E40AF] hover:bg-blue-100 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>استيراد جماعي (40+ مشروع)</span>
            </button>

            {items.length > 1 && (
              <ConfirmActionDropdown
                variant="warning"
                title="تأكيد الترقيم التسلسلي"
                message="سيتم إعادة ترقيم المواضيع الظاهرة بالتسلسل من 1 إلى آخر موضوع. هل تريد المتابعة؟"
                confirmLabel="تأكيد الترقيم"
                busy={savingOrder}
                onConfirm={handleNormalizeSequential}
                renderTrigger={({ onClick }) => (
                  <button
                    type="button"
                    disabled={savingOrder}
                    onClick={onClick}
                    title="توزيع الأرقام الترتيبية بالتسلسل من 1 إلى آخر موضوع"
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                  >
                    <ListOrdered className="w-4 h-4 text-[#1E40AF]" />
                    <span>ترقيم تسلسلي</span>
                  </button>
                )}
              />
            )}

            {hasSamples && hasPermission('delete_works') && (
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
                    className="px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    حذف التجريبية
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
                <ConfirmActionDropdown
                  variant="primary"
                  title="تأكيد حفظ الترتيب"
                  message="هل تريد اعتماد الأرقام الترتيبية الجديدة وتحديث ترتيب الظهور للزوار؟"
                  confirmLabel="تأكيد الحفظ"
                  busy={savingOrder}
                  onConfirm={handleSaveManualOrders}
                  renderTrigger={({ onClick }) => (
                    <button
                      type="button"
                      disabled={savingOrder}
                      onClick={onClick}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1E40AF] text-white text-xs font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingOrder ? 'جاري الحفظ...' : 'حفظ الترتيب الجديد'}</span>
                    </button>
                  )}
                />
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
                          <ConfirmActionDropdown
                            variant={item.status === 'published' ? 'warning' : 'primary'}
                            title={item.status === 'published' ? 'تأكيد إلغاء النشر' : 'تأكيد النشر'}
                            message={
                              item.status === 'published'
                                ? `هل تريد تحويل «${item.title}» إلى مسودة وإخفاءه مؤقتاً عن الزوار؟`
                                : `هل تريد نشر «${item.title}» وإظهاره للزوار في المنصة؟`
                            }
                            confirmLabel={item.status === 'published' ? 'تحويل لمسودة' : 'نشر الآن'}
                            busy={busyId === item.id}
                            onConfirm={() => togglePublish(item)}
                            renderTrigger={({ onClick }) => (
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={onClick}
                                title={item.status === 'published' ? 'إلغاء النشر' : 'نشر'}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                {item.status === 'published' ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4 text-emerald-700" />
                                )}
                              </button>
                            )}
                          />
                          {hasPermission('delete_works') && (
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
                          )}
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

      {/* Bulk Import Modal (40+ Projects via Live Excel or Quick Lines) */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E40AF]">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>الاستيراد الجماعي للمشاريع والإنتاجات (Excel / لصق سريع)</span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-1">
                  رفع 40+ مشروعاً وموضوعاً دفعة واحدة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Method Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBulkTab('file')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer ${
                    bulkTab === 'file'
                      ? 'bg-[#1E40AF] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  1. استيراد ملف Excel (.xlsx / .csv)
                </button>
                <button
                  type="button"
                  onClick={() => setBulkTab('quick')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer ${
                    bulkTab === 'quick'
                      ? 'bg-[#1E40AF] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  2. لصق سطور سريعة لـ 40 مشروعاً
                </button>
              </div>

              <button
                type="button"
                disabled={exportingExcel}
                onClick={() => handleDownloadLiveExcel(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-medium text-emerald-800 hover:bg-emerald-100 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تنزيل قالب Excel بالقوائم المنسدلة الحية</span>
              </button>
            </div>

            {bulkTab === 'file' ? (
              <div className="p-5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 space-y-3 text-center">
                <FileSpreadsheet className="w-9 h-9 text-[#1E40AF] mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    اختر ملف Excel المعبّأ (.xlsx أو .csv)
                  </p>
                  <p className="text-xs text-slate-500">
                    يُنشأ القالب تلقائياً متضمناً قوائم منسدلة للتصنيفات الرئيسية والفرعية، المستويات، أنواع المحتوى، وطرق الإضافة كما هي في منصتك المنشورة.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E40AF] text-white text-xs sm:text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{bulkParsing ? 'جاري التحليل...' : 'اختيار ملف Excel للتحليل'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.csv,.txt"
                    onChange={handleBulkFileChange}
                    className="hidden"
                  />
                </label>
                {bulkFileName && (
                  <div className="text-xs text-slate-600">الملف المختار: {bulkFileName}</div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      التصنيف الرئيسي الموحد
                    </label>
                    <select
                      value={quickCatId}
                      onChange={(e) => {
                        setQuickCatId(Number(e.target.value));
                        setQuickSubCatId('');
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      {mainCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      التصنيف الفرعي (اختياري)
                    </label>
                    <select
                      value={quickSubCatId}
                      onChange={(e) => setQuickSubCatId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      <option value="">بدون تصنيف فرعي</option>
                      {quickSubCategories.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      نوع المحتوى
                    </label>
                    <select
                      value={quickContentType}
                      onChange={(e) => setQuickContentType(e.target.value as ContentType)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      {Object.entries(CONTENT_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      مصدر الرابط الافتراضي
                    </label>
                    <select
                      value={quickSourceMethod}
                      onChange={(e) => setQuickSourceMethod(e.target.value as SourceMethod)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      <option value="gdrive">Google Drive</option>
                      <option value="youtube">YouTube</option>
                      <option value="direct">رابط مباشر</option>
                      <option value="project_bundle">مشروع مدرسي متكامل</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      المستوى الدراسي الافتراضي
                    </label>
                    <select
                      value={quickGradeLevel}
                      onChange={(e) => setQuickGradeLevel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      {GRADE_LEVELS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      حالة النشر
                    </label>
                    <select
                      value={quickStatus}
                      onChange={(e) => setQuickStatus(e.target.value as PublishStatus)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      <option value="published">نشر مباشرة</option>
                      <option value="draft">حفظ كمسودة</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    الصق سطراً لكل مشروع بالتنسيق:{' '}
                    <span dir="ltr" className="font-mono text-[#1E40AF]">
                      العنوان | الرابط | اسم التلميذ | المستوى (اختياري) | وصف مختصر (اختياري)
                    </span>
                  </label>
                  <textarea
                    rows={7}
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    placeholder={`مشروع الري الذكي | https://drive.google.com/file/d/.../view | سلمى المنصوري | السادس ابتدائي | نظام سقي أوتوماتيكي\nروبوت فرز النفايات | https://youtu.be/... | نادي الروبوتيك`}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs leading-relaxed"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleParseQuickLines}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تحليل السطور ومعاينة المشاريع</span>
                </button>
              </div>
            )}

            {/* Errors */}
            {bulkErrors.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1 max-h-40 overflow-y-auto">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>ملاحظات وأخطاء ({bulkErrors.length}):</span>
                </div>
                <ul className="list-disc pr-5 space-y-0.5">
                  {bulkErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Parsed Rows */}
            {bulkRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    معاينة الصفوف الجاهزة للاستيراد ({bulkRows.length} مشروع)
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkRows([])}
                    className="text-xs text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    مسح القائمة
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-64">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">العنوان</th>
                        <th className="py-2 px-3">التلميذ</th>
                        <th className="py-2 px-3">التصنيف</th>
                        <th className="py-2 px-3">النوع</th>
                        <th className="py-2 px-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-900 max-w-[240px] truncate">
                            {row.title}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{row.student_name || '—'}</td>
                          <td className="py-2 px-3 text-slate-600">
                            {categoryNameMap.get(row.category_id) || row.category_id}
                            {row.subcategory_id
                              ? ` / ${categoryNameMap.get(row.subcategory_id) || ''}`
                              : ''}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {CONTENT_TYPE_LABELS[row.content_type]}
                          </td>
                          <td className="py-2 px-3">
                            {row.status === 'published' ? 'منشور' : 'مسودة'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    إغلاق
                  </button>
                  <ConfirmActionDropdown
                    variant="primary"
                    title="تأكيد الاستيراد الجماعي"
                    message={`سيتم إضافة ${bulkRows.length} مشروعاً وموضوعاً دفعة واحدة إلى المنصة. هل تريد المتابعة؟`}
                    confirmLabel="استيراد المشاريع الآن"
                    busy={bulkImporting}
                    busyLabel="جاري الاستيراد..."
                    onConfirm={handleConfirmBulkImport}
                    renderTrigger={({ onClick }) => (
                      <button
                        type="button"
                        disabled={bulkImporting}
                        onClick={onClick}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white text-xs sm:text-sm font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>
                          {bulkImporting
                            ? 'جاري الاستيراد...'
                            : `تأكيد واستيراد ${bulkRows.length} مشروع`}
                        </span>
                      </button>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
