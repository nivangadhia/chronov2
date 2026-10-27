// --- BCA Chrono: Faculty Absences Feed ---
// Live Feed: Google Sheets CSV. The sheet can expose a full-day section in
// columns A-B and a partial-day section in columns D-F, so every column of
// every row is inspected. RFC 4180 quoting is handled, including embedded
// commas, quotes, and newlines.

const ABSENCES_URL = 'https://docs.google.com/spreadsheets/d/1pOTWkMNA6kTQjRnHxbJZtsFTKFHnhNAgrTJ2ed-avFY/gviz/tq?tqx=out:csv';

const ABSENCE_PERIOD_ORDER = ['1', 'HR', '2', '3', '4', '5', '6', '7', '8', '9'];
const ABSENCE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ABSENCE_DAY_MAP = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', R: 'Thursday', H: 'Thursday', F: 'Friday' };
const ABSENCE_DAY_ORDER = ['M', 'T', 'W', 'R', 'F'];

const ABSENCE_NOISE = new Set([
  'teacher', 'teachers', 'name', 'faculty', 'staff', 'absence', 'absences',
  'full', 'partial', 'day', 'days', 'period', 'periods', 'pd', 'pds', 'per',
  'room', 'note', 'notes', 'reason', 'date', 'available', 'unavailable',
  'out', 'igs', 'homeroom', 'class', 'classes', 'all', 'am', 'pm',
  'cafe', 'cafeteria', 'gym', 'auditorium', 'library', 'office', 'main'
]);

