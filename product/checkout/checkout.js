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

const deliveryPrices = {
  priority: 10000,
  standard: 7500,
  economy: 1500
};

const deliveryLabels = {
  priority: "Prioritas",
  standard: "Standar",
  economy: "Hemat"
};

let checkoutItems = [];
let storeData = {};
let selectedDelivery = "standard";
let deliveryFee = deliveryPrices.standard;
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

  const disabled = isDelivery && !hasAddress;

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

  deliveryFee = isDelivery
    ? deliveryPrices[selectedDelivery]
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

  } catch (error) {
    console.error("Gagal memuat data toko:", error);
  }
}

function updateDeliverySelection() {
  document.querySelectorAll(".delivery-option").forEach(option => {
    const radio = option.querySelector("input");

    if (!radio) return;

    option.classList.toggle(
      "active",
      radio.checked
    );
  });

  const selected = document.querySelector(
    'input[name="delivery-type"]:checked'
  );

  if (!selected) return;

  selectedDelivery = selected.value;
  deliveryFee = deliveryPrices[selectedDelivery] || 0;

  updateSummary();
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

function editProductOptions(itemId) {
  showPopup({
    title: "Ubah Pesanan",
    message: "Pengaturan grup opsi produk akan tersedia pada tahap berikutnya.",
    icon: "fa-sliders"
  });
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
    loadAddress();

    if (paymentMethod) {
      $("payment-method").textContent = paymentMethod;
    }

    updateDeliverySelection();
    renderProducts();

    await loadStore();

  } catch (error) {
    console.error("Gagal memuat checkout:", error);
  } finally {
    hideCheckoutLoading();
  }
}

initializeCheckout();
