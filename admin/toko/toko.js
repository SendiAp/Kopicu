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
const districtInput = $("kecamatan");
const villageInput = $("kelurahan");
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
    districtInput.value &&
    villageInput.value &&
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

    map.getContainer().style.position = "relative";
    map.getContainer().style.zIndex = "0";
    mapElement.style.position = "relative";
    mapElement.style.zIndex = "0";
    
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

async function loadCities(provinceName, selectedCity = "", selectedDistrict = "", selectedVillage = "") {
  const provinceOption = Array.from(provinceInput.options).find(option =>
    option.value === provinceName
  );

  const provinceId = provinceOption?.dataset.id;

  cityInput.disabled = true;
  cityInput.innerHTML = '<option value="">Memuat kota/kabupaten...</option>';

  districtInput.disabled = true;
  districtInput.innerHTML = '<option value="">Pilih kota terlebih dahulu</option>';

  villageInput.disabled = true;
  villageInput.innerHTML = '<option value="">Pilih kecamatan terlebih dahulu</option>';

  if (!provinceId) {
    cityInput.innerHTML = '<option value="">Pilih provinsi terlebih dahulu</option>';
    cityInput.disabled = false;
    return;
  }

  try {
    const response = await fetch(
      `https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provinceId}.json`
    );

    if (!response.ok) throw new Error("Gagal mengambil kota");

    const cities = await response.json();

    cityInput.innerHTML = '<option value="">Pilih kota/kabupaten</option>';

    cities.forEach(city => {
      const option = document.createElement("option");
      option.value = city.name;
      option.textContent = city.name;
      option.dataset.id = city.id;
      cityInput.appendChild(option);
    });

    if (selectedCity) {
      const match = Array.from(cityInput.options).find(option =>
        normalizeText(option.value) === normalizeText(selectedCity)
      );

      if (match) {
        cityInput.value = match.value;

        await loadDistricts(
          match.value,
          selectedDistrict,
          selectedVillage
        );
      }
    }
  } catch (error) {
    console.error("Gagal memuat kota:", error);
    cityInput.innerHTML = '<option value="">Gagal memuat kota</option>';
  } finally {
    cityInput.disabled = false;
  }
}

async function loadDistricts(cityName, selectedDistrict = "", selectedVillage = "") {
  const cityOption = Array.from(cityInput.options).find(option =>
    option.value === cityName
  );

  const cityId = cityOption?.dataset.id;

  districtInput.disabled = true;
  districtInput.innerHTML = '<option value="">Memuat kecamatan...</option>';

  villageInput.disabled = true;
  villageInput.innerHTML = '<option value="">Pilih kecamatan terlebih dahulu</option>';

  if (!cityId) {
    districtInput.innerHTML = '<option value="">Pilih kota terlebih dahulu</option>';
    districtInput.disabled = false;
    return;
  }

  try {
    const response = await fetch(
      `https://www.emsifa.com/api-wilayah-indonesia/api/districts/${cityId}.json`
    );

    if (!response.ok) throw new Error("Gagal mengambil kecamatan");

    const districts = await response.json();

    districtInput.innerHTML = '<option value="">Pilih kecamatan</option>';

    districts.forEach(district => {
      const option = document.createElement("option");
      option.value = district.name;
      option.textContent = district.name;
      option.dataset.id = district.id;
      districtInput.appendChild(option);
    });

    if (selectedDistrict) {
      const match = Array.from(districtInput.options).find(option =>
        normalizeText(option.value) === normalizeText(selectedDistrict)
      );

      if (match) {
        districtInput.value = match.value;
        await loadVillages(match.value, selectedVillage);
      }
    }
  } catch (error) {
    console.error("Gagal memuat kecamatan:", error);
    districtInput.innerHTML = '<option value="">Gagal memuat kecamatan</option>';
  } finally {
    districtInput.disabled = false;
  }
}

async function loadVillages(districtName, selectedVillage = "") {
  const districtOption = Array.from(districtInput.options).find(option =>
    option.value === districtName
  );

  const districtId = districtOption?.dataset.id;

  villageInput.disabled = true;
  villageInput.innerHTML = '<option value="">Memuat kelurahan/desa...</option>';

  if (!districtId) {
    villageInput.innerHTML = '<option value="">Pilih kecamatan terlebih dahulu</option>';
    villageInput.disabled = false;
    return;
  }

  try {
    const response = await fetch(
      `https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`
    );

    if (!response.ok) throw new Error("Gagal mengambil kelurahan");

    const villages = await response.json();

    villageInput.innerHTML = '<option value="">Pilih kelurahan/desa</option>';

    villages.forEach(village => {
      const option = document.createElement("option");
      option.value = village.name;
      option.textContent = village.name;
      villageInput.appendChild(option);
    });

    if (selectedVillage) {
      const match = Array.from(villageInput.options).find(option =>
        normalizeText(option.value) === normalizeText(selectedVillage)
      );

      if (match) villageInput.value = match.value;
    }
  } catch (error) {
    console.error("Gagal memuat kelurahan:", error);
    villageInput.innerHTML = '<option value="">Gagal memuat kelurahan</option>';
  } finally {
    villageInput.disabled = false;
  }
}

