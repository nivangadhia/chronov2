// --- BCA Chrono: Main Application ---
// State, routing, persistence, live bells, weather, absences, editing, print,
// and optional lazy-loaded Firebase sync.

const APP_DAYS = (window.BCA_DAYS || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']).slice();
const APP_PERIODS = (window.BCA_PERIOD_ORDER || ['1', 'HR', '2', '3', '4', '5', '6', '7', '8', '9']).slice();

const BELL_SCHEDULE = {
  full: {
    '1': [480, 530],
    'HR': [534, 538],
    '2': [542, 592],
    '3': [596, 646],
    '4': [650, 700],
    '5': [704, 754],
    '6': [758, 808],
    '7': [812, 862],
    '8': [866, 916],
    '9': [920, 970]
  },
  half: {
    '1': [480, 505],
    'HR': [509, 518],
    '2': [522, 547],
    '3': [551, 576],
    '4': [580, 605],
    '5': [609, 634],
    '6': [638, 663],
    '7': [667, 692],
    '8': [696, 721],
    '9': [725, 750]
  }
};

const COLOR_SWATCHES = [
  { id: 'slate', name: 'Slate', hex: '#8b91a1' },
  { id: 'blue', name: 'Cobalt', hex: '#5b8def' },
  { id: 'indigo', name: 'Indigo', hex: '#8b7cf6' },
  { id: 'magenta', name: 'Magenta', hex: '#d96ab3' },
  { id: 'rose', name: 'Rose', hex: '#e06c75' },
  { id: 'red', name: 'Signal red', hex: '#d94f4f' },
  { id: 'orange', name: 'Orange', hex: '#e08a4b' },
  { id: 'amber', name: 'Amber', hex: '#d6a93f' },
  { id: 'olive', name: 'Olive', hex: '#b7c95c' },
  { id: 'green', name: 'Green', hex: '#7fbf6a' },
  { id: 'teal', name: 'Teal', hex: '#4fb3a5' },
  { id: 'sky', name: 'Sky', hex: '#6aa9d8' },
  { id: 'umber', name: 'Umber', hex: '#a58a6b' },
  { id: 'stone', name: 'Stone', hex: '#9a9fb0' }
];

const STORAGE_KEY = 'bca_chrono_state_v1';
const WEATHER_CACHE_KEY = 'bca_chrono_weather_v1';
const ABSENCES_CACHE_KEY = 'bca_chrono_absences_v1';
const CLOUD_EMAIL_KEY = 'bca_chrono_cloud_email';
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const ABSENCES_REFRESH_MS = 5 * 60 * 1000;
const ALERT_WINDOW_SECONDS = 120;

const PLANNER_KINDS = [
  { id: 'homework', label: 'Homework', short: 'HW', icon: 'edit' },
  { id: 'assignment', label: 'Assignment', short: 'AS', icon: 'check' },
  { id: 'exam', label: 'Exam', short: 'EX', icon: 'alert' },
  { id: 'event', label: 'Event', short: 'EV', icon: 'calendar' },
  { id: 'date', label: 'Important date', short: 'DT', icon: 'flag' }
];
const PLANNER_KIND_IDS = PLANNER_KINDS.map(kind => kind.id);
const PLANNER_IMPACTS = [
  { id: 'none', label: 'No impact' },
  { id: 'no-school', label: 'No School' },
  { id: 'half-day', label: 'Half Day' }
];

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyArm1z9r_z0kLPztqTajOJp-xEXXeZAPRs',
  authDomain: 'bcaschedule-904b3.firebaseapp.com',
  projectId: 'bcaschedule-904b3',
  storageBucket: 'bcaschedule-904b3.firebasestorage.app',
  messagingSenderId: '441701647885',
  appId: '1:441701647885:web:0d885be45a9e74aeb13744'
};
const FIREBASE_VERSION = '10.14.1';

const state = {
  schedule: createEmptySchedule(),
  colors: {},
  bellMode: 'full',
  theme: 'system',
  alerts: { sound: true, desktop: true },
  rawInput: '',
  lastImportAt: null,
  weather: null,
  weatherFetchedAt: null,
  weatherError: null,
  weatherLoading: false,
  absences: [],
  absencesFetchedAt: null,
  absencesError: null,
  absencesLoading: false,
  route: 'today',
  today: 'Monday',
  now: new Date(),
  timerModel: null,
  lastDateKey: '',
  alertedPeriods: new Set(),
  facultyFilter: { query: '', scope: 'all', type: 'all' },
  planner: [],
  plannerFilter: { kind: 'all', showDone: false },
  plannerDialog: null,
  plannerImportDraft: '',
  weekOffset: 0,
  monthOffset: 0,
  importDraft: '',
  importPreview: null,
  importDirty: false,
  importMode: 'replace',
  settingsSection: 'appearance',
  classDialog: null,
  cloud: {
    user: null,
    status: 'local',
    lastSync: null,
    error: null,
    loading: false,
    initialized: false,
    listenerAttached: false,
    firebasePromise: null,
    syncTimer: null,
    applying: false
  },
  firebase: null,
  authMode: 'signin',
  syncChoice: null,
  confirmResolver: null,
  importTimer: null
};

const dom = {
  topbarDate: document.getElementById('topbar-date'),
  themeColor: document.getElementById('theme-color-meta'),
  settingsDialog: document.getElementById('settings-dialog'),
  settingsBody: document.getElementById('settings-body'),
  classDialog: document.getElementById('class-dialog'),
  classForm: document.getElementById('class-form'),
  classBody: document.getElementById('class-dialog-body'),
  classTitle: document.getElementById('class-dialog-title'),
  classEyebrow: document.getElementById('class-dialog-eyebrow'),
  classDelete: document.getElementById('class-delete-btn'),
  classSave: document.getElementById('class-save-btn'),
  plannerDialog: document.getElementById('planner-dialog'),
  plannerForm: document.getElementById('planner-form'),
  plannerBody: document.getElementById('planner-dialog-body'),
  plannerTitle: document.getElementById('planner-dialog-title'),
  plannerEyebrow: document.getElementById('planner-dialog-eyebrow'),
  plannerDelete: document.getElementById('planner-delete-btn'),
  plannerSave: document.getElementById('planner-save-btn'),
  plannerImportDialog: document.getElementById('planner-import-dialog'),
  plannerImportText: document.getElementById('planner-import-text'),
  plannerImportPreview: document.getElementById('planner-import-preview'),
  plannerImportButton: document.getElementById('planner-import-btn'),
  authDialog: document.getElementById('auth-dialog'),
  authBody: document.getElementById('auth-body'),
  confirmDialog: document.getElementById('confirm-dialog'),
  confirmTitle: document.getElementById('confirm-title'),
  confirmMessage: document.getElementById('confirm-message'),
  confirmEyebrow: document.getElementById('confirm-eyebrow'),
  confirmOk: document.getElementById('confirm-ok'),
  syncChoiceDialog: document.getElementById('sync-choice-dialog'),
  syncChoiceMessage: document.getElementById('sync-choice-message'),
  toastRegion: document.getElementById('toast-region'),
  printRoot: document.getElementById('print-root'),
  sidebarPhase: document.getElementById('sidebar-phase'),
  sidebarCountdown: document.getElementById('sidebar-countdown'),
  sidebarTitle: document.getElementById('sidebar-title'),
  sidebarBellLabel: document.getElementById('sidebar-bell-label'),
  syncStatus: document.getElementById('sync-status'),
  syncDot: document.getElementById('sync-dot'),
  main: document.getElementById('main-content')
};

let audioContext = null;

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

function init() {
  loadState();
  applyTheme();
  bindEvents();
  setupRouting();
  state.now = new Date();
  state.today = getWeekdayName(state.now);
  state.lastDateKey = getDateKey(state.now);
  state.timerModel = getTimerModel(state.now);
  renderAll();
  startTimer();
  loadWeather();
  loadAbsences();
  setInterval(() => loadWeather(), WEATHER_REFRESH_MS);
  setInterval(() => loadAbsences(), ABSENCES_REFRESH_MS);
  exposeDebugApi();
}

/* --------------------------------------------------------------------------
   Persistence and migration
   -------------------------------------------------------------------------- */

function safeParse(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch (error) { return null; }
}

function sanitizeColors(input) {
  const output = {};
  if (!input || typeof input !== 'object') return output;
  Object.keys(input).forEach(key => {
    const value = input[key];
    if (typeof value !== 'string') return;
    const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return;
    const hex = match[1].length === 3
      ? '#' + match[1].split('').map(ch => ch + ch).join('')
      : '#' + match[1];
    output[String(key)] = hex.toLowerCase();
  });
  return output;
}

function sanitizeAlerts(input) {
  return {
    sound: !input || input.sound !== false,
    desktop: !input || input.desktop !== false
  };
}

function makeId(prefix) {
  return `${prefix || 'id'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizePlanner(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const result = input.reduce((items, raw) => {
    if (!raw || typeof raw !== 'object') return items;
    const title = String(raw.title == null ? '' : raw.title).trim().slice(0, 120);
    if (!title) return items;
    const date = normalizeDateKey(raw.date);
    if (!date) return items;
    const kind = PLANNER_KIND_IDS.includes(raw.kind) ? raw.kind : 'event';
    const impact = raw.impact === 'no-school' || raw.impact === 'half-day' ? raw.impact : 'none';
    const course = String(raw.course == null ? '' : raw.course).trim().slice(0, 80);
    const notes = String(raw.notes == null ? '' : raw.notes).trim().slice(0, 500);
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : makeId('planner');
    const key = `${date}::${title.toLowerCase()}::${kind}::${impact}::${course.toLowerCase()}`;
    if (seen.has(key)) return items;
    seen.add(key);
    items.push({
      id,
      kind,
      title,
      course,
      date,
      notes,
      impact,
      done: !!raw.done,
      createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now()
    });
    return items;
  }, []);

  const overrides = new Map();
  result.forEach(item => {
    if (item.impact === 'none') return;
    if (!overrides.has(item.date)) overrides.set(item.date, []);
    overrides.get(item.date).push(item);
  });
  overrides.forEach(list => {
    const keep = list.find(item => item.impact === 'no-school') || list[0];
    list.forEach(item => {
      if (item !== keep) item.impact = 'none';
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date) || plannerKindRank(a.kind) - plannerKindRank(b.kind) || a.title.localeCompare(b.title));
}

function loadState() {
  let saved = safeParse(localStorage.getItem(STORAGE_KEY));
  let migrated = false;

  if (!saved) {
    const legacy = readLegacyState();
    if (legacy) {
      saved = legacy;
      migrated = true;
    }
  }

  if (saved && typeof saved === 'object') {
    state.schedule = normalizeSchedule(saved.schedule);
    state.colors = sanitizeColors(saved.colors);
    state.bellMode = saved.bellMode === 'half' ? 'half' : 'full';
    state.theme = ['light', 'dark', 'system'].includes(saved.theme) ? saved.theme : 'system';
    state.alerts = sanitizeAlerts(saved.alerts);
    state.rawInput = typeof saved.rawInput === 'string' ? saved.rawInput : '';
    state.importDraft = state.rawInput;
    state.lastImportAt = saved.lastImportAt || null;
    state.planner = sanitizePlanner(saved.planner);
    state.weekOffset = Number.isFinite(Number(saved.weekOffset)) ? Math.max(-52, Math.min(52, Math.round(Number(saved.weekOffset)))) : 0;
    state.monthOffset = Number.isFinite(Number(saved.monthOffset)) ? Math.max(-24, Math.min(24, Math.round(Number(saved.monthOffset)))) : 0;
  } else {
    state.schedule = createEmptySchedule();
  }

  const weatherCache = readCache(WEATHER_CACHE_KEY);
  if (weatherCache && weatherCache.data) {
    state.weather = weatherCache.data;
    state.weatherFetchedAt = weatherCache.fetchedAt || null;
  }
  const absencesCache = readCache(ABSENCES_CACHE_KEY);
  if (absencesCache && absencesCache.data && Array.isArray(absencesCache.data.absences)) {
    state.absences = absencesCache.data.absences;
    state.absencesFetchedAt = absencesCache.fetchedAt || null;
  }

  if (migrated) persist();
}

function readLegacyState() {
  const get = key => { try { return localStorage.getItem(key); } catch (error) { return null; } };
  const scheduleRaw = safeParse(get('bca_sched_v12')) || safeParse(get('ps_schedule_data')) || safeParse(get('bca_schedule_v12'));
  const colorsRaw = safeParse(get('bca_colors_v12')) || safeParse(get('bca_course_colors'));
  const rawInput = get('bca_raw_input') || get('ps_raw_input') || '';
  const bellRaw = get('bca_bell_mode');
  const bellMode = bellRaw === 'half' ? 'half' : 'full';
  const themeRaw = get('bca_theme_v12');
  const theme = ['light', 'dark', 'system'].includes(themeRaw) ? themeRaw : 'system';
  const notificationsRaw = get('bca_notifications_enabled');
  let desktop = true;
  if (notificationsRaw === 'false' || notificationsRaw === '"false"') desktop = false;

  if (!scheduleRaw && !colorsRaw && !rawInput && !notificationsRaw && !bellRaw && !themeRaw) return null;
  return {
    schedule: scheduleRaw,
    colors: colorsRaw || {},
    bellMode,
    theme,
    alerts: { sound: true, desktop },
    rawInput
  };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      schedule: state.schedule,
      colors: state.colors,
      bellMode: state.bellMode,
      theme: state.theme,
      alerts: state.alerts,
      rawInput: state.rawInput,
      lastImportAt: state.lastImportAt,
      planner: state.planner,
      weekOffset: state.weekOffset,
      monthOffset: state.monthOffset
    }));
  } catch (error) {
    console.warn('Could not save BCA Chrono state', error);
  }
  if (state.cloud.user && !state.cloud.applying) scheduleCloudSave();
}

function readCache(key) {
  const parsed = safeParse(localStorage.getItem(key));
  return parsed && parsed.data ? parsed : null;
}

function writeCache(key, data, fetchedAt) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, fetchedAt }));
  } catch (error) {
    console.warn('Could not cache BCA Chrono data', error);
  }
}

/* --------------------------------------------------------------------------
   Theme
   -------------------------------------------------------------------------- */

function resolveTheme() {
  if (state.theme === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return state.theme;
}

function applyTheme() {
  const resolved = resolveTheme();
  document.documentElement.dataset.theme = resolved;
  if (dom.themeColor) dom.themeColor.setAttribute('content', resolved === 'dark' ? '#0c0d0c' : '#f4f1e7');
  syncThemeButtons();
}

function setTheme(theme) {
  if (!['light', 'dark', 'system'].includes(theme)) return;
  state.theme = theme;
  persist();
  applyTheme();
  syncThemeButtons();
}

function toggleTheme() {
  setTheme(resolveTheme() === 'dark' ? 'light' : 'dark');
}

function syncThemeButtons() {
  document.querySelectorAll('[data-action="set-theme"]').forEach(button => {
    const active = button.dataset.theme === state.theme;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const toggle = document.querySelector('[data-action="toggle-theme"]');
  if (toggle) {
    const resolved = resolveTheme();
    toggle.innerHTML = icon(resolved === 'dark' ? 'sun' : 'moon');
    toggle.setAttribute('aria-label', resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.setAttribute('title', resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

if (window.matchMedia) {
  const themeQuery = window.matchMedia('(prefers-color-scheme: light)');
  const onThemeChange = () => { if (state.theme === 'system') applyTheme(); };
  if (themeQuery.addEventListener) themeQuery.addEventListener('change', onThemeChange);
  else if (themeQuery.addListener) themeQuery.addListener(onThemeChange);
}

/* --------------------------------------------------------------------------
   Routing
   -------------------------------------------------------------------------- */

function setupRouting() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
  const route = ['today', 'week', 'planner', 'month', 'faculty', 'import'].includes(raw) ? raw : 'today';
  state.route = route;
  document.querySelectorAll('.view').forEach(view => {
    const active = view.dataset.view === route;
    view.hidden = !active;
    view.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  document.querySelectorAll('[data-route]').forEach(link => {
    const active = link.dataset.route === route;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = routeTitle(route) + ' / BCA Chrono';
  renderCurrentView();
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' });
}

function routeTitle(route) {
  return {
    today: 'Today',
    week: 'Week',
    planner: 'Planner',
    month: 'Month',
    faculty: 'Faculty absences',
    import: 'Import'
  }[route] || 'Today';
}

function navigate(route) {
  const target = `#/${route}`;
  if (window.location.hash === target) handleRoute();
  else window.location.hash = target;
}

/* --------------------------------------------------------------------------
   Formatting helpers
   -------------------------------------------------------------------------- */

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function icon(name, className) {
  return `<svg class="${className || 'icon'}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function getWeekdayName(date) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateLong(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatMonthDay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatClock(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatMinutesAway(totalSeconds) {
  const minutes = Math.max(0, Math.ceil(totalSeconds / 60));
  if (minutes <= 0) return 'less than a minute';
  if (minutes === 1) return '1 minute';
  return `${minutes} minutes`;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'not yet';
  const diff = Date.now() - timestamp;
  if (diff < 45000) return 'just now';
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))} min ago`;
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function shortDay(day) {
  return { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' }[day] || day;
}

function formatDayList(days) {
  if (!days || !days.length) return 'All week';
  if (days.length >= 5) return 'All week';
  return days.map(shortDay).join(', ');
}

function formatWeekRange(dates) {
  if (!dates || !dates.length) return '';
  const first = dates[0];
  const last = dates[dates.length - 1];
  return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function getWeekDates(baseDate) {
  const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const day = base.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + offset);
  return [0, 1, 2, 3, 4].map(index => {
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + index);
    return date;
  });
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function normalizeDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return getDateKey(value);
  const text = String(value == null ? '' : value).trim();
  if (!text) return null;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    if (date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])) return getDateKey(date);
    return null;
  }
  match = text.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (match) {
    const year = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : new Date().getFullYear();
    const date = new Date(year, Number(match[1]) - 1, Number(match[2]), 12);
    if (date.getFullYear() === year && date.getMonth() === Number(match[1]) - 1 && date.getDate() === Number(match[2])) return getDateKey(date);
    return null;
  }
  const cleaned = text.replace(/^(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\.?,?\s+/i, '');
  const monthNames = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11
  };
  match = cleaned.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (match) {
    const month = monthNames[match[1].toLowerCase()];
    if (month !== undefined) {
      const year = match[3] ? Number(match[3]) : new Date().getFullYear();
      const date = new Date(year, month, Number(match[2]), 12);
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === Number(match[2])) return getDateKey(date);
      return null;
    }
  }
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) return getDateKey(parsed);
  return null;
}

function parseDateKey(key) {
  const normalized = normalizeDateKey(key);
  if (!normalized) return null;
  const parts = normalized.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12);
}

function formatPlannerDate(key, options) {
  const date = parseDateKey(key);
  if (!date) return '';
  return date.toLocaleDateString('en-US', options || { weekday: 'short', month: 'short', day: 'numeric' });
}

function plannerKindRank(kind) {
  const index = PLANNER_KIND_IDS.indexOf(kind);
  return index === -1 ? PLANNER_KIND_IDS.length : index;
}

function getPlannerKind(kind) {
  return PLANNER_KINDS.find(item => item.id === kind) || PLANNER_KINDS[PLANNER_KINDS.length - 1];
}

function getPlannerImpactLabel(impact) {
  const found = PLANNER_IMPACTS.find(item => item.id === impact);
  return found ? found.label : 'No impact';
}

function getPlannerItemsForDate(dateKey) {
  const key = normalizeDateKey(dateKey);
  if (!key) return [];
  return state.planner
    .filter(item => item.date === key)
    .sort((a, b) => Number(a.done) - Number(b.done) || plannerKindRank(a.kind) - plannerKindRank(b.kind) || a.title.localeCompare(b.title));
}

function getDateImpact(dateKey) {
  const key = normalizeDateKey(dateKey);
  const items = key ? getPlannerItemsForDate(key) : [];
  const noSchool = items.find(item => item.impact === 'no-school') || null;
  const halfDay = items.find(item => item.impact === 'half-day') || null;
  return {
    dateKey: key,
    items,
    noSchool: !!noSchool,
    halfDay: !!halfDay,
    noSchoolItem: noSchool,
    halfDayItem: halfDay
  };
}

function getBellModeForDate(dateKey) {
  return getDateImpact(dateKey).halfDay ? 'half' : state.bellMode;
}

function getBellForDate(dateKey) {
  return BELL_SCHEDULE[getBellModeForDate(dateKey)];
}

function getBellLabelForDate(dateKey) {
  const impact = getDateImpact(dateKey);
  if (impact.noSchool) return 'No school';
  if (impact.halfDay) return 'Half day';
  return bellModeLabel();
}

function isNoSchoolDate(dateKey) {
  return getDateImpact(dateKey).noSchool;
}

function getDisplayedWeekDates() {
  return getWeekDates(addDays(state.now, state.weekOffset * 7));
}

function getDisplayedMonthAnchor() {
  return new Date(state.now.getFullYear(), state.now.getMonth() + state.monthOffset, 1, 12);
}

function getPlannerItemsBetween(startKey, endKey) {
  const start = normalizeDateKey(startKey);
  const end = normalizeDateKey(endKey);
  if (!start || !end) return [];
  return state.planner
    .filter(item => item.date >= start && item.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.done) - Number(b.done) || plannerKindRank(a.kind) - plannerKindRank(b.kind) || a.title.localeCompare(b.title));
}

function getOpenPlannerCount(dateKey) {
  return getPlannerItemsForDate(dateKey).filter(item => !item.done && item.impact === 'none').length;
}

function getWeekOffsetForDate(dateKey) {
  const target = parseDateKey(dateKey);
  if (!target) return 0;
  const currentWeek = getWeekDates(state.now)[0];
  const targetWeek = getWeekDates(target)[0];
  return Math.round((targetWeek - currentWeek) / (7 * 86400000));
}

function isoWeekNumber(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
}

function periodLabel(period) {
  return period === 'HR' ? 'Homeroom' : `Period ${period}`;
}

function bellModeLabel() {
  return state.bellMode === 'half' ? 'Half day' : 'Full day';
}

function getDayClasses(day) {
  const map = {};
  APP_PERIODS.forEach(period => {
    map[period] = (state.schedule[period] && state.schedule[period][day]) || [];
  });
  return map;
}

function countClassesForDay(day) {
  return APP_PERIODS.reduce((total, period) => total + ((state.schedule[period] && state.schedule[period][day]) || []).length, 0);
}

function hasAnyClasses() {
  return APP_PERIODS.some(period => APP_DAYS.some(day => ((state.schedule[period] && state.schedule[period][day]) || []).length > 0));
}

function getNextSchoolDay(date) {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (let i = 1; i <= 60; i += 1) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = getWeekdayName(cursor);
    const dateKey = getDateKey(cursor);
    if (APP_DAYS.includes(weekday) && !isNoSchoolDate(dateKey)) {
      return {
        date: new Date(cursor),
        weekday,
        dateKey,
        bellMode: getBellModeForDate(dateKey),
        bell: getBellForDate(dateKey),
        bellLabel: getBellLabelForDate(dateKey)
      };
    }
  }
  return null;
}

function nextPeriodAfter(seconds, bell) {
  for (const period of APP_PERIODS) {
    if (bell[period][0] * 60 > seconds) return period;
  }
  return null;
}

function previousPeriodEndBefore(seconds, bell) {
  let previous = null;
  for (const period of APP_PERIODS) {
    if (bell[period][1] * 60 <= seconds) previous = period;
    else break;
  }
  return previous;
}

