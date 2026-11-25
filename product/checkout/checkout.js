import { db } from "../../database/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
  showCheckoutLoading,
  hideCheckoutLoading
} from "./loading.js";

const $ = id => document.getElementById(id);

const productList = $("checkout-product-list");
const addressCard = $("address-card");
const addressEmpty = $("address-empty");
const deliverySection = $("delivery-section");

const deliveryRates = {
  baseFee: 10700,
  baseDistance: 4,
  extraPerKm: 2675
};

let deliveryDistanceKm = null;

let deliveryDurationMinutes = null;

const deliveryTypes = {
  priority: {
    multiplier: 1.25,
    timeMultiplier: 0.85
  },
  standard: {
    multiplier: 1,
    timeMultiplier: 1
  },
  economy: {
    multiplier: 0.85,
    timeMultiplier: 1.2
  }
};

const deliveryLabels = {
  priority: "Prioritas",
  standard: "Standar",
  economy: "Hemat"
};

let checkoutItems = [];
let storeData = {};
let selectedDelivery = "standard";
let deliveryFee = 0;
let serviceFee = 0;
let paymentMethod = localStorage.getItem("kopicu_payment_method") || "";
let addressData = null;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatRupiah(value) {
  return "Rp" + Number(value || 0).toLocaleString("id-ID");
}

function getFullAddress() {
  return String(
    addressData?.fullAddress ||
    addressData?.address ||
    addressData?.alamat ||
    ""
  ).trim();
}

