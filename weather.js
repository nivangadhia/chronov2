// --- BCA Chrono: Weather Engine (Open-Meteo) ---
// Bergen County Academies, Hackensack, NJ
// Lat 40.8859, Lon -74.0435, TZ America/New_York

const WEATHER_CONFIG = {
  latitude: 40.8859,
  longitude: -74.0435,
  timezone: 'America/New_York',
  current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min',
  temperatureUnit: 'fahrenheit',
  windSpeedUnit: 'mph'
};

const WMO_CODES = {
  0: { label: 'Clear', icon: 'clear' },
  1: { label: 'Mainly clear', icon: 'partly-cloudy-day' },
  2: { label: 'Partly cloudy', icon: 'partly-cloudy-day' },
  3: { label: 'Overcast', icon: 'cloudy' },
  45: { label: 'Fog', icon: 'fog' },
  48: { label: 'Depositing rime fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'rain' },
  53: { label: 'Moderate drizzle', icon: 'rain' },
  55: { label: 'Dense drizzle', icon: 'rain' },
  56: { label: 'Light freezing drizzle', icon: 'sleet' },
  57: { label: 'Dense freezing drizzle', icon: 'sleet' },
  61: { label: 'Slight rain', icon: 'rain' },
  63: { label: 'Moderate rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  66: { label: 'Light freezing rain', icon: 'sleet' },
  67: { label: 'Heavy freezing rain', icon: 'sleet' },
  71: { label: 'Slight snow', icon: 'snow' },
  73: { label: 'Moderate snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Slight rain showers', icon: 'rain' },
  81: { label: 'Moderate rain showers', icon: 'rain' },
  82: { label: 'Violent rain showers', icon: 'rain' },
  85: { label: 'Slight snow showers', icon: 'snow' },
  86: { label: 'Heavy snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'thunderstorm' },
  96: { label: 'Thunderstorm with hail', icon: 'thunderstorm' },
  99: { label: 'Thunderstorm with heavy hail', icon: 'thunderstorm' }
};

function weatherEscapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function weatherIcon(code, isDay) {
  const info = WMO_CODES[code] || WMO_CODES[0];
  const day = isDay !== 0 && isDay !== false;
  let type;
  switch (info.icon) {
    case 'clear': type = day ? 'sun' : 'moon'; break;
    case 'partly-cloudy-day': type = day ? 'cloud-sun' : 'cloud-moon'; break;
    case 'cloudy': type = 'cloud'; break;
    case 'fog': type = 'fog'; break;
    case 'rain': type = 'rain'; break;
    case 'sleet': type = 'sleet'; break;
    case 'snow': type = 'snow'; break;
    case 'thunderstorm': type = 'thunderstorm'; break;
    default: type = 'sun';
  }
  return buildWeatherSVG(type);
}

function buildWeatherSVG(type) {
  const open = '<svg class="weather-icon weather-' + type + '" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

  const sun = `
    <circle class="wi-sun" cx="32" cy="32" r="9.5" stroke="none"/>
    <path class="wi-ray" d="M32 13v5M32 46v5M13 32h5M46 32h5M18.6 18.6l3.5 3.5M41.9 41.9l3.5 3.5M45.4 18.6l-3.5 3.5M22.1 41.9l-3.5 3.5"/>`;
  const moon = `
    <path d="M42.5 37.8A14.5 14.5 0 0 1 25.9 21a14.6 14.6 0 1 0 16.6 16.8Z" fill="currentColor" stroke="none" opacity=".9"/>
    <path d="M17 18h.01M22 24h.01M46 44h.01" stroke="currentColor" stroke-width="2.4"/>`;
  const cloud = `
    <path class="wi-cloud" d="M18.5 43.5h26a8 8 0 0 0 .6-15.9A12.2 12.2 0 0 0 21.2 24a9.6 9.6 0 0 0-2.7 19.5Z"/>`;
  const cloudSun = `
    <g opacity=".95">
      <circle class="wi-sun" cx="41" cy="22" r="6.5" stroke="none"/>
      <path class="wi-ray" d="M41 9v4M41 31v4M28 22h4M50 22h4M32 13l2.8 2.8M47.2 28.2 50 31M50 13l-2.8 2.8M34.8 28.2 32 31"/>
    </g>
    ${cloud}`;
  const cloudMoon = `
    <path d="M47.5 28.5A8.5 8.5 0 0 1 37.7 18.7a8.6 8.6 0 1 0 9.8 9.8Z" fill="currentColor" stroke="none" opacity=".9"/>
    ${cloud}`;
  const rain = `
    ${cloud}
    <path class="wi-rain" d="M23 49.5 20.5 56M32 49.5 29.5 56M41 49.5 38.5 56"/>`;
  const snow = `
    ${cloud}
    <g class="wi-snow">
      <path d="M23 49v7M20 51l6 3M26 51l-6 3"/>
      <path d="M41 49v7M38 51l6 3M44 51l-6 3"/>
    </g>`;
  const sleet = `
    ${cloud}
    <path class="wi-rain" d="M22 50.5 19.5 56M42 50.5 39.5 56"/>
    <path class="wi-snow" d="M31.5 51v5M29 53.5h5"/>`;
  const fog = `
    <path class="wi-fog" d="M17 25h30M13 33h38M19 41h26M16 49h32"/>`;
  const thunderstorm = `
    ${cloud}
    <path class="wi-bolt" d="M34.5 44 27 55h7l-2 6 9.5-12h-7l3-5Z"/>`;

  const parts = { sun, moon, cloud, 'cloud-sun': cloudSun, 'cloud-moon': cloudMoon, rain, snow, sleet, fog, thunderstorm };
  return open + (parts[type] || sun) + '</svg>';
}

function weatherDescription(code) {
  return WMO_CODES[code] ? WMO_CODES[code].label : 'Clear';
}

function buildWeatherUrl() {
  const params = [
    ['latitude', WEATHER_CONFIG.latitude],
    ['longitude', WEATHER_CONFIG.longitude],
    ['current', WEATHER_CONFIG.current],
    ['daily', WEATHER_CONFIG.daily],
    ['temperature_unit', WEATHER_CONFIG.temperatureUnit],
    ['wind_speed_unit', WEATHER_CONFIG.windSpeedUnit],
    ['timezone', WEATHER_CONFIG.timezone]
  ];
  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value)).replace(/%2C/gi, ',')}`)
    .join('&');
  return `https://api.open-meteo.com/v1/forecast?${query}`;
}

