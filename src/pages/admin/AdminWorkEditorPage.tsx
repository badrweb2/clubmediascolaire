import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Eye,
  FileCheck2,
  FolderKanban,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Link2,
  Plus,
  Save,
  Send,
  Trash2,
  Youtube,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { MediaPlayer } from '../../components/MediaPlayer.tsx';
import { ConfirmDeleteDropdown } from '../../components/ConfirmDeleteDropdown.tsx';
import { ConfirmActionDropdown } from '../../components/ConfirmActionDropdown.tsx';
import {
  CONTENT_TYPE_LABELS,
  GRADE_LEVELS,
  isSafeUrl,
  normalizeImageUrl,
  parseMediaUrlClient,
} from '../../lib/mediaUtils.ts';
import type {
  Category,
  ContentType,
  EmbedHealth,
  ExtraMediaItem,
  LinkInspectionResult,
  PublishStatus,
  SourceMethod,
  WorkItem,
} from '../../types.ts';

const PRESET_THUMBNAILS = [
  {
    label: 'مشروع الطاقة الشمسية',
    url: '/src/assets/images/thumb_science_solar_1795563099401.jpg',
  },
  {
    label: 'استوديو الإذاعة المدرسية',
    url: '/src/assets/images/thumb_school_radio_1795563100335.jpg',
  },
  {
    label: 'المعرض الفني والزخرفة',
    url: '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
  },
  {
    label: 'نادي الروبوتيك والعلوم',
    url: '/src/assets/images/thumb_robotics_club_1795563100911.jpg',
  },
  {
    label: 'المجلة المدرسية والبحوث',
    url: '/src/assets/images/thumb_school_magazine_1795563101388.jpg',
  },
  {
    label: 'مكتبة ومعرض المدرسة',
    url: '/src/assets/images/hero_school_cover_1795563098821.jpg',
  },
];

