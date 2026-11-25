const $ = id => document.getElementById(id);

const GOOGLE_MAPS_API_KEY = "MASUKKAN_GOOGLE_MAPS_API_KEY";

const ADDRESS_STORAGE_KEY = "kopicu_address";

let addressMap = null;
let addressMarker = null;
let addressGeocoder = null;
let selectedLocation = null;
let selectedFormattedAddress = "";

const addressFields = [
  $("address-detail"),
  $("full-name"),
  $("phone-number"),
  $("email"),
  $("location-type")
];

function loadGoogleMaps() {
  if (
    !GOOGLE_MAPS_API_KEY ||
    GOOGLE_MAPS_API_KEY === "MASUKKAN_GOOGLE_MAPS_API_KEY"
  ) {
    $("selected-address").textContent =
      "API Key Google Maps belum dipasang";

    $("selected-coordinates").textContent =
      "Silakan konfigurasi Google Maps API Key";

    return;
  }

  window.initKopicuAddressMap = initializeMap;

  const script = document.createElement("script");

  script.src =
    `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initKopicuAddressMap&v=weekly`;

  script.async = true;
  script.defer = true;

  script.onerror = () => {
    $("selected-address").textContent =
      "Google Maps gagal dimuat";

    $("selected-coordinates").textContent =
      "Periksa API Key dan koneksi internet";
  };

  document.head.appendChild(script);
}

function initializeMap() {
  const defaultLocation = {
    lat: -6.200000,
    lng: 106.816666
  };

  addressMap = new google.maps.Map($("address-map"), {
    center: defaultLocation,
    zoom: 14,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false
  });

  addressGeocoder = new google.maps.Geocoder();

  addressMarker = new google.maps.Marker({
    map: addressMap,
    position: defaultLocation,
    draggable: true,
    visible: false
  });

  addressMap.addListener("click", event => {
    setSelectedLocation(event.latLng);
  });

  addressMarker.addListener("dragend", event => {
    setSelectedLocation(event.latLng);
  });

  initializeAddressSearch();
}

function initializeAddressSearch() {
  const searchInput = $("address-search");

  const autocomplete = new google.maps.places.Autocomplete(
    searchInput,
    {
      fields: ["formatted_address", "geometry", "name"],
      componentRestrictions: {
        country: "id"
      }
    }
  );

  autocomplete.bindTo("bounds", addressMap);

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();

    if (!place.geometry || !place.geometry.location) {
      $("selected-address").textContent =
        "Alamat tidak ditemukan";

      return;
    }

    setSelectedLocation(
      place.geometry.location,
      place.formatted_address || place.name
    );
  });

  $("search-location-button").addEventListener("click", searchAddress);

  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchAddress();
    }
  });
}

function searchAddress() {
  const query = $("address-search").value.trim();

  if (!query || !addressGeocoder) return;

  $("selected-address").textContent = "Mencari alamat...";

  addressGeocoder.geocode(
    {
      address: query,
      componentRestrictions: {
        country: "ID"
      }
    },
    (results, status) => {
      if (status !== "OK" || !results.length) {
        $("selected-address").textContent =
          "Alamat tidak ditemukan";

        return;
      }

      const result = results[0];

      setSelectedLocation(
        result.geometry.location,
        result.formatted_address
      );
    }
  );
}

function setSelectedLocation(location, formattedAddress = "") {
  if (!addressMap || !addressMarker) return;

  const lat = location.lat();
  const lng = location.lng();

  selectedLocation = {
    lat,
    lng
  };

  addressMarker.setPosition(location);
  addressMarker.setVisible(true);

  addressMap.panTo(location);
  addressMap.setZoom(17);

  $("selected-coordinates").textContent =
    `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

  if (formattedAddress) {
    selectedFormattedAddress = formattedAddress;

    $("selected-address").textContent =
      formattedAddress;

    $("address-search").value = formattedAddress;

    updateSaveButton();
    return;
  }

  $("selected-address").textContent =
    "Mengambil rincian alamat...";

  addressGeocoder.geocode(
    {
      location
    },
    (results, status) => {
      if (status === "OK" && results.length) {
        selectedFormattedAddress =
          results[0].formatted_address;

        $("selected-address").textContent =
          selectedFormattedAddress;

        $("address-search").value =
          selectedFormattedAddress;
      } else {
        selectedFormattedAddress = "";

        $("selected-address").textContent =
          "Alamat tidak dapat ditemukan";
      }

      updateSaveButton();
    }
  );

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

  if (!addressMap) {
    showAddressMessage(
      "Peta Belum Siap",
      "Tunggu sampai Google Maps selesai dimuat."
    );
    return;
  }

  $("selected-address").textContent =
    "Mengambil lokasi perangkat...";

  navigator.geolocation.getCurrentPosition(
    position => {
      const location = new google.maps.LatLng(
        position.coords.latitude,
        position.coords.longitude
      );

      setSelectedLocation(location);
    },
    error => {
      let message = "Tidak dapat mengambil lokasi perangkat.";

      if (error.code === error.PERMISSION_DENIED) {
        message = "Izinkan akses lokasi pada browser kamu.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = "Informasi lokasi tidak tersedia.";
      } else if (error.code === error.TIMEOUT) {
        message = "Pengambilan lokasi terlalu lama.";
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
    const isOther = $("location-type").value === "Lainnya";

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

  const locationType = $("location-type").value === "Lainnya"
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
  if (typeof showPopup === "function") {
    showPopup({
      title,
      message,
      icon: "fa-circle-exclamation"
    });

    return;
  }

  alert(`${title}\n\n${message}`);
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
  loadGoogleMaps();
}

initializeAddressPage();