function getCustomerCoordinates() {
  const coordinates = addressData?.coordinates;

  const lat = Number(coordinates?.lat);
  const lng = Number(coordinates?.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
}

function getStoreCoordinates() {
  const lat = Number(storeData?.latitude);
  const lng = Number(storeData?.longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
}

function calculateDeliveryFee(distance, type = "standard") {
  if (!Number.isFinite(distance) || distance < 0) return 0;

  const roundedDistance = Math.ceil(distance);

  let basePrice = deliveryRates.baseFee;

  if (roundedDistance > deliveryRates.baseDistance) {
    basePrice +=
      (roundedDistance - deliveryRates.baseDistance) *
      deliveryRates.extraPerKm;
  }

  const multiplier = deliveryTypes[type]?.multiplier || 1;

  return Math.round((basePrice * multiplier) / 500) * 500;
}

function updateDeliveryPrices() {
  const isDelivery = document.querySelector(
    ".service-option.active"
  )?.dataset.service === "delivery";

  document.querySelectorAll(".delivery-option").forEach(option => {
    const radio = option.querySelector('input[name="delivery-type"]');

    if (!radio) return;

    const type = radio.value;
    const config = deliveryTypes[type];

    const priceElement = option.querySelector(".delivery-price");
    const timeElement = $(`${type}-time`);

    if (priceElement) {
      priceElement.textContent = deliveryDistanceKm === null
        ? "Tidak tersedia"
        : formatRupiah(calculateDeliveryFee(deliveryDistanceKm, type));
    }

    if (timeElement) {
      if (deliveryDurationMinutes === null || !config) {
        timeElement.textContent = "Waktu tidak tersedia";
      } else {
        const minutes = Math.ceil(
          deliveryDurationMinutes * config.timeMultiplier
        ) + 10;

        timeElement.textContent = `${minutes} menit`;
      }
    }
  });

  deliveryFee = isDelivery && deliveryDistanceKm !== null
    ? calculateDeliveryFee(deliveryDistanceKm, selectedDelivery)
    : 0;

  updateSummary();
  updateOrderButton();
}

async function calculateDeliveryDistance() {
  const distanceElement = $("delivery-distance");
  const customer = getCustomerCoordinates();
  const store = getStoreCoordinates();

  deliveryDistanceKm = null;
  deliveryDurationMinutes = null;
  deliveryFee = 0;

  if (distanceElement) {
    distanceElement.textContent = "Menghitung jarak...";
  }

  updateDeliveryPrices();
  updateOrderButton();

  if (!customer || !store) {
    if (distanceElement) {
      distanceElement.textContent = "Lokasi belum tersedia";
    }

    updateDeliveryPrices();
    updateOrderButton();
    return;
  }

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${store.lng},${store.lat};${customer.lng},${customer.lat}` +
      `?overview=false`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Gagal mendapatkan rute");
    }

    const result = await response.json();

    if (result.code !== "Ok" || !result.routes?.length) {
      throw new Error(result.message || "Rute tidak ditemukan");
    }

    const route = result.routes[0];

    if (
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration)
    ) {
      throw new Error("Jarak atau estimasi waktu tidak ditemukan");
    }

    deliveryDistanceKm = route.distance / 1000;
    deliveryDurationMinutes = route.duration / 60;

    if (distanceElement) {
      distanceElement.textContent =
        `(${deliveryDistanceKm.toLocaleString("id-ID", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        })} km)`;
    }

    updateDeliveryPrices();
    updateOrderButton();

  } catch (error) {
    console.error("Gagal menghitung jarak pengiriman:", error);

    deliveryDistanceKm = null;
    deliveryDurationMinutes = null;
    deliveryFee = 0;

    if (distanceElement) {
      distanceElement.textContent = "Jarak tidak tersedia";
    }

    updateDeliveryPrices();
    updateSummary();
    updateOrderButton();
  }
}

function showPopup({
  title = "Informasi",
  message = "",
  icon = "fa-circle-info",
  actions = []
}) {
  document.getElementById("checkout-popup-overlay")?.remove();

  const styleId = "checkout-popup-style";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .checkout-popup-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.45);
        animation: checkoutPopupFade 0.2s ease;
      }

      .checkout-popup {
        width: 100%;
        max-width: 360px;
        padding: 24px 20px 20px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 35px rgba(0, 0, 0, 0.14);
        animation: checkoutPopupScale 0.2s ease;
      }

      .checkout-popup-icon {
        width: 52px;
        height: 52px;
        margin: 0 auto 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #f7f3ef;
        color: #38251d;
        font-size: 22px;
      }

      .checkout-popup-title {
        margin: 0 0 9px;
        color: #242424;
        font-size: 17px;
        font-weight: 700;
        text-align: center;
      }

      .checkout-popup-message {
        margin: 0;
        color: #777777;
        font-size: 13px;
        line-height: 1.6;
        text-align: center;
      }

      .checkout-popup-actions {
        display: flex;
        flex-direction: column;
        gap: 9px;
        margin-top: 22px;
      }

      .checkout-popup-button {
        width: 100%;
        min-height: 43px;
        padding: 10px 14px;
        border: 1px solid #eeeeee;
        border-radius: 8px;
        background: #ffffff;
        color: #38251d;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      .checkout-popup-button.primary {
        border-color: #38251d;
        background: #38251d;
        color: #ffffff;
      }

      .checkout-popup-button.danger {
        border-color: #d93636;
        background: #d93636;
        color: #ffffff;
      }

      .checkout-popup-button:active {
        transform: scale(0.98);
      }

      @keyframes checkoutPopupFade {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes checkoutPopupScale {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement("div");
  overlay.id = "checkout-popup-overlay";
  overlay.className = "checkout-popup-overlay";

  overlay.innerHTML = `
    <div class="checkout-popup">
      <div class="checkout-popup-icon">
        <i class="fa-solid ${escapeHTML(icon)}"></i>
      </div>

      <h3 class="checkout-popup-title">
        ${escapeHTML(title)}
      </h3>

      <p class="checkout-popup-message">
        ${escapeHTML(message)}
      </p>

      <div class="checkout-popup-actions"></div>
    </div>
  `;

  const actionContainer = overlay.querySelector(
    ".checkout-popup-actions"
  );

  actions.forEach(action => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `checkout-popup-button ${action.type || ""}`;
    button.innerHTML = action.html || escapeHTML(action.label);

    button.addEventListener("click", () => {
      overlay.remove();
      action.onClick?.();
    });

    actionContainer.appendChild(button);
  });

  if (!actions.length) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "checkout-popup-button primary";
    button.textContent = "Mengerti";
    button.addEventListener("click", () => overlay.remove());
    actionContainer.appendChild(button);
  }

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
}

function getItemOptions(item) {
  if (!Array.isArray(item.selectedOptions)) return "";

  return item.selectedOptions
    .flatMap(group =>
      Array.isArray(group.options)
        ? group.options.map(option => option.name)
        : []
    )
    .filter(Boolean)
    .join(" + ");
}

function loadCheckoutItems() {
  try {
    const data = JSON.parse(
      localStorage.getItem("kopicu_checkout") || "[]"
    );

    checkoutItems = Array.isArray(data) ? data : [];
  } catch (error) {
    checkoutItems = [];
  }

  checkoutItems = checkoutItems.filter(item =>
    item && typeof item === "object"
  );

  checkoutItems.forEach(item => {
    item.quantity = Math.max(1, Number(item.quantity) || 1);
    item.unitPrice = Number(item.unitPrice || item.basePrice || 0);
    item.totalPrice = item.unitPrice * item.quantity;
  });

  saveCheckoutItems();
}

function saveCheckoutItems() {
  localStorage.setItem(
    "kopicu_checkout",
    JSON.stringify(checkoutItems)
  );
}

function renderProducts() {
  if (!productList) return;

  if (!checkoutItems.length) {
    productList.innerHTML = `
      <div class="checkout-empty">
        <p>Tidak ada produk yang dipilih.</p>
        <a href="../product.html">Kembali ke Menu</a>
      </div>
    `;

    updateSummary();
    return;
  }

  productList.innerHTML = checkoutItems.map(item => {
    const image = item.image || item.images?.[0] || "";
    const options = getItemOptions(item);

    return `
      <article
        class="checkout-product"
        data-product-id="${escapeHTML(item.id)}"
      >

        <div class="checkout-product-image">
          ${
            image
              ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(item.name)}">`
              : `<div class="product-image-placeholder">
                   <i class="fa-solid fa-image"></i>
                 </div>`
          }
        </div>

        <div class="checkout-product-content">

          <div class="checkout-product-heading">
            <h3 class="checkout-product-name">
              ${escapeHTML(item.name || "Product")}
            </h3>

            <button
              type="button"
              class="edit-product-button"
              data-action="edit-options"
            >
              Ubah
            </button>
          </div>

          <p class="checkout-product-price">
            ${formatRupiah(item.unitPrice)}
          </p>

          ${
            options
              ? `<p class="checkout-product-options">${escapeHTML(options)}</p>`
              : ""
          }

          <div class="checkout-product-bottom">

            <span class="checkout-product-unit-price">
              ${formatRupiah(item.totalPrice)}
            </span>

            <div class="checkout-quantity">

              <button
                type="button"
                class="quantity-decrease"
                aria-label="Kurangi jumlah"
              >
                <i class="fa-solid fa-minus"></i>
              </button>

              <span class="quantity-value">${item.quantity}</span>

              <button
                type="button"
                class="quantity-increase"
                aria-label="Tambah jumlah"
              >
                <i class="fa-solid fa-plus"></i>
              </button>

            </div>

          </div>

        </div>

      </article>
    `;
  }).join("");

  updateSummary();
}

function updateSummary() {
  const totalQuantity = checkoutItems.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  const productTotal = checkoutItems.reduce(
    (total, item) =>
      total + Number(item.unitPrice || 0) * Number(item.quantity || 0),
    0
  );

  const grandTotal = productTotal + deliveryFee + serviceFee;

  $("product-total-count").textContent =
    `Total ${totalQuantity} Menu`;

  $("product-total-price").textContent =
    formatRupiah(productTotal);

  $("summary-product-count").textContent =
    `Total Pesanan (${totalQuantity} menu)`;

  $("summary-product-total").textContent =
    formatRupiah(productTotal);

  $("summary-delivery-total").textContent =
    formatRupiah(deliveryFee);

  $("summary-service-fee").textContent =
    formatRupiah(serviceFee);

  $("summary-grand-total").textContent =
    formatRupiah(grandTotal);

  $("footer-grand-total").textContent =
    formatRupiah(grandTotal);
}

function updateQuantity(itemId, change) {
  const item = checkoutItems.find(item => item.id === itemId);

  if (!item) return;

  const newQuantity = Number(item.quantity) + change;

  if (newQuantity < 1) return;

  item.quantity = newQuantity;
  item.totalPrice = item.unitPrice * newQuantity;
  item.updatedAt = Date.now();

  saveCheckoutItems();
  renderProducts();
}

function updateOrderButton() {
  const button = $("place-order-button");
  if (!button) return;

  const hasAddress = Boolean(getFullAddress());

  const isDelivery = document.querySelector(
    ".service-option.active"
  )?.dataset.service === "delivery";

  const disabled = isDelivery && (
    !hasAddress ||
    deliveryDistanceKm === null
  );

  button.disabled = disabled;
  button.style.background = disabled ? "#bdbdbd" : "";
  button.style.color = disabled ? "#ffffff" : "";
  button.style.cursor = disabled ? "not-allowed" : "";
}
  
function loadAddress() {
  try {
    addressData = JSON.parse(
      localStorage.getItem("kopicu_address") || "null"
    );
  } catch (error) {
    addressData = null;
  }

  if (!addressData || typeof addressData !== "object") {
    addressData = null;
  }

  const fullAddress = getFullAddress();

  const customerName = addressData?.name ||
    addressData?.customerName ||
    addressData?.nama ||
    "";

  const customerPhone = addressData?.phone ||
    addressData?.customerPhone ||
    addressData?.nomorTelepon ||
    addressData?.noHp ||
    "";

  const landmark = addressData?.landmark ||
    addressData?.note ||
    addressData?.patokan ||
    "";

  const hasAddress = Boolean(fullAddress);

  addressCard.hidden = !hasAddress;
  addressEmpty.hidden = hasAddress;
  deliverySection.hidden = !hasAddress;

  $("address-detail").textContent =
    fullAddress || "Alamat belum diatur";

  $("customer-name").textContent =
    customerName || "-";

  $("customer-phone").textContent =
    customerPhone || "-";

  $("address-landmark").textContent =
    landmark || "-";

  updateOrderButton();
}

function renderServices() {
  const services = storeData?.services || {};

  const serviceButtons = [
    { key: "delivery" },
    { key: "pickup" },
    { key: "dineIn" }
  ];

  const availableServices = serviceButtons.filter(service =>
    services[service.key] === true
  );

  document.querySelectorAll(".service-option").forEach(button => {
    const service = button.dataset.service;

    button.hidden = !availableServices.some(item =>
      item.key === service
    );
  });

  if (availableServices.length) {
    const firstService = availableServices[0].key;

    document.querySelectorAll(".service-option").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.service === firstService
      );
    });

    updateService(firstService);
  } else {
    document.querySelectorAll(".service-option").forEach(button => {
      button.classList.remove("active");
    });

    $("summary-delivery-row").hidden = true;
    deliveryFee = 0;
    updateSummary();
    updateOrderButton();
  }
}

function updateService(service) {
  document.querySelectorAll(".service-option").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.service === service
    );
  });

  const isDelivery = service === "delivery";
  const hasAddress = Boolean(getFullAddress());

  addressCard.hidden = !isDelivery || !hasAddress;
  addressEmpty.hidden = !isDelivery || hasAddress;
  deliverySection.hidden = !isDelivery || !hasAddress;

  $("summary-delivery-row").hidden = !isDelivery;

  deliveryFee = isDelivery && deliveryDistanceKm !== null
    ? calculateDeliveryFee(deliveryDistanceKm, selectedDelivery)
    : 0;

  updateSummary();
  updateOrderButton();
}

async function loadStore() {
  try {
    const snapshot = await get(ref(db, "store"));

    storeData = snapshot.exists() ? snapshot.val() : {};

    $("store-name").textContent =
      storeData.name ||
      storeData.storeName ||
      storeData.outletName ||
      "KOPICU";

    renderServices();
    await calculateDeliveryDistance();

  } catch (error) {
    console.error("Gagal memuat data toko:", error);
  }
}

function updateDeliverySelection() {
  document.querySelectorAll(".delivery-option").forEach(option => {
    const radio = option.querySelector("input");

    if (!radio) return;

    option.classList.toggle("active", radio.checked);
  });

  const selected = document.querySelector(
    'input[name="delivery-type"]:checked'
  );

  if (!selected) return;

  selectedDelivery = selected.value;

  const isDelivery = document.querySelector(
    ".service-option.active"
  )?.dataset.service === "delivery";

  deliveryFee = isDelivery && deliveryDistanceKm !== null
    ? calculateDeliveryFee(deliveryDistanceKm, selectedDelivery)
    : 0;

  updateSummary();
  updateDeliveryPrices();
}

function selectPayment() {
  showPopup({
    title: "Metode Pembayaran",
    message: "Pilih metode pembayaran yang ingin digunakan.",
    icon: "fa-wallet",
    actions: [
      {
        label: "COD",
        html: '<i class="fa-solid fa-money-bill-wave"></i> COD',
        type: paymentMethod === "COD" ? "primary" : "",
        onClick: () => setPaymentMethod("COD")
      },
      {
        label: "QRIS",
        html: '<i class="fa-solid fa-qrcode"></i> QRIS',
        type: paymentMethod === "QRIS" ? "primary" : "",
        onClick: () => setPaymentMethod("QRIS")
      },
      {
        label: "Batal"
      }
    ]
  });
}

function setPaymentMethod(method) {
  paymentMethod = method;

  localStorage.setItem(
    "kopicu_payment_method",
    paymentMethod
  );

  $("payment-method").textContent = paymentMethod;
}

function showVoucher() {
  showPopup({
    title: "Voucher",
    message: "Voucher belum tersedia. Silakan coba kembali nanti.",
    icon: "fa-ticket"
  });
}

async function editProductOptions(itemId) {
  const item = checkoutItems.find(item => item.id === itemId);

  if (!item) return;

  if (!item.productId) {
    showPopup({
      title: "Produk Tidak Ditemukan",
      message: "ID produk tidak tersedia. Silakan tambahkan ulang produk ke keranjang.",
      icon: "fa-circle-exclamation"
    });
    return;
  }

  try {
    const [productSnapshot, groupsSnapshot] = await Promise.all([
      get(ref(db, `products/${item.productId}`)),
      get(ref(db, "optionGroups"))
    ]);

    if (!productSnapshot.exists()) {
      showPopup({
        title: "Produk Tidak Ditemukan",
        message: "Data produk tidak tersedia.",
        icon: "fa-circle-exclamation"
      });
      return;
    }

    const product = productSnapshot.val();

    const allGroups = groupsSnapshot.exists()
      ? groupsSnapshot.val()
      : {};

    const groupIds = Array.isArray(product.optionGroups)
      ? product.optionGroups
      : [];

    if (!groupIds.length) {
      showPopup({
        title: "Tidak Ada Pilihan",
        message: "Produk ini tidak memiliki grup opsi.",
        icon: "fa-circle-info"
      });
      return;
    }

    const previousSelections = item.selectedOptions || [];

    const groups = groupIds
      .map(groupId => {
        const group = allGroups[groupId];

        if (!group) return null;

        return {
          id: groupId,
          name: group.name || "Pilihan",
          required: group.required === true,
          multiple: group.multiple === true,
          options: Array.isArray(group.options)
            ? group.options
            : Object.values(group.options || {})
        };
      })
      .filter(Boolean);

    if (!groups.length) {
      showPopup({
        title: "Pilihan Tidak Tersedia",
        message: "Grup opsi produk tidak ditemukan.",
        icon: "fa-circle-info"
      });
      return;
    }

    document.getElementById("checkout-popup-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "checkout-popup-overlay";
    overlay.className = "checkout-popup-overlay";

    overlay.innerHTML = `
      <div class="checkout-popup">
        <div class="checkout-popup-icon">
          <i class="fa-solid fa-sliders"></i>
        </div>

        <h3 class="checkout-popup-title">Ubah Pilihan</h3>

        <p class="checkout-popup-message">
          Sesuaikan kembali pilihan untuk ${escapeHTML(item.name || "produk ini")}.
        </p>

        <div class="checkout-option-list">
          ${groups.map(group => {
            const previousGroup = previousSelections.find(
              selected => selected.groupId === group.id
            );

            const selectedNames = (previousGroup?.options || [])
              .map(option => option.name);

            return `
              <div
                class="checkout-option-group"
                data-group-id="${escapeHTML(group.id)}"
                data-group-name="${escapeHTML(group.name)}"
                data-required="${group.required}"
                data-multiple="${group.multiple}"
              >
                <h4>${escapeHTML(group.name)}</h4>

                <p class="checkout-option-hint">
                  ${group.required ? "Wajib dipilih" : "Opsional"}
                  ${group.multiple
                    ? " · Bisa pilih lebih dari satu"
                    : " · Pilih satu"}
                </p>

                ${group.options.map((option, index) => {
                  const checked = selectedNames.includes(option.name);
                  const inputType = group.multiple ? "checkbox" : "radio";

                  return `
                    <label class="checkout-option-choice">
                      <span>
                        <input
                          type="${inputType}"
                          name="checkout-option-${escapeHTML(group.id)}"
                          value="${index}"
                          data-option-name="${escapeHTML(option.name)}"
                          data-option-price="${Number(option.price) || 0}"
                          ${checked ? "checked" : ""}
                        >
                        ${escapeHTML(option.name)}
                      </span>

                      <span class="checkout-option-price">
                        ${Number(option.price) > 0
                          ? "+" + formatRupiah(option.price)
                          : "Gratis"}
                      </span>
                    </label>
                  `;
                }).join("")}
              </div>
            `;
          }).join("")}
        </div>

        <p class="checkout-option-error">
          Lengkapi pilihan yang wajib dipilih.
        </p>

        <div class="checkout-popup-actions">
          <button
            type="button"
            class="checkout-popup-button primary checkout-option-save"
          >
            Simpan Perubahan
          </button>

          <button
            type="button"
            class="checkout-popup-button checkout-option-cancel"
          >
            Batal
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".checkout-option-save")
      .addEventListener("click", () => {
        const selectedOptions = [];
        let invalid = false;

        overlay.querySelectorAll(".checkout-option-group")
          .forEach(groupElement => {
            const groupId = groupElement.dataset.groupId;
            const groupName = groupElement.dataset.groupName;
            const required = groupElement.dataset.required === "true";

            const checkedInputs = groupElement.querySelectorAll(
              "input:checked"
            );

            if (required && !checkedInputs.length) {
              invalid = true;
            }

            selectedOptions.push({
              groupId,
              groupName,
              options: Array.from(checkedInputs).map(input => ({
                name: input.dataset.optionName,
                price: Number(input.dataset.optionPrice) || 0
              }))
            });
          });

        if (invalid) {
          overlay.querySelector(".checkout-option-error").style.display =
            "block";
          return;
        }

        const optionTotal = selectedOptions.reduce(
          (total, group) =>
            total + group.options.reduce(
              (sum, option) => sum + option.price,
              0
            ),
          0
        );

        item.selectedOptions = selectedOptions;
        item.unitPrice = Number(item.basePrice || 0) + optionTotal;
        item.totalPrice = item.unitPrice * item.quantity;
        item.updatedAt = Date.now();

        saveCheckoutItems();
        renderProducts();

        overlay.remove();
      });

    overlay.querySelector(".checkout-option-cancel")
      .addEventListener("click", () => {
        overlay.remove();
      });

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

  } catch (error) {
    console.error("Gagal memuat grup opsi:", error);

    showPopup({
      title: "Gagal Memuat Pilihan",
      message: "Terjadi kesalahan saat mengambil grup opsi produk.",
      icon: "fa-circle-exclamation"
    });
  }
}

