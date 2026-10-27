// --- BCA Chrono: PowerSchool Schedule Importer (Exact Extraction Engine) ---
// The extraction logic below is the supplied PowerSchool engine, preserved
// verbatim. It turns raw PowerSchool schedule text (Ctrl+A paste) into the
// canonical campus data model:
//   { period: { weekday: [{ title, room, teacher }] } }

var BCA_PERIOD_ORDER = ['1', 'HR', '2', '3', '4', '5', '6', '7', '8', '9'];
var BCA_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// --- Helper: Day Expression Parser ---
function parseDays(dayStr) {
  let dUpper = dayStr.toUpperCase().replace(/\s+/g, '');
  dUpper = dUpper.replace(/([MTWRHF])-([MTWRHF])([MTWRHF])/g, '$1-$2,$3');
  dUpper = dUpper.replace(/\./g, ',');

  const res = new Set();
  const map = { 'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 'R': 'Thursday', 'H': 'Thursday', 'F': 'Friday' };
  const parts = dUpper.split(',');

  parts.forEach(pt => {
    const dash = pt.split('-');
    if (dash.length === 2) {
      const order = ['M', 'T', 'W', 'R', 'F'];
      let s = dash[0] === 'H' ? 'R' : dash[0];
      let e = dash[1] === 'H' ? 'R' : dash[1];
      let iStart = order.indexOf(s);
      let iEnd = order.indexOf(e);
      if (iStart !== -1 && iEnd !== -1 && iStart <= iEnd) {
        for (let i = iStart; i <= iEnd; i++) res.add(map[order[i]]);
      }
    } else {
      for (let ch of pt) {
        if (map[ch]) res.add(map[ch]);
      }
    }
  });
  return Array.from(res);
}

// --- Helper: Teacher Surname Formatter ---
function formatTeacherLastName(str) {
  if (!str) return '';
  let t = String(str).trim();
  t = t.replace(/^email\s+/i, '').replace(/-\s*rm:.*$/i, '').trim();
  t = t.replace(/^(dr\.|mr\.|ms\.|mrs\.)\s*/i, '').trim();
  t = t.replace(/\s+[A-F][+-]?\s*$/, '').trim();
  if (t.includes(',')) {
    return t.split(',')[0].trim();
  }
  const parts = t.split(/\s+/);
  return parts[parts.length - 1].trim();
}

// --- Helper: Course String Validation & Cleanup ---
function isInvalidCourseCandidate(str) {
  if (!str) return true;
  const s = str.trim();
  if (s.length < 2) return true;
  if (/^[\d\s\.\,\:\-\/\%\(\)]+$/.test(s)) return true;
  if (/^[MTWRHF\s\-\,\.\/]+$/i.test(s)) return true;
  const lower = s.toLowerCase();
  if (lower.includes('last week') || lower.includes('this week') || lower.includes('absences') || lower.includes('tardies') || lower.includes('expression')) return true;
  if (/^exp\b/i.test(lower)) return true;
  if (/^(course|term|attendance|grade|schedule|powerschool|my schedule|matrix|table|dropped|historical)/i.test(lower)) return true;
  if (/^(Rm:|Room\b|Cafe\b|Gym\b|[0-9]{2,4}[A-Z]?$)/i.test(s)) return true;
  if (/^(Email\b|Staff\b)/i.test(s)) return true;
  if (/^[A-F][+-]?$/i.test(s)) return true;
  if (/^(POS|AU|AE|SEA|T|TE|TU|HU|HE|ER|HIP|MA|FT|CT|DT|STC|ISS|OSS|CAE|SAP|AR|CV|SD|Not available|Show details|Semester\s*[12]|Q[1-4]|Term|FY|Course|Expression|Teacher|Room|Abs|Tar|Period|Schedule|Attendance|Full Day|Half Day)$/i.test(s)) return true;
  return false;
}

function cleanCourseTitle(title) {
  if (!title) return '';
  let c = title
    .replace(/\[\s*i\s*\]/gi, '')
    .replace(/Not\s+available/gi, '')
    .replace(/Show\s+details/gi, '')
    .replace(/\b(POS|AU|AE|SEA|T|TE|TU)\b/gi, '')
    .replace(/^[\s\.\-\_\:\~\t]+/, '')
    .replace(/[\s\.\-\_\:\~\t]+$/, '')
    .trim();

  if (isInvalidCourseCandidate(c)) return '';
  const lower = c.toLowerCase();
  if (lower.includes('igs') || lower.includes('homeroom')) return 'Homeroom';
  if (lower.includes('lunch')) return 'Lunch';
  return c;
}

// --- Main Schedule Parsing Function ---
function parsePowerSchoolText(rawText) {
  const scheduleData = {
    '1': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    'HR': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    '2': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    '3': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    '4': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    '5': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    '6': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    '7': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    '8': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
    '9': { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
  };

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const emailIndices = [];
  for (let i = 0; i < lines.length; i++) {
    if (/Email\s+/i.test(lines[i])) emailIndices.push(i);
  }

  for (let idx = 0; idx < emailIndices.length; idx++) {
    const eIdx = emailIndices[idx];
    const prevEIdx = idx === 0 ? -1 : emailIndices[idx - 1];
    const emailLine = lines[eIdx];

    // 1. Extract Teacher
    let teacher = '';
    const tMatch = emailLine.match(/Email\s+([^-\n\t]+)/i);
    if (tMatch) {
      teacher = formatTeacherLastName(tMatch[1]);
    }

    // 2. Extract Room
    let room = '';
    const rmInline = emailLine.match(/Rm:\s*([^\s\[\]]+)/i);
    if (rmInline) {
      room = rmInline[1];
    } else {
      for (let k = eIdx + 1; k < Math.min(lines.length, eIdx + 4); k++) {
        const l = lines[k];
        if (/Email/i.test(l)) break;
        const directMatch = l.match(/^(Cafe\s*2Flr|Gym[A-Z]?|[0-9]{2,4}[A-Z]?)$/i);
        if (directMatch) { room = directMatch[1]; break; }
      }
      if (!room) {
        for (let k = eIdx; k < Math.min(lines.length, eIdx + 4); k++) {
          if (lines[k] === '- Rm:' || lines[k] === 'Rm:' || lines[k] === '- Rm') {
            if (k + 1 < lines.length) { room = lines[k + 1].trim(); break; }
          }
        }
      }
    }

    // 3. Scan expression lines between previous and current email lines
    const periodList = [];
    let detectedCourse = '';

    for (let j = prevEIdx + 1; j <= eIdx; j++) {
      const line = lines[j];
      const expMatches = line.match(/(?:^|[\s\t\(\.0-9])(HR|\d)\(([M|T|W|R|H|F|\-|,|\.|\s]+)\)/gi);
      if (expMatches) {
        expMatches.forEach(em => {
          const m = em.match(/(HR|\d)\(([M|T|W|R|H|F|\-|,|\.|\s]+)\)/i);
          if (m) {
            const pId = m[1].toUpperCase();
            const days = parseDays(m[2]);
            periodList.push({ period: pId, days: days });
          }
        });
      }

      let cleanLine = line
        .replace(/(?:^|[\s\t\(\.0-9])(HR|\d)\(([M|T|W|R|H|F|\-|,|\.|\s]+)\)/gi, ' ')
        .replace(/Email\s+.*$/i, ' ')
        .replace(/\b(POS|AU|AE|SEA|T|TE|TU|HU|HE|ER|HIP|MA|FT|CT|DT|STC|ISS|OSS|CAE|SAP|AR|CV|SD)\b/gi, ' ')
        .replace(/Not\s+available/gi, ' ')
        .replace(/Show\s+details/gi, ' ')
        .replace(/\[\s*i\s*\]/gi, ' ')
        .replace(/-\s*Rm:.*$/gi, ' ')
        .replace(/Rm:.*$/gi, ' ')
        .replace(/\b[0-9]+(\.[0-9]+)?\b/g, ' ')
        .replace(/[~_\.\-\t]/g, ' ')
        .trim();

      if (cleanLine.length > 2 && !/^(Cafe\s*2Flr|Gym[A-Z]?|[0-9]{2,4}[A-Z]?)$/i.test(cleanLine)) {
        if (!/^[A-F][+-]?$/i.test(cleanLine) && !isInvalidCourseCandidate(cleanLine)) {
          detectedCourse = cleanLine;
        }
      }
    }

    // 4. Map class to periods & days
    if (periodList.length > 0) {
      let finalCourseName = cleanCourseTitle(detectedCourse);
      if (!finalCourseName) {
        finalCourseName = periodList.some(p => p.period === 'HR') ? 'Homeroom' : 'Class';
      }
      const cleanRm = room ? (room.toLowerCase().startsWith('rm') ? room : `Rm: ${room}`) : 'Rm: Campus';

      periodList.forEach(pItem => {
        pItem.days.forEach(day => {
          if (scheduleData[pItem.period] && scheduleData[pItem.period][day]) {
            const exists = scheduleData[pItem.period][day].some(
              x => x.title === finalCourseName && x.room === cleanRm
            );
            if (!exists) {
              scheduleData[pItem.period][day].push({
                title: finalCourseName,
                room: cleanRm,
                teacher: teacher || ''
              });
            }
          }
        });
      });
    }
  }

  return scheduleData;
}

// --- Canonical schedule helpers (not part of the extraction engine) ---

function createEmptySchedule() {
  const schedule = {};
  BCA_PERIOD_ORDER.forEach(period => {
    schedule[period] = {};
    BCA_DAYS.forEach(day => {
      schedule[period][day] = [];
    });
  });
  return schedule;
}

// Canonical schedules only ever store a surname. This cleans legacy entries,
// pasted imports, and cloud copies without touching the supplied extractor.
function normalizeTeacherSurname(value) {
  let text = String(value || '').replace(/\u00A0/g, ' ').trim();
  if (!text) return '';
  text = text.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').trim();
  text = text.replace(/^email\s+/i, '').replace(/-\s*rm:.*$/i, '').trim();
  text = text.replace(/\b(dr|mr|ms|mrs|mx)\.?\b/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.includes(',')) text = text.split(',')[0].trim();
  const parts = text.split(/\s+/).filter(part => /[A-Za-z]/.test(part));
  if (!parts.length) return '';
  return parts[parts.length - 1].replace(/[^A-Za-z'\-]/g, '');
}

function normalizeSchedule(input) {
  const schedule = createEmptySchedule();
  if (!input || typeof input !== 'object') return schedule;
  BCA_PERIOD_ORDER.forEach(period => {
    BCA_DAYS.forEach(day => {
      const source = input[period] && Array.isArray(input[period][day]) ? input[period][day] : [];
      schedule[period][day] = source
        .filter(item => item && typeof item === 'object' && String(item.title || '').trim())
        .map(item => ({
          title: String(item.title).trim(),
          room: String(item.room == null ? '' : item.room).trim(),
          teacher: normalizeTeacherSurname(item.teacher)
        }));
    });
  });
  return schedule;
}

function summarizeSchedule(schedule) {
  const courses = new Set();
  const teachers = new Set();
  let classes = 0;
  let filledSlots = 0;
  const byDay = {};
  BCA_DAYS.forEach(day => { byDay[day] = 0; });
  BCA_PERIOD_ORDER.forEach(period => {
    BCA_DAYS.forEach(day => {
      const list = (schedule[period] && schedule[period][day]) || [];
      if (list.length) filledSlots += 1;
      byDay[day] += list.length;
      classes += list.length;
      list.forEach(cls => {
        if (cls.title) courses.add(cls.title);
        if (cls.teacher) teachers.add(cls.teacher);
      });
    });
  });
  return { classes, courses: courses.size, teachers: teachers.size, filledSlots, byDay };
}

// Expose for module/browser use
if (typeof window !== 'undefined') {
  window.parsePowerSchoolText = parsePowerSchoolText;
  window.formatTeacherLastName = formatTeacherLastName;
  window.cleanCourseTitle = cleanCourseTitle;
  window.parseDays = parseDays;
  window.createEmptySchedule = createEmptySchedule;
  window.normalizeSchedule = normalizeSchedule;
  window.normalizeTeacherSurname = normalizeTeacherSurname;
  window.summarizeSchedule = summarizeSchedule;
  window.BCA_PERIOD_ORDER = BCA_PERIOD_ORDER;
  window.BCA_DAYS = BCA_DAYS;
}
