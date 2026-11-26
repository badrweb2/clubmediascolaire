export function createSchoolRadioWav(variant: 'ep1' | 'ep2'): Buffer {
  const sampleRate = 22050;
  const durationSec = 5.5;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const notes =
    variant === 'ep1'
      ? [293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 587.33]
      : [261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 329.63, 261.63];

  const noteDuration = durationSec / notes.length;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIndex = Math.min(notes.length - 1, Math.floor(t / noteDuration));
    const localT = t - noteIndex * noteDuration;
    const freq = notes[noteIndex];

    const attack = Math.min(1, localT / 0.04);
    const decay = Math.exp(-localT * 2.8);
    const env = attack * decay * 0.32;

    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic = 0.35 * Math.sin(2 * Math.PI * freq * 2 * t);
    const softThird = 0.15 * Math.sin(2 * Math.PI * freq * 3 * t);

    const sample = Math.max(-1, Math.min(1, env * (fundamental + harmonic + softThird)));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

interface PdfPageSpec {
  title: string;
  subtitle: string;
  lines: string[];
  accentRgb: [number, number, number];
}

function escapePdfAscii(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdfDocument(pages: PdfPageSpec[], landscape = false): Buffer {
  const width = landscape ? 842 : 595;
  const height = landscape ? 595 : 842;

  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: Helvetica-Bold, 4: Helvetica
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageObjNums: number[] = [];
  const baseObjNum = 5;

  pages.forEach((_, idx) => {
    pageObjNums.push(baseObjNum + idx * 2);
  });

  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`
  );
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'
  );
  objects.push(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );

  pages.forEach((page, idx) => {
    const pageNum = baseObjNum + idx * 2;
    const contentNum = pageNum + 1;
    const [r, g, b] = page.accentRgb;

    const cmds: string[] = [];
    // Soft background header bar
    cmds.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    cmds.push(`0 ${height - 96} ${width} 96 re f`);

    // Subtle border frame
    cmds.push('0.85 0.88 0.92 RG 1 w');
    cmds.push(`36 36 ${width - 72} ${height - 156} re S`);

    // Header Title (white)
    cmds.push('1 1 1 rg');
    cmds.push('BT /F1 20 Tf 48 ' + (height - 46) + ` Td (${escapePdfAscii(page.title)}) Tj ET`);
    cmds.push('0.90 0.94 1.00 rg');
    cmds.push('BT /F2 11 Tf 48 ' + (height - 72) + ` Td (${escapePdfAscii(page.subtitle)}) Tj ET`);

    // Body lines
    cmds.push('0.10 0.14 0.22 rg');
    let y = height - 148;
    for (const line of page.lines) {
      cmds.push(`BT /F2 12 Tf 56 ${y} Td (${escapePdfAscii(line)}) Tj ET`);
      y -= 26;
    }

    // Footer page number
    cmds.push('0.45 0.50 0.58 rg');
    cmds.push(
      `BT /F2 10 Tf 56 48 Td (Al-Hassan Ad-Dakhil Educational Platform - Page ${idx + 1} of ${pages.length}) Tj ET`
    );

    const streamStr = cmds.join('\n');
    const streamLen = Buffer.byteLength(streamStr, 'utf8');

    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamStr}\nendstream\nendobj\n`
    );
  });

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'utf8')];
  const offsets: number[] = [0];
  let currentOffset = chunks[0].length;

  for (const obj of objects) {
    offsets.push(currentOffset);
    const buf = Buffer.from(obj, 'utf8');
    chunks.push(buf);
    currentOffset += buf.length;
  }

  const xrefStart = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'utf8'));

  return Buffer.concat(chunks);
}

const pdfCache = new Map<string, Buffer>();
const wavCache = new Map<string, Buffer>();

export function getSampleWav(id: string): Buffer | null {
  const key = id === 'podcast-reading.wav' ? 'ep2' : id === 'radio-ep1.wav' ? 'ep1' : null;
  if (!key) return null;
  if (!wavCache.has(key)) {
    wavCache.set(key, createSchoolRadioWav(key));
  }
  return wavCache.get(key) || null;
}