/* --------------------------------------------------------------------------
   Live timer model
   -------------------------------------------------------------------------- */

function getTimerModel(now) {
  const current = now || new Date();
  const weekday = getWeekdayName(current);
  const dateKey = getDateKey(current);
  const impact = getDateImpact(dateKey);
  const noSchool = impact.noSchool;
  const bellMode = impact.halfDay ? 'half' : state.bellMode;
  const schoolDay = APP_DAYS.includes(weekday) && !noSchool;
  const bell = BELL_SCHEDULE[bellMode];
  const nowSeconds = current.getHours() * 3600 + current.getMinutes() * 60 + current.getSeconds();
  const firstStart = bell['1'][0] * 60;
  const lastEnd = bell['9'][1] * 60;
  const dayClasses = schoolDay ? getDayClasses(weekday) : {};
  const classesToday = schoolDay
    ? APP_PERIODS.reduce((total, period) => total + (dayClasses[period] || []).length, 0)
    : 0;

  let phase = noSchool ? 'no-school' : 'weekend';
  let period = null;
  let nextPeriod = null;
  let countdownSeconds = 0;
  let progress = 0;
  let progressStart = null;
  let progressEnd = null;
  let inSchoolHours = false;

  if (schoolDay) {
    if (nowSeconds < firstStart) {
      phase = 'before';
      nextPeriod = '1';
      countdownSeconds = firstStart - nowSeconds;
      progressStart = firstStart;
      progressEnd = bell['1'][1];
    } else if (nowSeconds >= lastEnd) {
      phase = 'after';
    } else {
      inSchoolHours = true;
      for (const candidate of APP_PERIODS) {
        if (nowSeconds >= bell[candidate][0] * 60 && nowSeconds < bell[candidate][1] * 60) {
          period = candidate;
          break;
        }
      }
      if (period) {
        phase = 'class';
        const start = bell[period][0];
        const end = bell[period][1];
        countdownSeconds = end * 60 - nowSeconds;
        progressStart = start;
        progressEnd = end;
        progress = ((nowSeconds - start * 60) / ((end - start) * 60)) * 100;
        nextPeriod = nextPeriodAfter(nowSeconds, bell);
      } else {
        phase = 'passing';
        nextPeriod = nextPeriodAfter(nowSeconds, bell);
        const previous = previousPeriodEndBefore(nowSeconds, bell);
        if (nextPeriod) {
          const nextStart = bell[nextPeriod][0];
          countdownSeconds = nextStart * 60 - nowSeconds;
          if (previous) {
            progressStart = bell[previous][1];
            progressEnd = nextStart;
            progress = ((nowSeconds - bell[previous][1] * 60) / ((nextStart - bell[previous][1]) * 60)) * 100;
          }
        } else {
          phase = 'after';
        }
      }
    }
  }

  progress = Math.max(0, Math.min(100, progress || 0));

  const currentClasses = period ? (dayClasses[period] || []) : [];
  const nextClasses = nextPeriod ? (dayClasses[nextPeriod] || []) : [];
  const nextSchoolDay = (phase === 'weekend' || phase === 'no-school' || phase === 'after') ? getNextSchoolDay(current) : null;

  let nextOccurrence = null;
  if (phase === 'class' && nextPeriod) {
    nextOccurrence = { day: weekday, period: nextPeriod, classes: nextClasses, start: bell[nextPeriod][0] };
  } else if (phase === 'passing' && nextPeriod) {
    nextOccurrence = { day: weekday, period: nextPeriod, classes: nextClasses, start: bell[nextPeriod][0] };
  } else if (phase === 'before') {
    nextOccurrence = { day: weekday, period: '1', classes: dayClasses['1'] || [], start: firstStart / 60 };
  } else if (nextSchoolDay) {
    const nextMap = getDayClasses(nextSchoolDay.weekday);
    const firstFilled = APP_PERIODS.find(candidate => (nextMap[candidate] || []).length > 0) || '1';
    nextOccurrence = {
      day: nextSchoolDay.weekday,
      period: firstFilled,
      classes: nextMap[firstFilled] || [],
      start: nextSchoolDay.bell[firstFilled][0]
    };
  }

  let countdownDisplay;
  if (phase === 'class' || phase === 'passing' || phase === 'before') countdownDisplay = formatDuration(countdownSeconds);
  else if (phase === 'after') countdownDisplay = 'Complete';
  else if (phase === 'no-school') countdownDisplay = 'No school';
  else countdownDisplay = 'Weekend';

  const phaseLabel = {
    class: 'In session',
    passing: 'Passing',
    before: 'Before first bell',
    after: 'Day complete',
    weekend: 'Weekend',
    'no-school': 'No school'
  }[phase];

  const countdownUnit = {
    class: 'left in this period',
    passing: 'until next period',
    before: 'until first bell',
    after: 'last bell was ' + formatTime(bell['9'][1]),
    weekend: 'no classes today',
    'no-school': 'no classes today'
  }[phase];

  let caption = '';
  if (phase === 'class') caption = `${formatMinutesAway(countdownSeconds)} left`;
  else if (phase === 'passing') caption = `${formatMinutesAway(countdownSeconds)} until ${periodLabel(nextPeriod)}`;
  else if (phase === 'before') caption = `${formatMinutesAway(countdownSeconds)} until first bell`;

  const timerKey = [
    dateKey,
    bellMode,
    noSchool ? 'off' : 'on',
    phase,
    period || '',
    nextPeriod || '',
    currentClasses.map(cls => `${cls.title}|${cls.room}|${cls.teacher}`).join('~'),
    nextClasses.map(cls => `${cls.title}|${cls.room}|${cls.teacher}`).join('~'),
    nextSchoolDay ? nextSchoolDay.weekday : ''
  ].join('::');

  return {
    now: current,
    dateKey,
    weekday,
    schoolDay,
    noSchool,
    bellMode,
    bellLabel: noSchool ? 'No school' : impact.halfDay ? 'Half day' : bellModeLabel(),
    impact,
    bell,
    phase,
    phaseLabel,
    period,
    nextPeriod,
    currentClasses,
    nextClasses,
    classesToday,
    dayClasses,
    countdownSeconds,
    countdownDisplay,
    countdownUnit,
    caption,
    progress,
    progressStart,
    progressEnd,
    inSchoolHours,
    nextSchoolDay,
    nextOccurrence,
    firstStart,
    lastEnd,
    isEnding: phase === 'class' && countdownSeconds <= ALERT_WINDOW_SECONDS,
    timerKey
  };
}

/* --------------------------------------------------------------------------
   Timer loop and alerts
   -------------------------------------------------------------------------- */

function startTimer() {
  tick();
  setInterval(tick, 500);
}

function tick() {
  const now = new Date();
  const previous = state.timerModel;
  const model = getTimerModel(now);
  const dateChanged = model.dateKey !== state.lastDateKey;

  state.now = now;
  state.timerModel = model;

  if (dateChanged) {
    state.lastDateKey = model.dateKey;
    state.today = model.weekday;
    state.alertedPeriods.clear();
    renderChrome();
    if (['today', 'week', 'planner', 'month'].includes(state.route)) renderCurrentView();
    loadAbsences();
  } else if (!previous || previous.timerKey !== model.timerKey) {
    renderChrome();
    if (state.route === 'today' || state.route === 'week') renderCurrentView();
    else updateLiveTimerUI(model);
  } else {
    updateLiveTimerUI(model);
  }

  checkClassEndingAlert(model);
}

function updateLiveTimerUI(model) {
  const countdown = document.querySelector('[data-live-countdown]');
  if (countdown) countdown.textContent = model.countdownDisplay;

  const progress = document.querySelector('[data-live-progress]');
  if (progress) progress.style.width = `${model.progress}%`;

  const caption = document.querySelector('[data-live-caption]');
  if (caption) caption.textContent = model.caption || '';

  const clock = document.querySelector('[data-live-clock]');
  if (clock) clock.textContent = formatClock(model.now);

  const nowCard = document.querySelector('.now-card');
  if (nowCard) nowCard.classList.toggle('is-ending', model.isEnding);

  renderSidebarTimer(model);
}

function renderSidebarTimer(model) {
  if (!dom.sidebarPhase || !dom.sidebarCountdown || !dom.sidebarTitle) return;
  dom.sidebarPhase.textContent = model.phaseLabel;
  dom.sidebarBellLabel.textContent = model.bellLabel || bellModeLabel();

  if (model.phase === 'class' || model.phase === 'passing' || model.phase === 'before') {
    dom.sidebarCountdown.textContent = model.countdownDisplay;
  } else if (model.phase === 'after') {
    dom.sidebarCountdown.textContent = 'Done';
  } else if (model.phase === 'no-school') {
    dom.sidebarCountdown.textContent = 'Off';
  } else {
    dom.sidebarCountdown.textContent = model.nextSchoolDay ? shortDay(model.nextSchoolDay.weekday) : 'Off';
  }

  const primary = model.phase === 'class' || model.phase === 'before'
    ? model.currentClasses[0] || model.nextClasses[0]
    : model.nextClasses[0];

  if (model.phase === 'class') {
    dom.sidebarTitle.textContent = primary
      ? primary.title + (model.currentClasses.length > 1 ? ` +${model.currentClasses.length - 1} more` : '')
      : 'Free period';
  } else if (model.phase === 'passing') {
    dom.sidebarTitle.textContent = primary
      ? `Next: ${primary.title} at ${formatTime(model.bell[model.nextPeriod][0])}`
      : 'Passing period';
  } else if (model.phase === 'before') {
    dom.sidebarTitle.textContent = primary
      ? `${primary.title} at ${formatTime(model.firstStart / 60)}`
      : `First bell at ${formatTime(model.firstStart / 60)}`;
  } else if (model.phase === 'after') {
    dom.sidebarTitle.textContent = `Last bell at ${formatTime(model.lastEnd / 60)}`;
  } else if (model.phase === 'no-school') {
    dom.sidebarTitle.textContent = model.nextSchoolDay
      ? `No school. Back ${model.nextSchoolDay.weekday}`
      : 'No school today';
  } else {
    dom.sidebarTitle.textContent = model.nextSchoolDay
      ? `Next school day: ${model.nextSchoolDay.weekday}`
      : 'No classes today';
  }
}

function checkClassEndingAlert(model) {
  if (!state.alerts.sound && !state.alerts.desktop) return;
  if (model.phase !== 'class' || !model.period) return;
  if (!model.currentClasses.length) return;
  if (model.countdownSeconds > ALERT_WINDOW_SECONDS || model.countdownSeconds <= 0) return;

  const key = `${model.dateKey}:${model.period}`;
  if (state.alertedPeriods.has(key)) return;
  state.alertedPeriods.add(key);

  if (state.alerts.sound) playChime();
  if (state.alerts.desktop) {
    notifyDesktop(`BCA Chrono / ${periodLabel(model.period)}`, `${periodLabel(model.period)} ends in about 2 minutes.`);
  }
  showToast(`${periodLabel(model.period)} ends in 2 minutes.`, 'info');
}

function ensureAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) audioContext = new AudioCtor();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function playChime() {
  const context = ensureAudioContext();
  if (!context) return;
  const start = context.currentTime;
  const notes = [
    { frequency: 880, offset: 0, length: 0.42 },
    { frequency: 1174.66, offset: 0.16, length: 0.5 }
  ];
  notes.forEach(note => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(note.frequency, start + note.offset);
    gain.gain.setValueAtTime(0.0001, start + note.offset);
    gain.gain.exponentialRampToValueAtTime(0.12, start + note.offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.offset + note.length);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start + note.offset);
    oscillator.stop(start + note.offset + note.length + 0.02);
  });
}

function notifyDesktop(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body, silent: false }); } catch (error) { console.warn(error); }
    return;
  }
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try { new Notification(title, { body, silent: false }); } catch (error) { console.warn(error); }
      }
    }).catch(() => {});
  }
}

/* --------------------------------------------------------------------------
   Schedule and color helpers
   -------------------------------------------------------------------------- */

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function getCourseColor(title) {
  if (state.colors[title]) return state.colors[title];
  return COLOR_SWATCHES[hashString(title) % COLOR_SWATCHES.length].hex;
}

function getCourseColorName(hex) {
  const swatch = COLOR_SWATCHES.find(item => item.hex.toLowerCase() === String(hex).toLowerCase());
  return swatch ? swatch.name : 'Custom';
}

function setCourseColor(title, hex) {
  if (!title) return;
  const clean = sanitizeColors({ [title]: hex })[title];
  if (!clean) return;
  if (state.colors[title] === clean) {
    syncSwatchGroups(title, clean);
    syncColorDots();
    return;
  }
  state.colors[title] = clean;
  persist();
  if (state.route === 'today' || state.route === 'week') renderCurrentView();
  syncSwatchGroups(title, clean);
  syncColorDots();
}

function updatePendingColor(hex) {
  if (!state.classDialog) return;
  const clean = sanitizeColors({ pending: hex }).pending;
  if (!clean) return;
  state.classDialog.pendingColor = clean;
  state.classDialog.colorTouched = true;
  const title = state.classDialog.title || '__new__';
  syncSwatchGroups(title, clean);
  syncSwatchGroups('__new__', clean);
  const preview = document.querySelector('[data-class-color-preview]');
  if (preview) preview.style.setProperty('--course-color', clean);
  const label = document.querySelector('[data-class-color-name]');
  if (label) label.textContent = getCourseColorName(clean);
}