function placeOrder() {
  if (!checkoutItems.length) {
    showPopup({
      title: "Pesanan Kosong",
      message: "Belum ada produk yang dipilih.",
      icon: "fa-basket-shopping"
    });
    return;
  }

  const activeService = document.querySelector(
    ".service-option.active"
  )?.dataset.service;

  if (!activeService) {
    showPopup({
      title: "Layanan Tidak Tersedia",
      message: "Silakan pilih layanan pesanan terlebih dahulu.",
      icon: "fa-store"
    });
    return;
  }

  if (activeService === "delivery" && !getFullAddress()) {
    showPopup({
      title: "Alamat Belum Diisi",
      message: "Tambahkan alamat terlebih dahulu sebelum melanjutkan pesanan.",
      icon: "fa-location-dot",
      actions: [
        {
          label: "Tambahkan Alamat",
          type: "primary",
          onClick: () => {
            window.location.href = "alamat.html";
          }
        },
        {
          label: "Batal"
        }
      ]
    });
    return;
  }

  if (!paymentMethod) {
    showPopup({
      title: "Pembayaran Belum Dipilih",
      message: "Silakan pilih metode pembayaran terlebih dahulu.",
      icon: "fa-wallet",
      actions: [
        {
          label: "Pilih Pembayaran",
          type: "primary",
          onClick: selectPayment
        },
        {
          label: "Batal"
        }
      ]
    });
    return;
  }

  showPopup({
    title: "Pesanan Siap",
    message: "Fitur pengiriman pesanan akan dihubungkan pada tahap berikutnya.",
    icon: "fa-circle-check"
  });
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "../keranjang/keranjang.html";
  }
}

