import { db } from "../../database/firebase.js";

import {
  ref,
  get,
  set,
  update
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("/admin/login.html");
}

const $ = id => document.getElementById(id);

const form = $("toko-form");
const nameInput = $("nama-toko");
const mapElement = $("location-map");
const selectLocationButton = $("select-location-button");
const latitudeInput = $("latitude");
const longitudeInput = $("longitude");
const locationTypeInput = $("jenis-lokasi");
const provinceInput = $("provinsi");
const cityInput = $("kota");
const postalCodeInput = $("kode-pos");
const addressInput = $("detail-alamat");
const branchWrapper = $("branch-wrapper");
const addBranchButton = $("add-branch-button");
const ownerEmailInput = $("owner-email");
const ownerPhoneInput = $("owner-phone");
const managerEmailInput = $("manager-email");
const managerPhoneInput = $("manager-phone");
const restaurantPhoneInput = $("restaurant-phone");
const saveButton = $("save-toko-button");

let savedData = {};
let map;
let marker;
let leafletReady = false;
let isSaving = false;
let isLoading = true;
let hasChanges = false;
let branches = [];

const STORE_PATH = "store";

function popup(message, title = "Informasi", confirmMode = false) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:999999;display:flex;
      align-items:center;justify-content:center;padding:20px;
      background:rgba(0,0,0,.4);backdrop-filter:blur(3px);
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
      width:100%;max-width:370px;padding:24px 22px 20px;
      border-radius:15px;background:#fff;box-shadow:0 15px 50px rgba(0,0,0,.15);
      font-family:"DM Sans",sans-serif;text-align:center;
    `;

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.cssText = "margin:0;color:#38251d;font-size:17px;font-weight:800";

    const description = document.createElement("p");
    description.textContent = message;
    description.style.cssText = "margin:12px 0 22px;color:#777;font-size:13px;line-height:1.6";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:9px";

    const makeButton = (text, background, color, value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.style.cssText = `
        flex:1;min-height:42px;border:0;border-radius:9px;
        background:${background};color:${color};font-family:inherit;
        font-size:12px;font-weight:700;cursor:pointer;
      `;
      button.addEventListener("click", () => {
        overlay.remove();
        resolve(value);
      });
      return button;
    };

    if (confirmMode) {
      actions.append(
        makeButton("Batal", "#eee", "#555", false),
        makeButton("Ya, lanjutkan", "#38251d", "#fff", true)
      );
    } else {
      actions.append(makeButton("Mengerti", "#38251d", "#fff", true));
    }

    dialog.append(heading, description, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function normalizePhone(value) {
  return String(value || "").replace(/[\s()-]/g, "");
}

function validPhone(value, required = false) {
  const phone = normalizePhone(value);
  if (!phone) return !required;
  return /^\+628[0-9]{7,12}$/.test(phone);
}

function validEmail(value, required = false) {
  const email = String(value || "").trim();
  if (!email) return !required;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function addressComplete() {
  return Boolean(
    latitudeInput.value &&
    longitudeInput.value &&
    locationTypeInput.value &&
    provinceInput.value &&
    cityInput.value &&
    postalCodeInput.value.trim() &&
    addressInput.value.trim()
  );
}

function updateBranchVisibility() {
  if (!branchWrapper) return;
  branchWrapper.hidden = !addressComplete();
}

function updateSaveButton() {
  if (!saveButton) return;

  const valid =
    nameInput?.value.trim() &&
    addressComplete() &&
    validEmail(ownerEmailInput?.value, true) &&
    validPhone(ownerPhoneInput?.value, true) &&
    validEmail(managerEmailInput?.value) &&
    validPhone(managerPhoneInput?.value) &&
    validPhone(restaurantPhoneInput?.value);

  saveButton.disabled = !valid || isSaving || isLoading || !hasChanges;
}

function markChanged() {
  if (isLoading) return;
  hasChanges = true;
  updateBranchVisibility();
  updateSaveButton();
}

function setButtonLoading(loading) {
  if (!saveButton) return;
  if (loading) {
    saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Menyimpan...</span>';
  } else {
    saveButton.innerHTML = '<i class="fa-solid fa-check"></i><span>Simpan Perubahan</span>';
  }
}

async function loadLeaflet() {
  if (window.L) return;

  if (!document.querySelector('link[data-leaflet="true"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.dataset.leaflet = "true";
    document.head.appendChild(link);
  }

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-leaflet="true"]');

    if (existing) {
      if (window.L) return resolve();
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.dataset.leaflet = "true";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function showMapPlaceholder(message = "Pilih titik lokasi toko pada peta") {
  if (!mapElement) return;
  mapElement.innerHTML = `
    <div class="map-placeholder">
      <i class="fa-solid fa-map-location-dot"></i>
      <span>${escapeHTML(message)}</span>
    </div>
  `;
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=id`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Reverse geocoding gagal:", error);
    return null;
  }
}

