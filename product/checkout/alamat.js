const $ = id => document.getElementById(id);

const ADDRESS_STORAGE_KEY = "kopicu_address";

let selectedLocation = null;
let selectedFormattedAddress = "";

const addressFields = [
  $("address-detail"),
  $("full-name"),
  $("phone-number"),
  $("email"),
  $("location-type")
];

function initializeMap() {
  const map = $("google-map");

  map.src =
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

function searchAddress() {
  const query = $("address-search").value.trim();

  if (!query) return;

  $("selected-address").textContent =
    "Menampilkan lokasi pencarian di Google Maps...";

  $("google-map").src =
    `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=17&output=embed`;

  selectedLocation = null;
  selectedFormattedAddress = "";

  $("selected-coordinates").textContent =
    "Koordinat belum ditentukan";

  $("address-auto-hint").hidden = true;

  updateSaveButton();
}

function setSelectedLocation(lat, lng, formattedAddress = "") {
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

  selectedLocation = { lat, lng };

  selectedFormattedAddress =
    formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  $("google-map").src =
    `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`;

  $("selected-coordinates").textContent =
    `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

  $("selected-address").textContent =
    selectedFormattedAddress;

  $("address-search").value =
    selectedFormattedAddress;

  $("address-detail").value =
    selectedFormattedAddress;

  $("address-auto-hint").hidden = false;

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

      setSelectedLocation(
        lat,
        lng,
        `${lat.toFixed(6)}, ${lng.toFixed(6)}`
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
