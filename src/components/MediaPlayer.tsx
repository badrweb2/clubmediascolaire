import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
  AlertCircle,
} from 'lucide-react';
import type { ContentType, ExtraMediaItem, SourceMethod } from '../types.ts';
import { CONTENT_TYPE_LABELS, isSafeUrl, normalizeImageUrl } from '../lib/mediaUtils.ts';

interface MediaPlayerProps {
  title: string;
  contentType: ContentType;
  sourceMethod: SourceMethod;
  embedUrl: string;
  originalUrl: string;
  thumbnailUrl?: string;
  galleryUrls?: string[];
  extraMedia?: ExtraMediaItem[];
  compact?: boolean;
  isAdminPreview?: boolean;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AudioRadioPlayer({
  src,
  title,
  thumbnailUrl,
  compact = false,
}: {
  src: string;
  title: string;
  thumbnailUrl?: string;
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const resolvedThumb = thumbnailUrl ? normalizeImageUrl(thumbnailUrl) : '';

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setError(false);
  }, [src]);

  useEffect(() => {
    setThumbError(false);
  }, [resolvedThumb]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        await el.play();
        setPlaying(true);
      } catch {
        setError(true);
      }
    }
  };

  const skip = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  };

  const cycleRate = () => {
    const el = audioRef.current;
    const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1;
    setRate(next);
    if (el) el.playbackRate = next;
  };

  const toggleMute = () => {
    const el = audioRef.current;
    const next = !muted;
    setMuted(next);
    if (el) el.muted = next;
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl ${
        compact ? 'p-4' : 'p-6 md:p-8'
      }`}
    >
      <audio
        ref={audioRef}
        src={isSafeUrl(src) ? src : ''}
        preload="metadata"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {resolvedThumb && isSafeUrl(resolvedThumb) && !thumbError ? (
          <div
            className={`${
              compact ? 'w-28 h-20' : 'w-full sm:w-44 h-28'
            } rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden p-1 shrink-0`}
          >
            <img
              key={resolvedThumb}
              src={resolvedThumb}
              alt={title}
              referrerPolicy="no-referrer"
              onError={() => setThumbError(true)}
              className="w-full h-full object-contain rounded"
            />
          </div>
        ) : (
          <div
            className={`${
              compact ? 'w-24 h-20' : 'w-28 h-24'
            } rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[#1E40AF] shrink-0`}
          >
            <Volume2 className="w-7 h-7" />
          </div>
        )}

        <div className="flex-1 min-w-0 w-full">
          <div className="text-xs text-slate-500 mb-1">مشغل الإذاعة والتسجيلات الصوتية</div>
          <h4 className="text-base md:text-lg font-semibold text-slate-900 truncate mb-3">
            {title}
          </h4>

          {error ? (
            <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>تعذر تحميل الملف الصوتي. يرجى التأكد من صلاحية رابط الصوت.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  aria-label="شريط التقدم الصوتي"
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (audioRef.current) audioRef.current.currentTime = val;
                    setCurrentTime(val);
                  }}
                  className="w-full accent-[#1E40AF] cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{playing ? 'إيقاف مؤقت' : 'تشغيل'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => skip(-10)}
                    title="تقديم 10 ثوانٍ"
                    aria-label="تقديم 10 ثوانٍ"
                    className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => skip(10)}
                    title="تأخير 10 ثوانٍ"
                    aria-label="تأخير 10 ثوانٍ"
                    className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={cycleRate}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono tabular-nums text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {rate}x
                  </button>

                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                    className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>

                <div className="text-xs font-mono tabular-nums text-slate-500" dir="ltr">
                  {formatSeconds(currentTime)} / {formatSeconds(duration)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InteractiveImageGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const safeImages = images.map(normalizeImageUrl).filter(isSafeUrl);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const currentSrc = safeImages[activeIndex] || '';

  useEffect(() => {
    setZoom(1);
  }, [activeIndex]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight' && safeImages.length > 1) {
        setActiveIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
      }
      if (e.key === 'ArrowLeft' && safeImages.length > 1) {
        setActiveIndex((prev) => (prev + 1) % safeImages.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, safeImages.length]);

  if (!currentSrc) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-10 text-center text-slate-500">
        لا توجد صورة متاحة للعرض حالياً.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-600 tabular-nums">
            {safeImages.length > 1
              ? `الصورة ${activeIndex + 1} من ${safeImages.length}`
              : 'معاينة العمل الفني'}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
              aria-label="تصغير"
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono tabular-nums text-slate-600 px-2">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
              aria-label="تكبير"
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              إعادة الضبط
            </button>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label="ملء الشاشة"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900 text-white text-xs hover:bg-slate-800 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>تكبير العرض</span>
            </button>
          </div>
        </div>

        <div className="relative bg-slate-100 flex items-center justify-center overflow-auto min-h-[340px] max-h-[580px] p-4">
          <img
            src={currentSrc}
            alt={title}
            referrerPolicy="no-referrer"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="max-w-full max-h-[520px] object-contain rounded-lg transition-transform duration-200"
          />

          {safeImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length)
                }
                aria-label="الصورة السابقة"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 border border-slate-200 text-slate-800 shadow-sm hover:bg-white cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev + 1) % safeImages.length)}
                aria-label="الصورة التالية"
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 border border-slate-200 text-slate-800 shadow-sm hover:bg-white cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {safeImages.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {safeImages.map((imgUrl, idx) => (
            <button
              key={`${imgUrl}-${idx}`}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`shrink-0 rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                idx === activeIndex ? 'border-[#1E40AF]' : 'border-slate-200 opacity-75 hover:opacity-100'
              }`}
            >
              <img
                src={imgUrl}
                alt={`${title} - ${idx + 1}`}
                referrerPolicy="no-referrer"
                className="w-24 h-16 object-contain bg-slate-50 p-0.5"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/92 flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-6xl flex items-center justify-between text-white mb-4">
            <span className="text-sm font-medium truncate">{title}</span>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>إغلاق</span>
            </button>
          </div>
          <div className="relative flex-1 w-full max-w-6xl flex items-center justify-center">
            <img
              src={currentSrc}
              alt={title}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[82vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CoordinatedGallerySection({
  images,
  title,
  compact = false,
}: {
  images: string[];
  title: string;
  compact?: boolean;
}) {
  const safeImages = images.map(normalizeImageUrl).filter(isSafeUrl);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight' && safeImages.length > 1) {
        setLightboxIdx((prev) =>
          prev === null ? 0 : (prev - 1 + safeImages.length) % safeImages.length
        );
      }
      if (e.key === 'ArrowLeft' && safeImages.length > 1) {
        setLightboxIdx((prev) => (prev === null ? 0 : (prev + 1) % safeImages.length));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, safeImages.length]);

  if (safeImages.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="text-sm font-semibold text-slate-900">
          الصور المرفقة والمنسقة بالموضوع ({safeImages.length})
        </div>
        <span className="text-xs text-slate-500">اضغط على أي صورة للتكبير</span>
      </div>

      <div
        className={`grid gap-4 ${
          compact
            ? 'grid-cols-1 sm:grid-cols-2'
            : safeImages.length === 1
              ? 'grid-cols-1 max-w-2xl mx-auto'
              : safeImages.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {safeImages.map((imgUrl, idx) => (
          <button
            key={`${imgUrl}-${idx}`}
            type="button"
            onClick={() => setLightboxIdx(idx)}
            className="group relative bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-2 flex flex-col items-center justify-center hover:border-[#1E40AF]/60 hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <div className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-lg bg-white">
              <img
                src={imgUrl}
                alt={`${title} - صورة ${idx + 1}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="w-full flex items-center justify-between pt-2 px-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700">صورة {idx + 1}</span>
              <span className="inline-flex items-center gap-1 text-[#1E40AF] opacity-80 group-hover:opacity-100">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>تكبير</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      {lightboxIdx !== null && safeImages[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/92 flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-6xl flex items-center justify-between text-white mb-4">
            <span className="text-sm font-medium truncate">
              {title} — صورة {lightboxIdx + 1} من {safeImages.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIdx(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>إغلاق</span>
            </button>
          </div>
          <div className="relative flex-1 w-full max-w-6xl flex items-center justify-center">
            <img
              src={safeImages[lightboxIdx]}
              alt={`${title} - ${lightboxIdx + 1}`}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[82vh] object-contain rounded-lg"
            />
            {safeImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIdx((prev) =>
                      prev === null ? 0 : (prev - 1 + safeImages.length) % safeImages.length
                    )
                  }
                  aria-label="الصورة السابقة"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 text-slate-900 shadow hover:bg-white cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIdx((prev) => (prev === null ? 0 : (prev + 1) % safeImages.length))
                  }
                  aria-label="الصورة التالية"
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 text-slate-900 shadow hover:bg-white cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaPlayer({
  title,
  contentType,
  sourceMethod,
  embedUrl,
  originalUrl,
  thumbnailUrl,
  galleryUrls = [],
  extraMedia = [],
  compact = false,
  isAdminPreview = false,
}: MediaPlayerProps) {
  const [fullscreenDoc, setFullscreenDoc] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const safeEmbed = isSafeUrl(embedUrl) ? embedUrl : '';
  const hasGalleryExtras =
    contentType !== 'image' &&
    contentType !== 'project' &&
    galleryUrls.map(normalizeImageUrl).some(isSafeUrl);
  const validExtraMedia = extraMedia.filter(
    (item) => isSafeUrl(item.embed_url) || isSafeUrl(item.original_url)
  );

  const renderPrimaryPlayer = () => {
    if (!safeEmbed && contentType !== 'image' && contentType !== 'project') {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-800">
            {isAdminPreview
              ? 'الرابط المدخل غير مكتمل أو غير صالح للتضمين.'
              : 'هذا المحتوى غير متاح للعرض حالياً.'}
          </p>
        </div>
      );
    }

  // 1. Google Drive / Docs / Slides official preview embed
  if (sourceMethod === 'gdrive' && safeEmbed) {
    const isAudioOrCompact = contentType === 'audio';
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <span className="text-xs text-slate-600">عارض Google Drive المدمج</span>
          <button
            type="button"
            onClick={() => setFullscreenDoc((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-[#1E40AF] cursor-pointer"
          >
            {fullscreenDoc ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{fullscreenDoc ? 'تصغير الإطار' : 'توسيع العرض'}</span>
          </button>
        </div>
        <div
          className={`w-full bg-slate-900/5 ${
            fullscreenDoc
              ? 'h-[80vh]'
              : isAudioOrCompact
                ? 'h-[180px]'
                : contentType === 'pdf' || contentType === 'presentation'
                  ? 'h-[580px]'
                  : 'aspect-video'
          }`}
        >
          <iframe
            src={safeEmbed}
            title={title}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // 2. YouTube Embedded Player
  if (sourceMethod === 'youtube' && safeEmbed) {
    return (
      <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-200 aspect-video relative">
        <iframe
          src={safeEmbed}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  // 3. Direct Video (MP4 / WebM)
  if (contentType === 'video' && safeEmbed) {
    return (
      <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-200">
        {videoError ? (
          <div className="p-10 text-center text-white space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm">تعذر تشغيل ملف الفيديو المباشر في المتصفح.</p>
            {isAdminPreview && (
              <p className="text-xs text-slate-400">
                تأكد من أن الرابط مباشر بصيغة MP4 أو WebM ويدعم التشغيل العام بدون قيود CORS.
              </p>
            )}
          </div>
        ) : (
          <video
            src={safeEmbed}
            poster={
              thumbnailUrl && isSafeUrl(normalizeImageUrl(thumbnailUrl))
                ? normalizeImageUrl(thumbnailUrl)
                : undefined
            }
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            className="w-full aspect-video max-h-[600px] bg-black"
          />
        )}
      </div>
    );
  }

  // 4. Direct Audio / School Radio
  if (contentType === 'audio' && safeEmbed) {
    return <AudioRadioPlayer src={safeEmbed} title={title} thumbnailUrl={thumbnailUrl} compact={compact} />;
  }

  // 5. Image / Art Gallery
  if (contentType === 'image') {
    const imgs = Array.from(
      new Set(
        [safeEmbed || thumbnailUrl, ...galleryUrls]
          .map((u) => (u ? normalizeImageUrl(u) : ''))
          .filter((u) => isSafeUrl(u))
      )
    );
    return <InteractiveImageGallery images={imgs} title={title} />;
  }

  // 6. PDF / Digital Magazine / Presentation Slides
  if (contentType === 'pdf' || contentType === 'presentation') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileText className="w-4 h-4 text-[#1E40AF]" />
            <span>
              {contentType === 'presentation'
                ? 'عارض العروض التقديمية والبحوث'
                : 'قارئ ملفات PDF المدمج'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFullscreenDoc((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-[#1E40AF] cursor-pointer"
          >
            {fullscreenDoc ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{fullscreenDoc ? 'الوضع العادي' : 'توسيع القارئ'}</span>
          </button>
        </div>
        <div className={`w-full bg-slate-100 ${fullscreenDoc ? 'h-[82vh]' : 'h-[620px]'}`}>
          <iframe
            src={safeEmbed}
            title={title}
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // 7. Comprehensive School Project Showcase (Images + Embedded Document/Media)
  const projectImages = Array.from(
    new Set([thumbnailUrl, ...galleryUrls].filter((u): u is string => Boolean(u && isSafeUrl(u))))
  );

  return (
    <div className="space-y-6">
      {projectImages.length > 0 && <InteractiveImageGallery images={projectImages} title={title} />}

      {safeEmbed && safeEmbed !== thumbnailUrl && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <FileText className="w-4 h-4 text-[#1E40AF]" />
              <span>ملف توثيق المشروع والبحث المرفق</span>
            </div>
            <button
              type="button"
              onClick={() => setFullscreenDoc((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-[#1E40AF] cursor-pointer"
            >
              {fullscreenDoc ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{fullscreenDoc ? 'تصغير' : 'توسيع'}</span>
            </button>
          </div>
          <div className={`w-full bg-slate-100 ${fullscreenDoc ? 'h-[80vh]' : 'h-[540px]'}`}>
            <iframe
              src={safeEmbed}
              title={`${title} - مرفق المشروع`}
              className="w-full h-full border-0"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {!safeEmbed && !projectImages.length && isAdminPreview && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
          أضف صورة غلاف أو رابط ملف للمشروع ({originalUrl || 'بدون رابط'}) لمعاينته هنا.
        </div>
      )}
    </div>
  );
  };

  return (
    <div className="space-y-6">
      {renderPrimaryPlayer()}
      {hasGalleryExtras && (
        <CoordinatedGallerySection images={galleryUrls} title={title} compact={compact} />
      )}
      {validExtraMedia.length > 0 && (
        <div className="space-y-5">
          {validExtraMedia.map((media, idx) => {
            const mediaTitle =
              media.title.trim() || `${CONTENT_TYPE_LABELS[media.content_type]} إضافي (${idx + 2})`;
            return (
              <div
                key={`${media.original_url}-${idx}`}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-[#1E40AF]/10 text-[#1E40AF] inline-flex items-center justify-center text-xs font-mono font-bold">
                      {idx + 2}
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                      {mediaTitle}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    {CONTENT_TYPE_LABELS[media.content_type]}
                  </span>
                </div>
                <MediaPlayer
                  title={mediaTitle}
                  contentType={media.content_type}
                  sourceMethod={media.source_method}
                  embedUrl={media.embed_url || media.original_url}
                  originalUrl={media.original_url}
                  thumbnailUrl={thumbnailUrl}
                  compact={compact}
                  isAdminPreview={isAdminPreview}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