function fillAddressFromGeocode(result) {
  if (!result?.address) return;

  const data = result.address;
  const province = data.state || data.province || "";
  const city =
    data.city ||
    data.town ||
    data.municipality ||
    data.county ||
    data.regency ||
    "";

  if (province) {
    provinceInput.value = province;
    provinceInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (city) {
    cityInput.value = city;
    cityInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const postcode = data.postcode || "";
  if (postcode) postalCodeInput.value = postcode;

  const detail = [
    data.road,
    data.house_number,
    data.neighbourhood,
    data.suburb,
    data.village,
    data.hamlet
  ].filter(Boolean).join(", ");

  if (detail) addressInput.value = detail;

  markChanged();
}

async function setSelectedLocation(lat, lng, reverse = true) {
  latitudeInput.value = Number(lat).toFixed(7);
  longitudeInput.value = Number(lng).toFixed(7);

  if (map && window.L) {
    const position = [Number(lat), Number(lng)];
    if (marker) marker.setLatLng(position);
    else marker = window.L.marker(position).addTo(map);
    map.setView(position, 16);
  }

  markChanged();

  if (reverse) {
    if (selectLocationButton) {
      selectLocationButton.disabled = true;
      selectLocationButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Mengambil detail lokasi...</span>';
    }

    const result = await reverseGeocode(lat, lng);
    fillAddressFromGeocode(result);

    if (selectLocationButton) {
      selectLocationButton.disabled = false;
      selectLocationButton.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i><span>Tentukan titik lokasi toko</span>';
    }
  }
}

async function initializeMap() {
  if (!mapElement) return;

  showMapPlaceholder("Memuat peta...");

  try {
    await loadLeaflet();
    mapElement.innerHTML = "";
    mapElement.style.display = "block";

    const defaultLat = Number(latitudeInput.value) || -6.200000;
    const defaultLng = Number(longitudeInput.value) || 106.816666;

    map = window.L.map(mapElement).setView([defaultLat, defaultLng], 12);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(map);

    if (latitudeInput.value && longitudeInput.value) {
      marker = window.L.marker([defaultLat, defaultLng]).addTo(map);
    }

    map.on("click", event => {
      setSelectedLocation(event.latlng.lat, event.latlng.lng, true);
    });

    leafletReady = true;
    setTimeout(() => map.invalidateSize(), 250);
  } catch (error) {
    console.error("Peta gagal dimuat:", error);
    showMapPlaceholder("Peta gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.");
  }
}

async function requestCurrentLocation() {
  if (!navigator.geolocation) {
    await popup("Browser ini tidak mendukung akses lokasi.");
    return;
  }

  if (selectLocationButton) {
    selectLocationButton.disabled = true;
    selectLocationButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Mencari lokasi...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      await setSelectedLocation(
        position.coords.latitude,
        position.coords.longitude,
        true
      );

      if (selectLocationButton) {
        selectLocationButton.disabled = false;
        selectLocationButton.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i><span>Tentukan titik lokasi toko</span>';
      }
    },
    async error => {
      const messages = {
        1: "Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini atau pilih titik langsung pada peta.",
        2: "Lokasi tidak dapat ditemukan. Coba pilih titik langsung pada peta.",
        3: "Permintaan lokasi terlalu lama. Silakan coba lagi."
      };

      await popup(messages[error.code] || "Gagal mendapatkan lokasi perangkat.");

      if (selectLocationButton) {
        selectLocationButton.disabled = false;
        selectLocationButton.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i><span>Tentukan titik lokasi toko</span>';
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

async function loadProvinces() {
  if (!provinceInput) return;

  try {
    const response = await fetch("https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json");
    if (!response.ok) throw new Error("Gagal mengambil daftar provinsi");

    const provinces = await response.json();
    const current = provinceInput.value;

    provinceInput.innerHTML = '<option value="">Pilih provinsi</option>';

    provinces.forEach(province => {
      const option = document.createElement("option");
      option.value = province.name;
      option.dataset.id = province.id;
      option.textContent = province.name;
      provinceInput.appendChild(option);
    });

    if (current) {
      const match = Array.from(provinceInput.options).find(option =>
        option.value.toLowerCase() === current.toLowerCase()
      );
      if (match) provinceInput.value = match.value;
    }
  } catch (error) {
    console.error("Gagal memuat provinsi:", error);
    provinceInput.innerHTML = '<option value="">Gagal memuat provinsi</option>';
  }
}

async function loadCities(provinceName, selectedCity = "") {
  if (!cityInput) return;

  const provinceOption = Array.from(provinceInput.options).find(option =>
    option.value === provinceName
  );

  const provinceId = provinceOption?.dataset.id;

  cityInput.disabled = true;
  cityInput.innerHTML = '<option value="">Memuat kota/kabupaten...</option>';

  if (!provinceId) {
    cityInput.innerHTML = '<option value="">Pilih provinsi terlebih dahulu</option>';
    cityInput.disabled = false;
    return;
  }

  try {
    const response = await fetch(
      `https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${encodeURIComponent(provinceId)}.json`
    );
    if (!response.ok) throw new Error("Gagal mengambil daftar kota");

    const cities = await response.json();
    cityInput.innerHTML = '<option value="">Pilih kota/kabupaten</option>';

    cities.forEach(city => {
      const option = document.createElement("option");
      option.value = city.name;
      option.textContent = city.name;
      cityInput.appendChild(option);
    });

    if (selectedCity) {
      const match = Array.from(cityInput.options).find(option =>
        option.value.toLowerCase() === selectedCity.toLowerCase()
      );
      if (match) cityInput.value = match.value;
    }
  } catch (error) {
    console.error("Gagal memuat kota:", error);
    cityInput.innerHTML = '<option value="">Gagal memuat kota/kabupaten</option>';
  } finally {
    cityInput.disabled = false;
  }
}