async function selectProvinceAndCity(
  provinceName,
  cityName,
  districtName = "",
  villageName = ""
) {
  if (!provinceName) return;

  const provinceMatch = Array.from(provinceInput.options).find(option =>
    normalizeText(option.value) === normalizeText(provinceName)
  );

  if (!provinceMatch) return;

  provinceInput.value = provinceMatch.value;

  await loadCities(
    provinceMatch.value,
    cityName,
    districtName,
    villageName
  );
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^(kota|kabupaten)\s+/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function collectOpeningHours() {
  const result = {};

  document.querySelectorAll("[data-day]").forEach(row => {
    const day = row.dataset.day;
    const closed = row.querySelector('[data-field="closed"]')?.checked || false;
    const open = row.querySelector('[data-field="open"]')?.value || "";
    const close = row.querySelector('[data-field="close"]')?.value || "";

    result[day] = {
      closed,
      open: closed ? "" : open,
      close: closed ? "" : close
    };
  });

  return result;
}

function applyOpeningHours(hours = {}) {
  document.querySelectorAll("[data-day]").forEach(row => {
    const day = row.dataset.day;
    const data = hours[day] || {};

    const closedInput = row.querySelector('[data-field="closed"]');
    const openInput = row.querySelector('[data-field="open"]');
    const closeInput = row.querySelector('[data-field="close"]');

    if (closedInput) closedInput.checked = Boolean(data.closed);
    if (openInput) openInput.value = data.open || "";
    if (closeInput) closeInput.value = data.close || "";

    updateDayRow(row);
  });
}

function updateDayRow(row) {
  const closed = row.querySelector('[data-field="closed"]')?.checked || false;
  const openInput = row.querySelector('[data-field="open"]');
  const closeInput = row.querySelector('[data-field="close"]');

  if (openInput) openInput.disabled = closed;
  if (closeInput) closeInput.disabled = closed;

  row.classList.toggle("is-closed", closed);
}

function normalizeBranches(data) {
  if (!data) return [];

  if (Array.isArray(data)) return data;

  if (typeof data === "object") {
    return Object.values(data);
  }

  return [];
}

function renderBranches() {
  if (!branchWrapper) return;

  const container = $("branch-list");
  if (!container) return;

  container.innerHTML = "";

  branches.forEach((branch, index) => {
    const item = document.createElement("div");
    item.className = "branch-item";

    item.innerHTML = `
      <div class="branch-item-info">
        <strong>${escapeHTML(branch.name || "Cabang " + (index + 1))}</strong>
        <span>${escapeHTML(branch.address || "Alamat belum diisi")}</span>
      </div>
      <button type="button" class="remove-branch-button" data-index="${index}" aria-label="Hapus cabang">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;

    container.appendChild(item);
  });

  container.querySelectorAll(".remove-branch-button").forEach(button => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.index);

      const confirmed = await popup(
        "Apakah kamu yakin ingin menghapus cabang ini?",
        "Hapus Cabang",
        true
      );

      if (!confirmed) return;

      branches.splice(index, 1);
      renderBranches();
      markChanged();
    });
  });
}

async function addBranch() {
  const name = prompt("Masukkan nama cabang:");
  if (name === null || !name.trim()) return;

  const address = prompt("Masukkan alamat cabang:");
  if (address === null || !address.trim()) return;

  branches.push({
    name: name.trim(),
    address: address.trim()
  });

  renderBranches();
  markChanged();
}

async function loadStore() {
  try {
    const snapshot = await get(ref(db, STORE_PATH));

    if (!snapshot.exists()) {
      savedData = {};
      branches = [];
      return;
    }

    savedData = snapshot.val() || {};

    fillForm(savedData);
  } catch (error) {
    console.error("Gagal memuat data toko:", error);
    await popup("Data toko gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.");
  }
}

async function fillForm(data) {
  nameInput.value = data.name || data.nama || "";

  latitudeInput.value = data.latitude || "";
  longitudeInput.value = data.longitude || "";

  locationTypeInput.value = data.locationType || data.jenisLokasi || "";

  postalCodeInput.value = data.postalCode || data.kodePos || "";
  addressInput.value = data.address || data.alamat || "";

  ownerEmailInput.value = data.ownerEmail || "";
  ownerPhoneInput.value = data.ownerPhone || "";

  managerEmailInput.value = data.managerEmail || "";
  managerPhoneInput.value = data.managerPhone || "";

  restaurantPhoneInput.value = data.restaurantPhone || "";

  branches = normalizeBranches(data.branches);
  renderBranches();

  await selectProvinceAndCity(
    data.province || data.provinsi || "",
    data.city || data.kota || "",
    data.district || data.kecamatan || "",
    data.village || data.kelurahan || ""
  );

  applyOpeningHours(data.openingHours || data.jamOperasional || {});

  updateBranchVisibility();
}

function collectStoreData() {
  return {
    name: nameInput.value.trim(),

    latitude: Number(latitudeInput.value),
    longitude: Number(longitudeInput.value),

    locationType: locationTypeInput.value,
    province: provinceInput.value,
    city: cityInput.value,
    district: districtInput.value,
    village: villageInput.value,
    postalCode: postalCodeInput.value.trim(),
    address: addressInput.value.trim(),

    ownerEmail: ownerEmailInput.value.trim(),
    ownerPhone: normalizePhone(ownerPhoneInput.value),

    managerEmail: managerEmailInput.value.trim(),
    managerPhone: normalizePhone(managerPhoneInput.value),

    restaurantPhone: normalizePhone(restaurantPhoneInput.value),

    branches,
    openingHours: collectOpeningHours(),

    createdAt: savedData.createdAt || Date.now(),
    updatedAt: Date.now()
  };
}

function validateStoreData() {
  if (!nameInput.value.trim()) {
    popup("Nama toko wajib diisi.");
    nameInput.focus();
    return false;
  }

  if (!latitudeInput.value || !longitudeInput.value) {
    popup("Tentukan titik koordinat toko pada peta.");
    return false;
  }

  if (!locationTypeInput.value) {
    popup("Pilih jenis lokasi toko.");
    locationTypeInput.focus();
    return false;
  }

  if (!provinceInput.value) {
    popup("Pilih provinsi toko.");
    provinceInput.focus();
    return false;
  }

  if (!cityInput.value) {
    popup("Pilih kota atau kabupaten toko.");
    cityInput.focus();
    return false;
  }

  if (!districtInput.value) {
    popup("Pilih kecamatan toko.");
    districtInput.focus();
    return false;
  }
  
  if (!villageInput.value) {
    popup("Pilih kelurahan atau desa toko.");
    villageInput.focus();
    return false;
  }
  
  if (!postalCodeInput.value.trim()) {
    popup("Kode pos wajib diisi.");
    postalCodeInput.focus();
    return false;
  }

  if (!addressInput.value.trim()) {
    popup("Detail alamat toko wajib diisi.");
    addressInput.focus();
    return false;
  }

  if (!validEmail(ownerEmailInput.value, true)) {
    popup("Email pemilik tidak valid.");
    ownerEmailInput.focus();
    return false;
  }

  if (!validPhone(ownerPhoneInput.value, true)) {
    popup("Nomor telepon pemilik harus menggunakan format +628.");
    ownerPhoneInput.focus();
    return false;
  }

  if (!validEmail(managerEmailInput.value)) {
    popup("Email pengelola tidak valid.");
    managerEmailInput.focus();
    return false;
  }

  if (!validPhone(managerPhoneInput.value)) {
    popup("Nomor telepon pengelola harus menggunakan format +628.");
    managerPhoneInput.focus();
    return false;
  }

  if (!validPhone(restaurantPhoneInput.value)) {
    popup("Nomor telepon restoran harus menggunakan format +628.");
    restaurantPhoneInput.focus();
    return false;
  }

  return true;
}

async function saveStore() {
  if (isSaving || !validateStoreData()) return;

  isSaving = true;
  updateSaveButton();
  setButtonLoading(true);

  try {
    const data = collectStoreData();

    await set(ref(db, STORE_PATH), data);

    savedData = data;
    hasChanges = false;

    await popup("Perubahan data toko berhasil disimpan.", "Berhasil");
  } catch (error) {
    console.error("Gagal menyimpan toko:", error);
    await popup("Data toko gagal disimpan. Periksa koneksi internet dan coba lagi.", "Gagal");
  } finally {
    isSaving = false;
    setButtonLoading(false);
    updateSaveButton();
  }
}

function bindEvents() {
  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();
      saveStore();
    });
  }

  selectLocationButton?.addEventListener("click", requestCurrentLocation);

  provinceInput?.addEventListener("change", async () => {
    await loadCities(provinceInput.value);
    markChanged();
  });
  
  cityInput?.addEventListener("change", async () => {
    await loadDistricts(cityInput.value);
    markChanged();
  });
  
  districtInput?.addEventListener("change", async () => {
    await loadVillages(districtInput.value);
    markChanged();
  });

villageInput?.addEventListener("change", markChanged);

  [
    nameInput,
    locationTypeInput,
    cityInput,
    districtInput,
    villageInput,
    postalCodeInput,
    addressInput,
    ownerEmailInput,
    ownerPhoneInput,
    managerEmailInput,
    managerPhoneInput,
    restaurantPhoneInput
  ].forEach(input => {
    input?.addEventListener("input", markChanged);
    input?.addEventListener("change", markChanged);
  });
  
  addBranchButton?.addEventListener("click", addBranch);

  document.querySelectorAll("[data-day]").forEach(row => {
    const closedInput = row.querySelector('[data-field="closed"]');

    closedInput?.addEventListener("change", () => {
      updateDayRow(row);
      markChanged();
    });

    row.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", markChanged);
    });
  });
}

async function initialize() {
  try {
    bindEvents();

    await loadProvinces();
    await loadStore();
    await initializeMap();

  } catch (error) {
    console.error("Inisialisasi halaman toko gagal:", error);
    await popup("Halaman toko gagal dimuat dengan sempurna.");
  } finally {
    isLoading = false;
    updateBranchVisibility();
    updateSaveButton();
  }
}

initialize();
