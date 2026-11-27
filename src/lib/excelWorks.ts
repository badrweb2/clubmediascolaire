import ExcelJS from 'exceljs';
import {
  CONTENT_TYPE_LABELS,
  GRADE_LEVELS,
  SOURCE_METHOD_LABELS,
  isSafeUrl,
  normalizeImageUrl,
  parseMediaUrlClient,
} from './mediaUtils.ts';
import type {
  Category,
  ContentType,
  ExtraMediaItem,
  PublishStatus,
  SourceMethod,
  WorkItem,
} from '../types.ts';

export interface ParsedBulkWorkRow {
  sort_order: number;
  title: string;
  student_name: string;
  grade_level: string;
  class_section: string;
  content_type: ContentType;
  source_method: SourceMethod;
  original_url: string;
  embed_url: string;
  media_mime: string;
  category_id: number;
  subcategory_id: number | null;
  extra_category_ids: number[];
  thumbnail_url: string;
  gallery_urls: string[];
  extra_media: ExtraMediaItem[];
  publish_date: string;
  status: PublishStatus;
  featured: boolean;
  description: string;
  keywords: string;
}

const EXCEL_COLUMNS = [
  { header: 'الرقم الترتيبي', key: 'sort_order', width: 14 },
  { header: 'عنوان الإنتاج *', key: 'title', width: 34 },
  { header: 'صاحب الإنتاج / التلميذ', key: 'student_name', width: 26 },
  { header: 'المستوى الدراسي', key: 'grade_level', width: 24 },
  { header: 'القسم / النادي', key: 'class_section', width: 18 },
  { header: 'نوع المحتوى *', key: 'content_type', width: 22 },
  { header: 'طريقة الإضافة *', key: 'source_method', width: 22 },
  { header: 'رابط المحتوى الأساسي *', key: 'original_url', width: 42 },
  { header: 'التصنيف الرئيسي *', key: 'category_name', width: 28 },
  { header: 'التصنيف الفرعي', key: 'subcategory_name', width: 32 },
  { header: 'تصنيفات إضافية (مفصولة بفاصلة)', key: 'extra_categories', width: 28 },
  { header: 'رابط الصورة المصغرة (اختياري)', key: 'thumbnail_url', width: 36 },
  { header: 'روابط صور المعرض (مفصولة بـ |)', key: 'gallery_urls', width: 36 },
  { header: 'روابط وسائط إضافية (مفصولة بـ |)', key: 'extra_media', width: 36 },
  { header: 'تاريخ النشر (YYYY-MM-DD)', key: 'publish_date', width: 20 },
  { header: 'الحالة *', key: 'status', width: 14 },
  { header: 'مميز بالرئيسية', key: 'featured', width: 16 },
  { header: 'وصف الإنتاج', key: 'description', width: 40 },
  { header: 'الكلمات المفتاحية', key: 'keywords', width: 26 },
] as const;

