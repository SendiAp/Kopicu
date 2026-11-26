const $ = id => document.getElementById(id);

const ADDRESS_STORAGE_KEY = "kopicu_address";

let locationResolving = false;
let addressSearching = false;
let selectedLocation = null;
let selectedFormattedAddress = "";
let locationRequestId = 0;
let searchController = null;
let smallMap = null;
let fullscreenMap = null;
let smallMarker = null;
let fullscreenMarker = null;
let pendingMapLocation = null;
let searchDebounce = null;
let suggestionController = null;
let suggestionResults = [];
let currentLocationRequest = null;

const addressFields = [
  $("address-detail"),
  $("full-name"),
  $("phone-number"),
  $("email"),
  $("location-type")
];

async function searchGeocoding(query, signal) {
  const params = new URLSearchParams({
    format: "jsonv2",
    q: query.trim(),
    countrycodes: "id",
    limit: "10",
    addressdetails: "1",
    "accept-language": "id"
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error("Gagal mencari alamat.");
  }

  const results = await response.json();

  return Array.isArray(results) ? results : [];
}

async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    "accept-language": "id",
    zoom: "18",
    addressdetails: "1"
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`
  );

  if (!response.ok) {
    throw new Error("Gagal mendapatkan alamat lengkap.");
  }

  const result = await response.json();

  if (!result.display_name) {
    throw new Error("Alamat lengkap tidak ditemukan.");
  }

  return result.display_name;
}

function createMapLayers(map) {
  const attribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  const streetLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution,
      crossOrigin: true
    }
  );

  const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
      crossOrigin: true
    }
  );

  const terrainLayer = L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 17,
      attribution:
        '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      crossOrigin: true
    }
  );

  streetLayer.addTo(map);

  return {
    streetLayer,
    satelliteLayer,
    terrainLayer
  };
}

function initializeMap() {
  smallMap = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([-6.2088, 106.8456], 13);

  fullscreenMap = L.map("fullscreen-map", {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([-6.2088, 106.8456], 13);

  const smallLayers = createMapLayers(smallMap);
  const fullscreenLayers = createMapLayers(fullscreenMap);

  L.control.layers(
    {
      "Peta Jalan": fullscreenLayers.streetLayer,
      "Satelit": fullscreenLayers.satelliteLayer,
      "Topografi": fullscreenLayers.terrainLayer
    },
    null,
    {
      position: "topright",
      collapsed: true
    }
  ).addTo(fullscreenMap);

  smallMap.on("click", event => {
    setMapPendingLocation(
      event.latlng.lat,
      event.latlng.lng
    );
  });

  fullscreenMap.on("click", event => {
    setMapPendingLocation(
      event.latlng.lat,
      event.latlng.lng
    );
  });

  initializeFullscreenLocationButton();
  initializeMapControls();
  initializeAddressSearch();

  setTimeout(() => {
    smallMap.invalidateSize();
    fullscreenMap.invalidateSize();
  }, 300);
}

function initializeFullscreenLocationButton() {
  const LocationControl = L.Control.extend({
    options: {
      position: "topleft"
    },

    onAdd: function () {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar leaflet-control"
      );

      const button = L.DomUtil.create(
        "button",
        "",
        container
      );

      button.type = "button";
      button.title = "Gunakan lokasi perangkat";
      button.setAttribute(
        "aria-label",
        "Gunakan lokasi perangkat"
      );

      button.innerHTML =
        '<i class="fa-solid fa-crosshairs"></i>';

      button.style.width = "42px";
      button.style.height = "42px";
      button.style.border = "none";
      button.style.background = "#ffffff";
      button.style.color = "#38251d";
      button.style.fontSize = "16px";
      button.style.cursor = "pointer";

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      L.DomEvent.on(button, "click", event => {
        L.DomEvent.preventDefault(event);
        locateCurrentPositionOnMap();
      });

      return container;
    }
  });

  fullscreenMap.addControl(new LocationControl());
}

function initializeMapControls() {
  $("open-map-button").addEventListener("click", () => {
    openFullscreenMap();
  });

  $("close-map-button").addEventListener("click", () => {
    $("map-overlay").hidden = true;

    if (pendingMapLocation) {
      const location = selectedLocation;

      if (location) {
        setMapPendingLocation(location.lat, location.lng);
      } else {
        pendingMapLocation = null;

        if (smallMarker) {
          smallMap.removeLayer(smallMarker);
          smallMarker = null;
        }

        if (fullscreenMarker) {
          fullscreenMap.removeLayer(fullscreenMarker);
          fullscreenMarker = null;
        }
      }
    }
  });

  $("confirm-map-location").addEventListener("click", async () => {
    if (!pendingMapLocation) {
      showAddressMessage(
        "Titik Belum Dipilih",
        "Silakan ketuk lokasi yang ingin digunakan pada peta."
      );
      return;
    }

    const { lat, lng } = pendingMapLocation;

    $("map-overlay").hidden = true;

    await setSelectedLocation(lat, lng);
  });
}

function openFullscreenMap() {
  $("map-overlay").hidden = false;

  setTimeout(() => {
    fullscreenMap.invalidateSize();

    const location = pendingMapLocation || selectedLocation;

    if (location) {
      fullscreenMap.setView(
        [location.lat, location.lng],
        17
      );
    } else {
      fullscreenMap.setView(
        smallMap.getCenter(),
        smallMap.getZoom()
      );
    }
  }, 150);
}

function setMapPendingLocation(lat, lng) {
  lat = Number(lat);
  lng = Number(lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return;
  }

  pendingMapLocation = { lat, lng };

  const position = [lat, lng];

  if (smallMarker) {
    smallMarker.setLatLng(position);
  } else {
    smallMarker = L.marker(position).addTo(smallMap);
  }

  if (fullscreenMarker) {
    fullscreenMarker.setLatLng(position);
  } else {
    fullscreenMarker = L.marker(position).addTo(fullscreenMap);
  }

  smallMap.setView(position, 17);
  fullscreenMap.setView(position, 17);
}

function initializeAddressSearch() {
  const input = $("address-search");
  const suggestions = $("address-suggestions");

  input.addEventListener("input", () => {
    clearTimeout(searchDebounce);

    if (suggestionController) {
      suggestionController.abort();
      suggestionController = null;
    }

    if (searchController) {
      searchController.abort();
      searchController = null;
    }

    addressSearching = false;
    locationRequestId++;

    const query = input.value.trim();

    if (query.length < 3) {
      suggestions.hidden = true;
      suggestions.replaceChildren();
      suggestionResults = [];
      updateSaveButton();
      return;
    }

    searchDebounce = setTimeout(() => {
      loadAddressSuggestions(query);
    }, 700);
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchAddress();
    }

    if (event.key === "Escape") {
      suggestions.hidden = true;
    }
  });

  $("search-location-button").addEventListener(
    "click",
    searchAddress
  );

  suggestions.addEventListener("click", event => {
    const button = event.target.closest(
      ".address-suggestion-item"
    );

    if (!button) return;

    const index = Number(button.dataset.index);
    const result = suggestionResults[index];

    if (!result) return;

    clearTimeout(searchDebounce);

    if (searchController) {
      searchController.abort();
      searchController = null;
    }

    if (suggestionController) {
      suggestionController.abort();
      suggestionController = null;
    }

    addressSearching = false;
    suggestions.hidden = true;

    setMapPendingLocation(
      Number(result.lat),
      Number(result.lon)
    );

    fullscreenMap.setView(
      [Number(result.lat), Number(result.lon)],
      17
    );
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".map-search")) {
      suggestions.hidden = true;
    }
  });
}

async function loadAddressSuggestions(query) {
  if (suggestionController) {
    suggestionController.abort();
  }

  const controller = new AbortController();
  suggestionController = controller;

  const suggestions = $("address-suggestions");

  try {
    const results = await searchGeocoding(
      query,
      controller.signal
    );

    if (suggestionController !== controller) return;
    if ($("address-search").value.trim() !== query) return;

    suggestionResults = results;
    suggestions.replaceChildren();

    if (!results.length) {
      suggestions.hidden = true;
      return;
    }

    results.forEach((result, index) => {
      const button = document.createElement("button");
      const icon = document.createElement("i");
      const text = document.createElement("span");

      button.type = "button";
      button.className = "address-suggestion-item";
      button.dataset.index = index;

      icon.className = "fa-solid fa-location-dot";
      text.textContent = result.display_name;

      button.append(icon, text);
      suggestions.appendChild(button);
    });

    suggestions.hidden = false;

  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Pencarian rekomendasi gagal:", error);
    }
  }
}

async function searchAddress() {
  const query = $("address-search").value.trim();

  if (!query) return;

  clearTimeout(searchDebounce);

  if (searchController) {
    searchController.abort();
  }

  if (suggestionController) {
    suggestionController.abort();
    suggestionController = null;
  }

  const controller = new AbortController();
  searchController = controller;

  const requestId = ++locationRequestId;

  addressSearching = true;
  $("address-suggestions").hidden = true;
  $("selected-address").textContent = "Sedang mencari alamat...";
  $("address-auto-hint").hidden = true;

  updateSaveButton();

  try {
    const results = await searchGeocoding(
      query,
      controller.signal
    );

    if (searchController !== controller) return;

    if (!results.length) {
      throw new Error("Alamat tidak ditemukan.");
    }

    const result = results[0];
    const lat = Number(result.lat);
    const lng = Number(result.lon);

    addressSearching = false;

    setMapPendingLocation(lat, lng);

    fullscreenMap.setView([lat, lng], 17);

    await setSelectedLocation(
      lat,
      lng,
      result.display_name
    );

  } catch (error) {
    if (error.name === "AbortError") return;
    if (searchController !== controller) return;

    if (requestId === locationRequestId) {
      selectedLocation = null;
      selectedFormattedAddress = "";

      $("selected-address").textContent =
        error.message || "Alamat tidak ditemukan.";

      $("selected-coordinates").textContent =
        "Koordinat belum ditentukan";
    }

  } finally {
    if (searchController === controller) {
      searchController = null;
      addressSearching = false;
      updateSaveButton();
    }
  }
}

async function setSelectedLocation(lat, lng, formattedAddress = "") {
  lat = Number(lat);
  lng = Number(lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return;
  }

  const requestId = ++locationRequestId;

  selectedLocation = { lat, lng };
  selectedFormattedAddress = "";
  pendingMapLocation = { lat, lng };

  locationResolving = true;

  const position = [lat, lng];

  if (smallMarker) {
    smallMarker.setLatLng(position);
  } else {
    smallMarker = L.marker(position).addTo(smallMap);
  }

  if (fullscreenMarker) {
    fullscreenMarker.setLatLng(position);
  } else {
    fullscreenMarker = L.marker(position).addTo(fullscreenMap);
  }

  smallMap.setView(position, 17);
  fullscreenMap.setView(position, 17);

  $("selected-coordinates").textContent =
    `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

  $("selected-address").textContent =
    formattedAddress || "Mengambil alamat lengkap...";

  $("address-detail").value = "";
  $("address-auto-hint").hidden = true;

  updateSaveButton();

  try {
    const address =
      formattedAddress || await reverseGeocode(lat, lng);

    if (requestId !== locationRequestId) return;

    selectedFormattedAddress = address;

    $("selected-address").textContent = address;
    $("address-search").value = address;
    $("address-detail").value = address;

    $("address-auto-hint").hidden = false;

  } catch (error) {
    if (requestId !== locationRequestId) return;

    console.error("Gagal mendapatkan alamat:", error);

    selectedFormattedAddress = "";

    $("selected-address").textContent =
      "Alamat otomatis tidak ditemukan. Silakan isi alamat lengkap secara manual.";

    $("address-detail").value = "";

  } finally {
    if (requestId === locationRequestId) {
      locationResolving = false;
      updateSaveButton();
    }
  }
}

