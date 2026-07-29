import axios from 'axios';

/** Dallas / Frisco-area fallback matching the Open-Meteo sample forecast URL. */
export const DEFAULT_WEATHER_COORDS = {
  latitude: 32.7767,
  longitude: -96.797,
} as const;

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 15000;

export type WeatherCondition = 'clear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export type WeatherSnapshot = {
  temperatureF: number;
  apparentTemperatureF: number | null;
  weatherCode: number;
  condition: WeatherCondition;
};

type OpenMeteoForecastResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
  };
};

export function weatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0) {
    return 'clear';
  }
  if (code === 1 || code === 2) {
    return 'partlyCloudy';
  }
  if (code === 3) {
    return 'cloudy';
  }
  if (code === 45 || code === 48) {
    return 'fog';
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return 'snow';
  }
  if (code >= 95) {
    return 'storm';
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return 'rain';
  }
  return 'partlyCloudy';
}

export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot> {
  const { data } = await axios.get<OpenMeteoForecastResponse>(OPEN_METEO_FORECAST_URL, {
    timeout: REQUEST_TIMEOUT_MS,
    params: {
      latitude,
      longitude,
      current: 'temperature_2m,apparent_temperature,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      temperature_unit: 'fahrenheit',
      timezone: 'America/Chicago',
      forecast_days: 7,
    },
  });

  const current = data.current;
  const temperature = Number(current?.temperature_2m);
  if (!Number.isFinite(temperature)) {
    throw new Error('Weather response missing temperature.');
  }

  const weatherCode = Number(current?.weather_code ?? 0);
  const apparent = Number(current?.apparent_temperature);

  return {
    temperatureF: Math.round(temperature),
    apparentTemperatureF: Number.isFinite(apparent) ? Math.round(apparent) : null,
    weatherCode: Number.isFinite(weatherCode) ? weatherCode : 0,
    condition: weatherCodeToCondition(Number.isFinite(weatherCode) ? weatherCode : 0),
  };
}