function colLetter(colIdx1Based: number): string {
  let n = colIdx1Based;
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

export async function downloadLiveWorksExcel(options: {
  categories: Category[];
  works?: WorkItem[];
  includeExistingWorks?: boolean;
}): Promise<void> {
  const { categories, works = [], includeExistingWorks = false } = options;
  const mainCats = categories.filter((c) => c.parent_id === null);
  const subCats = categories.filter((c) => c.parent_id !== null);
  const catById = new Map(categories.map((c) => [c.id, c]));

  const mainCatNames = mainCats.map((c) => c.name);
  const subCatLabels = subCats.map((sub) => {
    const parent = sub.parent_id ? catById.get(sub.parent_id) : null;
    return parent ? `${parent.name} ⟵ ${sub.name}` : sub.name;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'المنصة التعليمية لمدرسة الحسن الداخل';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('إدخال المشاريع والإنتاجات', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = EXCEL_COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF3B82F6' } },
      right: { style: 'thin', color: { argb: 'FF3B82F6' } },
    };
  });

  // Hidden/Secondary sheet with live lists from the published platform DB
  const listSheet = workbook.addWorksheet('_Lists', {
    state: 'hidden',
    views: [{ rightToLeft: true }],
  });

  const gradeList = [...GRADE_LEVELS];
  const contentTypeList = Object.values(CONTENT_TYPE_LABELS);
  const sourceMethodList = Object.values(SOURCE_METHOD_LABELS);
  const statusList = ['منشور', 'مسودة'];
  const featuredList = ['لا', 'نعم'];

  const listColumns: Array<{ header: string; values: string[] }> = [
    { header: 'GradeLevels', values: gradeList },
    { header: 'ContentTypes', values: contentTypeList },
    { header: 'SourceMethods', values: sourceMethodList },
    { header: 'MainCategories', values: mainCatNames.length ? mainCatNames : ['عام'] },
    { header: 'SubCategories', values: subCatLabels.length ? subCatLabels : ['بدون تصنيف فرعي'] },
    { header: 'Statuses', values: statusList },
    { header: 'Featured', values: featuredList },
  ];

  listColumns.forEach((col, cIdx) => {
    const colNum = cIdx + 1;
    listSheet.getCell(1, colNum).value = col.header;
    col.values.forEach((val, rIdx) => {
      listSheet.getCell(rIdx + 2, colNum).value = val;
    });
  });

  if (includeExistingWorks && works.length > 0) {
    works.forEach((w, idx) => {
      const mainCat = catById.get(w.category_id);
      const subCat = w.subcategory_id ? catById.get(w.subcategory_id) : null;
      const subDisplay = subCat
        ? mainCat
          ? `${mainCat.name} ⟵ ${subCat.name}`
          : subCat.name
        : '';
      const extraCatNames = (w.extra_category_ids || [])
        .map((id) => catById.get(id)?.name)
        .filter(Boolean)
        .join('، ');
      const extraMediaUrls = (w.extra_media || []).map((m) => m.original_url).join(' | ');

      sheet.addRow({
        sort_order: w.sort_order || idx + 1,
        title: w.title,
        student_name: w.student_name,
        grade_level: w.grade_level,
        class_section: w.class_section,
        content_type: CONTENT_TYPE_LABELS[w.content_type] || w.content_type,
        source_method: SOURCE_METHOD_LABELS[w.source_method] || w.source_method,
        original_url: w.original_url,
        category_name: mainCat?.name || w.category_name || '',
        subcategory_name: subDisplay,
        extra_categories: extraCatNames,
        thumbnail_url: w.thumbnail_url,
        gallery_urls: (w.gallery_urls || []).join(' | '),
        extra_media: extraMediaUrls,
        publish_date: w.publish_date,
        status: w.status === 'published' ? 'منشور' : 'مسودة',
        featured: w.featured ? 'نعم' : 'لا',
        description: w.description,
        keywords: w.keywords,
      });
    });
  } else {
    const defaultMain = mainCatNames[0] || '';
    const firstSub = subCats.find((s) => s.parent_id === mainCats[0]?.id) || subCats[0];
    const defaultSub = firstSub
      ? `${catById.get(firstSub.parent_id || 0)?.name || defaultMain} ⟵ ${firstSub.name}`
      : '';
    sheet.addRow({
      sort_order: 1,
      title: 'مثال: مشروع مصباح ذكي بالطاقة الشمسية (احذف أو عدّل هذا السطر)',
      student_name: 'يوسف التازي ومجموعة النادي العلمي',
      grade_level: gradeList[5] || gradeList[0],
      class_section: 'النادي العلمي',
      content_type: CONTENT_TYPE_LABELS.project,
      source_method: SOURCE_METHOD_LABELS.gdrive,
      original_url: 'https://drive.google.com/file/d/1ExampleFileIdHere/view?usp=sharing',
      category_name: defaultMain,
      subcategory_name: defaultSub,
      extra_categories: '',
      thumbnail_url: '',
      gallery_urls: '',
      extra_media: '',
      publish_date: new Date().toISOString().slice(0, 10),
      status: 'منشور',
      featured: 'لا',
      description: 'وصف مختصر يوضح فكرة المشروع وأهدافه التربوية.',
      keywords: 'مشروع، ابتكار، النادي العلمي',
    });
  }

  // Apply Excel native Data Validation dropdown lists to rows 2..300
  const maxRows = Math.max(300, works.length + 120);
  const validationColumns: Array<{ colIndex: number; listColIndex: number; count: number }> = [
    { colIndex: 4, listColIndex: 1, count: gradeList.length },
    { colIndex: 6, listColIndex: 2, count: contentTypeList.length },
    { colIndex: 7, listColIndex: 3, count: sourceMethodList.length },
    { colIndex: 9, listColIndex: 4, count: Math.max(1, mainCatNames.length) },
    { colIndex: 10, listColIndex: 5, count: Math.max(1, subCatLabels.length) },
    { colIndex: 16, listColIndex: 6, count: statusList.length },
    { colIndex: 17, listColIndex: 7, count: featuredList.length },
  ];

  for (let rowIdx = 2; rowIdx <= maxRows; rowIdx++) {
    const row = sheet.getRow(rowIdx);
    row.height = 24;
    for (const vc of validationColumns) {
      const lCol = colLetter(vc.listColIndex);
      const cell = row.getCell(vc.colIndex);
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_Lists!$${lCol}$2:$${lCol}$${vc.count + 1}`],
        showErrorMessage: true,
        errorStyle: 'information',
        errorTitle: 'اختيار من القائمة',
        error: 'يُستحسن اختيار قيمة من القائمة المنسدلة المعتمدة في المنصة.',
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = includeExistingWorks
    ? `مشاريع_ومحتويات_المنصة_${today}.xlsx`
    : `قالب_رفع_المشاريع_المنصة_${today}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function cellToString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'object') {
    if ('text' in val && typeof val.text === 'string') return val.text.trim();
    if ('hyperlink' in val && typeof val.hyperlink === 'string') return val.hyperlink.trim();
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text).join('').trim();
    }
    if ('result' in val && val.result !== undefined) return String(val.result).trim();
  }
  return '';
}

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const cleaned = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === ';') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