productList.addEventListener("click", event => {
  const button = event.target.closest("button");

  if (!button) return;

  const product = button.closest(".checkout-product");
  const itemId = product?.dataset.productId;

  if (!itemId) return;

  if (button.classList.contains("quantity-decrease")) {
    updateQuantity(itemId, -1);
  }

  if (button.classList.contains("quantity-increase")) {
    updateQuantity(itemId, 1);
  }

  if (button.dataset.action === "edit-options") {
    editProductOptions(itemId);
  }
});

document.querySelectorAll(".service-option").forEach(button => {
  button.addEventListener("click", () => {
    updateService(button.dataset.service);
  });
});

document.querySelectorAll(
  'input[name="delivery-type"]'
).forEach(radio => {
  radio.addEventListener("change", updateDeliverySelection);
});

$("voucher-button").addEventListener("click", showVoucher);
$("payment-button").addEventListener("click", selectPayment);
$("place-order-button").addEventListener("click", placeOrder);
$("back-button").addEventListener("click", goBack);

async function initializeCheckout() {
  showCheckoutLoading();

  try {
    loadCheckoutItems();

    if (!checkoutItems.length) {
      window.location.replace("../product.html");
      return;
    }

    loadAddress();

    if (paymentMethod) {
      $("payment-method").textContent = paymentMethod;
    }

    updateDeliverySelection();
    renderProducts();

    await loadStore();

    if (
      document.querySelector(".service-option.active")
      ?.dataset.service === "delivery" &&
      deliveryDistanceKm === null
    ) {
      showPopup({
        title: "Jarak Belum Tersedia",
        message: "Tidak dapat menghitung jarak pengiriman. Silakan periksa kembali lokasi toko dan alamat pengiriman.",
        icon: "fa-location-dot"
      });
    }

  } catch (error) {
    console.error("Gagal memuat checkout:", error);
  } finally {
    hideCheckoutLoading();
  }
}

initializeCheckout();