export function AdminWorkEditorPage({ editId }: { editId?: number }) {
  const { apiFetch, navigate, refreshPublicBootstrap, searchParams, hasPermission } = useApp();
  const fromQuery = searchParams.get('from') || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [inspecting, setInspecting] = useState(false);

  const [sourceMethod, setSourceMethod] = useState<SourceMethod>('youtube');
  const [contentType, setContentType] = useState<ContentType>('video');
  const [originalUrl, setOriginalUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [mediaMime, setMediaMime] = useState('');
  const [extraMediaItems, setExtraMediaItems] = useState<ExtraMediaItem[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [studentName, setStudentName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<string>(GRADE_LEVELS[5]);
  const [classSection, setClassSection] = useState('');
  const [publishDate, setPublishDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<number>(1);
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [extraCategoryIds, setExtraCategoryIds] = useState<number[]>([]);
  const [showExtraCats, setShowExtraCats] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [galleryItems, setGalleryItems] = useState<string[]>(['', '']);
  const [keywords, setKeywords] = useState('');
  const [status, setStatus] = useState<PublishStatus>('draft');
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState<string>('');

  const [embedStatus, setEmbedStatus] = useState<EmbedHealth>('ok');
  const [inspection, setInspection] = useState<LinkInspectionResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [thumbError, setThumbError] = useState(false);

  const resolvedThumbnailUrl = useMemo(
    () => normalizeImageUrl(thumbnailUrl),
    [thumbnailUrl]
  );

  useEffect(() => {
    setThumbError(false);
  }, [resolvedThumbnailUrl]);

  useEffect(() => {
    apiFetch<{ categories: Category[] }>('/api/admin/categories')
      .then((res) => {
        setCategories(res.categories);
        if (!editId) {
          const fromParams = new URLSearchParams(fromQuery);
          const presetCat = Number(fromParams.get('categoryId') || '');
          const presetSub = fromParams.get('subCategoryId') || '';
          const firstMain = res.categories.find((c) => c.parent_id === null);
          if (presetCat && res.categories.some((c) => c.id === presetCat && c.parent_id === null)) {
            setCategoryId(presetCat);
            if (presetSub && res.categories.some((c) => String(c.id) === presetSub && c.parent_id === presetCat)) {
              setSubcategoryId(presetSub);
            }
          } else if (firstMain) {
            setCategoryId(firstMain.id);
          }
        }
      })
      .catch(() => {});
  }, [apiFetch, editId, fromQuery]);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    setLoading(true);
    apiFetch<{ item: WorkItem }>(`/api/admin/works/${editId}`)
      .then(({ item }) => {
        if (!active) return;
        setSourceMethod(item.source_method);
        setContentType(item.content_type);
        setOriginalUrl(item.original_url);
        setEmbedUrl(item.embed_url);
        setMediaMime(item.media_mime);
        setExtraMediaItems(Array.isArray(item.extra_media) ? item.extra_media : []);
        setTitle(item.title);
        setDescription(item.description);
        setStudentName(item.student_name);
        setGradeLevel(item.grade_level);
        setClassSection(item.class_section);
        setPublishDate(item.publish_date);
        setCategoryId(item.category_id);
        setSubcategoryId(item.subcategory_id ? String(item.subcategory_id) : '');
        const loadedExtras = Array.isArray(item.extra_category_ids) ? item.extra_category_ids : [];
        setExtraCategoryIds(loadedExtras);
        if (loadedExtras.length > 0) setShowExtraCats(true);
        setThumbnailUrl(item.thumbnail_url);
        setGalleryItems(
          item.gallery_urls && item.gallery_urls.length > 0 ? item.gallery_urls : ['']
        );
        setKeywords(item.keywords);
        setStatus(item.status);
        setFeatured(item.featured);
        setSortOrder(item.sort_order ? String(item.sort_order) : '');
        setEmbedStatus(item.embed_status);
      })
      .catch((err) => {
        if (active) {
          setFeedback({
            type: 'error',
            text: err instanceof Error ? err.message : 'تعذر تحميل بيانات المحتوى.',
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editId, apiFetch]);

  const mainCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );
  const subcategories = useMemo(
    () => categories.filter((c) => c.parent_id === categoryId),
    [categories, categoryId]
  );

  // Instant client-side link parsing as admin types/pastes URL
  const handleUrlChange = (nextUrl: string) => {
    setOriginalUrl(nextUrl);
    setInspection(null);
    if (!nextUrl.trim()) {
      setEmbedUrl('');
      return;
    }
    const parsed = parseMediaUrlClient(nextUrl, sourceMethod, contentType);
    if (parsed.valid) {
      setEmbedUrl(parsed.embedUrl);
      setMediaMime(parsed.mediaMime);
      if (parsed.sourceMethod !== sourceMethod && sourceMethod !== 'project_bundle') {
        setSourceMethod(parsed.sourceMethod);
      }
      if (contentType !== 'project') {
        setContentType(parsed.contentType);
      }
      if (parsed.thumbnailUrl && !thumbnailUrl) {
        setThumbnailUrl(parsed.thumbnailUrl);
      }
    }
  };

  const handleInspectLink = async () => {
    if (!originalUrl.trim()) {
      setFeedback({ type: 'error', text: 'يرجى لصق رابط المحتوى أولاً قبل الفحص.' });
      return;
    }
    setInspecting(true);
    setFeedback(null);
    try {
      const res = await apiFetch<LinkInspectionResult>('/api/admin/inspect-link', {
        method: 'POST',
        body: JSON.stringify({
          url: originalUrl.trim(),
          source_method: sourceMethod,
          content_type: contentType,
        }),
      });
      setInspection(res);
      setEmbedStatus(res.embed_status);
      if (res.embed_url) setEmbedUrl(res.embed_url);
      if (res.media_mime) setMediaMime(res.media_mime);
      if (res.detected_content_type && contentType !== 'project') {
        setContentType(res.detected_content_type);
      }
      if (res.thumbnail_url && !thumbnailUrl) {
        setThumbnailUrl(res.thumbnail_url);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر فحص الرابط.',
      });
    } finally {
      setInspecting(false);
    }
  };

  const returnToCategoryTarget = useMemo(() => {
    const fromParams = new URLSearchParams(fromQuery);
    const fromCat = fromParams.get('categoryId') || '';
    const fromSub = fromParams.get('subCategoryId') || '';

    if (fromQuery && (fromCat || fromSub)) {
      const catObj = categories.find((c) => String(c.id) === (fromSub || fromCat));
      return {
        url: `/admin/works?${fromQuery}`,
        label: catObj ? `العودة إلى التصنيف: ${catObj.name}` : 'العودة إلى التصنيف',
      };
    }

    if (categoryId) {
      const sp = new URLSearchParams();
      sp.set('categoryId', String(categoryId));
      if (subcategoryId) sp.set('subCategoryId', subcategoryId);
      const catObj = categories.find((c) => String(c.id) === (subcategoryId || String(categoryId)));
      return {
        url: `/admin/works?${sp.toString()}`,
        label: catObj ? `العودة إلى التصنيف: ${catObj.name}` : 'العودة إلى التصنيف',
      };
    }

    return {
      url: fromQuery ? `/admin/works?${fromQuery}` : '/admin/works',
      label: 'العودة إلى التصنيف',
    };
  }, [fromQuery, categories, categoryId, subcategoryId]);

  const validExtraMediaPreview = useMemo<ExtraMediaItem[]>(
    () =>
      extraMediaItems
        .filter((m) => isSafeUrl(m.original_url.trim()))
        .map((m) => ({
          ...m,
          title: m.title.trim(),
          original_url: m.original_url.trim(),
          embed_url: (m.embed_url || m.original_url).trim(),
        })),
    [extraMediaItems]
  );

  const addExtraMediaSlot = () => {
    setExtraMediaItems((prev) => [
      ...prev,
      {
        title: '',
        content_type: contentType,
        source_method: sourceMethod,
        original_url: '',
        embed_url: '',
        media_mime: '',
      },
    ]);
  };

  const updateExtraMediaUrl = (idx: number, nextUrl: string) => {
    setExtraMediaItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (!nextUrl.trim()) {
          return { ...item, original_url: nextUrl, embed_url: '', media_mime: '' };
        }
        const parsed = parseMediaUrlClient(nextUrl, item.source_method, item.content_type);
        if (parsed.valid) {
          return {
            ...item,
            original_url: nextUrl,
            embed_url: parsed.embedUrl,
            media_mime: parsed.mediaMime,
            source_method:
              parsed.sourceMethod !== item.source_method && item.source_method !== 'project_bundle'
                ? parsed.sourceMethod
                : item.source_method,
            content_type: item.content_type !== 'project' ? parsed.contentType : item.content_type,
          };
        }
        return { ...item, original_url: nextUrl, embed_url: nextUrl };
      })
    );
  };

  const moveExtraMediaSlot = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= extraMediaItems.length) return;
    setExtraMediaItems((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const removeExtraMediaSlot = (idx: number) => {
    setExtraMediaItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const galleryUrlsArray = useMemo(
    () =>
      galleryItems
        .map((line) => normalizeImageUrl(line.trim()))
        .filter((line) => isSafeUrl(line)),
    [galleryItems]
  );

  const moveGallerySlot = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= galleryItems.length) return;
    setGalleryItems((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const removeGallerySlot = (idx: number) => {
    setGalleryItems((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, i) => i !== idx);
    });
  };

  const toggleExtraCategory = (id: number) => {
    setExtraCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async (targetStatus: PublishStatus) => {
    setFeedback(null);
    if (!title.trim()) {
      setFeedback({ type: 'error', text: 'يرجى كتابة عنوان المحتوى.' });
      return;
    }
    if (!originalUrl.trim() || !isSafeUrl(originalUrl.trim())) {
      setFeedback({
        type: 'error',
        text: 'يرجى إدخال رابط محتوى صحيح (يبدأ بـ https:// أو http://).',
      });
      return;
    }

    if (targetStatus === 'published' && embedStatus === 'blocked') {
      setFeedback({
        type: 'error',
        text: 'لا يمكن نشر محتوى يعاني من مشكلة صلاحيات وصول. يرجى حل مشكلة الرابط أو حفظه كمسودة.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        student_name: studentName.trim(),
        grade_level: gradeLevel,
        class_section: classSection.trim(),
        publish_date: publishDate,
        content_type: contentType,
        source_method: sourceMethod,
        original_url: originalUrl.trim(),
        embed_url: embedUrl.trim() || originalUrl.trim(),
        media_mime: mediaMime,
        extra_media: validExtraMediaPreview,
        thumbnail_url: normalizeImageUrl(thumbnailUrl.trim()),
        gallery_urls: galleryUrlsArray,
        category_id: categoryId,
        subcategory_id: subcategoryId ? Number(subcategoryId) : null,
        extra_category_ids: extraCategoryIds.filter(
          (id) => id !== categoryId && id !== (subcategoryId ? Number(subcategoryId) : -1)
        ),
        keywords: keywords.trim(),
        status: targetStatus,
        featured,
        sort_order: sortOrder.trim() ? Number(sortOrder) : 0,
        embed_status: embedStatus,
        embed_note: inspection?.message || '',
      };

      const res = await apiFetch<{ item: WorkItem }>(
        editId ? `/api/admin/works/${editId}` : '/api/admin/works',
        {
          method: editId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      setStatus(res.item.status);
      setSortOrder(res.item.sort_order ? String(res.item.sort_order) : '');
      setExtraCategoryIds(Array.isArray(res.item.extra_category_ids) ? res.item.extra_category_ids : []);
      setExtraMediaItems(Array.isArray(res.item.extra_media) ? res.item.extra_media : []);
      await refreshPublicBootstrap();
      setFeedback({
        type: 'success',
        text:
          targetStatus === 'published'
            ? 'تم نشر الإنتاج بنجاح وأصبح متاحاً للزوار في المنصة.'
            : 'تم حفظ الإنتاج كمسودة بنجاح.',
      });

      if (!editId) {
        navigate(
          fromQuery
            ? `/admin/edit/${res.item.id}?from=${encodeURIComponent(fromQuery)}`
            : `/admin/edit/${res.item.id}`
        );
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حفظ البيانات.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/works/${editId}`, { method: 'DELETE' });
      await refreshPublicBootstrap();
      navigate(returnToCategoryTarget.url);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حذف المحتوى.',
      });
    } finally {
      setSaving(false);
    }
  };

  const methodTabs: Array<{
    id: SourceMethod;
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'youtube',
      label: 'رابط YouTube',
      hint: 'لصق رابط فيديو YouTube للتشغيل المدمج داخل المنصة.',
      icon: Youtube,
    },
    {
      id: 'gdrive',
      label: 'رابط Google Drive',
      hint: 'لصق رابط فيديو، صوت، صورة، PDF، أو عرض Google Slides من Drive.',
      icon: HardDrive,
    },
    {
      id: 'direct',
      label: 'رابط مباشر',
      hint: 'رابط مباشر ينتهي بصيغة MP4 أو WebM أو MP3 أو WAV أو JPG أو PDF.',
      icon: Link2,
    },
    {
      id: 'project_bundle',
      label: 'مشروع مدرسي متكامل',
      hint: 'توثيق مشروع بصور متعددة مع رابط ملف بحث أو عرض مرفق.',
      icon: FolderKanban,
    },
  ];

  if (loading) {
    return (
      <AdminLayout title="تحميل المحرر">
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={editId ? 'تعديل ومعاينة الإنتاج' : 'إضافة محتوى جديد'}>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {editId ? 'تعديل ومعاينة المحتوى' : 'إضافة إنتاج طلابي جديد'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              الصق رابط المحتوى، تحقق من المعاينة المباشرة داخل المنصة، ثم احفظ كمسودة أو انشر للزوار.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(returnToCategoryTarget.url)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E40AF]/30 bg-blue-50/70 text-xs font-medium text-[#1E40AF] hover:bg-blue-100/70 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{returnToCategoryTarget.label}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLivePreview((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>{showLivePreview ? 'إخفاء المعاينة' : 'إظهار المعاينة المباشرة'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {feedback.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Form Column */}
          <div className={`${showLivePreview ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-6`}>
            {/* Step 1: Link Source Method */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  1. طريقة إضافة المحتوى والرابط
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  اختر مصدر المحتوى ثم الصق الرابط لتحويله تلقائياً إلى مشغل مدمج.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {methodTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = sourceMethod === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSourceMethod(tab.id);
                        if (tab.id === 'youtube') setContentType('video');
                        if (tab.id === 'project_bundle') setContentType('project');
                      }}
                      className={`text-right p-3.5 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                        active
                          ? 'bg-[#1E40AF]/5 border-[#1E40AF] text-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          active ? 'text-[#1E40AF]' : 'text-slate-400'
                        }`}
                      />
                      <div>
                        <div className="text-sm font-semibold">{tab.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {tab.hint}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label htmlFor="work-url" className="block text-sm font-medium text-slate-700">
                  رابط المحتوى (URL)
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="work-url"
                    type="text"
                    dir="ltr"
                    value={originalUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder={
                      sourceMethod === 'youtube'
                        ? 'https://www.youtube.com/watch?v=...'
                        : sourceMethod === 'gdrive'
                          ? 'https://drive.google.com/file/d/.../view?usp=sharing'
                          : 'https://example.com/media/file.mp4'
                    }
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                  />
                  <button
                    type="button"
                    onClick={handleInspectLink}
                    disabled={inspecting}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-medium hover:bg-slate-800 disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>{inspecting ? 'جاري الفحص...' : 'فحص صلاحية الرابط'}</span>
                  </button>
                </div>
              </div>

              {/* Google Drive Guide & Link Inspection Diagnostic */}
              {sourceMethod === 'gdrive' && !inspection && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                  <div className="font-semibold text-slate-900">
                    إرشادات مشاركة ملفات Google Drive للعرض داخل المنصة:
                  </div>
                  <p>
                    1. افتح الملف في Google Drive واضغط على <strong>مشاركة (Share)</strong>.
                  </p>
                  <p>
                    2. غيّر الوصول العام إلى <strong>أي شخص لديه الرابط (Anyone with the link)</strong>{' '}
                    بصلاحية <strong>عارض (Viewer)</strong>.
                  </p>
                </div>
              )}

              {inspection && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 leading-relaxed ${
                    inspection.embed_status === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : inspection.embed_status === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    {inspection.embed_status === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{inspection.message}</span>
                  </div>
                  {inspection.guidance.length > 0 && (
                    <ul className="list-disc pr-5 space-y-1">
                      {inspection.guidance.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    نوع المشغل / المحتوى
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value as ContentType)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                  >
                    {Object.entries(CONTENT_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    تاريخ النشر
                  </label>
                  <input
                    type="date"
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                  />
                </div>
              </div>

              {/* Multiple Extra Media Links */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <Link2 className="w-4 h-4 text-[#1E40AF]" />
                      <span>روابط وسائط إضافية بالموضوع (اختياري — فيديو، صوت، عرض، PDF)</span>
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      يمكنك إضافة أكثر من رابط فيديو أو تسجيل صوتي أو وثيقة داخل نفس الموضوع لتظهر مرتبة تحت المشغل الرئيسي.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addExtraMediaSlot}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E40AF]/10 text-[#1E40AF] text-xs font-medium hover:bg-[#1E40AF]/15 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة رابط وسائط إضافي</span>
                  </button>
                </div>

                {extraMediaItems.length > 0 && (
                  <div className="space-y-3">
                    {extraMediaItems.map((media, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <span className="w-5 h-5 rounded-md bg-[#1E40AF] text-white inline-flex items-center justify-center font-mono text-[11px]">
                              {idx + 2}
                            </span>
                            <span>وسيط إضافي رقم {idx + 2}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveExtraMediaSlot(idx, -1)}
                              title="تقديم للأعلى"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#1E40AF] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === extraMediaItems.length - 1}
                              onClick={() => moveExtraMediaSlot(idx, 1)}
                              title="تأخير للأسفل"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#1E40AF] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <ConfirmDeleteDropdown
                              title="تأكيد المسح"
                              message={`هل تريد مسح الرابط الإضافي رقم ${idx + 2}؟`}
                              confirmLabel="نعم، مسح"
                              onConfirm={() => removeExtraMediaSlot(idx)}
                              renderTrigger={({ onClick }) => (
                                <button
                                  type="button"
                                  onClick={onClick}
                                  title="مسح الرابط الإضافي"
                                  className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={media.title}
                            onChange={(e) =>
                              setExtraMediaItems((prev) =>
                                prev.map((m, i) => (i === idx ? { ...m, title: e.target.value } : m))
                              )
                            }
                            placeholder="عنوان هذا الجزء أو الرابط (اختياري)"
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={media.source_method}
                              onChange={(e) => {
                                const nextMethod = e.target.value as SourceMethod;
                                setExtraMediaItems((prev) =>
                                  prev.map((m, i) => {
                                    if (i !== idx) return m;
                                    const parsed = m.original_url.trim()
                                      ? parseMediaUrlClient(m.original_url, nextMethod, m.content_type)
                                      : null;
                                    return {
                                      ...m,
                                      source_method: nextMethod,
                                      embed_url: parsed?.valid ? parsed.embedUrl : m.embed_url,
                                    };
                                  })
                                );
                              }}
                              aria-label="مصدر الرابط الإضافي"
                              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                            >
                              <option value="youtube">YouTube</option>
                              <option value="gdrive">Google Drive</option>
                              <option value="direct">رابط مباشر</option>
                              <option value="project_bundle">مستند/مشروع</option>
                            </select>

                            <select
                              value={media.content_type}
                              onChange={(e) => {
                                const nextType = e.target.value as ContentType;
                                setExtraMediaItems((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, content_type: nextType } : m))
                                );
                              }}
                              aria-label="نوع المحتوى الإضافي"
                              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                            >
                              {Object.entries(CONTENT_TYPE_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <input
                          type="text"
                          dir="ltr"
                          value={media.original_url}
                          onChange={(e) => updateExtraMediaUrl(idx, e.target.value)}
                          placeholder="الصق رابط YouTube أو Google Drive أو رابط MP3 / MP4 / PDF مباشرة..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Step 2: Metadata */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <h2 className="font-display text-base font-bold text-slate-900">
                2. بيانات الإنتاج والتصنيف
              </h2>

              <div>
                <label htmlFor="work-title" className="block text-sm font-medium text-slate-700 mb-1.5">
                  عنوان الإنتاج *
                </label>
                <input
                  id="work-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: تجربة تنقية المياه بالطاقة الشمسية"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>

              <div>
                <label htmlFor="work-desc" className="block text-sm font-medium text-slate-700 mb-1.5">
                  وصف مختصر للإنتاج
                </label>
                <textarea
                  id="work-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اكتب نبذة واضحة عن فكرة العمل وأهدافه التربوية..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    التصنيف الرئيسي
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      const nextCatId = Number(e.target.value);
                      setCategoryId(nextCatId);
                      setSubcategoryId('');
                      setExtraCategoryIds((prev) => prev.filter((id) => id !== nextCatId));
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                  >
                    {mainCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    التصنيف الفرعي (اختياري)
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => {
                      const nextSub = e.target.value;
                      setSubcategoryId(nextSub);
                      if (nextSub) {
                        const subNum = Number(nextSub);
                        setExtraCategoryIds((prev) => prev.filter((id) => id !== subNum));
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                  >
                    <option value="">بدون تصنيف فرعي</option>
                    {subcategories.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Multi-Category Assignment */}
                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                        <Layers className="w-4 h-4 text-[#1E40AF]" />
                        <span>تصنيفات إضافية يظهر فيها هذا المحتوى (اختياري)</span>
                        {extraCategoryIds.length > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-[#1E40AF] text-white text-xs font-mono">
                            {extraCategoryIds.length}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        يظهر المحتوى افتراضياً فقط في التصنيف المختار أعلاه. أضف تصنيفات أخرى هنا إذا أردت عرضه في أكثر من محور.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {extraCategoryIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExtraCategoryIds([])}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          إلغاء الكل
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowExtraCats((v) => !v)}
                        className="px-3 py-1.5 rounded-lg bg-[#1E40AF]/10 text-[#1E40AF] text-xs font-medium hover:bg-[#1E40AF]/15 cursor-pointer"
                      >
                        {showExtraCats ? 'إخفاء القائمة' : 'اختيار تصنيفات إضافية'}
                      </button>
                    </div>
                  </div>

                  {showExtraCats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      {mainCategories.map((mainCat) => {
                        const subs = categories.filter((c) => c.parent_id === mainCat.id);
                        const isPrimaryMain = mainCat.id === categoryId;
                        const checkedMain = extraCategoryIds.includes(mainCat.id);
                        return (
                          <div
                            key={mainCat.id}
                            className="bg-white border border-slate-200 rounded-lg p-3 space-y-2"
                          >
                            <label
                              className={`flex items-center gap-2 text-xs font-semibold ${
                                isPrimaryMain
                                  ? 'text-[#1E40AF]'
                                  : 'text-slate-800 cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={isPrimaryMain}
                                checked={isPrimaryMain || checkedMain}
                                onChange={() => toggleExtraCategory(mainCat.id)}
                                className="w-4 h-4 accent-[#1E40AF] rounded"
                              />
                              <span>{mainCat.name}</span>
                              {isPrimaryMain && (
                                <span className="text-[11px] font-normal text-slate-500">
                                  (الأساسي)
                                </span>
                              )}
                            </label>

                            {subs.length > 0 && (
                              <div className="pr-5 space-y-1.5 border-r border-slate-100">
                                {subs.map((sub) => {
                                  const isPrimarySub = String(sub.id) === subcategoryId;
                                  const checkedSub = extraCategoryIds.includes(sub.id);
                                  return (
                                    <label
                                      key={sub.id}
                                      className={`flex items-center gap-2 text-xs ${
                                        isPrimarySub
                                          ? 'text-[#1E40AF]'
                                          : 'text-slate-600 cursor-pointer'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={isPrimarySub}
                                        checked={isPrimarySub || checkedSub}
                                        onChange={() => toggleExtraCategory(sub.id)}
                                        className="w-3.5 h-3.5 accent-[#1E40AF] rounded"
                                      />
                                      <span>{sub.name}</span>
                                      {isPrimarySub && (
                                        <span className="text-[11px] text-slate-500">
                                          (فرعي أساسي)
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    اسم التلميذ أو المجموعة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="مثال: سلمى المنصوري / نادي العلوم"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    المستوى الدراسي
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                  >
                    {GRADE_LEVELS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    القسم أو النادي (اختياري)
                  </label>
                  <input
                    type="text"
                    value={classSection}
                    onChange={(e) => setClassSection(e.target.value)}
                    placeholder="مثال: القسم 6/أ"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    كلمات مفتاحية
                  </label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="علوم، بيئة، روبوتيك..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    الرقم الترتيبي في المنصة (الأصغر يظهر أولاً)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    placeholder="تلقائي أو أدخل 1، 2، 3..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 tabular-nums"
                  />
                </div>
              </div>

              {/* Thumbnail URL + Presets */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700">
                  رابط الصورة المصغرة / الغلاف
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(normalizeImageUrl(e.target.value))}
                  placeholder="https://... أو رابط مشاركة صورة من Google Drive"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 text-left"
                />
                <p className="text-xs text-slate-500 leading-relaxed">
                  عند استخدام صورة من Google Drive، تأكد أن إعداد مشاركتها هو:{' '}
                  <strong>أي شخص لديه الرابط ← عارض (Viewer)</strong>.
                </p>

                {isSafeUrl(resolvedThumbnailUrl) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    {thumbError ? (
                      <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          تعذر عرض الصورة المصغرة. إذا كانت من Google Drive، افتحها في Drive ثم غيّر
                          صلاحية المشاركة إلى <strong>أي شخص لديه الرابط (Anyone with the link)</strong>{' '}
                          بصفة <strong>عارض (Viewer)</strong>.
                        </span>
                      </div>
                    ) : (
                      <img
                        key={resolvedThumbnailUrl}
                        src={resolvedThumbnailUrl}
                        alt="معاينة الصورة المصغرة"
                        referrerPolicy="no-referrer"
                        onError={() => setThumbError(true)}
                        className="w-full max-h-56 object-contain bg-white p-1 rounded-lg border border-slate-200"
                      />
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESET_THUMBNAILS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setThumbnailUrl(preset.url)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                        thumbnailUrl === preset.url
                          ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Always-available Structured Multi-Image Slots (Google Drive or Direct URLs) */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <ImageIcon className="w-4 h-4 text-[#1E40AF]" />
                      <span>صور مرفقة ومنسقة بالموضوع (اختياري — من Google Drive أو روابط مباشرة)</span>
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      أضف روابط الصور في الأماكن المخصصة ورتبها بالأزرار لتظهر منسقة ومرتبة داخل صفحة الموضوع.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGalleryItems((prev) => [...prev, ''])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E40AF]/10 text-[#1E40AF] text-xs font-medium hover:bg-[#1E40AF]/15 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة مكان صورة</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {galleryItems.map((rawUrl, idx) => {
                    const resolved = normalizeImageUrl(rawUrl.trim());
                    const hasValidUrl = isSafeUrl(resolved);

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <span className="w-5 h-5 rounded-md bg-[#1E40AF] text-white inline-flex items-center justify-center font-mono text-[11px]">
                              {idx + 1}
                            </span>
                            <span>صورة {idx + 1}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveGallerySlot(idx, -1)}
                              title="تقديم للأعلى"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#1E40AF] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === galleryItems.length - 1}
                              onClick={() => moveGallerySlot(idx, 1)}
                              title="تأخير للأسفل"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#1E40AF] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <ConfirmDeleteDropdown
                              title="تأكيد المسح"
                              message={`هل تريد مسح خانة الصورة رقم ${idx + 1}؟`}
                              confirmLabel="نعم، مسح"
                              onConfirm={() => removeGallerySlot(idx)}
                              renderTrigger={({ onClick }) => (
                                <button
                                  type="button"
                                  onClick={onClick}
                                  title="مسح مكان الصورة"
                                  className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 items-start">
                          <input
                            type="text"
                            dir="ltr"
                            value={rawUrl}
                            onChange={(e) => {
                              const nextVal = normalizeImageUrl(e.target.value);
                              setGalleryItems((prev) =>
                                prev.map((v, i) => (i === idx ? nextVal : v))
                              );
                            }}
                            placeholder={`رابط الصورة ${idx + 1} (مثال: رابط مشاركة من Google Drive أو رابط مباشر)`}
                            className="flex-1 w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                          />

                          {hasValidUrl && (
                            <div className="w-28 h-20 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden">
                              <img
                                key={resolved}
                                src={resolved}
                                alt={`معاينة صورة ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain rounded"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 accent-[#1E40AF] rounded"
                />
                <span className="text-sm text-slate-800">
                  تمييز هذا الإنتاج وإظهاره في قسم «المشاريع المدرسية المتميزة» بالرئيسية
                </span>
              </label>
            </section>

            {/* Action Buttons */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <ConfirmActionDropdown
                  variant="primary"
                  title={status === 'published' ? 'تأكيد تحديث المحتوى' : 'تأكيد نشر الإنتاج'}
                  message={
                    status === 'published'
                      ? `هل تريد حفظ وتحديث بيانات «${title || 'هذا الإنتاج'}» في المنصة؟`
                      : `هل تريد نشر «${title || 'هذا الإنتاج'}» ليظهر لجميع زوار المنصة؟`
                  }
                  confirmLabel={status === 'published' ? 'تأكيد التحديث' : 'نعم، نشر الآن'}
                  busy={saving}
                  busyLabel="جاري الحفظ..."
                  onConfirm={() => handleSave('published')}
                  renderTrigger={({ onClick }) => (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={onClick}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{status === 'published' ? 'تحديث ونشر التعديلات' : 'نشر الإنتاج الآن'}</span>
                    </button>
                  )}
                />

                <ConfirmActionDropdown
                  variant="warning"
                  title="تأكيد الحفظ كمسودة"
                  message={
                    status === 'published'
                      ? `هل تريد إلغاء نشر «${title || 'هذا الإنتاج'}» وتحويله إلى مسودة داخلية؟`
                      : `هل تريد حفظ «${title || 'هذا الإنتاج'}» كمسودة داخلية؟`
                  }
                  confirmLabel="تأكيد الحفظ"
                  busy={saving}
                  busyLabel="جاري الحفظ..."
                  onConfirm={() => handleSave('draft')}
                  renderTrigger={({ onClick }) => (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={onClick}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{status === 'published' ? 'إلغاء النشر وحفظ كمسودة' : 'حفظ كمسودة'}</span>
                    </button>
                  )}
                />

                <button
                  type="button"
                  onClick={() => navigate(returnToCategoryTarget.url)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm font-medium hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة إلى التصنيف</span>
                </button>
              </div>

              {editId && hasPermission('delete_works') && (
                <ConfirmDeleteDropdown
                  title="تأكيد حذف الإنتاج"
                  message={`هل أنت متأكد من حذف «${title || 'هذا الإنتاج'}» نهائياً؟`}
                  confirmLabel="تأكيد الحذف"
                  busy={saving}
                  onConfirm={handleDelete}
                  renderTrigger={({ onClick }) => (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={onClick}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-rose-200 text-rose-700 text-sm font-medium hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف المحتوى</span>
                    </button>
                  )}
                />
              )}
            </div>
          </div>

          {/* Live Preview Column */}
          {showLivePreview && (
            <div className="xl:col-span-5 space-y-5 xl:sticky xl:top-24">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="font-display text-sm font-bold text-slate-900">
                    المعاينة المباشرة قبل النشر
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {status === 'published' ? 'منشور للزوار' : 'مسودة داخلية'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-slate-500">
                    {CONTENT_TYPE_LABELS[contentType]}
                    {gradeLevel ? ` · ${gradeLevel}` : ''}
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    {title || 'عنوان الإنتاج سيظهر هنا...'}
                  </h3>
                  {studentName && (
                    <div className="text-xs text-slate-600">إعداد: {studentName}</div>
                  )}
                </div>

                <MediaPlayer
                  title={title || 'معاينة المحتوى'}
                  contentType={contentType}
                  sourceMethod={sourceMethod}
                  embedUrl={embedUrl || originalUrl}
                  originalUrl={originalUrl}
                  thumbnailUrl={thumbnailUrl}
                  galleryUrls={galleryUrlsArray}
                  extraMedia={validExtraMediaPreview}
                  compact
                  isAdminPreview
                />

                {description && (
                  <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