const REVERSE_CONTENT_TYPES: Record<string, ContentType> = Object.entries(CONTENT_TYPE_LABELS).reduce(
  (acc, [k, label]) => {
    acc[label.trim()] = k as ContentType;
    acc[k] = k as ContentType;
    return acc;
  },
  {} as Record<string, ContentType>
);

const REVERSE_SOURCE_METHODS: Record<string, SourceMethod> = Object.entries(
  SOURCE_METHOD_LABELS
).reduce(
  (acc, [k, label]) => {
    acc[label.trim()] = k as SourceMethod;
    acc[k] = k as SourceMethod;
    return acc;
  },
  {} as Record<string, SourceMethod>
);

function mapRowsToBulkWorks(
  rawRows: string[][],
  categories: Category[]
): { rows: ParsedBulkWorkRow[]; errors: string[] } {
  const mainCats = categories.filter((c) => c.parent_id === null);
  const subCats = categories.filter((c) => c.parent_id !== null);
  const catByName = new Map<string, Category>();
  categories.forEach((c) => catByName.set(c.name.trim(), c));

  const parsedRows: ParsedBulkWorkRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const cols = rawRows[i];
    if (!cols || cols.every((c) => !c.trim())) continue;

    const rowNum = i + 1;
    const sortOrderRaw = (cols[0] || '').trim();
    const title = (cols[1] || '').trim();
    const studentName = (cols[2] || '').trim();
    const gradeLevel = (cols[3] || '').trim();
    const classSection = (cols[4] || '').trim();
    const contentTypeRaw = (cols[5] || '').trim();
    const sourceMethodRaw = (cols[6] || '').trim();
    const originalUrl = (cols[7] || '').trim();
    const mainCatName = (cols[8] || '').trim();
    const subCatRaw = (cols[9] || '').trim();
    const extraCatRaw = (cols[10] || '').trim();
    const thumbRaw = (cols[11] || '').trim();
    const galleryRaw = (cols[12] || '').trim();
    const extraMediaRaw = (cols[13] || '').trim();
    const publishDateRaw = (cols[14] || '').trim();
    const statusRaw = (cols[15] || '').trim();
    const featuredRaw = (cols[16] || '').trim();
    const description = (cols[17] || '').trim();
    const keywords = (cols[18] || '').trim();

    if (!title) {
      errors.push(`السطر ${rowNum}: عنوان الإنتاج مفقود.`);
      continue;
    }
    if (!originalUrl || !isSafeUrl(originalUrl)) {
      errors.push(`السطر ${rowNum} («${title}»): رابط المحتوى الأساسي غير صالح.`);
      continue;
    }

    const mappedMethod = REVERSE_SOURCE_METHODS[sourceMethodRaw];
    const mappedType = REVERSE_CONTENT_TYPES[contentTypeRaw];
    const parsedUrl = parseMediaUrlClient(originalUrl, mappedMethod, mappedType);
    if (!parsedUrl.valid) {
      errors.push(`السطر ${rowNum} («${title}»): ${parsedUrl.error || 'تعذر قراءة الرابط'}`);
      continue;
    }

    // Resolve Main & Sub categories
    let resolvedMainCat = mainCats.find((c) => c.name.trim() === mainCatName) || null;
    let resolvedSubCat: Category | null = null;

    if (subCatRaw) {
      const parts = subCatRaw.split('⟵').map((s) => s.trim());
      if (parts.length === 2) {
        const pCat = mainCats.find((c) => c.name.trim() === parts[0]) || resolvedMainCat;
        if (pCat) {
          resolvedMainCat = pCat;
          resolvedSubCat =
            subCats.find((s) => s.parent_id === pCat.id && s.name.trim() === parts[1]) || null;
        }
      } else {
        resolvedSubCat =
          subCats.find(
            (s) =>
              s.name.trim() === subCatRaw &&
              (!resolvedMainCat || s.parent_id === resolvedMainCat.id)
          ) || null;
        if (!resolvedMainCat && resolvedSubCat?.parent_id) {
          resolvedMainCat = mainCats.find((c) => c.id === resolvedSubCat?.parent_id) || null;
        }
      }
    }

    if (!resolvedMainCat) {
      errors.push(
        `السطر ${rowNum} («${title}»): التصنيف الرئيسي «${mainCatName || 'فارغ'}» غير مطابق للتصنيفات الحالية.`
      );
      continue;
    }

    const extraCatIds = extraCatRaw
      ? extraCatRaw
          .split(/[،,|]/)
          .map((s) => catByName.get(s.trim())?.id)
          .filter((id): id is number => Boolean(id && id !== resolvedMainCat?.id && id !== resolvedSubCat?.id))
      : [];

    const galleryUrls = galleryRaw
      ? galleryRaw
          .split(/[|،\n]/)
          .map((u) => normalizeImageUrl(u.trim()))
          .filter((u) => isSafeUrl(u))
      : [];

    const extraMedia: ExtraMediaItem[] = [];
    if (extraMediaRaw) {
      for (const rawLink of extraMediaRaw.split(/[|\n]/).map((s) => s.trim()).filter(Boolean)) {
        if (!isSafeUrl(rawLink)) continue;
        const p = parseMediaUrlClient(rawLink);
        if (p.valid) {
          extraMedia.push({
            title: '',
            content_type: p.contentType,
            source_method: p.sourceMethod,
            original_url: rawLink,
            embed_url: p.embedUrl,
            media_mime: p.mediaMime,
          });
        }
      }
    }

    const sortNum = Number(sortOrderRaw);
    const publishDate = /^\d{4}-\d{2}-\d{2}$/.test(publishDateRaw)
      ? publishDateRaw
      : new Date().toISOString().slice(0, 10);

    const status: PublishStatus =
      statusRaw === 'مسودة' || statusRaw.toLowerCase() === 'draft' ? 'draft' : 'published';
    const featured = featuredRaw === 'نعم' || featuredRaw === '1' || featuredRaw.toLowerCase() === 'yes';

    parsedRows.push({
      sort_order: Number.isFinite(sortNum) && sortNum > 0 ? Math.floor(sortNum) : 0,
      title,
      student_name: studentName,
      grade_level: gradeLevel,
      class_section: classSection,
      content_type: mappedType || parsedUrl.contentType,
      source_method: mappedMethod || parsedUrl.sourceMethod,
      original_url: originalUrl,
      embed_url: parsedUrl.embedUrl,
      media_mime: parsedUrl.mediaMime,
      category_id: resolvedMainCat.id,
      subcategory_id: resolvedSubCat ? resolvedSubCat.id : null,
      extra_category_ids: extraCatIds,
      thumbnail_url:
        thumbRaw && isSafeUrl(thumbRaw) ? normalizeImageUrl(thumbRaw) : parsedUrl.thumbnailUrl,
      gallery_urls: galleryUrls,
      extra_media: extraMedia,
      publish_date: publishDate,
      status,
      featured,
      description,
      keywords,
    });
  }

  return { rows: parsedRows, errors };
}

export async function parseWorksSpreadsheetFile(
  file: File,
  categories: Category[]
): Promise<{ rows: ParsedBulkWorkRow[]; errors: string[] }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const text = await file.text();
    const matrix = parseCsvLines(text);
    return mapRowsToBulkWorks(matrix, categories);
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], errors: ['الملف لا يحتوي على أي ورقة عمل صالحة.'] };
  }

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cols: string[] = [];
    for (let c = 1; c <= EXCEL_COLUMNS.length; c++) {
      cols.push(cellToString(row.getCell(c).value));
    }
    matrix.push(cols);
  });

  return mapRowsToBulkWorks(matrix, categories);
}