function locateCurrentPositionOnMap() {
  if (!navigator.geolocation) {
    showAddressMessage(
      "Lokasi Tidak Didukung",
      "Perangkat kamu tidak mendukung fitur lokasi."
    );
    return;
  }

  if (currentLocationRequest) {
    currentLocationRequest.abort();
  }

  const controller = new AbortController();
  currentLocationRequest = controller;

  const button = document.querySelector(
    "#fullscreen-map .leaflet-control button"
  );

  if (button) {
    button.disabled = true;
    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i>';
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      if (currentLocationRequest !== controller) return;

      currentLocationRequest = null;

      if (button) {
        button.disabled = false;
        button.innerHTML =
          '<i class="fa-solid fa-crosshairs"></i>';
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setMapPendingLocation(lat, lng);

      fullscreenMap.setView([lat, lng], 18);
    },
    error => {
      if (currentLocationRequest !== controller) return;

      currentLocationRequest = null;

      if (button) {
        button.disabled = false;
        button.innerHTML =
          '<i class="fa-solid fa-crosshairs"></i>';
      }

      let message =
        "Tidak dapat mengambil lokasi perangkat.";

      if (error.code === error.PERMISSION_DENIED) {
        message =
          "Izinkan akses lokasi pada browser kamu.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message =
          "Informasi lokasi tidak tersedia.";
      } else if (error.code === error.TIMEOUT) {
        message =
          "Pengambilan lokasi terlalu lama.";
      }

      showAddressMessage("Lokasi Gagal", message);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    showAddressMessage(
      "Lokasi Tidak Didukung",
      "Perangkat kamu tidak mendukung fitur lokasi."
    );
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setSelectedLocation(lat, lng);
    },
    error => {
      let message =
        "Tidak dapat mengambil lokasi perangkat.";

      if (error.code === error.PERMISSION_DENIED) {
        message =
          "Izinkan akses lokasi pada browser kamu.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message =
          "Informasi lokasi tidak tersedia.";
      } else if (error.code === error.TIMEOUT) {
        message =
          "Pengambilan lokasi terlalu lama.";
      }

      showAddressMessage("Lokasi Gagal", message);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

function initializePhoneInput() {
  const phoneInput = $("phone-number");

  phoneInput.addEventListener("input", () => {
    let value = phoneInput.value.replace(/\D/g, "");

    if (value.startsWith("0")) {
      value = "62" + value.slice(1);
    } else if (!value.startsWith("62")) {
      value = "628" + value;
    }

    if (value.startsWith("62") && !value.startsWith("628")) {
      value = "628" + value.slice(2);
    }

    phoneInput.value = "+" + value;

    updateSaveButton();
  });

  phoneInput.addEventListener("keydown", event => {
    const start = phoneInput.selectionStart;

    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      start <= 4 &&
      phoneInput.value.startsWith("+628")
    ) {
      event.preventDefault();
    }
  });
}

function initializeLocationType() {
  $("location-type").addEventListener("change", () => {
    const isOther =
      $("location-type").value === "Lainnya";

    $("other-location-group").hidden = !isOther;

    if (!isOther) {
      $("other-location").value = "";
    }

    updateSaveButton();
  });

  $("other-location").addEventListener(
    "input",
    updateSaveButton
  );
}

function validateAddressForm() {
  const detail = $("address-detail").value.trim();
  const name = $("full-name").value.trim();
  const phone = $("phone-number").value.trim();
  const email = $("email").value.trim();
  const locationType = $("location-type").value;
  const otherLocation = $("other-location").value.trim();

  const validPhone = /^\+628[0-9]{8,11}$/.test(phone);

  const validEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validLocationType =
    locationType !== "" &&
    (locationType !== "Lainnya" || otherLocation !== "");

  return Boolean(
    selectedLocation &&
    !locationResolving &&
    !addressSearching &&
    detail &&
    name &&
    validPhone &&
    validEmail &&
    validLocationType
  );
}

function updateSaveButton() {
  $("save-address-button").disabled =
    !validateAddressForm();
}

function saveAddress() {
  if (!validateAddressForm()) {
    updateSaveButton();
    return;
  }

  const detail = $("address-detail").value.trim();
  const landmark = $("address-landmark").value.trim();
  const name = $("full-name").value.trim();
  const phone = $("phone-number").value.trim();
  const email = $("email").value.trim();

  const locationType =
    $("location-type").value === "Lainnya"
      ? $("other-location").value.trim()
      : $("location-type").value;

  const addressData = {
    fullAddress: `${detail}${landmark ? ", Patokan: " + landmark : ""}`,
    address: detail,
    landmark,
    name,
    phone,
    email,
    locationType,
    coordinates: {
      lat: selectedLocation.lat,
      lng: selectedLocation.lng
    },
    updatedAt: Date.now()
  };

  try {
    localStorage.setItem(
      ADDRESS_STORAGE_KEY,
      JSON.stringify(addressData)
    );

    window.location.href = "checkout.html";

  } catch (error) {
    console.error("Gagal menyimpan alamat:", error);

    showAddressMessage(
      "Gagal Menyimpan",
      "Alamat tidak dapat disimpan. Silakan coba kembali."
    );
  }
}

function showAddressMessage(title, message) {
  const overlay = document.createElement("div");

  overlay.className = "checkout-popup-overlay";

  overlay.innerHTML = `
    <div class="checkout-popup">
      <div class="checkout-popup-icon">
        <i class="fa-solid fa-circle-exclamation"></i>
      </div>

      <h3 class="checkout-popup-title">
        ${escapeAddressHTML(title)}
      </h3>

      <p class="checkout-popup-message">
        ${escapeAddressHTML(message)}
      </p>

      <div class="checkout-popup-actions">
        <button
          type="button"
          class="checkout-popup-button primary"
        >
          Mengerti
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("button").addEventListener(
    "click",
    () => overlay.remove()
  );
}

function escapeAddressHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function initializeAddressPage() {
  addressFields.forEach(field => {
    field.addEventListener("input", updateSaveButton);
    field.addEventListener("change", updateSaveButton);
  });

  $("address-landmark").addEventListener(
    "input",
    updateSaveButton
  );
  $("current-location-button").addEventListener(
    "click",
    getCurrentLocation
  );

  $("save-address-button").addEventListener(
    "click",
    saveAddress
  );

  $("back-button").addEventListener("click", () => {
    window.location.href = "checkout.html";
  });

  initializePhoneInput();
  initializeLocationType();

  updateSaveButton();
  initializeMap();
}

initializeAddressPage();
