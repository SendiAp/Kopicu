import { db } from "../../database/firebase.js";

import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const $ = id => document.getElementById(id);

const orderList = $("order-product-list");
const orderNumber = $("order-number");
const orderDate = $("order-date");
const paymentMethod = $("payment-method");
const pickupAddress = $("pickup-address");
const actionSection = $("order-action-section");
const copyButton = $("copy-order-number");
const orderAgainButton = $("order-again-button");

const CURRENT_ORDER_KEY = "kopicu_current_order_id";

let currentOrderId = localStorage.getItem(CURRENT_ORDER_KEY);
let currentOrder = null;
let redirectingToMaps = false;

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
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

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(/\./g, ":");
}

function getOrderStatus(status) {
  const normalized = String(status || "processing")
    .toLowerCase()
    .trim();

  if (["ready", "siap", "prepared"].includes(normalized)) {
    return 1;
  }

  if (["completed", "success", "berhasil", "picked_up"].includes(normalized)) {
    return 2;
  }

  return 0;
}

function renderStatus(status) {
  const activeIndex = getOrderStatus(status);
  const items = document.querySelectorAll(".status-item");
  const progressLines = document.querySelectorAll(".progress-line");
  const progressIcons = document.querySelectorAll(".status-progress span");

  items.forEach((item, index) => {
    item.classList.toggle("active", index <= activeIndex);
  });

  progressLines.forEach((line, index) => {
    line.style.background = index < activeIndex ? "#38251d" : "#eeeeee";
  });

  progressIcons.forEach((icon, index) => {
    icon.style.background = index <= activeIndex ? "#fff0e3" : "#f1f1f1";
  });

  const statusDescriptions = [
    "Pesananmu Sedang Disiapkan.",
    "Pesananmu Siap Diambil.",
    "Pesananmu Berhasil Diambil!"
  ];

  items.forEach((item, index) => {
    const description = item.querySelector("p");

    if (description) {
      description.textContent = statusDescriptions[index];
    }
  });

  actionSection.hidden = activeIndex !== 2;
}

function renderProducts(items = []) {
  if (!Array.isArray(items) || !items.length) {
    orderList.innerHTML = `
      <p style="color:#888;font-size:12px;">
        Rincian produk tidak tersedia.
      </p>
    `;
    return;
  }

  orderList.innerHTML = items.map(item => {
    const quantity = Number(item.quantity) || 1;
    const price = Number(
      item.unitPrice ??
      item.price ??
      item.basePrice ??
      0
    );

    const totalPrice = Number(
      item.totalPrice ?? price * quantity
    );

    const image = item.image || item.imageUrl || "";

    return `
      <div class="order-product">
        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(item.name || "Produk")}"
          class="product-image"
          ${image ? "" : "hidden"}
        >

        <div class="product-info">
          <p class="product-name">
            ${quantity} × ${escapeHTML(item.name || "Produk")}
          </p>
        </div>

        <strong class="product-price">
          ${rupiah(totalPrice)}
        </strong>
      </div>
    `;
  }).join("");
}

function renderPriceSummary(order) {
  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(
    order.voucherDiscount ?? order.discount ?? 0
  );
  const serviceFee = Number(order.serviceFee) || 0;
  const total = Number(
    order.total ?? subtotal - discount + serviceFee
  );

  const menuCount = Array.isArray(order.items)
    ? order.items.reduce(
        (total, item) => total + (Number(item.quantity) || 1),
        0
      )
    : 0;

  const summary = document.querySelector(".price-summary");

  if (!summary) return;

  summary.innerHTML = `
    <div class="price-row">
      <span>Subtotal Pesanan (${menuCount} menu)</span>
      <strong>${rupiah(subtotal)}</strong>
    </div>

    <div class="price-row">
      <span>Voucher Diskon</span>
      <strong>-${rupiah(discount)}</strong>
    </div>

    <div class="price-row">
      <span>Biaya Layanan</span>
      <strong>${rupiah(serviceFee)}</strong>
    </div>

    <div class="price-divider"></div>

    <div class="grand-total">
      <strong>${rupiah(total)}</strong>
      <span>Sudah Termasuk Pajak</span>
    </div>
  `;
}

function renderOrder(order) {
  currentOrder = order;

  renderStatus(order.status);
  renderProducts(order.items);
  renderPriceSummary(order);

  orderNumber.textContent =
    order.orderNumber || currentOrderId || "-";

  orderDate.textContent = formatDate(
    order.createdAt || order.orderDate
  );

  paymentMethod.textContent =
    order.paymentMethod || "-";

  pickupAddress.textContent =
    order.store?.address ||
    order.storeAddress ||
    order.pickupAddress ||
    "Alamat toko belum tersedia.";

  const note = document.querySelector(
    ".order-information-section .information-row"
  );

  if (note) {
    const noteValue = note.querySelector("strong");

    if (noteValue) {
      noteValue.textContent =
        order.additionalNote?.trim() || "Tidak Ada";
    }
  }

  const isPickup =
    order.service === "pickup" ||
    order.serviceType === "pickup";

  const pickupSection = document.querySelector(
    ".pickup-location-section"
  );

  if (pickupSection) {
    pickupSection.hidden = !isPickup;
  }

  if (
    isPickup &&
    getOrderStatus(order.status) === 1 &&
    !redirectingToMaps
  ) {
    redirectToStore(order);
  }
}

function redirectToStore(order) {
  const store = order.store || {};

  const latitude = store.latitude ?? order.storeLatitude;
  const longitude = store.longitude ?? order.storeLongitude;

  const address =
    store.address ||
    order.storeAddress ||
    order.pickupAddress ||
    "";

  let destination = "";

  if (latitude && longitude) {
    destination = `${latitude},${longitude}`;
  } else if (address) {
    destination = address;
  }

  if (!destination) return;

  redirectingToMaps = true;

  const mapsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

  window.location.href = mapsUrl;
}

function listenOrder() {
  if (!currentOrderId) {
    orderList.innerHTML = `
      <p style="color:#888;font-size:13px;text-align:center;">
        Pesanan tidak ditemukan.
      </p>
    `;

    return;
  }

  const orderRef = ref(db, `orders/${currentOrderId}`);

  onValue(orderRef, snapshot => {
    if (!snapshot.exists()) {
      orderList.innerHTML = `
        <p style="color:#888;font-size:13px;text-align:center;">
          Data pesanan tidak ditemukan.
        </p>
      `;

      return;
    }

    renderOrder(snapshot.val());
  }, error => {
    console.error("Gagal memuat pesanan:", error);
  });
}

async function copyOrderNumber() {
  const value = orderNumber.textContent.trim();

  if (!value || value === "-") return;

  try {
    await navigator.clipboard.writeText(value);

    copyButton.textContent = "TERSALIN";

    setTimeout(() => {
      copyButton.textContent = "SALIN";
    }, 1500);

  } catch (error) {
    console.error("Gagal menyalin nomor pesanan:", error);
  }
}

function orderAgain() {
  window.location.href = "../product.html";
}

function initializePesananku() {
  copyButton.addEventListener("click", copyOrderNumber);
  orderAgainButton.addEventListener("click", orderAgain);

  const helpButton = document.querySelector(".help-button");

  helpButton?.addEventListener("click", () => {
    alert("Silakan hubungi KOPICU jika membutuhkan bantuan terkait pesanan.");
  });

  listenOrder();
}

initializePesananku();
