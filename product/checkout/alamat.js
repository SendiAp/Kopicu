const $ = id => document.getElementById(id);

const ADDRESS_STORAGE_KEY = "kopicu_address";

let selectedLocation = null;
let selectedFormattedAddress = "";
let locationRequestId = 0;
let searchController = null;

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
    q: query,
    countrycodes: "id",
    limit: "1",
    "accept-language": "id"
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error("Gagal mencari alamat.");
  }

  const results = await response.json();

  if (!results.length) {
    throw new Error("Alamat tidak ditemukan.");
  }

  return results[0];
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

function initializeMap() {
  $("google-map").src =
    "https://maps.google.com/maps?q=Jakarta%20Indonesia&z=14&output=embed";

  initializeAddressSearch();
}

function initializeAddressSearch() {
  $("search-location-button").addEventListener(
    "click",
    searchAddress
  );

  $("address-search").addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchAddress();
      }
    }
  );
}

async function searchAddress() {
  const query = $("address-search").value.trim();

  if (!query) return;

  if (searchController) {
    searchController.abort();
  }

  searchController = new AbortController();

  $("selected-address").textContent =
    "Sedang mencari alamat...";

  $("address-auto-hint").hidden = true;

  try {
    const result = await searchGeocoding(
      query,
      searchController.signal
    );

    await setSelectedLocation(
      Number(result.lat),
      Number(result.lon),
      result.display_name
    );

  } catch (error) {
    if (error.name === "AbortError") return;

    $("selected-address").textContent =
      error.message || "Alamat tidak ditemukan.";

    selectedLocation = null;
    selectedFormattedAddress = "";

    $("selected-coordinates").textContent =
      "Koordinat belum ditentukan";

    updateSaveButton();
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

  $("google-map").src =
    `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`;

  $("selected-coordinates").textContent =
    `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

  $("selected-address").textContent =
    formattedAddress || "Mengambil alamat lengkap...";

  $("address-detail").value = "";
  $("address-auto-hint").hidden = true;

  updateSaveButton();

  try {
    const address = formattedAddress || await reverseGeocode(lat, lng);

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
  }

  updateSaveButton();
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    showAddressMessage(
      "Lokasi Tidak Didukung",
      "Perangkat kamu tidak mendukung fitur lokasi."
    );
    return;
  }

  $("selected-address").textContent =
    "Mengambil lokasi perangkat...";

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