export function getSamplePdf(id: string): Buffer | null {
  if (pdfCache.has(id)) return pdfCache.get(id) || null;

  let doc: Buffer | null = null;
  if (id === 'school-magazine.pdf') {
    doc = buildPdfDocument([
      {
        title: 'Al-Hassan Ad-Dakhil School Digital Magazine',
        subtitle: 'Issue 04 - Science, Culture & Student Voices (2026)',
        accentRgb: [0.118, 0.251, 0.686],
        lines: [
          'Editorial Welcome:',
          'Welcome to the fourth digital issue produced by the Journalism & Reading Club.',
          'Inside this edition, learners document environmental initiatives, science experiments,',
          'school radio highlights, and creative student poetry and visual art.',
          '',
          'Table of Contents:',
          '01. Solar Smart Irrigation in the School Garden ......................... Page 1',
          '02. Voices from the Morning School Radio .............................. Page 2',
          '03. Geometric Art & Watercolor Workshop Highlights .................... Page 2',
          '04. Robotics Club Autonomous Rover Challenge .......................... Page 3',
        ],
      },
      {
        title: 'Student Club Reports & Field Notes',
        subtitle: 'Environmental Awareness & Reading Circles',
        accentRgb: [0.06, 0.46, 0.43],
        lines: [
          'Green Campus Initiative:',
          'Sixth-grade students designed a water-saving drip system powered by a 12V solar',
          'panel, reducing daily watering waste in our school herb garden by 45 percent.',
          '',
          'Weekly Reading Circle:',
          'More than 60 learners participated in the autumn storytelling and book review',
          'sessions, recording short audio summaries for the school radio archive.',
        ],
      },
      {
        title: 'Upcoming Competitions & Acknowledgements',
        subtitle: 'Cultural & Scientific Innovation Calendar',
        accentRgb: [0.68, 0.35, 0.05],
        lines: [
          'Spring Robotics & Coding Showcase:',
          'Teams across primary and middle levels are preparing sensor-driven prototypes',
          'to present at the annual Al-Hassan Ad-Dakhil Student Innovation Fair.',
          '',
          'Prepared and edited by: Student Editorial Committee & Supervising Teachers.',
        ],
      },
    ]);
  } else if (id === 'solar-project-report.pdf') {
    doc = buildPdfDocument([
      {
        title: 'Solar-Powered Smart Irrigation Prototype',
        subtitle: 'Applied Science & Sustainability Project Documentation',
        accentRgb: [0.08, 0.39, 0.24],
        lines: [
          'Project Team: Salma El-Mansouri, Youssef Benali, Adam Tazi (Grade 6)',
          'Objective:',
          'Build an autonomous, clean-energy irrigation system that measures soil moisture',
          'and waters classroom plants only when needed.',
          '',
          'Components Used:',
          '- 5W Polycrystalline Solar Panel & Rechargeable Battery Pack',
          '- Soil Moisture Analog Sensor + Microcontroller Board',
          '- Miniature 5V Submersible Water Pump & Transparent Silicone Tubing',
          '',
          'Measured Result:',
          'Maintained optimal soil humidity for basil and mint plants for 14 continuous days',
          'using 100% solar energy with zero manual intervention.',
        ],
      },
    ]);
  } else if (id === 'heritage-slides.pdf') {
    doc = buildPdfDocument(
      [
        {
          title: 'Slide 1: Architectural & Cultural Heritage Research',
          subtitle: 'Student Presentation Deck - Grade 8 Social Studies & Art',
          accentRgb: [0.118, 0.251, 0.686],
          lines: [
            'Exploring Traditional Geometric Symmetry & Craftsmanship',
            'Prepared by: Cultural Heritage Research Group',
            '',
            'Presentation Outline:',
            '1. Historical Geometry in Moroccan Zellij & Woodwork',
            '2. Color Pigments & Natural Mineral Sources',
            '3. Modern Student Reinterpretations in Watercolor & Digital Design',
          ],
        },
        {
          title: 'Slide 2: Geometric Patterns & Mathematical Ratios',
          subtitle: 'Connecting Art Class with Euclidean Geometry',
          accentRgb: [0.58, 0.24, 0.08],
          lines: [
            'Key Discovery:',
            'Eight-fold and twelve-fold rosette stars start from a simple compass circle',
            'subdivided by intersecting squares and equilateral triangles.',
            '',
            'Students reconstructed three classic patterns using compass and straightedge',
            'before painting them for the school gallery exhibition.',
          ],
        },
        {
          title: 'Slide 3: Exhibition Takeaways & Student Reflections',
          subtitle: 'Preserving Heritage Through Creative Practice',
          accentRgb: [0.06, 0.46, 0.43],
          lines: [
            'Conclusion:',
            'Hands-on artistic creation deepens appreciation for scientific and mathematical',
            'precision embedded in historical craftsmanship.',
            '',
            'Full artwork scans are featured in the Art & Visual Creativity Gallery.',
          ],
        },
      ],
      true
    );
  }

  if (doc) pdfCache.set(id, doc);
  return doc;
}
