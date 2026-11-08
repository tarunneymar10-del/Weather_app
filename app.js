// Weather data: Open-Meteo (free, no API key). Needs an internet connection.
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WX_URL = "https://api.open-meteo.com/v1/forecast";

// WMO weather codes -> label + background theme
const CODES = {
  0: ["Clear sky", "clear"], 1: ["Mostly clear", "clear"], 2: ["Partly cloudy", "cloudy"],
  3: ["Overcast", "cloudy"], 45: ["Fog", "fog"], 48: ["Freezing fog", "fog"],
  51: ["Light drizzle", "rain"], 53: ["Drizzle", "rain"], 55: ["Heavy drizzle", "rain"],
  56: ["Freezing drizzle", "rain"], 57: ["Freezing drizzle", "rain"],
  61: ["Light rain", "rain"], 63: ["Rain", "rain"], 65: ["Heavy rain", "rain"],
  66: ["Freezing rain", "rain"], 67: ["Freezing rain", "rain"],
  71: ["Light snow", "snow"], 73: ["Snow", "snow"], 75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"], 80: ["Rain showers", "rain"], 81: ["Rain showers", "rain"],
  82: ["Heavy showers", "rain"], 85: ["Snow showers", "snow"], 86: ["Snow showers", "snow"],
  95: ["Thunderstorm", "storm"], 96: ["Thunderstorm with hail", "storm"], 99: ["Thunderstorm with hail", "storm"],
};

const $ = (id) => document.getElementById(id);
let state = { data: null, place: "", unit: "C" };

try { state.unit = localStorage.getItem("unit") || "C"; } catch (e) {}

const toUnit = (c) => Math.round(state.unit === "C" ? c : c * 9 / 5 + 32);
const label = (code) => (CODES[code] || ["Unknown", "cloudy"]);

function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.className = isError ? "error" : "";
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed (" + res.status + ")");
  return res.json();
}

async function searchCity(name) {
  setStatus("Searching…");
  const geo = await getJSON(`${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
  if (!geo.results || !geo.results.length) throw new Error(`No city found for “${name}”. Check the spelling and try again.`);
  const r = geo.results[0];
  const place = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
  await loadWeather(r.latitude, r.longitude, place);
}

async function loadWeather(lat, lon, place) {
  setStatus("Loading weather…");
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: "auto", forecast_days: 7,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
  });
  state.data = await getJSON(`${WX_URL}?${params}`);
  state.place = place;
  render();
  setStatus("");
}

function render() {
  const { current: c, daily: d } = state.data;
  const [text, sky] = label(c.weather_code);

  document.body.dataset.sky = sky === "clear" ? (c.is_day ? "clear-day" : "clear-night") : sky;
  $("place").textContent = state.place;
  $("condition").textContent = text;
  $("temp").textContent = `${toUnit(c.temperature_2m)}°`;
  $("feels").textContent = `${toUnit(c.apparent_temperature)}°`;
  $("humidity").textContent = `${c.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  $("unit").textContent = state.unit === "C" ? "Switch to °F" : "Switch to °C";

  const list = $("forecast");
  list.innerHTML = "";
  d.time.forEach((day, i) => {
    const li = document.createElement("li");
    const name = i === 0 ? "Today" : new Date(day + "T12:00").toLocaleDateString(undefined, { weekday: "short" });
    li.innerHTML = `<span></span><span></span><span><span class="low"></span><span class="hi"></span></span>`;
    li.children[0].textContent = name;
    li.children[1].textContent = label(d.weather_code[i])[0];
    li.querySelector(".low").textContent = `${toUnit(d.temperature_2m_min[i])}°`;
    li.querySelector(".hi").textContent = `${toUnit(d.temperature_2m_max[i])}°`;
    list.appendChild(li);
  });

  $("current").hidden = false;
  $("forecast-wrap").hidden = false;
}

function fail(err) {
  setStatus(err.message || "Something went wrong. Check your connection and try again.", true);
}

$("search").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("q").value.trim();
  if (!q) return setStatus("Enter a city name to search.", true);
  searchCity(q).catch(fail);
});

$("locate").addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Your browser doesn’t support location. Search for a city instead.", true);
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude, "Your location").catch(fail),
    () => setStatus("Location access was denied. Search for a city instead.", true)
  );
});

$("unit").addEventListener("click", () => {
  state.unit = state.unit === "C" ? "F" : "C";
  try { localStorage.setItem("unit", state.unit); } catch (e) {}
  if (state.data) render();
});

// Start with a default city so the page isn't empty
searchCity("London").catch(fail);
