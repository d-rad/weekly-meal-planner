// ── WeatherTab ──────────────────────────────────────────────────────────────
// Uses the browser's Geolocation API to get coordinates, then fetches a 7-day
// forecast from Open-Meteo (free, no API key required).
//
// Module-level cache survives tab switches (component unmount/remount).
// On remount within 15 min, cached data is loaded into state immediately
// without making a new API call.

const WEATHER_FIFTEEN_MIN  = 15 * 60 * 1000;
let weatherLastFetched     = null;   // ms timestamp of last successful fetch
let weatherCachedCoords    = null;   // { latitude, longitude }
let weatherCachedForecast  = null;   // data.daily object
let weatherCachedLocation  = '';     // city name string

function WeatherTab() {
  const [forecast, setForecast]         = React.useState(weatherCachedForecast);
  const [locationName, setLocationName] = React.useState(weatherCachedLocation);
  const [loading, setLoading]           = React.useState(!weatherCachedForecast);
  const [error, setError]               = React.useState(null);

  // WMO weather-code → human label + emoji
  const weatherCodeInfo = (code) => {
    if (code === 0)                   return { label: 'Clear Sky',     emoji: '☀️' };
    if (code === 1)                   return { label: 'Mainly Clear',  emoji: '🌤️' };
    if (code === 2)                   return { label: 'Partly Cloudy', emoji: '⛅' };
    if (code === 3)                   return { label: 'Overcast',      emoji: '☁️' };
    if ([45,48].includes(code))       return { label: 'Foggy',         emoji: '🌫️' };
    if ([51,53,55].includes(code))    return { label: 'Drizzle',       emoji: '🌦️' };
    if ([61,63,65].includes(code))    return { label: 'Rain',          emoji: '🌧️' };
    if ([71,73,75,77].includes(code)) return { label: 'Snow',          emoji: '❄️' };
    if ([80,81,82].includes(code))    return { label: 'Rain Showers',  emoji: '🌧️' };
    if ([85,86].includes(code))       return { label: 'Snow Showers',  emoji: '🌨️' };
    if ([95,96,99].includes(code))    return { label: 'Thunderstorm',  emoji: '⛈️' };
    return { label: 'Unknown', emoji: '🌡️' };
  };

  const dayLabel = (dateStr, index) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const data = await res.json();
      const addr = data.address || {};
      return addr.city || addr.town || addr.village || addr.county || 'Your Location';
    } catch {
      return 'Your Location';
    }
  };

  const fetchWeather = async (lat, lon) => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    return res.json();
  };

  React.useEffect(() => {
    const now = Date.now();

    // Within cooldown AND we have cached data → restore it, nothing else to do
    if (weatherLastFetched && now - weatherLastFetched < WEATHER_FIFTEEN_MIN) {
      if (weatherCachedForecast) {
        setForecast(weatherCachedForecast);
        setLocationName(weatherCachedLocation);
        setLoading(false);
      }
      return;
    }

    // Need a fresh fetch
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    const getCoords = () =>
      new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );

    (async () => {
      try {
        let coords = weatherCachedCoords;
        if (!coords) {
          const pos = await getCoords();
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          weatherCachedCoords = coords;
        }

        const { latitude, longitude } = coords;
        const [data, name] = await Promise.all([
          fetchWeather(latitude, longitude),
          reverseGeocode(latitude, longitude),
        ]);

        // Update module-level cache
        weatherCachedForecast = data.daily;
        weatherCachedLocation = name;
        weatherLastFetched    = Date.now();

        setForecast(data.daily);
        setLocationName(name);
      } catch (e) {
        setError(
          e.code === 1
            ? 'Location access was denied. Please allow location access and refresh.'
            : 'Could not load weather data. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const containerStyle = {
    minHeight: '100%',
    padding: '24px 16px',
    background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)',
    boxSizing: 'border-box',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    maxWidth: '1100px',
    margin: '0 auto',
  };

  const cardBase = {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  };

  const todayCard = {
    ...cardBase,
    background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    color: 'white',
    gridColumn: 'span 2',
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#0ea5e9' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌍</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Fetching your forecast…</div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>Allow location access if prompted</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: 'white', borderRadius: 16, padding: 32, textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: 400,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, color: '#ef4444', fontWeight: 600 }}>{error}</div>
        </div>
      </div>
    );
  }

  const days = forecast.time;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#0c4a6e', letterSpacing: '-0.5px' }}>
          📍 {locationName}
        </p>
      </div>

      {/* Cards grid */}
      <div style={gridStyle}>
        {days.map((date, i) => {
          const { label, emoji } = weatherCodeInfo(forecast.weathercode[i]);
          const hi   = Math.round(forecast.temperature_2m_max[i]);
          const lo   = Math.round(forecast.temperature_2m_min[i]);
          const rain = forecast.precipitation_sum[i]?.toFixed(2) ?? '0.00';
          const pop  = forecast.precipitation_probability_max[i] ?? 0;
          const wind = Math.round(forecast.windspeed_10m_max[i]);
          const isToday = i === 0;

          const card       = isToday ? todayCard : cardBase;
          const textColor  = isToday ? 'rgba(255,255,255,0.85)' : '#64748b';
          const labelColor = isToday ? 'white' : '#1e293b';

          return (
            <div key={date} style={card}>
              <div style={{ fontSize: isToday ? 18 : 15, fontWeight: 700, color: labelColor }}>
                {dayLabel(date, i)}
              </div>
              {isToday && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: -6 }}>{date}</div>
              )}
              <div style={{ fontSize: isToday ? 56 : 44, lineHeight: 1, margin: '4px 0' }}>{emoji}</div>
              <div style={{ fontSize: isToday ? 16 : 14, fontWeight: 600, color: labelColor }}>{label}</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontSize: isToday ? 22 : 18, fontWeight: 700, color: isToday ? 'white' : '#f97316' }}>
                  {hi}°F
                </span>
                <span style={{ fontSize: isToday ? 16 : 14, fontWeight: 700, color: isToday ? 'rgba(255,255,255,0.85)' : '#1d4ed8' }}>
                  / {lo}°F
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span title="Chance of precipitation" style={{ fontSize: isToday ? 16 : 14, fontWeight: 600, color: isToday ? 'rgba(255,255,255,0.9)' : '#0369a1' }}>🌂 {pop}%</span>
                <span title="Precipitation amount"    style={{ fontSize: isToday ? 16 : 14, fontWeight: 600, color: isToday ? 'rgba(255,255,255,0.9)' : '#0369a1' }}>💧 {rain}"</span>
                <span title="Max wind speed"          style={{ fontSize: 12, color: textColor }}>💨 {wind} mph</span>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 28 }}>
        Data from <a href="https://open-meteo.com/" target="_blank" rel="noopener" style={{ color: '#0ea5e9' }}>Open-Meteo</a> · Updates on tab activation (15-min cooldown)
      </p>
    </div>
  );
}