function normalizeWeather(data) {
  const cur = (data && data.current) || {};
  const daily = (data && data.daily) || {};
  if (typeof cur.temperature_2m !== 'number') {
    throw new Error('Weather response did not include a current temperature');
  }
  const code = cur.weather_code !== undefined ? cur.weather_code : (daily.weather_code && daily.weather_code[0]) || 0;
  const isDay = cur.is_day !== undefined ? cur.is_day === 1 : true;
  const high = daily.temperature_2m_max && daily.temperature_2m_max[0] !== undefined ? Math.round(daily.temperature_2m_max[0]) : null;
  const low = daily.temperature_2m_min && daily.temperature_2m_min[0] !== undefined ? Math.round(daily.temperature_2m_min[0]) : null;

  return {
    temperature: Math.round(cur.temperature_2m),
    feelsLike: Math.round(cur.apparent_temperature !== undefined ? cur.apparent_temperature : cur.temperature_2m),
    humidity: Math.round(cur.relative_humidity_2m !== undefined ? cur.relative_humidity_2m : 0),
    windSpeed: Math.round(cur.wind_speed_10m !== undefined ? cur.wind_speed_10m : 0),
    precipitation: cur.precipitation !== undefined ? cur.precipitation : 0,
    condition: weatherDescription(code),
    iconCode: code,
    isDay,
    svg: weatherIcon(code, isDay ? 1 : 0),
    high,
    low,
    observedAt: cur.time || null
  };
}

async function fetchWeather() {
  const res = await fetch(buildWeatherUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Weather request failed with status ${res.status}`);
  const data = await res.json();
  return { data: normalizeWeather(data), fetchedAt: Date.now() };
}

if (typeof window !== 'undefined') {
  window.fetchWeather = fetchWeather;
  window.normalizeWeather = normalizeWeather;
  window.weatherIcon = weatherIcon;
  window.weatherDescription = weatherDescription;
  window.buildWeatherUrl = buildWeatherUrl;
  window.WEATHER_CONFIG = WEATHER_CONFIG;
  window.WMO_CODES = WMO_CODES;
}
