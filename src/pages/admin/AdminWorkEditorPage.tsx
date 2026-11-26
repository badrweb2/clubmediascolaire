import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileCheck2,
  FolderKanban,
  HardDrive,
  Link2,
  Save,
  Send,
  Trash2,
  Youtube,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { MediaPlayer } from '../../components/MediaPlayer.tsx';
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
  const { apiFetch, navigate, refreshPublicBootstrap } = useApp();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [inspecting, setInspecting] = useState(false);

  const [sourceMethod, setSourceMethod] = useState<SourceMethod>('youtube');
  const [contentType, setContentType] = useState<ContentType>('video');
  const [originalUrl, setOriginalUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [mediaMime, setMediaMime] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [studentName, setStudentName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<string>(GRADE_LEVELS[5]);
  const [classSection, setClassSection] = useState('');
  const [publishDate, setPublishDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<number>(1);
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [galleryUrlsText, setGalleryUrlsText] = useState('');
  const [keywords, setKeywords] = useState('');
  const [status, setStatus] = useState<PublishStatus>('draft');
  const [featured, setFeatured] = useState(false);

  const [embedStatus, setEmbedStatus] = useState<EmbedHealth>('ok');
  const [inspection, setInspection] = useState<LinkInspectionResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
          const firstMain = res.categories.find((c) => c.parent_id === null);
          if (firstMain) setCategoryId(firstMain.id);
        }
      })
      .catch(() => {});
  }, [apiFetch, editId]);

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
        setTitle(item.title);
        setDescription(item.description);
        setStudentName(item.student_name);
        setGradeLevel(item.grade_level);
        setClassSection(item.class_section);
        setPublishDate(item.publish_date);
        setCategoryId(item.category_id);
        setSubcategoryId(item.subcategory_id ? String(item.subcategory_id) : '');
        setThumbnailUrl(item.thumbnail_url);
        setGalleryUrlsText((item.gallery_urls || []).join('\n'));
        setKeywords(item.keywords);
        setStatus(item.status);
        setFeatured(item.featured);
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

  const galleryUrlsArray = useMemo(
    () =>
      galleryUrlsText
        .split('\n')
        .map((line) => normalizeImageUrl(line.trim()))
        .filter((line) => isSafeUrl(line)),
    [galleryUrlsText]
  );

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
        thumbnail_url: normalizeImageUrl(thumbnailUrl.trim()),
        gallery_urls: galleryUrlsArray,
        category_id: categoryId,
        subcategory_id: subcategoryId ? Number(subcategoryId) : null,
        keywords: keywords.trim(),
        status: targetStatus,
        featured,
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
      await refreshPublicBootstrap();
      setFeedback({
        type: 'success',
        text:
          targetStatus === 'published'
            ? 'تم نشر الإنتاج بنجاح وأصبح متاحاً للزوار في المنصة.'
            : 'تم حفظ الإنتاج كمسودة بنجاح.',
      });

      if (!editId) {
        navigate(`/admin/edit/${res.item.id}`);
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
      navigate('/admin/works');
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حذف المحتوى.',
      });
      setConfirmDelete(false);
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

          <div className="flex items-center gap-2 shrink-0">
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
                      setCategoryId(Number(e.target.value));
                      setSubcategoryId('');
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
                    onChange={(e) => setSubcategoryId(e.target.value)}
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
                        className="w-full max-h-44 object-cover rounded-lg border border-slate-200"
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

              {(contentType === 'project' || contentType === 'image') && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-sm font-medium text-slate-700">
                    صور إضافية للمعرض أو المشروع (رابط في كل سطر — اختياري)
                  </label>
                  <textarea
                    rows={3}
                    dir="ltr"
                    value={galleryUrlsText}
                    onChange={(e) => setGalleryUrlsText(e.target.value)}
                    placeholder="/src/assets/images/thumb_science_solar_1795563099401.jpg"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 text-left"
                  />
                </div>
              )}

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
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('published')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{status === 'published' ? 'تحديث ونشر التعديلات' : 'نشر الإنتاج الآن'}</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{status === 'published' ? 'إلغاء النشر وحفظ كمسودة' : 'حفظ كمسودة'}</span>
                </button>
              </div>

              {editId && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-rose-200 text-rose-700 text-sm font-medium hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف المحتوى</span>
                </button>
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

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">تأكيد حذف الإنتاج</h3>
            <p className="text-sm text-slate-600">
              هل أنت متأكد من حذف «{title}» نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