function syncSwatchGroups(title, hex) {
  document.querySelectorAll('.swatches').forEach(group => {
    if (group.dataset.swatchCourse !== title) return;
    group.querySelectorAll('.swatch').forEach(swatch => {
      const active = swatch.dataset.hex === hex;
      swatch.classList.toggle('is-active', active);
      swatch.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  });
}

function syncColorDots() {
  document.querySelectorAll('[data-color-dot-course]').forEach(dot => {
    const title = dot.dataset.colorDotCourse;
    dot.style.setProperty('--course-color', getCourseColor(title));
  });
}

function getCourses() {
  const courses = new Map();
  APP_PERIODS.forEach(period => {
    APP_DAYS.forEach(day => {
      ((state.schedule[period] && state.schedule[period][day]) || []).forEach(cls => {
        if (!courses.has(cls.title)) courses.set(cls.title, { title: cls.title, count: 0 });
        courses.get(cls.title).count += 1;
      });
    });
  });
  return Array.from(courses.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function mergeSchedules(base, incoming) {
  const merged = normalizeSchedule(base);
  const roomKey = value => String(value || '').replace(/^rm:\s*/i, '').trim().toLowerCase();
  const teacherKey = value => normalizeTeacherSurname(value).toLowerCase();
  APP_PERIODS.forEach(period => {
    APP_DAYS.forEach(day => {
      const existing = merged[period][day];
      ((incoming[period] && incoming[period][day]) || []).forEach(cls => {
        const duplicate = existing.some(item => item.title === cls.title
          && roomKey(item.room) === roomKey(cls.room)
          && teacherKey(item.teacher) === teacherKey(cls.teacher));
        if (!duplicate) existing.push(cls);
      });
    });
  });
  return merged;
}

/* --------------------------------------------------------------------------
   Chrome rendering
   -------------------------------------------------------------------------- */

function renderAll() {
  renderChrome();
  renderCurrentView();
}

function renderCurrentView() {
  const view = document.getElementById(`view-${state.route}`);
  if (!view) return;
  if (state.route === 'today') view.innerHTML = renderToday();
  else if (state.route === 'week') view.innerHTML = renderWeek();
  else if (state.route === 'planner') view.innerHTML = renderPlanner();
  else if (state.route === 'month') view.innerHTML = renderMonth();
  else if (state.route === 'faculty') view.innerHTML = renderFaculty();
  else if (state.route === 'import') view.innerHTML = renderImport();
  syncColorDots();
}

function renderChrome() {
  if (dom.topbarDate) dom.topbarDate.textContent = formatDateLong(state.now);
  if (dom.sidebarBellLabel) dom.sidebarBellLabel.textContent = bellModeLabel();
  document.title = `${routeTitle(state.route)} / BCA Chrono`;
  syncBellUI();
  syncThemeButtons();
  renderSyncStatus();
  renderSidebarTimer(state.timerModel || getTimerModel(state.now));
  document.querySelectorAll('[data-route]').forEach(link => {
    const active = link.dataset.route === state.route;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function syncBellUI() {
  document.querySelectorAll('[data-action="set-bell"]').forEach(button => {
    const active = button.dataset.bell === state.bellMode;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.classList.toggle('is-active', active);
  });
}

function setBellMode(mode) {
  if (mode !== 'full' && mode !== 'half') return;
  if (state.bellMode === mode) return;
  state.bellMode = mode;
  persist();
  state.timerModel = getTimerModel(new Date());
  syncBellUI();
  renderSidebarTimer(state.timerModel);
  if (state.route === 'today' || state.route === 'week') renderCurrentView();
  showToast(`${bellModeLabel()} bell schedule selected.`, 'info');
}

function renderSyncStatus() {
  if (!dom.syncStatus || !dom.syncDot) return;
  let label = 'Local only';
  let dotClass = '';
  if (state.cloud.loading) {
    label = 'Connecting';
    dotClass = 'is-syncing';
  } else if (state.cloud.user) {
    if (state.cloud.status === 'syncing') {
      label = 'Syncing';
      dotClass = 'is-syncing';
    } else if (state.cloud.status === 'error') {
      label = 'Sync error';
      dotClass = 'is-error';
    } else if (state.cloud.status === 'choice') {
      label = 'Choose copy';
      dotClass = 'is-syncing';
    } else if (state.cloud.status === 'paused') {
      label = 'Sync paused';
    } else {
      label = 'Cloud sync';
      dotClass = 'is-live';
    }
  } else if (state.cloud.status === 'error') {
    label = 'Sync error';
    dotClass = 'is-error';
  }
  dom.syncStatus.textContent = label;
  dom.syncDot.className = `status-dot ${dotClass}`.trim();
  const button = dom.syncStatus.closest('button');
  if (button) button.title = state.cloud.user ? `Signed in as ${state.cloud.user.email}` : 'Cloud sync is optional';
}

/* --------------------------------------------------------------------------
   Today view
   -------------------------------------------------------------------------- */

function renderToday() {
  const model = state.timerModel || getTimerModel(state.now);
  const isSchoolDay = model.schoolDay;
  const noSchool = model.noSchool;
  const affecting = isSchoolDay ? absencesAffectingSchedule(state.absences, state.schedule, state.today) : [];
  const preview = !isSchoolDay;
  const displayDay = noSchool ? null : isSchoolDay ? state.today : (model.nextSchoolDay ? model.nextSchoolDay.weekday : 'Monday');
  const noSchedule = !hasAnyClasses();
  const halfDay = !!model.impact && model.impact.halfDay;

  const headSide = `
    <span class="badge${noSchool ? ' badge-warning' : halfDay ? ' badge-accent' : ''}">${icon(noSchool ? 'calendar' : 'bell')} ${noSchool ? 'No school' : halfDay ? 'Half day / ends ' + formatTime(model.bell['9'][1]) : bellModeLabel() + ' / 10 periods'}</span>
    <button class="btn btn-outline btn-sm" type="button" data-action="open-settings" data-settings-target="bells">
      ${icon('bell')} Alerts
    </button>
    ${noSchedule
      ? `<button class="btn btn-primary btn-sm" type="button" data-action="go-import">${icon('import')} Import schedule</button>`
      : `<button class="btn btn-primary btn-sm" type="button" data-action="go-week">${icon('grid')} Edit week</button>`}
  `;

  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">${icon('calendar')} ${formatDateLong(state.now)} / Week ${isoWeekNumber(state.now)}</p>
        <h1 class="page-title">${escapeHtml(todayHeadline(model))}</h1>
        <p class="page-lede">${todayLede(model, affecting)}</p>
      </div>
      <div class="page-head-side">${headSide}</div>
    </div>
    ${halfDay ? `
      <div class="faculty-banner is-accent">
        ${icon('bell')}
        <div>Half Day is on the planner for today. Every period uses the half-day bell schedule and the day ends at ${formatTime(model.bell['9'][1])}.
          <button class="rail-link" type="button" data-action="edit-planner" data-id="${escapeAttr(model.impact.halfDayItem ? model.impact.halfDayItem.id : '')}">Review the event ${icon('arrow-right')}</button>
        </div>
      </div>
    ` : ''}
    <div class="today-layout">
      <div class="today-main">
        ${renderNowCard(model, affecting)}
        ${noSchool ? renderNoSchoolPanel(model) : renderTimeline(model, displayDay, preview, affecting)}
      </div>
      <aside class="today-rail" aria-label="Today at a glance">
        ${renderWeatherCard()}
        ${renderTodayPlanner(model)}
        ${renderFacultyWatch(affecting, model)}
        ${renderWeekGlance()}
      </aside>
    </div>
  `;
}

function todayHeadline(model) {
  if (model.noSchool) return 'No school today.';
  if (!hasAnyClasses()) return 'Your day, ready to be built.';
  if (model.phase === 'weekend') return 'The weekend, unhurried.';
  if (model.phase === 'before') return 'The day is about to start.';
  if (model.phase === 'passing') return 'Between bells.';
  if (model.phase === 'after') return 'The day is in the books.';
  return `${model.weekday}, in motion.`;
}

function todayLede(model, affecting) {
  if (model.noSchool) {
    const next = model.nextSchoolDay;
    if (!next) return 'A No School event is on the planner. The schedule is hidden for today.';
    return `A No School event is on the planner, so the timetable is hidden today. The next school day is ${next.weekday}${next.bellLabel === 'Half day' ? ' on the half-day schedule' : ''}.`;
  }
  if (!hasAnyClasses()) {
    return 'Import your PowerSchool schedule to see every period, teacher, and room in one precise view. The live bell clock works either way.';
  }
  if (model.phase === 'weekend') {
    const next = model.nextSchoolDay;
    if (!next) return 'No classes today.';
    const nextMap = getDayClasses(next.weekday);
    const first = APP_PERIODS.find(period => (nextMap[period] || []).length > 0);
    return `No classes today. ${next.weekday} starts at 8:00 AM${first ? ` with ${nextMap[first][0].title}` : ''}.`;
  }
  const absenceLine = affecting.length
    ? ` ${affecting.length} faculty ${affecting.length === 1 ? 'absence touches' : 'absences touch'} your schedule today.`
    : '';
  if (model.phase === 'before') {
    return `${model.classesToday} classes on the docket. First bell at ${formatTime(model.firstStart / 60)}.${absenceLine}`;
  }
  if (model.phase === 'class') {
    const end = model.period ? formatTime(model.bell[model.period][1]) : '';
    return `${model.classesToday} classes today. ${periodLabel(model.period)} ends at ${end}.${absenceLine}`;
  }
  if (model.phase === 'passing') {
    return `The next bell is at ${formatTime(model.bell[model.nextPeriod][0])}. ${periodLabel(model.nextPeriod)} is next.${absenceLine}`;
  }
  return `${model.classesToday} classes completed. Last bell at ${formatTime(model.lastEnd / 60)}.${absenceLine}`;
}

function renderNowCard(model, affecting) {
  const primary = model.currentClasses.find(Boolean) || null;
  const isText = model.phase === 'after' || model.phase === 'weekend' || model.phase === 'no-school';
  const currentAbsence = model.period
    ? affecting.find(absence => absence.affectedPeriods.includes(model.period)
      && model.currentClasses.some(cls => absenceAffectsClass(absence, cls, model.period, model.weekday)))
    : null;
  const noSchedule = !hasAnyClasses();

  let title = '';
  let meta = '';
  let extra = '';
  let actions = '';

  if (model.noSchool) {
    title = 'No school today';
    const next = model.nextSchoolDay;
    meta = `<span>${icon('calendar')} ${next ? `Next school day: ${escapeHtml(next.weekday)} at ${formatTime(next.bell['1'][0])}` : 'The planner has this date marked as No School.'}</span>`;
    actions = `<div class="now-empty-actions">
      <button class="btn btn-primary btn-sm" type="button" data-action="go-planner">${icon('planner')} Open planner</button>
      ${model.impact.noSchoolItem ? `<button class="btn btn-ghost btn-sm now-ghost" type="button" data-action="edit-planner" data-id="${escapeAttr(model.impact.noSchoolItem.id)}">${icon('edit')} Edit event</button>` : ''}
    </div>`;
  } else if (noSchedule) {
    title = 'No timetable yet';
    meta = `<span>${icon('clock')} The bell clock is live. Add your schedule to fill the frame.</span>`;
    actions = `<div class="now-empty-actions">
      <button class="btn btn-primary btn-sm" type="button" data-action="go-import">${icon('import')} Import schedule</button>
      <button class="btn btn-ghost btn-sm now-ghost" type="button" data-action="add-class" data-day="${model.weekday}" data-period="${model.period || '1'}">${icon('plus')} Add one class</button>
    </div>`;
  } else if (model.phase === 'class') {
    if (primary) {
      title = primary.title;
      meta = `
        <span>${icon('map-pin')} ${escapeHtml(primary.room || 'Room not set')}</span>
        ${primary.teacher ? `<span>${icon('user')} ${escapeHtml(primary.teacher)}</span>` : ''}
      `;
      const alsoInSlot = model.currentClasses.filter(Boolean).slice(1);
      if (alsoInSlot.length) {
        extra = `<div class="now-extra">Also in this slot: ${alsoInSlot.map(cls => escapeHtml(cls.title)).join(', ')}</div>`;
      }
    } else {
      title = 'Free period';
      meta = `<span>${icon('clock')} No class is scheduled in this slot.</span>`;
      actions = `<div class="now-empty-actions">
        <button class="btn btn-ghost btn-sm now-ghost" type="button" data-action="add-class" data-day="${model.weekday}" data-period="${model.period}">${icon('plus')} Add a class here</button>
      </div>`;
    }
  } else if (model.phase === 'passing') {
    const nextPrimary = model.nextClasses[0];
    if (nextPrimary) {
      title = nextPrimary.title;
      meta = `<span>${icon('clock')} Next: ${periodLabel(model.nextPeriod)} at ${formatTime(model.bell[model.nextPeriod][0])}</span>
        ${nextPrimary.room ? `<span>${icon('map-pin')} ${escapeHtml(nextPrimary.room)}</span>` : ''}`;
    } else {
      title = 'Passing period';
      meta = `<span>${icon('clock')} The next slot is open.</span>`;
    }
  } else if (model.phase === 'before') {
    const first = model.nextClasses[0];
    title = first ? first.title : 'First bell is coming';
    meta = `<span>${icon('bell')} ${periodLabel('1')} begins at ${formatTime(model.firstStart / 60)}</span>
      ${first && first.room ? `<span>${icon('map-pin')} ${escapeHtml(first.room)}</span>` : ''}`;
  } else if (model.phase === 'after') {
    title = 'The day is complete';
    meta = `<span>${icon('check')} ${model.classesToday} classes, all clocked out.</span>`;
  } else {
    title = 'No classes today';
    meta = model.nextSchoolDay
      ? `<span>${icon('calendar')} Next school day: ${model.nextSchoolDay.weekday} at ${formatTime(model.firstStart / 60)}</span>`
      : `<span>${icon('calendar')} Enjoy the break.</span>`;
  }

  const periodText = model.noSchool
    ? 'No School / Schedule hidden'
    : model.phase === 'class' && model.period
      ? `${periodLabel(model.period)} / ${formatTime(model.bell[model.period][0])} - ${formatTime(model.bell[model.period][1])}`
      : model.phase === 'passing' && model.nextPeriod
        ? `${periodLabel(model.nextPeriod)} next / ${formatTime(model.bell[model.nextPeriod][0])}`
        : model.phase === 'before'
          ? `${model.bellLabel} / First bell ${formatTime(model.firstStart / 60)}`
          : model.phase === 'after'
            ? `${model.bellLabel} / Last bell ${formatTime(model.lastEnd / 60)}`
            : 'Weekend / No bells';

  let progressHtml = '';
  if (model.phase === 'class' || model.phase === 'passing') {
    progressHtml = `
      <div class="now-progress">
        <div class="now-progress-head">
          <span>${model.phase === 'class' ? 'Period progress' : 'Passing'}</span>
          <span>${Math.round(model.progress)}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill" data-live-progress style="width:${model.progress}%"></div></div>
        <div class="progress-labels">
          <span>${formatTime(model.progressStart)}</span>
          <span>${formatTime(model.progressEnd)}</span>
        </div>
        <div class="progress-caption" data-live-caption>${escapeHtml(model.caption)}</div>
      </div>`;
  } else {
    progressHtml = `
      <div class="now-progress">
        <div class="now-progress-head"><span>Bell schedule</span><span>${escapeHtml(model.bellLabel)}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${model.phase === 'after' ? 100 : 0}%"></div></div>
        <div class="progress-labels">
          <span>First ${formatTime(model.firstStart / 60)}</span>
          <span>Last ${formatTime(model.lastEnd / 60)}</span>
        </div>
        <div class="progress-caption">${model.noSchool ? 'No school. The schedule is hidden for this date.' : model.phase === 'before' ? 'The first bell has not rung yet.' : model.phase === 'after' ? 'All ten periods are complete.' : 'No bells today.'}</div>
      </div>`;
  }

  const next = model.nextOccurrence;
  const nextHtml = next
    ? `<div class="now-next">
        <div class="now-next-label">Next</div>
        <div class="now-next-title">${periodLabel(next.period)} / ${escapeHtml(next.classes[0] ? next.classes[0].title : 'Open period')}</div>
        <div class="now-next-time">${escapeHtml(next.day)} at ${formatTime(next.start)}</div>
      </div>`
    : `<div class="now-next">
        <div class="now-next-label">Next</div>
        <div class="now-next-title">No more classes today</div>
        <div class="now-next-time">See you at the next bell.</div>
      </div>`;

  const footLeft = model.noSchool
    ? `${icon('calendar')} ${model.nextSchoolDay ? `Next school day ${model.nextSchoolDay.weekday}` : 'No school today'}`
    : model.phase === 'class' && model.period
      ? `${icon('bell')} Bell at ${formatTime(model.bell[model.period][1])}`
      : model.phase === 'passing' && model.nextPeriod
        ? `${icon('bell')} Next bell at ${formatTime(model.bell[model.nextPeriod][0])}`
        : model.phase === 'before'
          ? `${icon('bell')} First bell at ${formatTime(model.firstStart / 60)}`
          : model.phase === 'after'
            ? `${icon('check')} Last bell at ${formatTime(model.lastEnd / 60)}`
            : `${icon('calendar')} ${model.nextSchoolDay ? `Next school day ${model.nextSchoolDay.weekday}` : 'No classes today'}`;

  const footRight = currentAbsence
    ? `<span class="now-absence">${icon('alert')} Faculty absence reported</span>`
    : `<span class="now-foot-left">${icon('info')} ${escapeHtml(model.phase === 'class' ? 'Live bell countdown' : 'BCA bell schedule')}</span>`;

  return `
    <section class="now-card phase-${model.phase}${model.isEnding ? ' is-ending' : ''}" aria-labelledby="now-heading">
      <div class="now-kicker">
        <span class="now-phase">${model.phase === 'class' || model.phase === 'passing' ? '<span class="live-dot"></span>' : ''}${escapeHtml(model.phaseLabel)}</span>
        <span class="now-period">${escapeHtml(periodText)}</span>
      </div>
      <div class="now-layout">
        <div class="now-main">
          <div class="now-count-row">
            <div class="now-countdown${isText ? ' is-text' : ''}" data-live-countdown>${escapeHtml(model.countdownDisplay)}</div>
            <div class="now-count-label">${escapeHtml(model.countdownUnit)}</div>
          </div>
          <h2 class="now-title" id="now-heading">${escapeHtml(title)}</h2>
          <div class="now-meta">${meta}</div>
          ${extra}
          ${actions}
        </div>
        <div class="now-side">
          <div>
            <div class="now-clock-label">Local time</div>
            <div class="now-clock" data-live-clock>${formatClock(model.now)}</div>
          </div>
          ${progressHtml}
          ${nextHtml}
        </div>
      </div>
      <div class="now-foot">
        <span class="now-foot-left">${footLeft}</span>
        ${footRight}
      </div>
    </section>
  `;
}

function renderTimeline(model, day, preview, affecting) {
  const bell = preview && model.nextSchoolDay ? model.nextSchoolDay.bell : model.bell;
  const classesTotal = countClassesForDay(day);
  const filledPeriods = APP_PERIODS.filter(period => ((state.schedule[period] && state.schedule[period][day]) || []).length > 0).length;

  if (!classesTotal) {
    return `
      <section class="timeline-panel" aria-label="${preview ? 'Next school day' : 'Today'}">
        <div class="timeline-panel-head">
          <div>
            <div class="section-title">${icon('clock')} ${preview ? 'Next school day' : "Today's line-up"}</div>
            <div class="section-sub">${preview ? `${day} preview` : `${filledPeriods} of 10 periods filled`}</div>
          </div>
        </div>
        <div class="empty-state" style="border:0;border-radius:0;background:transparent;">
          <span class="empty-icon">${icon('calendar', 'icon icon-lg')}</span>
          <div class="empty-title">${hasAnyClasses() ? 'No classes on this day' : 'The timetable is empty'}</div>
          <p class="empty-copy">${hasAnyClasses()
            ? `Add a class to ${day} or switch to the week view to build the full timetable.`
            : 'Paste a PowerSchool export and the importer will map every period, room, and teacher.'}</p>
          <div class="empty-actions">
            ${hasAnyClasses()
              ? `<button class="btn btn-primary btn-sm" type="button" data-action="add-class" data-day="${day}" data-period="1">${icon('plus')} Add a class</button>`
              : `<button class="btn btn-primary btn-sm" type="button" data-action="go-import">${icon('import')} Import schedule</button>`}
            <button class="btn btn-ghost btn-sm" type="button" data-action="go-week">${icon('grid')} Open week</button>
          </div>
        </div>
      </section>
    `;
  }

  const nowSeconds = model.now.getHours() * 3600 + model.now.getMinutes() * 60 + model.now.getSeconds();
  const rows = APP_PERIODS.map(period => {
    const [start, end] = bell[period];
    const classes = (state.schedule[period] && state.schedule[period][day]) || [];
    const isNow = !preview && model.phase === 'class' && model.period === period;
    const isPast = !preview && model.phase !== 'before' && model.phase !== 'weekend' && nowSeconds >= end * 60;
    const periodAbsences = (!preview && day === state.today)
      ? affecting.filter(absence => absence.affectedPeriods.includes(period))
      : [];

    const classHtml = classes.length
      ? classes.map((cls, index) => renderClassItem(cls, day, period, index, periodAbsences)).join('')
      : `<div class="empty-slot">${icon('plus')} Open / add a class</div>`;

    return `
      <div class="timeline-row${isNow ? ' is-now' : ''}${isPast ? ' is-past' : ''}">
        <div class="timeline-time">
          <span class="timeline-time-start">${formatTime(start)}</span>
          <span class="timeline-time-end">${formatTime(end)}</span>
        </div>
        <div class="timeline-rail"><span class="timeline-dot"></span></div>
        <div class="timeline-body">
          <div class="timeline-row-head">
            <span class="period-name">${periodLabel(period)}</span>
            <span class="period-time-inline">${formatTime(start)} - ${formatTime(end)}</span>
            ${isNow ? '<span class="now-tag">Now</span>' : ''}
            <button class="add-inline" type="button" data-action="add-class" data-day="${day}" data-period="${period}">
              ${icon('plus')} Add
            </button>
          </div>
          <div class="class-stack">${classHtml}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="timeline-panel" aria-label="${preview ? 'Next school day' : 'Today'}">
      <div class="timeline-panel-head">
        <div>
          <div class="section-title">${icon('clock')} ${preview ? 'Next school day' : "Today's line-up"}</div>
          <div class="section-sub">${preview ? `${day} preview / ${classesTotal} classes` : `${classesTotal} classes / ${filledPeriods} of 10 periods`}</div>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="go-week">${icon('grid')} Open week</button>
      </div>
      <div class="timeline">${rows}</div>
    </section>
  `;
}

function renderClassItem(cls, day, period, index, periodAbsences) {
  const color = getCourseColor(cls.title);
  const absent = periodAbsences.some(absence => absenceAffectsClass(absence, cls, period, day));
  return `
    <button class="class-item${absent ? ' is-absent' : ''}" type="button"
      style="--course-color:${escapeAttr(color)}"
      data-action="edit-class" data-day="${day}" data-period="${period}" data-index="${index}"
      aria-label="Edit ${escapeAttr(cls.title)}, ${escapeAttr(cls.room || 'room not set')}${absent ? ', faculty absence reported' : ''}">
      <span class="class-color" aria-hidden="true"></span>
      <span class="class-copy">
        <span class="class-title">${escapeHtml(cls.title)}</span>
        <span class="class-meta">
          ${cls.room ? `<span>${icon('map-pin')} ${escapeHtml(cls.room)}</span>` : ''}
          ${cls.teacher ? `<span>${icon('user')} ${escapeHtml(cls.teacher)}</span>` : ''}
        </span>
        ${absent ? `<span class="class-absent">${icon('alert')} Faculty absence reported</span>` : ''}
      </span>
    </button>
  `;
}

function renderNoSchoolPanel(model) {
  const next = model.nextSchoolDay;
  const eventItem = model.impact && model.impact.noSchoolItem;
  const nextText = next
    ? `Next school day: ${escapeHtml(next.weekday)}, ${escapeHtml(formatPlannerDate(next.dateKey))}${next.bellLabel === 'Half day' ? ' on the half-day schedule' : ''}.`
    : 'No later school day is on the calendar yet.';

  return `
    <section class="timeline-panel no-school-panel" aria-label="No school today">
      <div class="no-school-mark" aria-hidden="true">${icon('calendar', 'icon icon-lg')}</div>
      <div class="no-school-copy">
        <p class="eyebrow">${icon('planner')} Planner / No School</p>
        <h2 class="no-school-title">The schedule is off for today.</h2>
        <p class="no-school-text">A No School event is on the planner for ${escapeHtml(formatPlannerDate(model.dateKey, { weekday: 'long', month: 'long', day: 'numeric' }))}. The timetable is hidden, and the live clock skips to the next school day.</p>
        <div class="no-school-next">${icon('arrow-right')} ${nextText}</div>
        <div class="no-school-actions">
          <button class="btn btn-primary btn-sm" type="button" data-action="go-planner">${icon('planner')} Open planner</button>
          ${eventItem ? `<button class="btn btn-outline btn-sm" type="button" data-action="edit-planner" data-id="${escapeAttr(eventItem.id)}">${icon('edit')} Edit No School event</button>` : ''}
          <button class="btn btn-ghost btn-sm" type="button" data-action="add-planner" data-date="${escapeAttr(model.dateKey)}">${icon('plus')} Add a date</button>
        </div>
      </div>
    </section>
  `;
}

function renderPlannerCompactItem(item) {
  const kind = getPlannerKind(item.kind);
  const impact = item.impact === 'no-school' ? 'No School' : item.impact === 'half-day' ? 'Half Day' : '';
  const meta = [impact, item.course].filter(Boolean).join(' / ');
  return `
    <button class="planner-mini kind-${kind.id}${item.done ? ' is-done' : ''}" type="button" data-action="edit-planner" data-id="${escapeAttr(item.id)}">
      <span class="planner-mini-kind">${escapeHtml(kind.short)}</span>
      <span class="planner-mini-copy">
        <span class="planner-mini-title">${escapeHtml(item.title)}</span>
        <span class="planner-mini-meta">${escapeHtml(meta || kind.label)}</span>
      </span>
    </button>
  `;
}

function renderTodayPlanner(model) {
  const items = getPlannerItemsForDate(model.dateKey);
  const open = items.filter(item => !item.done || item.impact !== 'none');
  const body = open.length
    ? open.slice(0, 4).map(renderPlannerCompactItem).join('')
    : `<div class="empty-inline">Nothing due today. The next homework, exam, or date can live here.</div>`;
  return `
    <section class="rail-card" aria-label="Planner items for today">
      <div class="rail-head">
        <span class="rail-title">${icon('planner')} Today's planner</span>
        <button class="rail-link" type="button" data-action="go-planner">Open ${icon('arrow-right')}</button>
      </div>
      ${body}
      ${open.length > 4 ? `<div class="empty-inline" style="padding-bottom:0;">And ${open.length - 4} more.</div>` : ''}
      <button class="btn btn-outline btn-sm planner-rail-add" type="button" data-action="add-planner" data-date="${escapeAttr(model.dateKey)}">${icon('plus')} Add item</button>
    </section>
  `;
}

function renderWeatherCard() {
  const weather = state.weather;
  const hasWeather = !!weather;

  if (!hasWeather) {
    if (state.weatherLoading) {
      return `
        <section class="rail-card" aria-label="Campus weather">
          <div class="rail-head">
            <span class="rail-title">${icon('cloud')} Campus weather</span>
          </div>
          <div class="empty-inline"><span class="boot-spinner" style="display:inline-block;margin-right:6px;vertical-align:-2px;"></span> Reading the sky over Hackensack...</div>
        </section>`;
    }
    return `
      <section class="rail-card" aria-label="Campus weather">
        <div class="rail-head">
          <span class="rail-title">${icon('cloud')} Campus weather</span>
          <button class="icon-btn" type="button" data-action="refresh-weather" aria-label="Retry weather" title="Retry weather">${icon('refresh')}</button>
        </div>
        <div class="empty-inline">${state.weatherError ? escapeHtml(state.weatherError) : 'Weather data is not available yet.'}</div>
        <button class="btn btn-outline btn-sm" type="button" data-action="refresh-weather">Try again</button>
      </section>`;
  }

  const stale = !!state.weatherError;
  const status = stale
    ? `Cached / ${formatRelativeTime(state.weatherFetchedAt)}`
    : state.weatherLoading
      ? `Refreshing / ${formatRelativeTime(state.weatherFetchedAt)}`
      : `Live / updated ${formatRelativeTime(state.weatherFetchedAt)}`;
  const highLow = weather.high !== null && weather.low !== null
    ? `High ${weather.high}° / Low ${weather.low}°`
    : 'Daily range unavailable';

  return `
    <section class="rail-card" aria-label="Campus weather in Hackensack, New Jersey">
      <div class="rail-head">
        <span class="rail-title">${icon('cloud')} Campus weather</span>
        <button class="icon-btn" type="button" data-action="refresh-weather" aria-label="Refresh weather" title="Refresh weather">${icon('refresh')}</button>
      </div>
      <div class="weather-main">
        <div>
          <div class="weather-temp">${weather.temperature}<sup>°</sup></div>
          <div class="weather-condition">${escapeHtml(weather.condition)}</div>
          <div class="weather-highlow">${escapeHtml(highLow)}</div>
        </div>
        ${weather.svg || ''}
      </div>
      <div class="weather-stats">
        <div class="weather-stat">
          <span class="weather-stat-label">${icon('thermometer')} Feels</span>
          <span class="weather-stat-value">${weather.feelsLike}°</span>
        </div>
        <div class="weather-stat">
          <span class="weather-stat-label">${icon('droplet')} Humidity</span>
          <span class="weather-stat-value">${weather.humidity}%</span>
        </div>
        <div class="weather-stat">
          <span class="weather-stat-label">${icon('wind')} Wind</span>
          <span class="weather-stat-value">${weather.windSpeed} mph</span>
        </div>
      </div>
      <div class="weather-status${stale ? ' is-stale' : ''}">
        <span class="status-dot${stale ? ' is-error' : ' is-live'}"></span>
        ${escapeHtml(status)}
      </div>
    </section>
  `;
}

function formatPeriodList(periods) {
  if (!periods || !periods.length) return '';
  const names = periods.map(periodLabel);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function renderFacultyWatch(affecting, model) {
  const hasFeed = state.absences.length > 0 || state.absencesFetchedAt;
  let body = '';

  if (!model.schoolDay) {
    body = `<div class="empty-inline">No classes today. The next faculty roster arrives on the next school day.</div>`;
  } else if (state.absencesLoading && !hasFeed) {
    body = `<div class="empty-inline"><span class="boot-spinner" style="display:inline-block;margin-right:6px;vertical-align:-2px;"></span> Checking the faculty sheet...</div>`;
  } else if (state.absencesError && !hasFeed) {
    body = `<div class="empty-inline">${escapeHtml(state.absencesError)}</div>
      <button class="btn btn-outline btn-sm" type="button" data-action="refresh-absences">Try again</button>`;
  } else if (!affecting.length) {
    body = `<div class="empty-inline">${icon('check', 'icon')} All clear. No reported absences affect your classes today.</div>`;
  } else {
    body = affecting.slice(0, 3).map(absence => `
      <div class="absence-mini">
        <span class="absence-mini-mark" aria-hidden="true"></span>
        <div>
          <div class="absence-mini-name">${escapeHtml(absence.teacher)}</div>
          <div class="absence-mini-meta">${escapeHtml(absence.label)} / You have them in ${escapeHtml(formatPeriodList(absence.affectedPeriods))}</div>
          <span class="badge badge-danger">Affects you</span>
        </div>
      </div>
    `).join('');
    if (affecting.length > 3) {
      body += `<div class="empty-inline" style="padding-bottom:0;">And ${affecting.length - 3} more.</div>`;
    }
  }

  const stale = state.absencesError && hasFeed;
  return `
    <section class="rail-card" aria-label="Faculty absences affecting your schedule">
      <div class="rail-head">
        <span class="rail-title">${icon('users')} Faculty watch</span>
        <button class="rail-link" type="button" data-action="go-faculty">View all ${icon('arrow-right')}</button>
      </div>
      ${body}
      <div class="weather-status${stale ? ' is-stale' : ''}" style="margin-top:11px;">
        <span class="status-dot${stale ? ' is-error' : ' is-live'}"></span>
        ${stale ? 'Cached roster / ' : 'Roster / '}${escapeHtml(formatRelativeTime(state.absencesFetchedAt))}
      </div>
    </section>
  `;
}

function renderWeekGlance() {
  const dates = getWeekDates(state.now);
  const todayKey = getDateKey(state.now);
  const rows = APP_DAYS.map((day, index) => {
    const dateKey = getDateKey(dates[index]);
    const impact = getDateImpact(dateKey);
    const count = impact.noSchool ? 0 : countClassesForDay(day);
    const width = Math.max(count ? 4 : 0, Math.min(100, (count / 10) * 100));
    const isToday = dateKey === todayKey;
    const offLabel = impact.noSchool ? 'No school' : impact.halfDay ? 'Half day' : `${count} classes`;
    return `
      <button class="glance-row${isToday ? ' is-today' : ''}${impact.noSchool ? ' is-off' : ''}${impact.halfDay ? ' is-half' : ''}" type="button" data-action="go-week" aria-label="${day}, ${offLabel}${isToday ? ', today' : ''}">
        <span class="glance-day">${shortDay(day)}</span>
        <span class="glance-bar"><span class="glance-fill" style="width:${width}%"></span></span>
        <span class="glance-count">${impact.noSchool ? 'Off' : count}</span>
      </button>
    `;
  }).join('');

  return `
    <section class="rail-card" aria-label="Week at a glance">
      <div class="rail-head">
        <span class="rail-title">${icon('grid')} Week at a glance</span>
        <span class="section-sub">Week ${isoWeekNumber(state.now)}</span>
      </div>
      <div class="week-glance">${rows}</div>
    </section>
  `;
}

/* --------------------------------------------------------------------------
   Week view
   -------------------------------------------------------------------------- */

function renderWeek() {
  const dates = getDisplayedWeekDates();
  const dateKeys = dates.map(getDateKey);
  const todayKey = getDateKey(state.now);
  const summary = summarizeSchedule(state.schedule);
  const affecting = absencesAffectingSchedule(state.absences, state.schedule, state.today);
  const courses = getCourses();
  const defaultDay = dateKeys.includes(todayKey) ? state.today : 'Monday';
  const empty = summary.classes === 0;
  const weekNumber = isoWeekNumber(dates[0]);
  const weekPlanner = getPlannerItemsBetween(dateKeys[0], dateKeys[4]);
  const halfDays = dates.filter((date, index) => getDateImpact(dateKeys[index]).halfDay).length;
  const noSchoolDays = dates.filter((date, index) => getDateImpact(dateKeys[index]).noSchool).length;
  const weekBellLabel = noSchoolDays || halfDays
    ? [state.bellMode === 'half' ? 'Half day' : 'Full day', halfDays ? `${halfDays} half ${halfDays === 1 ? 'day' : 'days'}` : '', noSchoolDays ? `${noSchoolDays} no school` : ''].filter(Boolean).join(' / ')
    : bellModeLabel();
  const offsetLabel = state.weekOffset === 0 ? 'This week' : state.weekOffset > 0 ? `${state.weekOffset} ${state.weekOffset === 1 ? 'week' : 'weeks'} ahead` : `${Math.abs(state.weekOffset)} ${Math.abs(state.weekOffset) === 1 ? 'week' : 'weeks'} back`;

  const legend = courses.length
    ? `<div class="course-legend" role="group" aria-label="Course colors">
        ${courses.map(course => `
          <span class="legend-item">
            <span class="legend-dot" style="--course-color:${escapeAttr(getCourseColor(course.title))}" data-color-dot-course="${escapeAttr(course.title)}"></span>
            ${escapeHtml(course.title)}
          </span>
        `).join('')}
      </div>`
    : '';

  const dayHeads = APP_DAYS.map((day, index) => {
    const dateKey = dateKeys[index];
    const impact = getDateImpact(dateKey);
    const isToday = dateKey === todayKey;
    const bell = getBellForDate(dateKey);
    const dayBadge = impact.noSchool
      ? `<span class="week-day-badge is-off">${icon('calendar')} No school</span>`
      : impact.halfDay
        ? `<span class="week-day-badge is-half">${icon('bell')} Half day / ends ${formatTime(bell['9'][1])}</span>`
        : '';
    return `
      <div class="week-head-cell${isToday ? ' is-today' : ''}${impact.noSchool ? ' is-off' : ''}${impact.halfDay ? ' is-half' : ''}">
        <div class="week-head-day">${day}</div>
        <div class="week-head-date">${formatMonthDay(dates[index])}${isToday ? ' / Today' : ''}</div>
        ${dayBadge}
      </div>
    `;
  }).join('');

  const baseBell = BELL_SCHEDULE[state.bellMode];
  const rows = APP_PERIODS.map(period => {
    const [start, end] = baseBell[period];
    const periodClasses = APP_DAYS.map((day, index) => {
      const dateKey = dateKeys[index];
      const impact = getDateImpact(dateKey);
      const isToday = dateKey === todayKey;

      if (impact.noSchool) {
        return `
          <div class="week-cell is-off${isToday ? ' is-today' : ''}" data-day="${day}">
            ${period === '1' ? `<div class="week-off-mark">${icon('calendar')} No school</div><div class="week-off-copy">Schedule hidden</div>` : ''}
          </div>
        `;
      }

      const classes = (state.schedule[period] && state.schedule[period][day]) || [];
      const cellAbsences = isToday ? affecting : [];
      const bell = getBellForDate(dateKey);
      const [cellStart, cellEnd] = bell[period];
      const classHtml = classes.map((cls, classIndex) => {
        const absent = cellAbsences.some(absence => absenceAffectsClass(absence, cls, period, day));
        const meta = [cls.room, cls.teacher].filter(Boolean).join(' / ');
        return `
          <button class="week-class${absent ? ' is-absent' : ''}" type="button"
            style="--course-color:${escapeAttr(getCourseColor(cls.title))}"
            data-action="edit-class" data-day="${day}" data-period="${period}" data-index="${classIndex}"
            aria-label="Edit ${escapeAttr(cls.title)} on ${day}, ${periodLabel(period)}${absent ? ', faculty absence reported' : ''}">
            <div class="week-class-title">${escapeHtml(cls.title)}</div>
            <div class="week-class-meta">${escapeHtml(meta || 'Details not set')}${absent ? ' / Faculty out' : ''}</div>
          </button>
        `;
      }).join('');

      return `
        <div class="week-cell${isToday ? ' is-today' : ''}${classes.length ? '' : ' is-empty'}${impact.halfDay ? ' is-half' : ''}">
          ${impact.halfDay ? `<span class="week-cell-bell">${formatTime(cellStart)} - ${formatTime(cellEnd)}</span>` : ''}
          ${classes.length ? classHtml : '<span class="week-empty-mark">Open</span>'}
          <button class="week-add" type="button" data-action="add-class" data-day="${day}" data-period="${period}" aria-label="Add a class to ${day}, ${periodLabel(period)}">
            ${icon('plus')} Add
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="week-period">
        <div class="week-period-id">${period === 'HR' ? 'Homeroom' : `Period ${period}`}</div>
        <div class="week-period-time">${formatTime(start)}<br>${formatTime(end)}</div>
      </div>
      ${periodClasses}
    `;
  }).join('');

  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">${icon('grid')} ${formatWeekRange(dates)} / Week ${weekNumber}</p>
        <h1 class="page-title">${empty ? 'Build the week, period by period.' : state.weekOffset === 0 ? 'The week, on one grid.' : 'A week beyond this one.'}</h1>
        <p class="page-lede">${empty
          ? 'Add a class to any slot, or import a PowerSchool export and let the timetable fill itself. Every slot can hold more than one class.'
          : `${summary.classes} classes across ${summary.courses} courses and ${summary.teachers} teachers. ${weekPlanner.length ? `${weekPlanner.length} planner ${weekPlanner.length === 1 ? 'item lands' : 'items land'} in this week.` : 'Planner items for this week will appear above the grid.'}`}</p>
      </div>
      <div class="page-head-side">
        <button class="btn btn-outline btn-sm" type="button" data-action="print">${icon('print')} Print</button>
        <button class="btn btn-primary btn-sm" type="button" data-action="add-planner" data-date="${escapeAttr(dateKeys[0])}">${icon('plus')} Add planner item</button>
      </div>
    </div>

    ${legend}

    <div class="week-toolbar">
      <div class="week-toolbar-left">
        <div class="week-nav" role="group" aria-label="Week navigation">
          <button class="icon-btn week-nav-btn" type="button" data-action="week-prev" aria-label="Previous week" title="Previous week">${icon('chevron-left')}</button>
          <button class="btn btn-ghost btn-sm week-today-btn" type="button" data-action="week-today">${state.weekOffset === 0 ? 'This week' : 'Back to this week'}</button>
          <button class="icon-btn week-nav-btn" type="button" data-action="week-next" aria-label="Next week" title="Next week">${icon('chevron-right')}</button>
        </div>
        <span class="badge">${icon('bell')} ${weekBellLabel}</span>
        <span class="section-sub">${offsetLabel} / ${formatWeekRange(dates)}</span>
      </div>
      <div class="week-toolbar-right">
        <button class="btn btn-ghost btn-sm" type="button" data-action="add-class" data-day="${defaultDay}" data-period="1">${icon('plus')} Add class</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="go-faculty">${icon('users')} Faculty</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="open-settings" data-settings-target="colors">${icon('palette')} Colors</button>
      </div>
    </div>

    ${renderWeekPlanner(dateKeys, weekPlanner)}

    ${affecting.length && dateKeys.includes(todayKey) ? `
      <div class="faculty-banner">
        ${icon('alert')}
        <div>
          ${affecting.length} faculty ${affecting.length === 1 ? 'absence touches' : 'absences touch'} your classes today. Only the affected periods are tinted.
          <button class="rail-link" type="button" data-action="go-faculty">Review the roster ${icon('arrow-right')}</button>
        </div>
      </div>
    ` : ''}

    <div class="week-scroll">
      <div class="week-grid" role="group" aria-label="Weekly timetable, ten periods by five days">
        <div class="week-head-cell is-corner">
          <div class="week-head-day">Period</div>
          <div class="week-head-date">Bell times</div>
        </div>
        ${dayHeads}
        ${rows}
      </div>
    </div>

    <div class="week-footnote">
      ${icon('info')} Every class in a shared slot stays visible. Planner items live above the grid and in Month, never on the printed schedule.
    </div>
  `;
}

function renderWeekPlanner(dateKeys, items) {
  const list = items.length
    ? items.map(item => {
      const kind = getPlannerKind(item.kind);
      const impact = item.impact === 'no-school' ? 'No School' : item.impact === 'half-day' ? 'Half Day' : '';
      return `
        <button class="week-plan-chip kind-${kind.id}${item.done ? ' is-done' : ''}" type="button" data-action="edit-planner" data-id="${escapeAttr(item.id)}">
          <span class="week-plan-kind">${escapeHtml(kind.short)}</span>
          <span class="week-plan-title">${escapeHtml(item.title)}</span>
          <span class="week-plan-meta">${escapeHtml(formatPlannerDate(item.date))}${impact ? ` / ${impact}` : item.course ? ` / ${escapeHtml(item.course)}` : ''}</span>
        </button>
      `;
    }).join('')
    : `<div class="week-plan-empty">No homework, assignments, or dates land in this week yet.</div>`;

  return `
    <section class="week-planner" aria-labelledby="week-planner-title">
      <div class="week-planner-head">
        <div>
          <h2 class="week-planner-title" id="week-planner-title">${icon('planner')} Due this week</h2>
          <p class="week-planner-sub">${items.length ? `${items.length} ${items.length === 1 ? 'item' : 'items'} across the week` : 'Planner items are separate from the timetable printout'}</p>
        </div>
        <button class="btn btn-outline btn-sm" type="button" data-action="add-planner" data-date="${escapeAttr(dateKeys[0])}">${icon('plus')} Add item</button>
      </div>
      <div class="week-plan-list">${list}</div>
    </section>
  `;
}

/* --------------------------------------------------------------------------
   Planner view
   -------------------------------------------------------------------------- */

function getFilteredPlannerItems() {
  const kind = state.plannerFilter.kind;
  const showDone = state.plannerFilter.showDone;
  return state.planner
    .filter(item => {
      if (kind !== 'all' && item.kind !== kind) return false;
      if (!showDone && item.done && item.impact === 'none') return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || plannerKindRank(a.kind) - plannerKindRank(b.kind) || a.title.localeCompare(b.title));
}

function plannerDateLabel(dateKey) {
  const todayKey = getDateKey(state.now);
  const target = parseDateKey(dateKey);
  const today = parseDateKey(todayKey);
  if (!target || !today) return formatPlannerDate(dateKey, { weekday: 'long', month: 'long', day: 'numeric' });
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatPlannerDate(dateKey, { weekday: 'long', month: 'long', day: 'numeric' });
}

function renderPlannerRow(item) {
  const kind = getPlannerKind(item.kind);
  const impact = item.impact === 'no-school' ? 'No School' : item.impact === 'half-day' ? 'Half Day' : '';
  const done = item.done && item.impact === 'none';
  const meta = [item.course, item.notes].filter(Boolean).join(' / ');
  const check = item.impact === 'none'
    ? `<button class="planner-check${done ? ' is-checked' : ''}" type="button" data-action="toggle-planner-done" data-id="${escapeAttr(item.id)}" aria-pressed="${done}" aria-label="Mark ${escapeAttr(item.title)} ${done ? 'not done' : 'done'}"><span aria-hidden="true">${done ? icon('check') : ''}</span></button>`
    : `<span class="planner-check is-static" aria-hidden="true">${icon('calendar')}</span>`;

  return `
    <div class="planner-row kind-${kind.id}${done ? ' is-done' : ''}${item.impact !== 'none' ? ' is-impact' : ''}">
      ${check}
      <button class="planner-row-main" type="button" data-action="edit-planner" data-id="${escapeAttr(item.id)}">
        <span class="planner-row-top">
          <span class="planner-kind kind-${kind.id}">${escapeHtml(kind.label)}</span>
          ${impact ? `<span class="planner-impact is-${item.impact}">${escapeHtml(impact)}</span>` : ''}
        </span>
        <span class="planner-row-title">${escapeHtml(item.title)}</span>
        <span class="planner-row-meta">${escapeHtml(meta || (item.impact !== 'none' ? 'Schedule override for this date' : 'No course or notes'))}</span>
      </button>
    </div>
  `;
}

function renderPlannerGroup(dateKey, items) {
  const impact = getDateImpact(dateKey);
  const badge = impact.noSchool
    ? `<span class="planner-impact is-no-school">${icon('calendar')} No School</span>`
    : impact.halfDay
      ? `<span class="planner-impact is-half-day">${icon('bell')} Half Day</span>`
      : '';
  return `
    <section class="planner-group" aria-labelledby="planner-group-${dateKey}">
      <div class="planner-group-head">
        <div>
          <h2 class="planner-group-date" id="planner-group-${dateKey}">${escapeHtml(plannerDateLabel(dateKey))}</h2>
          <p class="planner-group-sub">${escapeHtml(formatPlannerDate(dateKey, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}${badge ? ` ${badge}` : ''}</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="add-planner" data-date="${escapeAttr(dateKey)}">${icon('plus')} Add</button>
      </div>
      <div class="planner-group-list">${items.map(renderPlannerRow).join('')}</div>
    </section>
  `;
}

function renderPlannerRail() {
  const todayKey = getDateKey(state.now);
  const upcoming = state.planner
    .filter(item => !item.done && item.impact === 'none' && item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || plannerKindRank(a.kind) - plannerKindRank(b.kind))
    .slice(0, 5);
  const overrides = state.planner
    .filter(item => item.impact !== 'none' && item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return `
    <aside class="planner-rail" aria-label="Planner details">
      <section class="rail-card" aria-label="Next planner items">
        <div class="rail-head">
          <span class="rail-title">${icon('planner')} Next up</span>
          <span class="section-sub">${upcoming.length}</span>
        </div>
        ${upcoming.length
          ? upcoming.map(item => `
            <button class="rail-planner-row" type="button" data-action="edit-planner" data-id="${escapeAttr(item.id)}">
              <span class="rail-planner-date">${escapeHtml(formatPlannerDate(item.date))}</span>
              <span class="rail-planner-copy">
                <span class="rail-planner-title">${escapeHtml(item.title)}</span>
                <span class="rail-planner-meta">${escapeHtml(getPlannerKind(item.kind).label)}${item.course ? ` / ${escapeHtml(item.course)}` : ''}</span>
              </span>
            </button>
          `).join('')
          : `<div class="empty-inline">Nothing open ahead. Add homework, an assignment, or a date to get started.</div>`}
      </section>

      <section class="rail-card" aria-label="Upcoming schedule changes">
        <div class="rail-head">
          <span class="rail-title">${icon('calendar')} Schedule changes</span>
          <span class="section-sub">${overrides.length}</span>
        </div>
        ${overrides.length
          ? overrides.map(item => `
            <button class="rail-planner-row is-impact" type="button" data-action="edit-planner" data-id="${escapeAttr(item.id)}">
              <span class="rail-planner-date">${escapeHtml(formatPlannerDate(item.date))}</span>
              <span class="rail-planner-copy">
                <span class="rail-planner-title">${escapeHtml(item.title)}</span>
                <span class="rail-planner-meta">${escapeHtml(getPlannerImpactLabel(item.impact))} / schedule override</span>
              </span>
            </button>
          `).join('')
          : `<div class="empty-inline">No schedule changes are ahead.</div>`}
      </section>

      <section class="rail-card planner-rail-note" aria-label="How the planner connects">
        <div class="rail-head">
          <span class="rail-title">${icon('info')} Where items appear</span>
        </div>
        <p>Planner items show in Week and Month. The printed schedule stays timetable only, with no homework or event notes.</p>
        <button class="btn btn-outline btn-sm" type="button" data-action="open-planner-import">${icon('import')} Import dates</button>
      </section>
    </aside>
  `;
}

function renderPlanner() {
  const todayKey = getDateKey(state.now);
  const weekDates = getWeekDates(state.now);
  const weekStart = getDateKey(weekDates[0]);
  const weekEnd = getDateKey(weekDates[4]);
  const filtered = getFilteredPlannerItems();
  const open = state.planner.filter(item => !item.done && item.impact === 'none');
  const dueToday = open.filter(item => item.date === todayKey);
  const dueThisWeek = open.filter(item => item.date >= weekStart && item.date <= weekEnd);
  const exams = open.filter(item => item.kind === 'exam' && item.date >= todayKey);
  const groups = [];
  const groupMap = new Map();
  filtered.forEach(item => {
    if (!groupMap.has(item.date)) {
      groupMap.set(item.date, []);
      groups.push(item.date);
    }
    groupMap.get(item.date).push(item);
  });

  const kindFilters = [{ id: 'all', label: 'All items' }].concat(PLANNER_KINDS.map(kind => ({ id: kind.id, label: kind.label })));
  const body = groups.length
    ? groups.map(dateKey => renderPlannerGroup(dateKey, groupMap.get(dateKey))).join('')
    : `
      <div class="empty-state planner-empty">
        <span class="empty-icon">${icon('planner', 'icon icon-lg')}</span>
        <div class="empty-title">${state.planner.length ? 'No items match these filters.' : 'The planner is clear.'}</div>
        <p class="empty-copy">${state.planner.length
          ? 'Try another type or show completed items.'
          : 'Add homework, assignments, exams, events, or important dates. They will show in Week and Month, never on the printed timetable.'}</p>
        <div class="empty-actions">
          <button class="btn btn-primary btn-sm" type="button" data-action="add-planner" data-date="${escapeAttr(todayKey)}">${icon('plus')} Add an item</button>
          <button class="btn btn-outline btn-sm" type="button" data-action="open-planner-import">${icon('import')} Import dates</button>
        </div>
      </div>
    `;

  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">${icon('planner')} Homework, assignments, exams, and dates / local first</p>
        <h1 class="page-title">The work and the dates, in one place.</h1>
        <p class="page-lede">Add the homework, assignments, exams, events, and important dates that sit around the timetable. They appear in Week and Month, and stay out of the printed schedule.</p>
      </div>
      <div class="page-head-side">
        <button class="btn btn-outline btn-sm" type="button" data-action="open-planner-import">${icon('import')} Import dates</button>
        <button class="btn btn-primary btn-sm" type="button" data-action="add-planner" data-date="${escapeAttr(todayKey)}">${icon('plus')} Add item</button>
      </div>
    </div>

    <div class="planner-summary">
      <div class="stat-card">
        <div class="stat-label">Open</div>
        <div class="stat-value">${open.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Due today</div>
        <div class="stat-value">${dueToday.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">This week</div>
        <div class="stat-value">${dueThisWeek.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Exams ahead</div>
        <div class="stat-value">${exams.length}</div>
      </div>
    </div>

    <div class="planner-toolbar">
      <div class="chip-row" role="group" aria-label="Planner item type">
        ${kindFilters.map(kind => `
          <button class="filter-chip${state.plannerFilter.kind === kind.id ? ' is-active' : ''}" type="button" data-action="filter-planner" data-kind="${kind.id}" aria-pressed="${state.plannerFilter.kind === kind.id}">${kind.label}</button>
        `).join('')}
      </div>
      <button class="btn btn-ghost btn-sm${state.plannerFilter.showDone ? ' is-active' : ''}" type="button" data-action="toggle-planner-done-filter" aria-pressed="${state.plannerFilter.showDone}">
        ${icon('check')} ${state.plannerFilter.showDone ? 'Hide completed' : 'Show completed'}
      </button>
    </div>

    <div class="planner-layout">
      <section class="planner-panel" aria-label="Planner items">
        ${body}
      </section>
      ${renderPlannerRail()}
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Month view
   -------------------------------------------------------------------------- */

function renderMonthChip(item) {
  const kind = getPlannerKind(item.kind);
  const impact = item.impact === 'no-school' ? 'No School' : item.impact === 'half-day' ? 'Half Day' : '';
  const title = `${item.title}${impact ? `, ${impact}` : ''}`;
  return `
    <button class="month-chip kind-${kind.id}${item.done ? ' is-done' : ''}" type="button" data-action="edit-planner" data-id="${escapeAttr(item.id)}" title="${escapeAttr(title)}">
      <span class="month-chip-dot" aria-hidden="true"></span>
      <span class="month-chip-text">${escapeHtml(item.title)}</span>
    </button>
  `;
}

function renderMonth() {
  const anchor = getDisplayedMonthAnchor();
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const gridStart = getWeekDates(monthStart)[0];
  const dateKeys = Array.from({ length: 42 }, (unused, index) => getDateKey(addDays(gridStart, index)));
  const todayKey = getDateKey(state.now);
  const monthPrefix = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;
  const monthItems = state.planner.filter(item => item.date.startsWith(monthPrefix));
  const openMonth = monthItems.filter(item => !item.done && item.impact === 'none');
  const noSchoolDays = dateKeys.filter(key => key.startsWith(monthPrefix) && getDateImpact(key).noSchool).length;
  const halfDays = dateKeys.filter(key => key.startsWith(monthPrefix) && getDateImpact(key).halfDay).length;
  const monthLabel = anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const weeks = [];
  for (let week = 0; week < 6; week += 1) {
    const cells = [];
    for (let day = 0; day < 7; day += 1) {
      const index = week * 7 + day;
      const date = addDays(gridStart, index);
      const dateKey = getDateKey(date);
      const inMonth = date.getMonth() === anchor.getMonth() && date.getFullYear() === anchor.getFullYear();
      const impact = getDateImpact(dateKey);
      const items = inMonth ? getPlannerItemsForDate(dateKey) : [];
      const shown = items.slice(0, 3);
      const more = items.length - shown.length;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = dateKey === todayKey;
      const badges = !inMonth ? '' : impact.noSchool
        ? `<span class="month-badge is-off">${icon('calendar')} No school</span>`
        : impact.halfDay
          ? `<span class="month-badge is-half">${icon('bell')} Half day</span>`
          : '';
      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      cells.push(`
        <div class="month-cell${inMonth ? '' : ' is-outside'}${isWeekend ? ' is-weekend' : ''}${isToday ? ' is-today' : ''}${inMonth && impact.noSchool ? ' is-off' : ''}${inMonth && impact.halfDay ? ' is-half' : ''}" role="gridcell" aria-label="${escapeAttr(dayLabel)}${inMonth && impact.noSchool ? ', no school' : inMonth && impact.halfDay ? ', half day' : ''}">
          <div class="month-cell-head">
            <span class="month-day-number">${date.getDate()}</span>
            ${inMonth ? `<button class="month-add" type="button" data-action="add-planner" data-date="${escapeAttr(dateKey)}" aria-label="Add planner item on ${escapeAttr(dayLabel)}">${icon('plus')}</button>` : ''}
          </div>
          ${badges ? `<div class="month-badges">${badges}</div>` : ''}
          ${inMonth ? `<div class="month-items">
            ${shown.map(renderMonthChip).join('')}
            ${more > 0 ? `<span class="month-more">+${more} more</span>` : ''}
          </div>` : ''}
        </div>
      `);
    }
    weeks.push(`<div class="month-week" role="row">${cells.join('')}</div>`);
  }

  const legend = `
    <div class="month-legend" role="group" aria-label="Planner item types">
      ${PLANNER_KINDS.map(kind => `<span class="legend-item"><span class="legend-dot kind-dot-${kind.id}"></span>${kind.label}</span>`).join('')}
      <span class="legend-item"><span class="legend-dot legend-dot-off"></span>No school</span>
      <span class="legend-item"><span class="legend-dot legend-dot-half"></span>Half day</span>
    </div>
  `;

  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">${icon('calendar')} Month view / homework, assignments, and dates</p>
        <h1 class="page-title">${escapeHtml(monthLabel)}</h1>
        <p class="page-lede">A month at a glance, weekends included. Homework, assignments, exams, events, and important dates sit beside No School and Half Day markers.</p>
      </div>
      <div class="page-head-side">
        <button class="btn btn-outline btn-sm" type="button" data-action="open-planner-import">${icon('import')} Import dates</button>
        <button class="btn btn-primary btn-sm" type="button" data-action="add-planner" data-date="${escapeAttr(todayKey)}">${icon('plus')} Add item</button>
      </div>
    </div>

    <div class="month-summary">
      <div class="stat-card">
        <div class="stat-label">Homework</div>
        <div class="stat-value">${openMonth.filter(item => item.kind === 'homework').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Assignments</div>
        <div class="stat-value">${openMonth.filter(item => item.kind === 'assignment').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Exams</div>
        <div class="stat-value">${openMonth.filter(item => item.kind === 'exam').length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dates and events</div>
        <div class="stat-value">${openMonth.filter(item => item.kind === 'date' || item.kind === 'event').length}</div>
      </div>
      <div class="stat-card stat-card-wide">
        <div class="stat-label">Schedule changes</div>
        <div class="stat-value stat-value-sm">${noSchoolDays} no school / ${halfDays} half ${halfDays === 1 ? 'day' : 'days'}</div>
      </div>
    </div>

    <div class="month-toolbar">
      <div class="week-nav" role="group" aria-label="Month navigation">
        <button class="icon-btn week-nav-btn" type="button" data-action="month-prev" aria-label="Previous month" title="Previous month">${icon('chevron-left')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="month-today">This month</button>
        <button class="icon-btn week-nav-btn" type="button" data-action="month-next" aria-label="Next month" title="Next month">${icon('chevron-right')}</button>
      </div>
      <span class="section-sub">${escapeHtml(monthLabel)} / ${monthItems.length} planner ${monthItems.length === 1 ? 'item' : 'items'}</span>
      <button class="btn btn-outline btn-sm" type="button" data-action="go-week">${icon('grid')} Open week</button>
    </div>

    ${legend}
    <p class="month-swipe-hint">Scroll sideways to see the full week.</p>

    <div class="month-scroll">
      <div class="month-calendar">
        <div class="month-weekdays" aria-hidden="true">
          ${weekdayNames.map(name => `<span>${name}</span>`).join('')}
        </div>
        <div class="month-grid" role="grid" aria-label="${escapeAttr(monthLabel)} calendar">
          ${weeks.join('')}
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Planner editor and import
   -------------------------------------------------------------------------- */

function openPlannerDialog(id, options) {
  let item = null;
  if (id) {
    item = state.planner.find(entry => entry.id === id) || null;
    if (!item) return;
  }
  const date = item ? item.date : normalizeDateKey(options && options.date) || getDateKey(state.now);
  state.plannerDialog = {
    mode: item ? 'edit' : 'add',
    id: item ? item.id : null,
    kind: item ? item.kind : (options && PLANNER_KIND_IDS.includes(options.kind) ? options.kind : 'homework'),
    title: item ? item.title : '',
    date,
    course: item ? item.course : '',
    notes: item ? item.notes : '',
    impact: item ? item.impact : 'none',
    done: item ? item.done : false
  };
  renderPlannerDialog();
  if (!dom.plannerDialog.open) dom.plannerDialog.showModal();
  requestAnimationFrame(() => {
    const titleInput = document.getElementById('planner-title');
    if (titleInput) titleInput.focus();
  });
}

function renderPlannerDialog() {
  const dialog = state.plannerDialog;
  if (!dialog || !dom.plannerBody) return;
  const courses = getCourses();
  if (dom.plannerTitle) dom.plannerTitle.textContent = dialog.mode === 'edit' ? 'Edit planner item' : 'Add planner item';
  if (dom.plannerEyebrow) dom.plannerEyebrow.textContent = dialog.mode === 'edit' ? 'Planner / edit' : 'Planner / new';
  if (dom.plannerDelete) dom.plannerDelete.hidden = dialog.mode !== 'edit';
  if (dom.plannerSave) dom.plannerSave.textContent = dialog.mode === 'edit' ? 'Save changes' : 'Add item';

  dom.plannerBody.innerHTML = `
    <div class="field-row">
      <div class="field">
        <label for="planner-kind">Type</label>
        <select class="input" id="planner-kind">
          ${PLANNER_KINDS.map(kind => `<option value="${kind.id}" ${dialog.kind === kind.id ? 'selected' : ''}>${kind.label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="planner-date">Date</label>
        <input class="input" id="planner-date" type="date" value="${escapeAttr(dialog.date)}">
        <div class="field-error" id="planner-date-error" hidden></div>
      </div>
    </div>

    <div class="field">
      <label for="planner-title">Title</label>
      <input class="input" id="planner-title" data-planner-title maxlength="120" value="${escapeAttr(dialog.title)}" placeholder="e.g. Chapter 8 problems, or No School" autocomplete="off">
      <div class="field-error" id="planner-title-error" hidden></div>
    </div>

    <div class="field">
      <label for="planner-course">Course</label>
      <input class="input" id="planner-course" maxlength="80" value="${escapeAttr(dialog.course)}" placeholder="Optional course" autocomplete="off" list="planner-courses">
      <datalist id="planner-courses">
        ${courses.map(course => `<option value="${escapeAttr(course.title)}"></option>`).join('')}
      </datalist>
    </div>

    <div class="field">
      <label for="planner-notes">Notes</label>
      <textarea class="input" id="planner-notes" rows="3" maxlength="500" placeholder="Optional details, pages, or reminders">${escapeHtml(dialog.notes)}</textarea>
    </div>

    <div class="field">
      <label for="planner-impact">Schedule impact</label>
      <select class="input" id="planner-impact">
        ${PLANNER_IMPACTS.map(impact => `<option value="${impact.id}" ${dialog.impact === impact.id ? 'selected' : ''}>${impact.label}${impact.id === 'no-school' ? ': hide the schedule' : impact.id === 'half-day' ? ': use half-day bells' : ''}</option>`).join('')}
      </select>
      <div class="field-hint">A No School event hides that date in Today, Week, and the printout. A Half Day event uses the half-day bell schedule for that date only.</div>
      <div class="field-error" id="planner-impact-error" hidden></div>
    </div>

    <label class="check-row">
      <input type="checkbox" id="planner-done" ${dialog.done ? 'checked' : ''}>
      <span>Mark as done</span>
    </label>
  `;
}

function savePlannerItem() {
  const dialog = state.plannerDialog;
  if (!dialog) return;
  const titleInput = document.getElementById('planner-title');
  const dateInput = document.getElementById('planner-date');
  const title = titleInput ? titleInput.value.trim() : '';
  const date = normalizeDateKey(dateInput ? dateInput.value : '');
  const titleError = document.getElementById('planner-title-error');
  const dateError = document.getElementById('planner-date-error');
  const impactError = document.getElementById('planner-impact-error');

  [titleError, dateError, impactError].forEach(error => {
    if (error) error.hidden = true;
  });
  [titleInput, dateInput, document.getElementById('planner-impact')].forEach(field => {
    if (field) field.removeAttribute('aria-invalid');
  });

  if (!title) {
    if (titleError) {
      titleError.textContent = 'Enter a title.';
      titleError.hidden = false;
    }
    if (titleInput) {
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
    }
    return;
  }
  if (!date) {
    if (dateError) {
      dateError.textContent = 'Choose a valid date.';
      dateError.hidden = false;
    }
    if (dateInput) dateInput.focus();
    return;
  }

  const kindSelect = document.getElementById('planner-kind');
  const courseInput = document.getElementById('planner-course');
  const notesInput = document.getElementById('planner-notes');
  const impactSelect = document.getElementById('planner-impact');
  const doneInput = document.getElementById('planner-done');
  let kind = kindSelect && PLANNER_KIND_IDS.includes(kindSelect.value) ? kindSelect.value : dialog.kind;
  let impact = impactSelect && ['none', 'no-school', 'half-day'].includes(impactSelect.value) ? impactSelect.value : 'none';
  if (impact === 'none') impact = inferPlannerImpact(title) || 'none';
  if (impact !== 'none') kind = 'event';

  const noSchoolConflict = impact === 'half-day' && state.planner.some(item =>
    item.id !== dialog.id && item.date === date && item.impact === 'no-school');
  if (noSchoolConflict) {
    if (impactError) {
      impactError.textContent = 'This date already has a No School event. No School takes precedence; set the schedule impact to None or pick another date.';
      impactError.hidden = false;
    }
    if (impactSelect) {
      impactSelect.setAttribute('aria-invalid', 'true');
      impactSelect.focus();
    }
    return;
  }

  state.planner.forEach(item => {
    if (item.id !== dialog.id && item.date === date && item.impact !== 'none' && impact !== 'none') item.impact = 'none';
  });

  const payload = {
    kind,
    title,
    date,
    course: courseInput ? courseInput.value.trim().slice(0, 80) : '',
    notes: notesInput ? notesInput.value.trim().slice(0, 500) : '',
    impact,
    done: doneInput ? !!doneInput.checked : false
  };

  if (dialog.mode === 'edit') {
    const item = state.planner.find(entry => entry.id === dialog.id);
    if (item) Object.assign(item, payload);
  } else {
    state.planner.push({ id: makeId('planner'), ...payload, createdAt: Date.now() });
  }

  state.planner = sanitizePlanner(state.planner);
  persist();
  if (dom.plannerDialog.open) dom.plannerDialog.close();
  renderAll();
  showToast(`${title} ${dialog.mode === 'edit' ? 'updated' : 'added'} to the planner.`, 'success');
}

async function deletePlannerItem() {
  const dialog = state.plannerDialog;
  if (!dialog || dialog.mode !== 'edit') return;
  const item = state.planner.find(entry => entry.id === dialog.id);
  if (!item) return;
  const ok = await askConfirm({
    eyebrow: 'Planner',
    title: 'Delete this item?',
    message: `${item.title} will be removed from the planner. This cannot be undone.`,
    confirmLabel: 'Delete item',
    danger: true
  });
  if (!ok) return;
  state.planner = state.planner.filter(entry => entry.id !== item.id);
  persist();
  if (dom.plannerDialog.open) dom.plannerDialog.close();
  renderAll();
  showToast(`${item.title} removed.`, 'info');
}

function togglePlannerDone(id) {
  const item = state.planner.find(entry => entry.id === id);
  if (!item || item.impact !== 'none') return;
  item.done = !item.done;
  persist();
  renderCurrentView();
  showToast(`${item.title} ${item.done ? 'marked done' : 'reopened'}.`, 'info');
}

function filterPlanner(kind) {
  if (kind !== 'all' && !PLANNER_KIND_IDS.includes(kind)) return;
  state.plannerFilter.kind = kind;
  renderCurrentView();
  const next = document.querySelector(`[data-action="filter-planner"][data-kind="${kind}"]`);
  if (next) next.focus();
}

function togglePlannerDoneFilter() {
  state.plannerFilter.showDone = !state.plannerFilter.showDone;
  renderCurrentView();
  const next = document.querySelector('[data-action="toggle-planner-done-filter"]');
  if (next) next.focus();
}

function inferPlannerImpact(title) {
  const text = String(title || '').trim();
  if (/no[\s_-]*school|school[\s_-]*closed|holiday/i.test(text)) return 'no-school';
  if (/half[\s_-]*day|early[\s_-]*dismissal/i.test(text)) return 'half-day';
  return '';
}

function inferPlannerKind(title) {
  const text = String(title || '').toLowerCase();
  if (/exam|midterm|final|\btest\b|\bquiz\b/i.test(text)) return 'exam';
  if (/homework|\bhw\b|problem set|reading/i.test(text)) return 'homework';
  if (/assignment|essay|project|lab report|paper\b/i.test(text)) return 'assignment';
  if (/no school|half day|holiday|event|assembly|meeting/i.test(text)) return 'event';
  if (/deadline|important date|reminder|date\b/i.test(text)) return 'date';
  return 'event';
}

function normalizePlannerKind(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (/homework|\bhw\b/.test(text)) return 'homework';
  if (/assignment|project|essay/.test(text)) return 'assignment';
  if (/exam|test|quiz/.test(text)) return 'exam';
  if (/event|activity|assembly/.test(text)) return 'event';
  if (/date|deadline|reminder/.test(text)) return 'date';
  return PLANNER_KIND_IDS.includes(text) ? text : '';
}

function splitPlannerImportRows(text) {
  const source = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!source) return [];
  if (source.includes('\t')) {
    return source.split(/\r?\n/).filter(line => line.trim()).map(line => line.split('\t'));
  }
  if (typeof window.parseRFC4180CSV === 'function') return window.parseRFC4180CSV(source);
  return source.split(/\r?\n/).filter(line => line.trim()).map(line => line.split(','));
}

function parsePlannerImport(text) {
  const rows = splitPlannerImportRows(text).filter(row => row.some(cell => String(cell || '').trim()));
  if (!rows.length) return [];
  const first = rows[0].map(cell => String(cell || '').trim().toLowerCase());
  const alias = {
    date: ['date', 'day', 'when'],
    title: ['title', 'event', 'name', 'assignment', 'homework', 'item'],
    kind: ['kind', 'type', 'category'],
    course: ['course', 'class', 'subject'],
    notes: ['notes', 'note', 'details', 'description'],
    impact: ['impact', 'schedule', 'schedule impact']
  };
  const indexOf = key => first.findIndex(cell => alias[key].some(name => cell === name || cell.includes(name)));
  const header = { date: indexOf('date'), title: indexOf('title'), kind: indexOf('kind'), course: indexOf('course'), notes: indexOf('notes'), impact: indexOf('impact') };
  const hasHeader = header.date !== -1 && header.title !== -1;
  const map = hasHeader
    ? header
    : { date: 0, title: 1, kind: 2, course: 3, notes: 4, impact: 5 };
  const tabDelimited = String(text || '').includes('\t');
  const output = [];
  const seen = new Set();

  rows.slice(hasHeader ? 1 : 0).forEach(row => {
    const cells = row.map(cell => String(cell == null ? '' : cell).trim());
    let dateText = '';
    let title = '';
    let kindText = '';
    let courseText = '';
    let notesText = '';
    let impactText = '';

    if (hasHeader) {
      dateText = map.date >= 0 ? cells[map.date] || '' : '';
      title = map.title >= 0 ? cells[map.title] || '' : '';
      kindText = map.kind >= 0 ? cells[map.kind] || '' : '';
      courseText = map.course >= 0 ? cells[map.course] || '' : '';
      notesText = map.notes >= 0 ? cells[map.notes] || '' : '';
      impactText = map.impact >= 0 ? cells[map.impact] || '' : '';
    } else {
      const trimmedCells = cells.slice();
      while (trimmedCells.length && !trimmedCells[trimmedCells.length - 1]) trimmedCells.pop();
      const line = trimmedCells.join(tabDelimited ? '\t' : ', ').trim();
      const match = line.match(/^([A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s+\d{4})?|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)\s*(?:[,:-]\s*)?(.+)$/);
      if (match && normalizeDateKey(match[1])) {
        dateText = match[1];
        const rest = match[2].split(tabDelimited ? /\t/ : /\s*,\s*/).map(part => part.trim());
        title = rest[0] || '';
        kindText = rest[1] || '';
        courseText = rest[2] || '';
        notesText = rest[3] || '';
        impactText = rest[4] || '';
      } else {
        dateText = cells[0] || '';
        title = cells[1] || '';
        kindText = cells[2] || '';
        courseText = cells[3] || '';
        notesText = cells[4] || '';
        impactText = cells[5] || '';
      }
    }

    const date = normalizeDateKey(dateText);
    if (!date || !title) return;

    let impact = 'none';
    if (/no[\s_-]*school|school[\s_-]*closed|holiday/i.test(impactText)) impact = 'no-school';
    else if (/half[\s_-]*day|early[\s_-]*dismissal/i.test(impactText)) impact = 'half-day';
    if (impact === 'none') impact = inferPlannerImpact(title) || 'none';

    let kind = normalizePlannerKind(kindText);
    if (!kind) kind = inferPlannerKind(title);
    if (impact !== 'none') kind = 'event';

    const item = {
      kind,
      title: title.slice(0, 120),
      date,
      course: courseText.slice(0, 80),
      notes: notesText.slice(0, 500),
      impact,
      done: false
    };
    const key = `${item.date}::${item.title.toLowerCase()}::${item.kind}::${item.impact}::${item.course.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(item);
  });

  return output;
}

function renderPlannerImportPreview() {
  if (!dom.plannerImportPreview) return;
  const draft = state.plannerImportDraft || '';
  const items = parsePlannerImport(draft);
  const noSchool = items.filter(item => item.impact === 'no-school').length;
  const halfDay = items.filter(item => item.impact === 'half-day').length;
  if (!draft.trim()) {
    dom.plannerImportPreview.innerHTML = `<div class="import-preview-empty">${icon('import', 'icon icon-lg')} Nothing to preview yet. Paste dates and events above.</div>`;
    if (dom.plannerImportButton) dom.plannerImportButton.disabled = true;
    return;
  }
  if (!items.length) {
    dom.plannerImportPreview.innerHTML = `<div class="import-preview-empty">${icon('alert', 'icon icon-lg')} No dated items were found. Check the date format and try again.</div>`;
    if (dom.plannerImportButton) dom.plannerImportButton.disabled = true;
    return;
  }
  dom.plannerImportPreview.innerHTML = `
    <div class="planner-import-stats">
      <span class="badge">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
      ${noSchool ? `<span class="badge badge-warning">${noSchool} No School</span>` : ''}
      ${halfDay ? `<span class="badge badge-accent">${halfDay} Half Day</span>` : ''}
    </div>
    <div class="planner-import-list">
      ${items.slice(0, 8).map(item => `
        <div class="planner-import-row">
          <span class="planner-import-date">${escapeHtml(formatPlannerDate(item.date))}</span>
          <span class="planner-import-copy">
            <span class="planner-import-title">${escapeHtml(item.title)}</span>
            <span class="planner-import-meta">${escapeHtml(getPlannerKind(item.kind).label)}${item.impact !== 'none' ? ` / ${escapeHtml(getPlannerImpactLabel(item.impact))}` : ''}${item.course ? ` / ${escapeHtml(item.course)}` : ''}</span>
          </span>
        </div>
      `).join('')}
      ${items.length > 8 ? `<div class="preview-more">And ${items.length - 8} more.</div>` : ''}
    </div>
  `;
  if (dom.plannerImportButton) dom.plannerImportButton.disabled = false;
}

function openPlannerImport() {
  if (!dom.plannerImportDialog) return;
  if (dom.plannerImportText) dom.plannerImportText.value = state.plannerImportDraft || '';
  renderPlannerImportPreview();
  if (!dom.plannerImportDialog.open) dom.plannerImportDialog.showModal();
  requestAnimationFrame(() => {
    if (dom.plannerImportText) dom.plannerImportText.focus();
  });
}

function closePlannerImport() {
  if (dom.plannerImportDialog && dom.plannerImportDialog.open) dom.plannerImportDialog.close();
}

async function pastePlannerClipboard() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    showToast('Clipboard access is not available here. Paste with Ctrl+V instead.', 'error');
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showToast('The clipboard is empty.', 'error');
      return;
    }
    state.plannerImportDraft = text;
    if (dom.plannerImportText) dom.plannerImportText.value = text;
    renderPlannerImportPreview();
    showToast('Clipboard text pasted.', 'success');
  } catch (error) {
    console.warn(error);
    showToast('Clipboard access was blocked. Paste with Ctrl+V instead.', 'error');
  }
}

function importPlannerItems() {
  const items = parsePlannerImport(state.plannerImportDraft || '');
  if (!items.length) {
    showToast('No dated planner items were found.', 'error');
    return;
  }
  const existing = new Set(state.planner.map(item => `${item.date}::${item.title.toLowerCase()}::${item.kind}::${item.impact}::${item.course.toLowerCase()}`));
  const added = [];
  items.forEach(item => {
    const key = `${item.date}::${item.title.toLowerCase()}::${item.kind}::${item.impact}::${item.course.toLowerCase()}`;
    if (existing.has(key)) return;
    state.planner.push({ id: makeId('planner'), ...item, createdAt: Date.now() });
    existing.add(key);
    added.push(item);
  });
  if (!added.length) {
    showToast('Every item in that paste is already in the planner.', 'info');
    return;
  }
  state.planner = sanitizePlanner(state.planner);
  persist();
  closePlannerImport();
  renderAll();
  const impactCount = added.filter(item => item.impact !== 'none').length;
  showToast(`${added.length} ${added.length === 1 ? 'item' : 'items'} imported${impactCount ? `, including ${impactCount} schedule ${impactCount === 1 ? 'change' : 'changes'}` : ''}.`, 'success');
}

function shiftWeek(delta) {
  state.weekOffset = Math.max(-52, Math.min(52, state.weekOffset + Number(delta || 0)));
  persist();
  renderCurrentView();
}

function resetWeek() {
  state.weekOffset = 0;
  persist();
  renderCurrentView();
}

function shiftMonth(delta) {
  state.monthOffset = Math.max(-24, Math.min(24, state.monthOffset + Number(delta || 0)));
  persist();
  renderCurrentView();
}

function resetMonth() {
  state.monthOffset = 0;
  persist();
  renderCurrentView();
}

/* --------------------------------------------------------------------------
   Faculty view
   -------------------------------------------------------------------------- */

function renderFaculty() {
  const affecting = absencesAffectingSchedule(state.absences, state.schedule, state.today);
  const todayAbsences = absencesForToday(state.absences, state.today);
  const fullDay = state.absences.filter(absence => absence.type === 'full').length;
  const partialDay = state.absences.filter(absence => absence.type === 'partial').length;
  const hasFeed = state.absences.length > 0 || state.absencesFetchedAt;
  const stale = state.absencesError && hasFeed;

  let banner = '';
  if (state.absencesLoading && !hasFeed) {
    banner = `<div class="faculty-banner"><span class="boot-spinner" style="display:inline-block;vertical-align:-2px;"></span><div>Reading the faculty sheet now.</div></div>`;
  } else if (state.absencesError && !hasFeed) {
    banner = `<div class="faculty-banner is-error">${icon('alert')}<div>${escapeHtml(state.absencesError)}</div></div>`;
  } else if (stale) {
    banner = `<div class="faculty-banner is-stale">${icon('alert')}<div>Live roster unavailable. Showing the last saved copy from ${escapeHtml(formatRelativeTime(state.absencesFetchedAt))}.</div></div>`;
  } else if (!hasFeed && !state.absencesLoading) {
    banner = `<div class="faculty-banner">${icon('info')}<div>The roster has not been read yet. Refresh to check the faculty sheet.</div></div>`;
  }

  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">${icon('users')} Live faculty roster / ${formatDateLong(state.now)}</p>
        <h1 class="page-title">Who is out, and whether it reaches you.</h1>
        <p class="page-lede">The sheet is checked every five minutes. A marker appears only when the teacher is on your timetable today and the listed periods include your class.</p>
      </div>
      <div class="page-head-side">
        <button class="btn btn-outline btn-sm" type="button" data-action="refresh-absences" ${state.absencesLoading ? 'disabled' : ''}>
          ${icon('refresh')} ${state.absencesLoading ? 'Refreshing' : 'Refresh'}
        </button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="go-week">${icon('grid')} Week</button>
      </div>
    </div>

    <div class="faculty-summary">
      <div class="stat-card">
        <div class="stat-label">Reported</div>
        <div class="stat-value">${state.absences.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Today</div>
        <div class="stat-value">${todayAbsences.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Affects you</div>
        <div class="stat-value${affecting.length ? ' is-danger' : ''}">${affecting.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Full day</div>
        <div class="stat-value">${fullDay}</div>
      </div>
    </div>

    <div class="faculty-toolbar">
      <label class="search-field">
        <span class="sr-only">Search faculty absences</span>
        ${icon('search')}
        <input class="input input-search" type="search" placeholder="Search teacher, period, or day" value="${escapeAttr(state.facultyFilter.query)}" data-faculty-search autocomplete="off">
      </label>
      <div class="chip-row" role="group" aria-label="Absence scope">
        <button class="filter-chip${state.facultyFilter.scope === 'all' ? ' is-active' : ''}" type="button" data-action="filter-faculty" data-scope="all" aria-pressed="${state.facultyFilter.scope === 'all'}">All feed</button>
        <button class="filter-chip${state.facultyFilter.scope === 'today' ? ' is-active' : ''}" type="button" data-action="filter-faculty" data-scope="today" aria-pressed="${state.facultyFilter.scope === 'today'}">Today</button>
        <button class="filter-chip${state.facultyFilter.scope === 'mine' ? ' is-active' : ''}" type="button" data-action="filter-faculty" data-scope="mine" aria-pressed="${state.facultyFilter.scope === 'mine'}">Affects me</button>
      </div>
      <div class="chip-row" role="group" aria-label="Absence type">
        <button class="filter-chip${state.facultyFilter.type === 'all' ? ' is-active' : ''}" type="button" data-action="filter-faculty" data-type="all" aria-pressed="${state.facultyFilter.type === 'all'}">All types</button>
        <button class="filter-chip${state.facultyFilter.type === 'full' ? ' is-active' : ''}" type="button" data-action="filter-faculty" data-type="full" aria-pressed="${state.facultyFilter.type === 'full'}">Full day</button>
        <button class="filter-chip${state.facultyFilter.type === 'partial' ? ' is-active' : ''}" type="button" data-action="filter-faculty" data-type="partial" aria-pressed="${state.facultyFilter.type === 'partial'}">Partial day</button>
      </div>
    </div>

    ${banner}
    <div id="faculty-results">${renderFacultyList()}</div>

    <div class="faculty-source">
      <div class="faculty-source-left">
        ${icon('globe')}
        ${stale ? 'Cached roster' : 'Live roster'} / updated ${escapeHtml(formatRelativeTime(state.absencesFetchedAt))} / ${partialDay} partial ${partialDay === 1 ? 'absence' : 'absences'}
      </div>
      <a class="rail-link" href="${escapeAttr(window.ABSENCES_URL || '#')}" target="_blank" rel="noopener noreferrer">Open source sheet ${icon('arrow-up-right')}</a>
    </div>
  `;
}

function getFilteredAbsences(affectingIds) {
  const { query, scope, type } = state.facultyFilter;
  let list = state.absences.slice();

  if (scope === 'today') list = absencesForToday(list, state.today);
  else if (scope === 'mine') list = list.filter(absence => affectingIds.has(absence.id));

  if (type === 'full') list = list.filter(absence => absence.type === 'full');
  else if (type === 'partial') list = list.filter(absence => absence.type === 'partial');

  const needle = query.trim().toLowerCase();
  if (needle) {
    list = list.filter(absence => {
      const haystack = [
        absence.teacher,
        absence.label,
        absence.days ? absence.days.join(' ') : '',
        absence.raw
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }

  return list.sort((a, b) => {
    const aAffects = affectingIds.has(a.id) ? 1 : 0;
    const bAffects = affectingIds.has(b.id) ? 1 : 0;
    if (aAffects !== bAffects) return bAffects - aAffects;
    return a.teacher.localeCompare(b.teacher);
  });
}

function renderFacultyList() {
  const affecting = absencesAffectingSchedule(state.absences, state.schedule, state.today);
  const affectingIds = new Set(affecting.map(absence => absence.id));
  const filtered = getFilteredAbsences(affectingIds);
  const hasFeed = state.absences.length > 0 || state.absencesFetchedAt;

  if (!state.absences.length) {
    return `
      <div class="empty-state">
        <span class="empty-icon">${icon('users', 'icon icon-lg')}</span>
        <div class="empty-title">${hasFeed ? 'The roster is clear.' : 'The roster has not loaded.'}</div>
        <p class="empty-copy">${hasFeed
          ? 'No faculty absences are posted right now. The page will check again in a few minutes.'
          : 'Check your connection, then refresh the faculty sheet.'}</p>
        <div class="empty-actions">
          <button class="btn btn-primary btn-sm" type="button" data-action="refresh-absences" ${state.absencesLoading ? 'disabled' : ''}>${icon('refresh')} Refresh roster</button>
        </div>
      </div>
    `;
  }

  if (!filtered.length) {
    return `
      <div class="empty-state">
        <span class="empty-icon">${icon('search', 'icon icon-lg')}</span>
        <div class="empty-title">No absences match these filters.</div>
        <p class="empty-copy">Try a different search, scope, or absence type.</p>
        <div class="empty-actions">
          <button class="btn btn-outline btn-sm" type="button" data-action="reset-faculty-filters">${icon('refresh')} Clear filters</button>
        </div>
      </div>
    `;
  }

  const rows = filtered.map(absence => {
    const isAffecting = affectingIds.has(absence.id);
    const typeLabel = absence.type === 'full' ? 'All day' : 'Partial';
    const typeClass = absence.type === 'full' ? 'badge-warning' : 'badge';
    return `
      <div class="faculty-row" role="row">
        <div class="faculty-cell faculty-name-cell" role="cell">
          <div class="faculty-name"><span class="faculty-name-dot" aria-hidden="true"></span>${escapeHtml(absence.teacher)}</div>
        </div>
        <div class="faculty-cell" data-label="Type" role="cell"><span class="badge ${typeClass}">${typeLabel}</span></div>
        <div class="faculty-cell faculty-periods" data-label="Periods" role="cell">${escapeHtml(absence.label)}</div>
        <div class="faculty-cell faculty-days" data-label="Days" role="cell">${escapeHtml(formatDayList(absence.days))}</div>
        <div class="faculty-cell faculty-affects-cell" data-label="Affects you" role="cell">
          ${isAffecting ? `<span class="badge badge-danger">Affects you</span>` : `<span class="section-sub">No conflict</span>`}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section-sub" style="margin-bottom:8px;">Showing ${filtered.length} of ${state.absences.length} reported ${state.absences.length === 1 ? 'absence' : 'absences'}</div>
    <div class="faculty-panel" role="table" aria-label="Reported faculty absences">
      <div class="faculty-row faculty-head" role="row">
        <div role="columnheader">Teacher</div>
        <div role="columnheader">Type</div>
        <div role="columnheader">Periods</div>
        <div role="columnheader">Days</div>
        <div role="columnheader">Affects you</div>
      </div>
      ${rows}
    </div>
  `;
}

function renderFacultyResults() {
  const region = document.getElementById('faculty-results');
  if (region) region.innerHTML = renderFacultyList();
}

function filterFaculty(kind, value) {
  if (kind === 'scope') state.facultyFilter.scope = value;
  else if (kind === 'type') state.facultyFilter.type = value;
  renderCurrentView();
  const selector = kind === 'scope'
    ? `[data-action="filter-faculty"][data-scope="${value}"]`
    : `[data-action="filter-faculty"][data-type="${value}"]`;
  const next = document.querySelector(selector);
  if (next) next.focus();
}

function resetFacultyFilters() {
  state.facultyFilter = { query: '', scope: 'all', type: 'all' };
  renderCurrentView();
  const input = document.querySelector('[data-faculty-search]');
  if (input) input.focus();
}

/* --------------------------------------------------------------------------
   Import view
   -------------------------------------------------------------------------- */

function renderImport() {
  const draft = state.importDraft || '';
  const preview = state.importPreview;
  const summary = preview ? summarizeSchedule(preview) : null;
  const dirtyBanner = preview
    ? `<div class="faculty-banner" data-import-dirty ${state.importDirty ? '' : 'hidden'}>${icon('info')}<div>The text changed since this preview was built. Analyze it again before importing.</div></div>`
    : '';

  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">${icon('import')} PowerSchool importer / local first</p>
        <h1 class="page-title">Bring the timetable in.</h1>
        <p class="page-lede">Paste the full PowerSchool schedule table. The extraction engine maps period expressions, teacher lines, and rooms into the ten-period week, then shows you a preview before anything is replaced.</p>
      </div>
      <div class="page-head-side">
        <button class="btn btn-ghost btn-sm" type="button" data-action="go-week">${icon('grid')} Open week</button>
      </div>
    </div>

    <div class="import-layout">
      <section class="import-panel" aria-labelledby="import-source-title">
        <div class="import-panel-head">
          <h2 class="import-panel-title" id="import-source-title">PowerSchool export</h2>
          <p class="import-panel-copy">Copy the full schedule table, not a single course row. The engine needs the period expression and the teacher line to place each class.</p>
        </div>
        <label class="sr-only" for="import-text">PowerSchool schedule text</label>
        <textarea class="import-textarea" id="import-text" data-import-text spellcheck="false" placeholder="Paste the PowerSchool schedule table here...">${escapeHtml(draft)}</textarea>
        <div class="import-actions">
          <button class="btn btn-primary" type="button" data-action="analyze-import">${icon('search')} Analyze text</button>
          <button class="btn btn-outline" type="button" data-action="paste-clipboard">${icon('import')} Paste from clipboard</button>
          <button class="btn btn-ghost" type="button" data-action="clear-import-text">${icon('trash')} Clear</button>
        </div>
        <div class="import-note">
          <span style="display:inline;vertical-align:-2px;margin-right:4px;">${icon('info', 'icon icon-sm')}</span>
          The text stays in this browser unless you turn on cloud sync. Nothing is sent to a server by the importer.
        </div>
        <ol class="import-steps">
          <li>Open PowerSchool and go to My Schedule.</li>
          <li>Select the full schedule table, then copy it.</li>
          <li>Paste it above and choose Analyze text.</li>
          <li>Review the preview, then replace or merge the timetable.</li>
        </ol>
        <div class="import-note">
          ${state.lastImportAt ? `${icon('check', 'icon icon-sm')} Last import ${escapeHtml(formatRelativeTime(state.lastImportAt))}.` : 'No schedule has been imported yet.'}
        </div>
      </section>

      <section class="import-panel" aria-labelledby="import-preview-title">
        <div class="import-panel-head">
          <h2 class="import-panel-title" id="import-preview-title">Preview</h2>
          <p class="import-panel-copy">${preview
            ? 'Check the mapped classes before committing. Replace clears the current timetable; merge keeps it and adds the incoming classes.'
            : 'Analyze the pasted text to see class counts and the mapped slots.'}</p>
        </div>
        ${dirtyBanner}
        ${preview && summary ? renderImportPreview(preview, summary) : `
          <div class="import-preview-empty">
            ${icon('import', 'icon icon-lg')}
            Nothing to preview yet. Paste a PowerSchool export and analyze it.
          </div>
        `}
      </section>
    </div>
  `;
}

function renderImportPreview(preview, summary) {
  const rows = [];
  APP_PERIODS.forEach(period => {
    APP_DAYS.forEach(day => {
      const classes = (preview[period] && preview[period][day]) || [];
      if (!classes.length) return;
      rows.push(`
        <div class="preview-row">
          <div class="preview-period">${period === 'HR' ? 'HR' : `P${period}`}<br>${shortDay(day)}</div>
          <div>
            <div class="preview-title">${classes.map(cls => escapeHtml(cls.title)).join(', ')}</div>
            <div class="preview-meta">${classes.map(cls => [cls.room, cls.teacher].filter(Boolean).map(escapeHtml).join(' / ')).filter(Boolean).join(' | ')}</div>
          </div>
        </div>
      `);
    });
  });

  const shown = rows.slice(0, 18);
  const more = rows.length - shown.length;

  return `
    <div class="import-stats">
      <div class="import-stat">
        <div class="import-stat-label">Classes</div>
        <div class="import-stat-value">${summary.classes}</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-label">Courses</div>
        <div class="import-stat-value">${summary.courses}</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-label">Teachers</div>
        <div class="import-stat-value">${summary.teachers}</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-label">Filled slots</div>
        <div class="import-stat-value">${summary.filledSlots}</div>
      </div>
    </div>

    <div class="radio-row" role="radiogroup" aria-label="Import mode">
      <label><input type="radio" name="import-mode" value="replace" data-import-mode ${state.importMode === 'replace' ? 'checked' : ''}> Replace timetable</label>
      <label><input type="radio" name="import-mode" value="merge" data-import-mode ${state.importMode === 'merge' ? 'checked' : ''}> Merge into current</label>
    </div>

    <div class="preview-list">
      ${shown.join('')}
      ${more > 0 ? `<div class="preview-more">And ${more} more ${more === 1 ? 'slot' : 'slots'}. The full timetable appears in Week after import.</div>` : ''}
    </div>

    <div class="import-submit-row">
      <button class="btn btn-primary" type="button" data-action="apply-import" data-import-submit>${icon('download')} ${state.importMode === 'merge' ? 'Merge schedule' : 'Replace timetable'}</button>
      <button class="btn btn-ghost" type="button" data-action="clear-import-text">${icon('trash')} Clear</button>
    </div>
  `;
}

function markImportDirty() {
  if (!state.importPreview || state.importDirty) return;
  state.importDirty = true;
  const banner = document.querySelector('[data-import-dirty]');
  if (banner) banner.hidden = false;
}

function analyzeImport() {
  const text = (state.importDraft || '').trim();
  if (!text) {
    showToast('Paste a PowerSchool schedule first.', 'error');
    return;
  }

  let parsed;
  try {
    parsed = normalizeSchedule(parsePowerSchoolText(text));
  } catch (error) {
    console.warn(error);
    showToast('The schedule text could not be read.', 'error');
    return;
  }

  const summary = summarizeSchedule(parsed);
  if (!summary.classes) {
    state.importPreview = null;
    state.importDirty = false;
    renderCurrentView();
    showToast('No classes were found. Copy the full schedule table and try again.', 'error');
    return;
  }

  state.importPreview = parsed;
  state.importDirty = false;
  renderCurrentView();
  showToast(`Found ${summary.classes} ${summary.classes === 1 ? 'class' : 'classes'} across ${summary.courses} ${summary.courses === 1 ? 'course' : 'courses'}.`, 'success');
}

async function pasteImport() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    showToast('Clipboard access is not available here. Paste with Ctrl+V instead.', 'error');
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showToast('The clipboard is empty.', 'error');
      return;
    }
    state.importDraft = text;
    state.importPreview = null;
    state.importDirty = false;
    renderCurrentView();
    const textarea = document.getElementById('import-text');
    if (textarea) textarea.focus();
    showToast('Clipboard text pasted. Analyze it when ready.', 'success');
  } catch (error) {
    console.warn(error);
    showToast('Clipboard access was blocked. Paste with Ctrl+V instead.', 'error');
  }
}

function clearImportText() {
  state.importDraft = '';
  state.importPreview = null;
  state.importDirty = false;
  state.rawInput = '';
  persist();
  renderCurrentView();
  showToast('Import text cleared.', 'info');
}

async function applyImport() {
  if (!state.importPreview) return;
  if (state.importDirty) {
    showToast('Analyze the updated text before importing.', 'error');
    return;
  }
  const summary = summarizeSchedule(state.importPreview);

  if (state.importMode === 'replace' && hasAnyClasses()) {
    const ok = await askConfirm({
      eyebrow: 'Replace timetable',
      title: 'Replace the current week?',
      message: `The current timetable will be replaced with ${summary.classes} imported ${summary.classes === 1 ? 'class' : 'classes'}. This cannot be undone.`,
      confirmLabel: 'Replace timetable',
      danger: true
    });
    if (!ok) return;
  }

  state.schedule = state.importMode === 'merge'
    ? mergeSchedules(state.schedule, state.importPreview)
    : normalizeSchedule(state.importPreview);
  state.rawInput = state.importDraft;
  state.lastImportAt = Date.now();
  state.importPreview = null;
  state.importDirty = false;
  state.alertedPeriods.clear();
  state.timerModel = getTimerModel(new Date());
  persist();
  renderAll();
  showToast(`${summary.classes} ${summary.classes === 1 ? 'class' : 'classes'} imported.`, 'success');
  navigate('week');
}

/* --------------------------------------------------------------------------
   Class editor
   -------------------------------------------------------------------------- */

function openClassDialog(day, period, index) {
  const safeDay = APP_DAYS.includes(day) ? day : (APP_DAYS.includes(state.today) ? state.today : 'Monday');
  const safePeriod = APP_PERIODS.includes(period) ? period : '1';
  let mode = 'add';
  let original = null;
  let originalTitle = '';

  if (index !== null && index !== undefined) {
    original = (state.schedule[safePeriod] && state.schedule[safePeriod][safeDay]) ? state.schedule[safePeriod][safeDay][Number(index)] : null;
    if (!original) return;
    mode = 'edit';
    originalTitle = original.title;
  }

  const pendingColor = original ? getCourseColor(original.title) : getCourseColor('New class');
  state.classDialog = {
    mode,
    day: safeDay,
    period: safePeriod,
    index: mode === 'edit' ? Number(index) : null,
    title: original ? original.title : '',
    room: original ? original.room : '',
    teacher: original ? original.teacher : '',
    pendingColor,
    colorTouched: false,
    originalTitle
  };

  if (dom.classTitle) dom.classTitle.textContent = mode === 'edit' ? 'Edit class' : 'Add a class';
  if (dom.classEyebrow) dom.classEyebrow.textContent = `${safeDay} / ${periodLabel(safePeriod)}`;
  if (dom.classDelete) dom.classDelete.hidden = mode !== 'edit';
  if (dom.classSave) dom.classSave.textContent = mode === 'edit' ? 'Save changes' : 'Add class';
  if (dom.classBody) dom.classBody.innerHTML = renderClassDialog();

  if (!dom.classDialog.open) dom.classDialog.showModal();
  requestAnimationFrame(() => {
    const titleInput = document.getElementById('class-title');
    if (titleInput) titleInput.focus();
  });
}

function renderClassDialog() {
  const dialog = state.classDialog;
  if (!dialog) return '';
  const color = dialog.pendingColor;
  const colorName = getCourseColorName(color);
  const swatchCourse = dialog.title || '__new__';
  const teachers = Array.from(new Set(
    APP_PERIODS.flatMap(period => APP_DAYS.flatMap(day => ((state.schedule[period] && state.schedule[period][day]) || []).map(cls => cls.teacher)))
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  return `
    <div class="field-row">
      <div class="field">
        <label for="class-day">Day</label>
        <select class="input" id="class-day">
          ${APP_DAYS.map(day => `<option value="${day}" ${dialog.day === day ? 'selected' : ''}>${day}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="class-period">Period</label>
        <select class="input" id="class-period">
          ${APP_PERIODS.map(period => `<option value="${period}" ${dialog.period === period ? 'selected' : ''}>${periodLabel(period)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="field">
      <label for="class-title">Course title</label>
      <input class="input" id="class-title" data-class-title maxlength="80" value="${escapeAttr(dialog.title)}" placeholder="e.g. AP Biology" autocomplete="off">
      <div class="field-error" id="class-title-error" hidden></div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="class-room">Room</label>
        <input class="input" id="class-room" maxlength="32" value="${escapeAttr(dialog.room)}" placeholder="e.g. 204" autocomplete="off">
      </div>
      <div class="field">
        <label for="class-teacher">Teacher surname</label>
        <input class="input" id="class-teacher" maxlength="48" value="${escapeAttr(dialog.teacher)}" placeholder="Surname" autocomplete="off" list="teacher-surnames">
      </div>
    </div>
    <datalist id="teacher-surnames">
      ${teachers.map(name => `<option value="${escapeAttr(name)}"></option>`).join('')}
    </datalist>

    <div class="class-color-field">
      <div class="class-color-head">
        <span class="class-color-label">Course color</span>
        <span class="class-color-preview" data-class-color-preview style="--course-color:${escapeAttr(color)}">
          <span aria-hidden="true"></span>
          <em data-class-color-name style="font-style:normal;">${escapeHtml(colorName)}</em>
        </span>
      </div>
      <div class="swatches" data-swatch-course="${escapeAttr(swatchCourse)}">
        ${renderSwatches(color, 'data-action="pick-class-color"')}
        <label class="swatch swatch-custom" title="Custom color">
          <input type="color" value="${escapeAttr(color)}" data-class-custom-color aria-label="Custom course color">
        </label>
      </div>
    </div>
  `;
}

function renderSwatches(color, attrs) {
  return COLOR_SWATCHES.map(swatch => {
    const active = swatch.hex.toLowerCase() === String(color).toLowerCase();
    return `<button class="swatch${active ? ' is-active' : ''}" type="button" style="--swatch:${swatch.hex}" ${attrs} data-hex="${swatch.hex}" aria-label="${escapeAttr(swatch.name)}" aria-pressed="${active}" title="${escapeAttr(swatch.name)}"></button>`;
  }).join('');
}

function saveClass() {
  const dialog = state.classDialog;
  if (!dialog) return;

  const day = document.getElementById('class-day') ? document.getElementById('class-day').value : dialog.day;
  const period = document.getElementById('class-period') ? document.getElementById('class-period').value : dialog.period;
  const titleInput = document.getElementById('class-title');
  const title = titleInput ? titleInput.value.trim() : '';
  const error = document.getElementById('class-title-error');

  if (!title) {
    if (error) {
      error.textContent = 'Enter a course title.';
      error.hidden = false;
    }
    if (titleInput) {
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
    }
    return;
  }

  const room = document.getElementById('class-room') ? document.getElementById('class-room').value.trim() : '';
  let teacher = document.getElementById('class-teacher') ? document.getElementById('class-teacher').value.trim() : '';
  if (teacher) {
    teacher = typeof window.normalizeTeacherSurname === 'function'
      ? window.normalizeTeacherSurname(teacher)
      : (typeof window.formatTeacherLastName === 'function' ? window.formatTeacherLastName(teacher) : teacher);
  }

  const cls = { title, room, teacher };
  const targetDay = APP_DAYS.includes(day) ? day : dialog.day;
  const targetPeriod = APP_PERIODS.includes(period) ? period : dialog.period;
  const oldList = state.schedule[dialog.period][dialog.day];

  if (dialog.mode === 'edit' && dialog.day === targetDay && dialog.period === targetPeriod) {
    oldList[dialog.index] = cls;
  } else {
    if (dialog.mode === 'edit' && oldList[dialog.index]) oldList.splice(dialog.index, 1);
    state.schedule[targetPeriod][targetDay].push(cls);
  }

  if (dialog.pendingColor && (dialog.colorTouched || !state.colors[title])) {
    state.colors[title] = dialog.pendingColor;
  }
  persist();
  if (dom.classDialog.open) dom.classDialog.close();
  renderAll();
  showToast(`${title} ${dialog.mode === 'edit' ? 'updated' : 'added'} on ${shortDay(targetDay)}.`, 'success');
}

async function deleteClass() {
  const dialog = state.classDialog;
  if (!dialog || dialog.mode !== 'edit') return;
  const cls = state.schedule[dialog.period][dialog.day][dialog.index];
  if (!cls) return;

  const ok = await askConfirm({
    eyebrow: 'Timetable',
    title: 'Delete this class?',
    message: `${cls.title} will be removed from ${dialog.day}, ${periodLabel(dialog.period)}. This cannot be undone.`,
    confirmLabel: 'Delete class',
    danger: true
  });
  if (!ok) return;

  state.schedule[dialog.period][dialog.day].splice(dialog.index, 1);
  persist();
  if (dom.classDialog.open) dom.classDialog.close();
  renderAll();
  showToast(`${cls.title} removed.`, 'info');
}

/* --------------------------------------------------------------------------
   Settings
   -------------------------------------------------------------------------- */

function openSettings(target) {
  if (target) state.settingsSection = target;
  renderSettings();
  if (!dom.settingsDialog.open) dom.settingsDialog.showModal();
  requestAnimationFrame(() => scrollSettingsTo(`settings-${state.settingsSection || 'appearance'}`));
}

function renderSettings() {
  if (!dom.settingsBody) return;
  const permission = ('Notification' in window) ? Notification.permission : 'unsupported';
  const permissionLabel = permission === 'granted'
    ? 'Granted'
    : permission === 'denied'
      ? 'Blocked in the browser'
      : permission === 'unsupported'
        ? 'Not supported here'
        : 'Not requested yet';
  const permissionBadge = permission === 'granted'
    ? `<span class="badge badge-success">${icon('check')} Granted</span>`
    : `<button class="btn btn-outline btn-sm" type="button" data-action="request-notifications">${icon('bell')} Enable notifications</button>`;

  const themes = [
    { id: 'light', label: 'Light', icon: 'sun', colors: ['#fbf9f2', '#e8e3d4', '#c8f24a'] },
    { id: 'dark', label: 'Dark', icon: 'moon', colors: ['#141613', '#22251f', '#d7ff63'] },
    { id: 'system', label: 'System', icon: 'monitor', colors: ['#141613', '#f4f1e7', '#d7ff63'] }
  ];

  const courses = getCourses();
  const cloudUser = state.cloud.user;
  const cloudInitial = cloudUser && cloudUser.email ? cloudUser.email.charAt(0).toUpperCase() : '?';
  const cloudStatus = state.cloud.loading
    ? 'Connecting to Firebase...'
    : state.cloud.status === 'syncing'
      ? 'Syncing changes...'
      : state.cloud.status === 'error'
        ? 'The last sync did not finish.'
        : state.cloud.status === 'choice'
          ? 'A cloud copy is waiting for your decision.'
          : state.cloud.status === 'paused'
            ? 'Sync is paused. Use Sync now when ready.'
            : state.cloud.lastSync
              ? `Last synced ${formatRelativeTime(state.cloud.lastSync)}.`
              : 'Signed in. Changes sync automatically.';

  const courseColorList = courses.length
    ? `<div class="color-list">
        ${courses.map(course => {
          const color = getCourseColor(course.title);
          return `
            <div class="color-course">
              <div class="color-course-head">
                <span class="color-course-name">
                  <span class="color-course-dot" style="--course-color:${escapeAttr(color)}" data-color-dot-course="${escapeAttr(course.title)}"></span>
                  ${escapeHtml(course.title)}
                </span>
                <span class="color-course-count">${course.count} ${course.count === 1 ? 'slot' : 'slots'}</span>
              </div>
              <div class="swatches" data-swatch-course="${escapeAttr(course.title)}">
                ${renderSwatches(color, `data-action="set-course-color" data-course="${escapeAttr(course.title)}"`)}
                <label class="swatch swatch-custom" title="Custom color">
                  <input type="color" value="${escapeAttr(color)}" data-course-color-input data-course="${escapeAttr(course.title)}" aria-label="Custom color for ${escapeAttr(course.title)}">
                </label>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="data-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-action="reset-colors">${icon('refresh')} Reset course colors</button>
      </div>`
    : `<div class="color-empty">Import a schedule or add a class to unlock course colors.</div>`;

  dom.settingsBody.innerHTML = `
    <section class="settings-section" id="settings-appearance">
      <h3 class="settings-section-title">Appearance</h3>
      <p class="settings-section-copy">Choose how Chrono looks. System follows the device setting.</p>
      <div class="theme-options">
        ${themes.map(theme => `
          <button class="theme-card${state.theme === theme.id ? ' is-active' : ''}" type="button" data-action="set-theme" data-theme="${theme.id}" aria-pressed="${state.theme === theme.id}">
            <span class="theme-preview">${theme.colors.map(color => `<span style="background:${color}"></span>`).join('')}</span>
            <span style="display:inline-flex;align-items:center;gap:5px;">${icon(theme.icon)} ${theme.label}</span>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="settings-section" id="settings-bells">
      <h3 class="settings-section-title">Bells and alerts</h3>
      <p class="settings-section-copy">The live clock follows the selected schedule. Alerts fire once per class, two minutes before the bell.</p>
      <div class="setting-row">
        <div class="setting-row-copy">
          <div class="setting-row-title">Bell schedule</div>
          <div class="setting-row-desc">Full day ends at ${formatTime(BELL_SCHEDULE.full['9'][1])}. Half day ends at ${formatTime(BELL_SCHEDULE.half['9'][1])}.</div>
        </div>
        <div class="segmented" role="group" aria-label="Bell schedule">
          <button class="seg-btn" type="button" data-action="set-bell" data-bell="full" aria-pressed="${state.bellMode === 'full'}">Full day</button>
          <button class="seg-btn" type="button" data-action="set-bell" data-bell="half" aria-pressed="${state.bellMode === 'half'}">Half day</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-copy">
          <div class="setting-row-title">Two-minute chime</div>
          <div class="setting-row-desc">Play a soft two-note Web Audio chime before class ends.</div>
        </div>
        <label class="switch">
          <input type="checkbox" data-setting-alert="sound" ${state.alerts.sound ? 'checked' : ''} aria-label="Play a chime two minutes before class ends">
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="setting-row">
        <div class="setting-row-copy">
          <div class="setting-row-title">Desktop notification</div>
          <div class="setting-row-desc">Browser permission: ${permissionLabel}.</div>
        </div>
        <label class="switch">
          <input type="checkbox" data-setting-alert="desktop" ${state.alerts.desktop ? 'checked' : ''} aria-label="Show a desktop notification two minutes before class ends">
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="data-actions">
        ${permissionBadge}
        <button class="btn btn-ghost btn-sm" type="button" data-action="test-chime">${icon('volume')} Test chime</button>
      </div>
    </section>

    <section class="settings-section" id="settings-colors">
      <h3 class="settings-section-title">Course colors</h3>
      <p class="settings-section-copy">Click a swatch and the ring moves immediately. There is no save step. Colors apply to every class with the same title.</p>
      ${courseColorList}
    </section>

    <section class="settings-section" id="settings-cloud">
      <h3 class="settings-section-title">Cloud sync</h3>
      <p class="settings-section-copy">Optional. Chrono is fully local without an account. Signing in adds a second copy of the timetable, planner, colors, and bell mode through Firebase.</p>
      <div class="cloud-box">
        <div class="cloud-box-icon">${cloudUser ? `<span class="auth-avatar" style="width:32px;height:32px;font-size:12px;">${escapeHtml(cloudInitial)}</span>` : icon('sync')}</div>
        <div class="cloud-box-copy">
          <div class="cloud-box-title">${cloudUser ? escapeHtml(cloudUser.email || 'Signed in') : 'Local only'}</div>
          <div class="cloud-box-desc">${escapeHtml(cloudStatus)}</div>
        </div>
      </div>
      ${state.cloud.error ? `<div class="auth-error">${escapeHtml(state.cloud.error)}</div>` : ''}
      <div class="cloud-actions">
        ${cloudUser
          ? `<button class="btn btn-outline btn-sm" type="button" data-action="sync-now">${icon('sync')} Sync now</button>
             <button class="btn btn-ghost btn-sm" type="button" data-action="sign-out">${icon('log-out')} Sign out</button>`
          : `<button class="btn btn-primary btn-sm" type="button" data-action="open-auth">${icon('sync')} Sign in to sync</button>`}
      </div>
      <p class="auth-note">Firebase receives the timetable, planner, course colors, and bell mode only. Weather and faculty data never leave this browser.</p>
    </section>

    <section class="settings-section" id="settings-data">
      <h3 class="settings-section-title">Data and print</h3>
      <p class="settings-section-copy">Print a single US Letter portrait page with ten periods by five days, pure black lines, and no background fills. Planner items are never included.</p>
      <div class="setting-row">
        <div class="setting-row-copy">
          <div class="setting-row-title">Print the week</div>
          <div class="setting-row-desc">All classes stay visible in shared slots, separated by dashed dividers.</div>
        </div>
        <button class="btn btn-outline btn-sm" type="button" data-action="print">${icon('print')} Print</button>
      </div>
      <div class="setting-row">
        <div class="setting-row-copy">
          <div class="setting-row-title">Clear timetable</div>
          <div class="setting-row-desc">Removes every class and the saved import text. Course colors stay.</div>
        </div>
        <button class="btn btn-danger-ghost btn-sm" type="button" data-action="clear-timetable">${icon('trash')} Clear</button>
      </div>
      <div class="data-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-action="go-import">${icon('import')} Open importer</button>
      </div>
      <div class="import-note">
        ${state.lastImportAt ? `Last import ${escapeHtml(formatRelativeTime(state.lastImportAt))}.` : 'No import yet.'} Data is stored in this browser.
      </div>
    </section>
  `;

  syncThemeButtons();
  syncBellUI();
  syncColorDots();
  document.querySelectorAll('.settings-nav-link').forEach(link => {
    link.classList.toggle('is-active', link.dataset.scrollTo === `settings-${state.settingsSection}`);
  });
}

function scrollSettingsTo(id) {
  const section = document.getElementById(id);
  if (!section || !dom.settingsBody) return;
  const bodyRect = dom.settingsBody.getBoundingClientRect();
  const sectionRect = section.getBoundingClientRect();
  const top = dom.settingsBody.scrollTop + (sectionRect.top - bodyRect.top) - 12;
  dom.settingsBody.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  state.settingsSection = id.replace(/^settings-/, '');
  document.querySelectorAll('.settings-nav-link').forEach(link => {
    link.classList.toggle('is-active', link.dataset.scrollTo === id);
  });
}

function toggleAlert(key, enabled) {
  if (key !== 'sound' && key !== 'desktop') return;
  state.alerts[key] = !!enabled;
  persist();

  if (key === 'desktop' && enabled) {
    if (!('Notification' in window)) {
      state.alerts.desktop = false;
      persist();
      if (dom.settingsDialog.open) renderSettings();
      showToast('Desktop notifications are not supported in this browser.', 'error');
      return;
    }
    if (Notification.permission === 'denied') {
      state.alerts.desktop = false;
      persist();
      if (dom.settingsDialog.open) renderSettings();
      showToast('Notifications are blocked in the browser settings.', 'error');
      return;
    }
    if (Notification.permission === 'default') {
      requestNotificationPermission();
      return;
    }
  }

  if (dom.settingsDialog.open) renderSettings();
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    state.alerts.desktop = false;
    persist();
    if (dom.settingsDialog.open) renderSettings();
    showToast('Desktop notifications are not supported in this browser.', 'error');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    state.alerts.desktop = permission === 'granted';
    persist();
    if (dom.settingsDialog.open) renderSettings();
    if (permission === 'granted') showToast('Desktop notifications enabled.', 'success');
    else if (permission === 'denied') showToast('Notifications were blocked in the browser.', 'error');
    else showToast('Notification permission was not granted.', 'info');
  } catch (error) {
    console.warn(error);
    showToast('The browser could not request notification permission.', 'error');
  }
}

async function clearTimetable() {
  const ok = await askConfirm({
    eyebrow: 'Clear timetable',
    title: 'Remove every class?',
    message: 'The full week and saved import text will be cleared. Course colors, theme, and alert settings stay. This cannot be undone.',
    confirmLabel: 'Clear timetable',
    danger: true
  });
  if (!ok) return;

  state.schedule = createEmptySchedule();
  state.rawInput = '';
  state.importDraft = '';
  state.importPreview = null;
  state.importDirty = false;
  state.lastImportAt = null;
  state.alertedPeriods.clear();
  state.timerModel = getTimerModel(new Date());
  persist();
  renderAll();
  if (dom.settingsDialog.open) renderSettings();
  showToast('Timetable cleared.', 'info');
}

/* --------------------------------------------------------------------------
   Optional Firebase cloud sync
   -------------------------------------------------------------------------- */

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      if (existing.dataset.failed === 'true') {
        existing.remove();
        loadScriptOnce(src).then(resolve, reject);
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      script.dataset.failed = 'true';
      reject(new Error(`Could not load ${src}`));
    }, { once: true });
    document.head.appendChild(script);
  });
}

async function loadFirebase() {
  if (state.firebase) return state.firebase;
  if (state.cloud.firebasePromise) return state.cloud.firebasePromise;

  state.cloud.loading = true;
  state.cloud.error = null;
  if (dom.authDialog.open) renderAuthBody();
  if (dom.settingsDialog.open) renderSettings();

  state.cloud.firebasePromise = (async () => {
    try {
      if (!(window.firebase && window.firebase.auth && window.firebase.firestore)) {
        const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
        await loadScriptOnce(`${base}firebase-app-compat.js`);
        await loadScriptOnce(`${base}firebase-auth-compat.js`);
        await loadScriptOnce(`${base}firebase-firestore-compat.js`);
      }

      if (!window.firebase || !window.firebase.initializeApp) {
        throw new Error('Firebase did not initialize');
      }

      const app = (window.firebase.apps && window.firebase.apps.length)
        ? window.firebase.app()
        : window.firebase.initializeApp(FIREBASE_CONFIG);
      const auth = window.firebase.auth(app);
      const db = window.firebase.firestore(app);

      state.firebase = { app, auth, db };
      state.cloud.initialized = true;

      if (!state.cloud.listenerAttached) {
        auth.onAuthStateChanged(user => {
          handleAuthState(user).catch(error => console.warn('Auth state handling failed', error));
        });
        state.cloud.listenerAttached = true;
      }

      state.cloud.loading = false;
      if (dom.authDialog.open) renderAuthBody();
      if (dom.settingsDialog.open) renderSettings();
      return state.firebase;
    } catch (error) {
      console.warn('Firebase failed to load', error);
      state.cloud.loading = false;
      state.cloud.status = 'error';
      state.cloud.error = 'Cloud sync could not load. Check your connection and try again.';
      state.cloud.firebasePromise = null;
      if (dom.authDialog.open) renderAuthBody();
      if (dom.settingsDialog.open) renderSettings();
      throw error;
    }
  })();

  return state.cloud.firebasePromise;
}

async function handleAuthState(user) {
  state.cloud.user = user || null;

  if (!user) {
    state.cloud.status = 'local';
    state.cloud.lastSync = null;
    state.cloud.error = null;
    try { localStorage.removeItem(CLOUD_EMAIL_KEY); } catch (error) { /* storage can be unavailable */ }
    renderSyncStatus();
    if (dom.authDialog.open) renderAuthBody();
    if (dom.settingsDialog.open) renderSettings();
    return;
  }

  try { localStorage.setItem(CLOUD_EMAIL_KEY, user.email || ''); } catch (error) { /* storage can be unavailable */ }
  state.cloud.status = 'syncing';
  state.cloud.error = null;
  renderSyncStatus();
  if (dom.authDialog.open) renderAuthBody();
  if (dom.settingsDialog.open) renderSettings();
  await loadCloudSchedule(user);
}

async function loadCloudSchedule(user) {
  if (!state.firebase) return;

  try {
    const ref = state.firebase.db.collection('schedules').doc(user.uid);
    const doc = await ref.get();
    const cloudData = doc.exists ? doc.data() : null;
    const cloudSchedule = cloudData ? normalizeSchedule(cloudData.schedule) : null;
    const cloudPlanner = cloudData ? sanitizePlanner(cloudData.planner) : [];
    const cloudHasSchedule = cloudSchedule ? summarizeSchedule(cloudSchedule).classes > 0 : false;
    const localHasSchedule = hasAnyClasses();

    if (cloudHasSchedule && localHasSchedule) {
      const same = JSON.stringify(cloudSchedule) === JSON.stringify(state.schedule)
        && (cloudData.bellMode === 'half' ? 'half' : 'full') === state.bellMode
        && JSON.stringify(cloudPlanner) === JSON.stringify(state.planner);
      if (!same) {
        state.syncChoice = { cloudData };
        state.cloud.status = 'choice';
        renderSyncStatus();
        if (dom.settingsDialog.open) renderSettings();
        if (dom.authDialog.open) dom.authDialog.close();
        renderSyncChoice();
        if (!dom.syncChoiceDialog.open) dom.syncChoiceDialog.showModal();
        return;
      }
    }

    if (cloudHasSchedule && !localHasSchedule) {
      applyCloudData(cloudData, 'Cloud timetable loaded.');
      state.cloud.status = 'synced';
      state.cloud.lastSync = Date.now();
    } else if (!cloudHasSchedule) {
      await saveToCloud(false);
    } else {
      state.cloud.status = 'synced';
      state.cloud.lastSync = Date.now();
    }

    renderSyncStatus();
    if (dom.settingsDialog.open) renderSettings();
  } catch (error) {
    console.warn('Cloud schedule load failed', error);
    state.cloud.status = 'error';
    state.cloud.error = 'The cloud timetable could not be read. Your local copy is safe.';
    renderSyncStatus();
    if (dom.settingsDialog.open) renderSettings();
  }
}

function applyCloudData(data, message) {
  state.cloud.applying = true;
  state.schedule = normalizeSchedule(data.schedule);
  state.colors = sanitizeColors(data.colors);
  state.planner = sanitizePlanner(data.planner);
  state.bellMode = data.bellMode === 'half' ? 'half' : 'full';
  state.timerModel = getTimerModel(new Date());
  persist();
  state.cloud.applying = false;
  renderAll();
  if (dom.settingsDialog.open) renderSettings();
  if (message) showToast(message, 'success');
}

async function saveToCloud(manual) {
  if (!state.cloud.user || !state.firebase) {
    if (manual) openAuthDialog();
    return;
  }

  if (state.cloud.syncTimer) {
    clearTimeout(state.cloud.syncTimer);
    state.cloud.syncTimer = null;
  }

  state.cloud.status = 'syncing';
  state.cloud.error = null;
  renderSyncStatus();
  if (dom.settingsDialog.open) renderSettings();

  try {
    await state.firebase.db.collection('schedules').doc(state.cloud.user.uid).set({
      schedule: state.schedule,
      colors: state.colors,
      planner: state.planner,
      bellMode: state.bellMode,
      updatedAt: Date.now(),
      version: 2
    });
    state.cloud.status = 'synced';
    state.cloud.lastSync = Date.now();
    if (manual) showToast('Timetable synced to the cloud.', 'success');
  } catch (error) {
    console.warn('Cloud save failed', error);
    state.cloud.status = 'error';
    state.cloud.error = 'Cloud save failed. Your local copy is safe.';
    if (manual) showToast('Cloud save failed. The local copy is safe.', 'error');
  }

  renderSyncStatus();
  if (dom.settingsDialog.open) renderSettings();
}

function scheduleCloudSave() {
  if (!state.cloud.user || !state.firebase || state.cloud.applying) return;
  if (state.cloud.status === 'choice') return;
  if (state.cloud.syncTimer) clearTimeout(state.cloud.syncTimer);
  state.cloud.syncTimer = setTimeout(() => {
    state.cloud.syncTimer = null;
    saveToCloud(false);
  }, 1800);
}

function openAuthDialog() {
  if (!dom.authDialog) return;
  if (!dom.authDialog.open) dom.authDialog.showModal();
  renderAuthBody();
  if (!state.firebase && !state.cloud.firebasePromise) {
    loadFirebase().catch(() => {});
  }
}

function renderAuthBody() {
  if (!dom.authBody) return;

  if (state.cloud.loading) {
    dom.authBody.innerHTML = `<div class="empty-inline"><span class="boot-spinner" style="display:inline-block;margin-right:6px;vertical-align:-2px;"></span> Connecting to Firebase...</div>`;
    return;
  }

  if (state.cloud.user) {
    const email = state.cloud.user.email || 'Signed in';
    const initial = email.charAt(0).toUpperCase();
    const status = state.cloud.status === 'syncing'
      ? 'Syncing changes...'
      : state.cloud.status === 'error'
        ? 'The last sync did not finish.'
        : state.cloud.lastSync
          ? `Last synced ${formatRelativeTime(state.cloud.lastSync)}.`
          : 'Signed in. Changes sync automatically.';
    dom.authBody.innerHTML = `
      <div class="auth-user">
        <span class="auth-avatar">${escapeHtml(initial)}</span>
        <div class="auth-user-copy">
          <div class="auth-user-email">${escapeHtml(email)}</div>
          <div class="auth-user-status">${escapeHtml(status)}</div>
        </div>
      </div>
      ${state.cloud.error ? `<div class="auth-error">${escapeHtml(state.cloud.error)}</div>` : ''}
      <div class="cloud-actions">
        <button class="btn btn-primary" type="button" data-action="sync-now">${icon('sync')} Sync now</button>
        <button class="btn btn-ghost" type="button" data-action="sign-out">${icon('log-out')} Sign out</button>
      </div>
      <p class="auth-note">Signing out never removes the timetable from this device. The cloud copy stays in Firebase until you replace it.</p>
    `;
    return;
  }

  const mode = state.authMode === 'signup' ? 'signup' : 'signin';
  let savedEmail = '';
  try { savedEmail = localStorage.getItem(CLOUD_EMAIL_KEY) || ''; } catch (error) { savedEmail = ''; }

  dom.authBody.innerHTML = `
    <div class="auth-tabs" role="tablist" aria-label="Cloud account">
      <button class="auth-tab${mode === 'signin' ? ' is-active' : ''}" type="button" data-action="auth-tab" data-auth-mode="signin" role="tab" aria-selected="${mode === 'signin'}">Sign in</button>
      <button class="auth-tab${mode === 'signup' ? ' is-active' : ''}" type="button" data-action="auth-tab" data-auth-mode="signup" role="tab" aria-selected="${mode === 'signup'}">Create account</button>
    </div>
    ${state.cloud.error ? `<div class="auth-error">${escapeHtml(state.cloud.error)}</div>` : ''}
    <form id="auth-form" novalidate>
      <div class="field">
        <label for="auth-email">Email</label>
        <input class="input" id="auth-email" name="email" type="email" autocomplete="email" value="${escapeAttr(savedEmail)}" placeholder="you@example.com">
      </div>
      <div class="field">
        <label for="auth-password">Password</label>
        <input class="input" id="auth-password" name="password" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" placeholder="At least 6 characters">
      </div>
      <button class="btn btn-primary" type="submit" style="width:100%;">${mode === 'signup' ? 'Create account' : 'Sign in'}</button>
    </form>
    <div class="auth-divider">or</div>
    <button class="btn btn-outline" type="button" data-action="auth-google" style="width:100%;">${icon('globe')} Continue with Google</button>
    <p class="auth-note">Cloud sync is optional. The account stores only the timetable, planner, course colors, and bell mode. Your local copy keeps working without it.</p>
  `;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.target;
  if (!form || form.id !== 'auth-form') return;

  const emailInput = form.querySelector('#auth-email');
  const passwordInput = form.querySelector('#auth-password');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!email || !password) {
    state.cloud.error = 'Enter both an email address and a password.';
    renderAuthBody();
    return;
  }

  try {
    const firebaseApi = await loadFirebase();
    state.cloud.loading = true;
    state.cloud.error = null;
    renderAuthBody();

    if (state.authMode === 'signup') {
      await firebaseApi.auth.createUserWithEmailAndPassword(email, password);
    } else {
      await firebaseApi.auth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    console.warn('Cloud sign-in failed', error);
    state.cloud.error = friendlyAuthError(error);
  } finally {
    state.cloud.loading = false;
    if (dom.authDialog.open) renderAuthBody();
  }
}

function friendlyAuthError(error) {
  const code = String(error && error.code ? error.code : '');
  if (code.includes('email-already-in-use')) return 'An account already exists for that email. Try signing in.';
  if (code.includes('invalid-email')) return 'That email address is not valid.';
  if (code.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) return 'Email or password did not match.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a moment and try again.';
  if (code.includes('network-request-failed')) return 'The network request failed. Check your connection.';
  if (code.includes('popup-closed-by-user')) return 'The Google sign-in window was closed.';
  if (code.includes('operation-not-allowed')) return 'This sign-in method is not enabled in Firebase.';
  return 'Cloud sign-in failed. Try again.';
}

async function signInWithGoogle() {
  state.cloud.error = null;
  state.cloud.loading = true;
  renderAuthBody();

  try {
    const firebaseApi = await loadFirebase();
    const provider = new window.firebase.auth.GoogleAuthProvider();
    await firebaseApi.auth.signInWithPopup(provider);
  } catch (error) {
    console.warn('Google sign-in failed', error);
    state.cloud.error = friendlyAuthError(error);
  } finally {
    state.cloud.loading = false;
    if (dom.authDialog.open) renderAuthBody();
  }
}

async function signOutCloud() {
  if (!state.firebase) return;
  try {
    await state.firebase.auth.signOut();
  } catch (error) {
    console.warn('Sign out failed', error);
    showToast('Could not sign out. Try again.', 'error');
    return;
  }
  state.cloud.user = null;
  state.cloud.status = 'local';
  state.cloud.lastSync = null;
  state.cloud.error = null;
  try { localStorage.removeItem(CLOUD_EMAIL_KEY); } catch (error) { /* storage can be unavailable */ }
  renderSyncStatus();
  if (dom.authDialog.open) renderAuthBody();
  if (dom.settingsDialog.open) renderSettings();
  showToast('Signed out. The timetable stays on this device.', 'info');
}

function renderSyncChoice() {
  if (!dom.syncChoiceMessage) return;
  dom.syncChoiceMessage.textContent = 'This account already has a timetable. Choose which copy should stay. The copy you do not choose will be overwritten on the next sync.';
}

function useCloudCopy() {
  if (!state.syncChoice) return;
  const data = state.syncChoice.cloudData;
  state.syncChoice = null;
  if (dom.syncChoiceDialog.open) dom.syncChoiceDialog.close();
  applyCloudData(data, 'Cloud timetable loaded.');
  state.cloud.status = 'synced';
  state.cloud.lastSync = Date.now();
  renderSyncStatus();
  if (dom.settingsDialog.open) renderSettings();
}

function keepLocalCopy() {
  if (!state.syncChoice) return;
  state.syncChoice = null;
  if (dom.syncChoiceDialog.open) dom.syncChoiceDialog.close();
  state.cloud.status = 'syncing';
  renderSyncStatus();
  saveToCloud(true);
}

function closeSyncChoice() {
  state.syncChoice = null;
  if (dom.syncChoiceDialog.open) dom.syncChoiceDialog.close();
  state.cloud.status = 'paused';
  renderSyncStatus();
  if (dom.settingsDialog.open) renderSettings();
  showToast('Cloud sync paused. Choose Sync now when you are ready.', 'info');
}

/* --------------------------------------------------------------------------
   Confirmation dialog
   -------------------------------------------------------------------------- */

function askConfirm(options) {
  return new Promise(resolve => {
    state.confirmResolver = resolve;
    if (dom.confirmEyebrow) dom.confirmEyebrow.textContent = options.eyebrow || 'Please confirm';
    if (dom.confirmTitle) dom.confirmTitle.textContent = options.title || 'Confirm';
    if (dom.confirmMessage) dom.confirmMessage.textContent = options.message || '';
    if (dom.confirmOk) {
      dom.confirmOk.textContent = options.confirmLabel || 'Confirm';
      dom.confirmOk.className = options.danger ? 'btn btn-danger' : 'btn btn-primary';
    }
    if (!dom.confirmDialog.open) dom.confirmDialog.showModal();
    requestAnimationFrame(() => { if (dom.confirmOk) dom.confirmOk.focus(); });
  });
}

function resolveConfirm(value) {
  const resolve = state.confirmResolver;
  state.confirmResolver = null;
  if (dom.confirmDialog.open) dom.confirmDialog.close();
  if (resolve) resolve(value);
}

/* --------------------------------------------------------------------------
   Print
   -------------------------------------------------------------------------- */

function renderPrintSheet() {
  if (!dom.printRoot) return;
  const dates = getDisplayedWeekDates();
  const dateKeys = dates.map(getDateKey);
  const baseBell = BELL_SCHEDULE[state.bellMode];
  const summary = summarizeSchedule(state.schedule);
  const dense = summary.classes > 34;
  const halfDays = dates.filter((date, index) => getDateImpact(dateKeys[index]).halfDay).length;
  const noSchoolDays = dates.filter((date, index) => getDateImpact(dateKeys[index]).noSchool).length;
  const printedSummary = (() => {
    let classes = 0;
    const courses = new Set();
    APP_DAYS.forEach((day, index) => {
      if (getDateImpact(dateKeys[index]).noSchool) return;
      APP_PERIODS.forEach(period => {
        const list = (state.schedule[period] && state.schedule[period][day]) || [];
        classes += list.length;
        list.forEach(cls => {
          if (cls.title) courses.add(cls.title);
        });
      });
    });
    return { classes, courses: courses.size };
  })();
  const printBellLabel = noSchoolDays || halfDays
    ? [state.bellMode === 'half' ? 'Half day' : 'Full day', halfDays ? `${halfDays} half ${halfDays === 1 ? 'day' : 'days'}` : '', noSchoolDays ? `${noSchoolDays} no school` : ''].filter(Boolean).join(' / ')
    : bellModeLabel();

  const dayHeads = APP_DAYS.map((day, index) => {
    const dateKey = dateKeys[index];
    const impact = getDateImpact(dateKey);
    const note = impact.noSchool ? 'No school' : impact.halfDay ? 'Half day' : '';
    return `
      <th class="print-day${impact.noSchool ? ' print-day-off' : ''}${impact.halfDay ? ' print-day-half' : ''}">
        ${day}
        <br>
        <span style="font-weight:400;letter-spacing:0;text-transform:none;font-size:5.4pt;">${formatMonthDay(dates[index])}</span>
        ${note ? `<br><span class="print-day-note">${note}</span>` : ''}
      </th>
    `;
  }).join('');

  const rows = APP_PERIODS.map(period => {
    const [start, end] = baseBell[period];
    const cells = APP_DAYS.map((day, index) => {
      const dateKey = dateKeys[index];
      const impact = getDateImpact(dateKey);
      if (impact.noSchool) {
        return `<td class="print-off">${period === '1' ? '<div class="print-empty print-off-mark">No school</div>' : ''}</td>`;
      }
      const bell = getBellForDate(dateKey);
      const [cellStart, cellEnd] = bell[period];
      const classes = (state.schedule[period] && state.schedule[period][day]) || [];
      const content = classes.length
        ? classes.map(cls => `
            <div class="print-class">
              <div class="print-class-title">${escapeHtml(cls.title)}</div>
              ${(cls.room || cls.teacher) ? `<div class="print-class-meta">${[cls.room, cls.teacher].filter(Boolean).map(escapeHtml).join(' / ')}</div>` : ''}
            </div>
          `).join('')
        : '<div class="print-empty">Open</div>';
      return `<td class="${impact.halfDay ? 'print-half-day' : ''}">${impact.halfDay ? `<div class="print-cell-time">${formatTime(cellStart)} - ${formatTime(cellEnd)}</div>` : ''}${content}</td>`;
    }).join('');

    return `
      <tr>
        <td class="print-period">
          <div class="print-period-id">${period === 'HR' ? 'HR' : `P${period}`}</div>
          <div class="print-period-time">${formatTime(start)}<br>${formatTime(end)}</div>
        </td>
        ${cells}
      </tr>
    `;
  }).join('');

  dom.printRoot.innerHTML = `
    <div class="print-sheet${dense ? ' print-dense' : ''}">
      <div class="print-head">
        <div>
          <div class="print-title">BCA Chrono / Weekly timetable</div>
          <div class="print-sub">Bergen County Academies / Hackensack, NJ</div>
        </div>
        <div class="print-meta">
          <strong>${printBellLabel}</strong><br>
          ${formatWeekRange(dates)}<br>
          Printed ${formatMonthDay(state.now)}
        </div>
      </div>
      <table class="print-table">
        <thead>
          <tr>
            <th class="print-corner">Period</th>
            ${dayHeads}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="print-foot">
        <span>${printedSummary.classes}${printedSummary.classes !== summary.classes ? ` of ${summary.classes}` : ''} ${summary.classes === 1 ? 'class' : 'classes'} / ${printedSummary.courses} ${printedSummary.courses === 1 ? 'course' : 'courses'}</span>
        <span>BCA Chrono</span>
      </div>
    </div>
  `;
}

function printSchedule() {
  renderPrintSheet();
  setTimeout(() => window.print(), 30);
}

/* --------------------------------------------------------------------------
   Live data
   -------------------------------------------------------------------------- */

async function loadWeather() {
  if (state.weatherLoading) return;
  state.weatherLoading = true;
  state.weatherError = null;
  if (state.route === 'today') renderCurrentView();

  try {
    const result = await fetchWeather();
    state.weather = result.data;
    state.weatherFetchedAt = result.fetchedAt;
    state.weatherError = null;
    writeCache(WEATHER_CACHE_KEY, result.data, result.fetchedAt);
  } catch (error) {
    console.warn('Weather load failed', error);
    state.weatherError = state.weather
      ? 'Live weather is unavailable. Showing the last saved reading.'
      : 'Weather could not be loaded. Check your connection and try again.';
  } finally {
    state.weatherLoading = false;
    if (state.route === 'today') renderCurrentView();
  }
}

async function loadAbsences() {
  if (state.absencesLoading) return;
  const startedAt = Date.now();
  state.absencesLoading = true;
  state.absencesError = null;
  if (state.route === 'today' || state.route === 'week' || state.route === 'faculty') renderCurrentView();

  try {
    const result = await fetchAbsences();
    if (state.absencesFetchedAt && state.absencesFetchedAt > startedAt) {
      return;
    }
    state.absences = result.absences;
    state.absencesFetchedAt = result.fetchedAt;
    state.absencesError = null;
    writeCache(ABSENCES_CACHE_KEY, { absences: result.absences }, result.fetchedAt);
  } catch (error) {
    console.warn('Absences load failed', error);
    state.absencesError = state.absences.length || state.absencesFetchedAt
      ? 'The faculty sheet could not be reached. Showing the last saved roster.'
      : 'The faculty sheet could not be reached. Check your connection and try again.';
  } finally {
    state.absencesLoading = false;
    if (state.route === 'today' || state.route === 'week' || state.route === 'faculty') renderCurrentView();
  }
}

/* --------------------------------------------------------------------------
   Toasts
   -------------------------------------------------------------------------- */

function showToast(message, type) {
  if (!dom.toastRegion) return;
  while (dom.toastRegion.children.length >= 4) {
    dom.toastRegion.firstElementChild.remove();
  }
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : ''}`;
  toast.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info')}<span>${escapeHtml(message)}</span>`;
  dom.toastRegion.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 220);
  }, 4200);
}

/* --------------------------------------------------------------------------
   Events
   -------------------------------------------------------------------------- */

function bindEvents() {
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('input', handleDocumentInput);
  document.addEventListener('change', handleDocumentChange);

  if (dom.classForm) {
    dom.classForm.addEventListener('submit', event => {
      event.preventDefault();
      saveClass();
    });
  }

  if (dom.plannerForm) {
    dom.plannerForm.addEventListener('submit', event => {
      event.preventDefault();
      savePlannerItem();
    });
  }

  if (dom.authBody) {
    dom.authBody.addEventListener('submit', handleAuthSubmit);
  }

  [dom.settingsDialog, dom.classDialog, dom.plannerDialog, dom.plannerImportDialog, dom.authDialog, dom.syncChoiceDialog, dom.confirmDialog].forEach(dialog => {
    if (!dialog) return;
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });

  if (dom.classDialog) {
    dom.classDialog.addEventListener('close', () => { state.classDialog = null; });
  }

  if (dom.plannerDialog) {
    dom.plannerDialog.addEventListener('close', () => { state.plannerDialog = null; });
  }

  if (dom.plannerImportDialog) {
    dom.plannerImportDialog.addEventListener('close', () => {
      if (dom.plannerImportText) state.plannerImportDraft = dom.plannerImportText.value;
    });
  }

  if (dom.confirmDialog) {
    dom.confirmDialog.addEventListener('close', () => {
      const resolve = state.confirmResolver;
      state.confirmResolver = null;
      if (resolve) resolve(false);
    });
  }

  if (dom.syncChoiceDialog) {
    dom.syncChoiceDialog.addEventListener('close', () => {
      if (!state.syncChoice) return;
      state.syncChoice = null;
      if (state.cloud.user && state.cloud.status === 'choice') {
        state.cloud.status = 'paused';
        renderSyncStatus();
        if (dom.settingsDialog.open) renderSettings();
      }
    });
  }

  window.addEventListener('beforeprint', renderPrintSheet);
  window.addEventListener('online', () => {
    if (state.weatherError) loadWeather();
    if (state.absencesError) loadAbsences();
  });

  // Browsers only unlock audio after a gesture. Prime the context quietly so
  // the two-minute chime can fire while the tab is in the background.
  const primeAudio = () => {
    if (!state.alerts.sound) return;
    let context;
    try {
      context = ensureAudioContext();
    } catch (error) {
      console.warn(error);
      return;
    }
    if (context && context.state !== 'suspended') {
      document.removeEventListener('pointerdown', primeAudio, true);
      document.removeEventListener('keydown', primeAudio, true);
    }
  };
  document.addEventListener('pointerdown', primeAudio, true);
  document.addEventListener('keydown', primeAudio, true);
}

function handleDocumentClick(event) {
  const origin = event.target instanceof Element ? event.target : null;
  if (!origin) return;

  const settingsNav = origin.closest('[data-scroll-to]');
  if (settingsNav && dom.settingsDialog && dom.settingsDialog.open) {
    event.preventDefault();
    scrollSettingsTo(settingsNav.dataset.scrollTo);
    return;
  }

  const target = origin.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'set-theme':
      setTheme(target.dataset.theme);
      break;
    case 'open-settings':
      openSettings(target.dataset.settingsTarget);
      break;
    case 'close-settings':
      if (dom.settingsDialog.open) dom.settingsDialog.close();
      break;
    case 'set-bell':
      setBellMode(target.dataset.bell);
      break;
    case 'print':
      printSchedule();
      break;
    case 'refresh-weather':
      loadWeather();
      break;
    case 'refresh-absences':
      loadAbsences();
      break;
    case 'go-import':
      navigate('import');
      break;
    case 'go-week':
      resetWeek();
      navigate('week');
      break;
    case 'go-planner':
      navigate('planner');
      break;
    case 'go-month':
      resetMonth();
      navigate('month');
      break;
    case 'go-faculty':
      navigate('faculty');
      break;
    case 'go-today':
      navigate('today');
      break;
    case 'week-prev':
      shiftWeek(-1);
      break;
    case 'week-next':
      shiftWeek(1);
      break;
    case 'week-today':
      resetWeek();
      break;
    case 'month-prev':
      shiftMonth(-1);
      break;
    case 'month-next':
      shiftMonth(1);
      break;
    case 'month-today':
      resetMonth();
      break;
    case 'add-planner':
      openPlannerDialog(null, { date: target.dataset.date });
      break;
    case 'edit-planner':
      openPlannerDialog(target.dataset.id);
      break;
    case 'delete-planner':
      deletePlannerItem();
      break;
    case 'close-planner-dialog':
      if (dom.plannerDialog.open) dom.plannerDialog.close();
      break;
    case 'toggle-planner-done':
      togglePlannerDone(target.dataset.id);
      break;
    case 'filter-planner':
      filterPlanner(target.dataset.kind);
      break;
    case 'toggle-planner-done-filter':
      togglePlannerDoneFilter();
      break;
    case 'open-planner-import':
      openPlannerImport();
      break;
    case 'close-planner-import':
      closePlannerImport();
      break;
    case 'import-planner':
      importPlannerItems();
      break;
    case 'paste-planner-clipboard':
      pastePlannerClipboard();
      break;
    case 'add-class':
      openClassDialog(target.dataset.day, target.dataset.period, null);
      break;
    case 'edit-class':
      openClassDialog(target.dataset.day, target.dataset.period, Number(target.dataset.index));
      break;
    case 'close-class-dialog':
      if (dom.classDialog.open) dom.classDialog.close();
      break;
    case 'delete-class':
      deleteClass();
      break;
    case 'pick-class-color':
      updatePendingColor(target.dataset.hex);
      break;
    case 'set-course-color':
      setCourseColor(target.dataset.course, target.dataset.hex);
      break;
    case 'reset-colors':
      state.colors = {};
      persist();
      renderCurrentView();
      if (dom.settingsDialog.open) renderSettings();
      showToast('Course colors reset.', 'info');
      break;
    case 'analyze-import':
      analyzeImport();
      break;
    case 'paste-clipboard':
      pasteImport();
      break;
    case 'clear-import-text':
      clearImportText();
      break;
    case 'apply-import':
      applyImport();
      break;
    case 'filter-faculty':
      if (target.dataset.scope) filterFaculty('scope', target.dataset.scope);
      else if (target.dataset.type) filterFaculty('type', target.dataset.type);
      break;
    case 'reset-faculty-filters':
      resetFacultyFilters();
      break;
    case 'clear-timetable':
      clearTimetable();
      break;
    case 'test-chime':
      if (!ensureAudioContext()) {
        showToast('Web Audio is not available in this browser.', 'error');
      } else {
        playChime();
        showToast('Chime test played. If you heard nothing, check your volume.', 'info');
      }
      break;
    case 'request-notifications':
      requestNotificationPermission();
      break;
    case 'open-auth':
      openAuthDialog();
      break;
    case 'close-auth':
      if (dom.authDialog.open) dom.authDialog.close();
      break;
    case 'auth-tab':
      state.authMode = target.dataset.authMode === 'signup' ? 'signup' : 'signin';
      state.cloud.error = null;
      renderAuthBody();
      requestAnimationFrame(() => {
        const email = document.getElementById('auth-email');
        if (email) email.focus();
      });
      break;
    case 'auth-google':
      signInWithGoogle();
      break;
    case 'sign-out':
      signOutCloud();
      break;
    case 'sync-now':
      saveToCloud(true);
      break;
    case 'close-sync-choice':
      closeSyncChoice();
      break;
    case 'sync-use-cloud':
      useCloudCopy();
      break;
    case 'sync-use-local':
      keepLocalCopy();
      break;
    case 'confirm-ok':
      resolveConfirm(true);
      break;
    case 'confirm-cancel':
      resolveConfirm(false);
      break;
    default:
      break;
  }
}

function handleDocumentInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

  if (target.matches('[data-faculty-search]')) {
    state.facultyFilter.query = target.value;
    renderFacultyResults();
    return;
  }

  if (target.matches('[data-import-text]')) {
    state.importDraft = target.value;
    markImportDirty();
    return;
  }

  if (target.matches('[data-planner-import-text]')) {
    state.plannerImportDraft = target.value;
    renderPlannerImportPreview();
    return;
  }

  if (target.matches('[data-planner-title]')) {
    const error = document.getElementById('planner-title-error');
    if (error) error.hidden = true;
    target.removeAttribute('aria-invalid');
    return;
  }

  if (target.matches('#planner-date')) {
    const error = document.getElementById('planner-date-error');
    if (error) error.hidden = true;
    return;
  }

  if (target.matches('[data-class-title]')) {
    const error = document.getElementById('class-title-error');
    if (error) error.hidden = true;
    target.removeAttribute('aria-invalid');
    if (state.classDialog) {
      state.classDialog.title = target.value;
      const group = document.querySelector('.class-color-field .swatches');
      if (group) group.dataset.swatchCourse = target.value || '__new__';
      if (!state.classDialog.colorTouched) {
        const nextColor = getCourseColor(target.value.trim() || 'New class');
        state.classDialog.pendingColor = nextColor;
        const preview = document.querySelector('[data-class-color-preview]');
        if (preview) preview.style.setProperty('--course-color', nextColor);
        const label = document.querySelector('[data-class-color-name]');
        if (label) label.textContent = getCourseColorName(nextColor);
        const custom = document.querySelector('[data-class-custom-color]');
        if (custom) custom.value = nextColor;
        syncSwatchGroups(target.value || '__new__', nextColor);
      }
    }
    return;
  }

  if (target.matches('[data-class-custom-color]')) {
    updatePendingColor(target.value);
    return;
  }

  if (target.matches('[data-course-color-input]')) {
    setCourseColor(target.dataset.course, target.value);
  }
}

function handleDocumentChange(event) {
  const target = event.target;

  if (target.matches('[data-setting-alert]')) {
    toggleAlert(target.dataset.settingAlert, target.checked);
    return;
  }

  if (target.matches('[data-import-mode]')) {
    state.importMode = target.value === 'merge' ? 'merge' : 'replace';
    const submit = document.querySelector('[data-import-submit]');
    if (submit) submit.innerHTML = `${icon('download')} ${state.importMode === 'merge' ? 'Merge schedule' : 'Replace timetable'}`;
    return;
  }

  if (target.matches('[data-course-color-input]')) {
    setCourseColor(target.dataset.course, target.value);
  }
}

/* --------------------------------------------------------------------------
   Debug API and boot
   -------------------------------------------------------------------------- */

function exposeDebugApi() {
  window.BCAChrono = {
    state,
    getTimerModel,
    renderAll,
    renderCurrentView,
    loadWeather,
    loadAbsences,
    printSchedule,
    openClassDialog,
    openSettings,
    openPlannerDialog,
    openPlannerImport,
    parsePlannerImport,
    getDateImpact,
    getDisplayedWeekDates,
    getDisplayedMonthAnchor,
    getPlannerItemsForDate,
    getNextSchoolDay,
    shiftWeek,
    shiftMonth,
    resetWeek,
    resetMonth,
    getScheduleSummary: () => summarizeSchedule(state.schedule),
    parsePowerSchoolText: window.parsePowerSchoolText,
    extractAbsences: window.extractAbsences,
    absencesAffectingSchedule: window.absencesAffectingSchedule
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