// RFC 4180 CSV parser. Handles quoted fields, escaped quotes, embedded commas
// and newlines, CRLF/LF endings, and a UTF-8 BOM.
function parseRFC4180CSV(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && source[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      if (i < len && source[i] === '\n') i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Teacher surnames only. Handles "Smith ( Mr)", "Dr. Smith", "Smith, John".
function normalizeTeacherName(name) {
  if (!name) return '';
  let t = String(name).replace(/\u00A0/g, ' ').trim();
  t = t.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  t = t.replace(/^email\s+/i, '').trim();
  t = t.replace(/-\s*rm:.*$/i, '').trim();
  t = t.replace(/\b(dr|mr|ms|mrs|mx)\.?\b/gi, ' ');
  t = t.replace(/[^A-Za-z'\- ,.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.includes(',')) t = t.split(',')[0].trim();
  const parts = t.split(/\s+/).filter(part => /[A-Za-z]/.test(part));
  if (!parts.length) return '';
  let last = parts[parts.length - 1].replace(/\.$/, '');
  if (last.length === 1 && parts.length > 1) last = parts[parts.length - 2].replace(/\.$/, '');
  return last.replace(/[^A-Za-z'\-]/g, '');
}

// Parse a day expression such as MWF, T-R, Mon/Wed, or "M 1-4".
// Returns null when the cell is a name, a period range, or "All Day".
function parseAbsenceDays(cell) {
  if (!cell) return null;
  let t = String(cell).toUpperCase().replace(/\u00A0/g, ' ').trim();
  if (!t) return null;
  if (/\d{1,2}\s*[\/.]\s*\d{1,2}/.test(t)) return null;

  t = t.replace(/\b(PERIODS?|PDS?|PD|PER|CLASSES?|IGS|HOMEROOM|ALL|FULL|PARTIAL|DAYS?|ABSENT|ABSENCE|UNAVAILABLE|OUT|AND|TO|THRU|THROUGH|AM|PM)\b/g, ' ');
  t = t
    .replace(/\bMON(?:DAY)?\b/g, 'M')
    .replace(/\bTUES(?:DAY)?\b|\bTUE\b/g, 'T')
    .replace(/\bWEDS(?:DAY)?\b|\bWED\b/g, 'W')
    .replace(/\bTHURS(?:DAY)?\b|\bTHUR\b|\bTHU\b|\bTH\b/g, 'R')
    .replace(/\bFRI(?:DAY)?\b/g, 'F')
    .replace(/\bTTH\b/g, 'T,R');

  t = t
    .replace(/\b[1-9]\s*[-–]\s*[1-9]\b/g, ' ')
    .replace(/\b[1-9]\b/g, ' ')
    .replace(/[^A-Z\-, ]/g, ' ');

  const segments = t.split(/[,\s]+/).filter(Boolean);
  if (!segments.length) return null;

  const found = new Set();
  for (const segment of segments) {
    if (!/^[MTWRHF]+(?:-[MTWRHF]+)?$/.test(segment)) return null;
    if (segment.includes('-')) {
      const pair = segment.split('-');
      if (pair.length !== 2 || pair[0].length !== 1 || pair[1].length !== 1) return null;
      const startKey = pair[0] === 'H' ? 'R' : pair[0];
      const endKey = pair[1] === 'H' ? 'R' : pair[1];
      const startIndex = ABSENCE_DAY_ORDER.indexOf(startKey);
      const endIndex = ABSENCE_DAY_ORDER.indexOf(endKey);
      if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return null;
      for (let i = startIndex; i <= endIndex; i += 1) {
        found.add(ABSENCE_DAY_MAP[ABSENCE_DAY_ORDER[i]]);
      }
    } else {
      for (const ch of segment) {
        if (!ABSENCE_DAY_MAP[ch]) return null;
        found.add(ABSENCE_DAY_MAP[ch]);
      }
    }
  }
  return found.size ? ABSENCE_DAYS.filter(day => found.has(day)) : null;
}

function formatPeriodRanges(periods) {
  const numbers = periods
    .filter(p => p !== 'HR')
    .map(Number)
    .filter(n => n >= 1 && n <= 9)
    .sort((a, b) => a - b);
  const unique = Array.from(new Set(numbers));
  const ranges = [];
  let start = null;
  let previous = null;
  unique.forEach(n => {
    if (start === null) {
      start = n;
      previous = n;
      return;
    }
    if (n === previous + 1) {
      previous = n;
      return;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = n;
    previous = n;
  });
  if (start !== null) ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges.join(', ');
}

function formatPeriodLabel(periods, extras) {
  const pieces = [];
  const numeric = formatPeriodRanges(periods || []);
  if (numeric) pieces.push(`Periods ${numeric}`);
  if (periods && periods.includes('HR')) pieces.push('Homeroom');
  if (extras && extras.includes('IGS')) pieces.push('IGS');
  return pieces.length ? pieces.join(' and ') : 'Periods not listed';
}

// Extract period IDs and extras (IGS) from a cell. Supports "1-4 & IGS",
// "5-9", "Periods 2-3", "Period 5", "1, 3, 5", and "HR".
function extractPeriods(cell) {
  if (!cell) return null;
  const text = String(cell).trim();
  if (!text) return null;
  if (/\d{1,2}\s*[\/.]\s*\d{1,2}/.test(text)) return null;

  const lower = text.toLowerCase();
  const hasKeyword = /\b(periods?|pds?|pd|per)\b/.test(lower) || /\bhr\b/.test(lower) || /\bhomeroom\b/.test(lower) || /\bigs\b/.test(lower);
  const hasRange = /(?<!\d)([1-9])\s*[-–]\s*([1-9])(?!\d)/.test(text);
  const pure = /^[\s\d,&+\-–—]+$/.test(text) && /\d/.test(text);
  if (!hasKeyword && !hasRange && !pure) return null;

  const periods = new Set();
  const extras = new Set();
  if (/\bhr\b|\bhomeroom\b/i.test(text)) periods.add('HR');
  if (/\bigs\b/i.test(text)) extras.add('IGS');

  const rangeRe = /(?<!\d)([1-9])\s*[-–]\s*([1-9])(?!\d)/g;
  let match;
  while ((match = rangeRe.exec(text)) !== null) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    for (let p = low; p <= high; p += 1) periods.add(String(p));
  }

  if (hasKeyword || pure || /[1-9]\s*,/.test(text)) {
    const singleRe = /(?<![\d\/.-])([1-9])(?![\d\/.-])/g;
    while ((match = singleRe.exec(text)) !== null) {
      periods.add(match[1]);
    }
  }

  if (!periods.size && !extras.size) return null;
  const sortedPeriods = Array.from(periods).sort((a, b) => ABSENCE_PERIOD_ORDER.indexOf(a) - ABSENCE_PERIOD_ORDER.indexOf(b));
  const sortedExtras = Array.from(extras);
  return {
    periods: sortedPeriods,
    extras: sortedExtras,
    label: formatPeriodLabel(sortedPeriods, sortedExtras)
  };
}

function isFullDayMarker(cell) {
  return /\b(?:all|full)\s*days?\b|\ball\s*days\b|\babsent\s*all\s*day\b|\bout\s*all\s*day\b/i.test(String(cell || ''));
}

function isHeaderCell(cell) {
  const value = String(cell || '').trim().toLowerCase();
  return /^(teacher|teachers|name|faculty|staff|absence|absences|all day|full day|partial day|days?|periods?|pd|pds|room|notes?|reason|date)$/.test(value);
}

function isHeaderRow(row) {
  const joined = row.join(' ').toLowerCase();
  return /\bteacher\b|\bfaculty\b|\bname\b/.test(joined) && /\b(day|period|absence|room|note|reason)\b/.test(joined);
}

function isNameLike(cell) {
  if (!cell) return false;
  const raw = String(cell).trim();
  if (raw.length < 2) return false;
  if (/@|https?:|\d/.test(raw)) return false;
  if (isFullDayMarker(raw) || isHeaderCell(raw)) return false;
  if (parseAbsenceDays(raw)) return false;
  if (extractPeriods(raw)) return false;

  let text = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(dr|mr|ms|mrs|mx)\.?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return false;
  if (!/^[A-Za-z][A-Za-z.'\- ,]*$/.test(text)) return false;

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[.'\-,]/g, ''))
    .filter(Boolean);
  if (!words.length) return false;
  if (words.some(word => ABSENCE_NOISE.has(word))) return false;
  return text.replace(/[^A-Za-z]/g, '').length >= 2;
}

function findTeacherCell(sectionCells, markerIndex) {
  const before = sectionCells.filter(cell => cell.index < markerIndex && isNameLike(cell.text));
  if (before.length) return before[before.length - 1];
  const after = sectionCells.filter(cell => cell.index > markerIndex && isNameLike(cell.text));
  if (after.length) return after[0];
  return sectionCells.find(cell => cell.index !== markerIndex && isNameLike(cell.text)) || null;
}

function findDays(cells) {
  const found = new Set();
  cells.forEach(cell => {
    const days = parseAbsenceDays(cell.text);
    if (days) days.forEach(day => found.add(day));
  });
  return found.size ? ABSENCE_DAYS.filter(day => found.has(day)) : null;
}

function findPeriods(cells) {
  const periods = new Set();
  const extras = new Set();
  let found = false;
  cells.forEach(cell => {
    const result = extractPeriods(cell.text);
    if (!result) return;
    found = true;
    result.periods.forEach(period => periods.add(period));
    result.extras.forEach(extra => extras.add(extra));
  });
  if (!found) return null;
  const sortedPeriods = Array.from(periods).sort((a, b) => ABSENCE_PERIOD_ORDER.indexOf(a) - ABSENCE_PERIOD_ORDER.indexOf(b));
  const sortedExtras = Array.from(extras);
  return {
    periods: sortedPeriods,
    extras: sortedExtras,
    label: formatPeriodLabel(sortedPeriods, sortedExtras)
  };
}

// Extract absences from all columns of every row. The sheet can carry a
// full-day block in A-B and a partial-day block in D-F; both are preserved.
function extractAbsences(rows) {
  const absences = [];
  const seen = new Set();

  function addAbsence({ teacher, days, periods, extras, type, raw }) {
    const surname = normalizeTeacherName(teacher);
    if (!surname) return;
    const dayList = (days && days.length ? days : ABSENCE_DAYS).slice();
    const periodList = periods && periods.length ? periods.slice() : null;
    const extraList = extras ? extras.slice() : [];
    const key = [
      surname.toLowerCase(),
      dayList.join(','),
      periodList ? periodList.join(',') : 'all',
      extraList.join(','),
      type
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    absences.push({
      id: key,
      teacher: surname,
      teacherRaw: String(teacher || '').trim(),
      days: dayList,
      periods: periodList,
      extras: extraList,
      type,
      label: type === 'full' ? 'All day' : formatPeriodLabel(periodList || [], extraList),
      raw: String(raw || '').trim()
    });
  }

  for (const row of rows) {
    if (!row || !row.length) continue;
    const cells = row.map(cell => String(cell == null ? '' : cell).trim());
    if (!cells.some(Boolean)) continue;
    if (isHeaderRow(cells)) continue;

    const sections = [];
    if (cells.length <= 3) {
      sections.push([0, 1, 2].filter(index => index < cells.length));
    } else {
      for (let start = 0; start < cells.length; start += 3) {
        sections.push([start, start + 1, start + 2].filter(index => index < cells.length));
      }
    }

    sections.forEach(section => {
      const sectionCells = section
        .map(index => ({ index, text: cells[index] }))
        .filter(cell => cell.text);
      if (!sectionCells.length) return;

      const marker = sectionCells.find(cell => isFullDayMarker(cell.text));
      if (marker) {
        const teacherCell = findTeacherCell(sectionCells, marker.index);
        if (!teacherCell) return;
        const otherCells = sectionCells.filter(cell => cell.index !== teacherCell.index && cell.index !== marker.index);
        addAbsence({
          teacher: teacherCell.text,
          days: findDays(otherCells) || ABSENCE_DAYS,
          periods: null,
          extras: [],
          type: 'full',
          raw: sectionCells.map(cell => cell.text).join(' | ')
        });
        return;
      }

      const teacherCell = sectionCells.find(cell => isNameLike(cell.text));
      if (!teacherCell) return;
      const otherCells = sectionCells.filter(cell => cell.index !== teacherCell.index);
      const days = findDays(otherCells);
      const periodInfo = findPeriods(otherCells);
      if (!days && !periodInfo) return;

      addAbsence({
        teacher: teacherCell.text,
        days: days || ABSENCE_DAYS,
        periods: periodInfo ? periodInfo.periods : null,
        extras: periodInfo ? periodInfo.extras : [],
        type: periodInfo ? 'partial' : 'full',
        raw: sectionCells.map(cell => cell.text).join(' | ')
      });
    });
  }

  return absences;
}

function absencesForToday(absences, today) {
  return (absences || []).filter(absence => absence.days && absence.days.includes(today));
}

// True only when the teacher on the class is the teacher who is out, the day
// matches, and the absence covers this specific period. A full-day absence
// covers every period the student has with that teacher.
function absenceAffectsClass(absence, cls, period, day) {
  if (!absence || !cls) return false;
  if (day && (!absence.days || !absence.days.includes(day))) return false;
  const absenceTeacher = normalizeTeacherName(absence.teacher).toLowerCase();
  const classTeacher = normalizeTeacherName(cls.teacher).toLowerCase();
  if (!absenceTeacher || !classTeacher || absenceTeacher !== classTeacher) return false;
  if (absence.type === 'full' || !absence.periods || !absence.periods.length) return true;
  if (absence.periods.includes(period)) return true;
  if (absence.extras && absence.extras.includes('IGS') && /homeroom|igs/i.test(cls.title)) return true;
  return false;
}

// Return only the absences that touch the student's actual schedule on a day,
// annotated with the periods in which they meet that teacher.
function absencesAffectingSchedule(absences, schedule, day) {
  const results = [];
  (absencesForToday(absences, day)).forEach(absence => {
    const affectedPeriods = [];
    ABSENCE_PERIOD_ORDER.forEach(period => {
      const classes = (schedule[period] && schedule[period][day]) || [];
      const matching = classes.filter(cls => absenceAffectsClass(absence, cls, period, day));
      if (matching.length) affectedPeriods.push(period);
    });
    if (affectedPeriods.length) {
      results.push({ ...absence, affectedPeriods });
    }
  });
  return results;
}

async function fetchAbsences() {
  const res = await fetch(ABSENCES_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Absences request failed with status ${res.status}`);
  const text = await res.text();
  if (/^\s*<!doctype html|^\s*<html/i.test(text)) {
    throw new Error('The absences feed returned a web page instead of CSV');
  }
  const rows = parseRFC4180CSV(text);
  return {
    absences: extractAbsences(rows),
    fetchedAt: Date.now(),
    rawText: text,
    rowCount: rows.length
  };
}

if (typeof window !== 'undefined') {
  window.parseRFC4180CSV = parseRFC4180CSV;
  window.normalizeTeacherName = normalizeTeacherName;
  window.parseAbsenceDays = parseAbsenceDays;
  window.extractPeriods = extractPeriods;
  window.extractAbsences = extractAbsences;
  window.absencesForToday = absencesForToday;
  window.absenceAffectsClass = absenceAffectsClass;
  window.absencesAffectingSchedule = absencesAffectingSchedule;
  window.fetchAbsences = fetchAbsences;
  window.ABSENCE_PERIOD_ORDER = ABSENCE_PERIOD_ORDER;
  window.ABSENCE_DAYS = ABSENCE_DAYS;
  window.ABSENCES_URL = ABSENCES_URL;
}
