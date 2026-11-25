const $ = id => document.getElementById(id);

const ADDRESS_STORAGE_KEY = "kopicu_address";

let addressMap = null;
let addressMarker = null;
let selectedLocation = null;
let selectedFormattedAddress = "";
let searchController = null;
let reverseController = null;

const addressFields = [
  $("address-detail"),
  $("full-name"),
  $("phone-number"),
  $("email"),
  $("location-type")
];

async function reverseGeocode(lat, lng) {
  if (reverseController) {
    reverseController.abort();
  }

  reverseController = new AbortController();

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`,
    {
      signal: reverseController.signal
    }
  );

  if (!response.ok) {
    throw new Error("Gagal mengambil alamat");
  }

  return await response.json();
}

function initializeMap() {
  const defaultLocation = [-6.200000, 106.816666];

  $("address-map").innerHTML = "";

  addressMap = L.map("address-map").setView(
    defaultLocation,
    14
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  ).addTo(addressMap);

  addressMap.on("click", event => {
    setSelectedLocation(
      event.latlng.lat,
      event.latlng.lng
    );
  });

  initializeAddressSearch();

  setTimeout(() => {
    addressMap.invalidateSize();
  }, 200);
}

function setMarker(lat, lng) {
  const location = [lat, lng];

  if (!addressMarker) {
    addressMarker = L.marker(location, {
      draggable: true
    }).addTo(addressMap);

    addressMarker.on("dragend", event => {
      const position = event.target.getLatLng();

      setSelectedLocation(
        position.lat,
        position.lng
      );
    });
  } else {
    addressMarker.setLatLng(location);
  }

  addressMap.setView(location, 17);
}

async function setSelectedLocation(lat, lng, formattedAddress = "") {
  if (!addressMap) return;

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

  selectedLocation = {
    lat,
    lng
  };

  selectedFormattedAddress = "";

  setMarker(lat, lng);

  $("selected-coordinates").textContent =
    `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

  $("selected-address").textContent =
    "Mengambil rincian alamat...";

  updateSaveButton();

  if (formattedAddress) {
    selectedFormattedAddress = formattedAddress;

    $("selected-address").textContent =
      formattedAddress;

    $("address-search").value = formattedAddress;

    updateSaveButton();
    return;
  }

  try {
    const result = await reverseGeocode(lat, lng);

    if (
      !selectedLocation ||
      selectedLocation.lat !== lat ||
      selectedLocation.lng !== lng
    ) {
      return;
    }

    if (!result.display_name) {
      throw new Error("Alamat tidak ditemukan");
    }

    selectedFormattedAddress = result.display_name;

    $("selected-address").textContent =
      selectedFormattedAddress;

    $("address-search").value =
      selectedFormattedAddress;

  } catch (error) {
    if (error.name === "AbortError") return;

    console.error("Gagal mengambil alamat:", error);

    $("selected-address").textContent =
      "Alamat tidak dapat ditemukan";

    selectedFormattedAddress = "";

  } finally {
    updateSaveButton();
  }
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
    "Mencari alamat...";

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=id&limit=1&accept-language=id`,
      {
        signal: searchController.signal
      }
    );

    if (!response.ok) {
      throw new Error("Pencarian alamat gagal");
    }

    const results = await response.json();

    if (!results.length) {
      $("selected-address").textContent =
        "Alamat tidak ditemukan";

      return;
    }

    const result = results[0];

    await setSelectedLocation(
      Number(result.lat),
      Number(result.lon),
      result.display_name
    );

  } catch (error) {
    if (error.name === "AbortError") return;

    console.error("Gagal mencari alamat:", error);

    $("selected-address").textContent =
      "Pencarian gagal. Silakan coba kembali.";
  }
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    showAddressMessage(
      "Lokasi Tidak Didukung",
      "Perangkat kamu tidak mendukung fitur lokasi."
    );
    return;
  }

  if (!addressMap) {
    showAddressMessage(
      "Peta Belum Siap",
      "Tunggu sampai peta selesai dimuat."
    );
    return;
  }

  $("selected-address").textContent =
    "Mengambil lokasi perangkat...";

  navigator.geolocation.getCurrentPosition(
    position => {
      setSelectedLocation(
        position.coords.latitude,
        position.coords.longitude
      );
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
    selectedFormattedAddress &&
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
  const name = $("full-name").value.trim();
  const phone = $("phone-number").value.trim();
  const email = $("email").value.trim();

  const locationType =
    $("location-type").value === "Lainnya"
      ? $("other-location").value.trim()
      : $("location-type").value;

  const addressData = {
    fullAddress: `${selectedFormattedAddress}, ${detail}`,
    address: selectedFormattedAddress,
    landmark: detail,
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
