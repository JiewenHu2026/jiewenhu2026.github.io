(() => {
  'use strict';

  const TIME_ZONE = 'America/New_York';
  const LATITUDE = 39.9526;
  const LONGITUDE = -75.1652;
  const MINUTE = 60_000;
  const DAY = 86_400_000;
  const radians = (degrees) => degrees * Math.PI / 180;
  const degrees = (angle) => angle * 180 / Math.PI;
  let dateFormatter;
  let timeFormatter;
  let cachedDate;
  let cachedSun;
  let timer;

  try {
    dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true
    });
  } catch {
    dateFormatter = undefined;
    timeFormatter = undefined;
    // A small fallback for browsers without named-zone Intl data; current US
    // DST rules have applied since 2007. Normal browsers use the IANA zone above.
  }

  function philadelphiaDate(now) {
    if (dateFormatter) {
      return Object.fromEntries(dateFormatter.formatToParts(now)
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value }) => [type, Number(value)]));
    }
    const year = now.getUTCFullYear();
    const marchSunday = 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7;
    const novemberSunday = 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7;
    const summer = year >= 2007
      && now.getTime() >= Date.UTC(year, 2, marchSunday, 7)
      && now.getTime() < Date.UTC(year, 10, novemberSunday, 6);
    const local = new Date(now.getTime() - (summer ? 4 : 5) * 60 * MINUTE);
    return {
      year: local.getUTCFullYear(), month: local.getUTCMonth() + 1,
      day: local.getUTCDate(), hour: local.getUTCHours(),
      minute: local.getUTCMinutes(), zone: summer ? 'EDT' : 'EST'
    };
  }

  // NOAA's Meeus-based solar equations, with a 90.833-degree zenith for
  // apparent sunrise/sunset (solar disk and standard atmospheric refraction).
  // This is sunrise-to-sunset daylight, rather than the civil-twilight interval.
  // https://gml.noaa.gov/grad/solcalc/calcdetails.html
  // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  // Terrain and weather can shift observed times; no network requests are made.
  function solarCoordinates(julianDay) {
    const t = (julianDay - 2451545) / 36525;
    const longitude = radians((280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360);
    const anomaly = radians(357.52911 + t * (35999.05029 - 0.0001537 * t));
    const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const center = Math.sin(anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t))
      + Math.sin(2 * anomaly) * (0.019993 - 0.000101 * t)
      + Math.sin(3 * anomaly) * 0.000289;
    const omega = radians(125.04 - 1934.136 * t);
    const apparentLongitude = longitude + radians(center - 0.00569 - 0.00478 * Math.sin(omega));
    const obliquity = radians(23 + (26 + (21.448 - t * (46.815
      + t * (0.00059 - 0.001813 * t))) / 60) / 60 + 0.00256 * Math.cos(omega));
    const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));
    const y = Math.tan(obliquity / 2) ** 2;
    const equationOfTime = 4 * degrees(y * Math.sin(2 * longitude)
      - 2 * eccentricity * Math.sin(anomaly)
      + 4 * eccentricity * y * Math.sin(anomaly) * Math.cos(2 * longitude)
      - 0.5 * y * y * Math.sin(4 * longitude)
      - 1.25 * eccentricity * eccentricity * Math.sin(2 * anomaly));
    return { declination, equationOfTime };
  }

  function sunTimes({ year, month, day }) {
    const midnight = Date.UTC(year, month - 1, day);
    const julianDay = midnight / DAY + 2440587.5;
    const latitude = radians(LATITUDE);
    const event = (direction) => {
      let minutes = 720 - 4 * LONGITUDE;
      // Refine coordinates at the event's UTC instant, including UTC dates
      // after midnight (Philadelphia summer sunsets can fall on the next day).
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const { declination, equationOfTime } = solarCoordinates(julianDay + minutes / 1440);
        const cosine = Math.cos(radians(90.833)) / (Math.cos(latitude) * Math.cos(declination))
          - Math.tan(latitude) * Math.tan(declination);
        if (cosine < -1 || cosine > 1) return NaN;
        const hourAngle = degrees(Math.acos(cosine));
        minutes = 720 - 4 * LONGITUDE + direction * 4 * hourAngle - equationOfTime;
      }
      return Math.round(midnight + minutes * MINUTE);
    };
    return { sunrise: event(-1), sunset: event(1) };
  }

  function refresh() {
    const now = new Date();
    const local = philadelphiaDate(now);
    const dateKey = `${local.year}-${local.month}-${local.day}`;
    if (dateKey !== cachedDate) {
      cachedDate = dateKey;
      cachedSun = sunTimes(local);
    }
    const { sunrise, sunset } = cachedSun;
    const validSun = Number.isFinite(sunrise) && Number.isFinite(sunset);
    const daylight = validSun ? now.getTime() >= sunrise && now.getTime() < sunset
      : local.hour >= 7 && local.hour < 18;

    // Runs immediately when included in <head>, before the first page paint.
    document.documentElement.dataset.theme = daylight ? 'day' : 'night';
    const themeColor = document.querySelector?.('meta[name="theme-color"]');
    if (themeColor) themeColor.content = daylight ? '#ffffff' : '#000000';

    const time = document.getElementById('philadelphia-clock-time');
    const period = document.getElementById('philadelphia-clock-period');
    const pad = (value) => String(value).padStart(2, '0');
    if (time) {
      const label = timeFormatter ? timeFormatter.format(now)
        : `${local.hour % 12 || 12}:${pad(local.minute)} ${local.hour < 12 ? 'AM' : 'PM'}`;
      // Keep the real instant in machine-readable UTC. Updating text only when
      // changed avoids unnecessary announcements; markup should use aria-live=off.
      if (time.textContent !== label) time.textContent = label;
      time.dateTime = now.toISOString();
    }
    if (period) {
      const label = daylight ? 'Daylight' : 'Nighttime';
      if (period.textContent !== label) period.textContent = label;
    }
    if (time && period) {
      const clock = document.getElementById('philadelphia-clock');
      if (clock) clock.hidden = false;
    }

    clearTimeout(timer);
    if (!document.hidden) {
      let delay = MINUTE - now.getTime() % MINUTE;
      const transition = [sunrise, sunset].find((instant) => instant > now.getTime());
      if (Number.isFinite(transition)) delay = Math.min(delay, transition - now.getTime() + 25);
      timer = setTimeout(refresh, Math.max(25, delay));
    }
  }

  refresh();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else refresh();
  });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('pagehide', () => clearTimeout(timer));
})();
