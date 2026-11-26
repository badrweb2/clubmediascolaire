import React, { useEffect, useState } from 'react';
import { BookOpen, Eye, FileText, FolderKanban, Headphones, Image as ImageIcon, Play } from 'lucide-react';
import type { ContentType, WorkItem } from '../types.ts';
import {
  CONTENT_TYPE_LABELS,
  formatArabicDate,
  isSafeUrl,
  normalizeImageUrl,
} from '../lib/mediaUtils.ts';
import { isSettingEnabled } from '../lib/settingsDefaults.ts';
import { useApp } from '../context/AppContext.tsx';

function getTypeIcon(type: ContentType) {
  switch (type) {
    case 'video':
      return <Play className="w-4 h-4" />;
    case 'audio':
      return <Headphones className="w-4 h-4" />;
    case 'image':
      return <ImageIcon className="w-4 h-4" />;
    case 'pdf':
      return <FileText className="w-4 h-4" />;
    case 'presentation':
      return <BookOpen className="w-4 h-4" />;
    case 'project':
      return <FolderKanban className="w-4 h-4" />;
  }
}

export function WorkCard({ item }: { item: WorkItem }) {
  const { navigate, settings } = useApp();
  const [imgFailed, setImgFailed] = useState(false);

  const resolvedThumb = normalizeImageUrl(item.thumbnail_url);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedThumb]);

  const hasThumb = Boolean(resolvedThumb && isSafeUrl(resolvedThumb) && !imgFailed);
  const showViews = isSettingEnabled(settings.show_view_counts);

  return (
    <article
      onClick={() => navigate(`/work/${item.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/work/${item.id}`);
        }
      }}
      tabIndex={0}
      role="button"
      className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-[#1E40AF]/40 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
    >
      <div className="relative aspect-[16/10] bg-slate-50 overflow-hidden flex items-center justify-center p-1.5 border-b border-slate-100">
        {hasThumb ? (
          <img
            key={resolvedThumb}
            src={resolvedThumb}
            alt={item.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-contain rounded transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-4 text-slate-500">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#1E40AF] mb-2">
              {getTypeIcon(item.content_type)}
            </div>
            <span className="text-xs text-slate-600 text-center line-clamp-1">
              {CONTENT_TYPE_LABELS[item.content_type]}
            </span>
          </div>
        )}

        {(item.content_type === 'video' || item.content_type === 'audio') && (
          <div className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-slate-950/75 text-white flex items-center justify-center backdrop-blur-xs">
            {item.content_type === 'video' ? (
              <Play className="w-4 h-4 fill-current" />
            ) : (
              <Headphones className="w-4 h-4" />
            )}
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-2">
            <span className="font-medium text-[#1E40AF]">
              {item.category_name || CONTENT_TYPE_LABELS[item.content_type]}
            </span>
            <span aria-hidden="true">·</span>
            <span>{CONTENT_TYPE_LABELS[item.content_type]}</span>
            {item.grade_level && (
              <>
                <span aria-hidden="true">·</span>
                <span>{item.grade_level}</span>
              </>
            )}
          </div>

          <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-[#1E40AF] transition-colors">
            {item.title}
          </h3>

          {item.description && (
            <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="truncate">
            {item.student_name ? item.student_name : 'إنتاج مدرسي'}
          </span>
          <div className="flex items-center gap-3 shrink-0 tabular-nums">
            {showViews && (
              <span className="inline-flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {item.views_count}
              </span>
            )}
            <span>{formatArabicDate(item.publish_date)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
