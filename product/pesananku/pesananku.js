import { db } from "../../database/firebase.js";

import {
  ref,
  get,
  onValue,
  remove
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

const ORDER_HISTORY_KEY = "kopicu_order_history";

let pendingCancelTimer = null;
let pendingCancelSince = null;
let isCancellingOrder = false;

function redirectToProduct() {
  localStorage.removeItem(CURRENT_ORDER_KEY);
  window.location.href = "../product.html";
}

const STATUS_LIST = [
  {
    title: "Calling!",
    description: "Sedang Menghubungi Resto Untuk Menyiapkan Pesanan!",
    icon: "fa-phone"
  },
  {
    title: "Proses!",
    description: "Sedang Menyiapkan Pesanan Untuk Dijemput!",
    icon: "fa-utensils"
  },
  {
    title: "Siap!",
    description: "Pesananmu Siap Dijemput, Dan Segera Untuk Diambil Diresto!",
    icon: "fa-motorcycle"
  },
  {
    title: "Berhasil!",
    description: "Pesananmu Berhasil Dijemput Dan Siap Dihidangkan!",
    icon: "fa-store"
  }
];

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

function getSafeImageUrl(value) {
  const url = String(value || "").trim();

  if (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("data:image/")
  ) {
    return url;
  }

  return "";
}

function formatDate(value) {
  if (!value) return "—";

  let date;

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    let timestamp = Number(value);

    if (timestamp < 1000000000000) {
      timestamp *= 1000;
    }

    date = new Date(timestamp);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(/\./g, ":");
}

function getOrderItems(items) {
  if (Array.isArray(items)) {
    return items;
  }

  if (items && typeof items === "object") {
    return Object.values(items);
  }

  return [];
}

function getOrderStatus(status, agreement) {
  const normalized = String(status || "calling")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  const approved = String(agreement || "")
    .toLowerCase()
    .trim() === "approved";

  if (["ready", "siap", "ready_for_pickup"].includes(normalized)) {
    return 2;
  }

  if (
    ["completed", "success", "berhasil", "picked_up", "done", "selesai"]
      .includes(normalized)
  ) {
    return 3;
  }

  if (
    ["processing", "proses", "preparing", "prepared"].includes(normalized)
  ) {
    return approved ? 1 : 0;
  }

  return approved ? 1 : 0;
}

function renderStatus(status, agreement) {
  const activeIndex = getOrderStatus(status, agreement);

  const items = document.querySelectorAll(".status-item");
  const progressLines = document.querySelectorAll(".progress-line");
  const progressIcons = document.querySelectorAll(".status-progress span");

  items.forEach((item, index) => {
    const isActive = index === activeIndex;

    item.hidden = !isActive;
    item.style.display = isActive ? "" : "none";

    item.classList.toggle("active", isActive);
    item.classList.toggle("completed", index < activeIndex);

    const title = item.querySelector("h3");
    const description = item.querySelector("p");
    const icon = item.querySelector(".status-icon i");

    if (title) title.textContent = STATUS_LIST[index].title;
    if (description) description.textContent = STATUS_LIST[index].description;
    if (icon) icon.className = `fa-solid ${STATUS_LIST[index].icon}`;
  });

  progressLines.forEach((line, index) => {
    line.style.background =
      index < activeIndex ? "#38251d" : "#eeeeee";

    line.classList.toggle(
      "progress-animated",
      index === activeIndex && activeIndex < 3
    );
  });

  progressIcons.forEach((icon, index) => {
    const isActive = index === activeIndex;
    const isCompleted = index < activeIndex;

    icon.style.background =
      isActive || isCompleted ? "#fff0e3" : "#f1f1f1";

    icon.style.color =
      isActive || isCompleted ? "#38251d" : "#999999";

    icon.style.borderColor =
      isActive || isCompleted ? "#f1dfd2" : "#eeeeee";
  });

  if (actionSection) {
    actionSection.hidden = activeIndex !== 3;
  }
}

function renderProducts(items = []) {
  const products = getOrderItems(items);

  if (!products.length) {
    orderList.innerHTML = `
      <div class="empty-order">
        <i class="fa-solid fa-basket-shopping"></i>
        <p>Rincian produk belum tersedia.</p>
      </div>
    `;
    return;
  }

  orderList.innerHTML = products.map(item => {
    const quantity = Math.max(1, Number(item.quantity) || 1);

    const unitPrice = Number(
      item.unitPrice ??
      item.price ??
      item.basePrice ??
      0
    );

    const totalPrice = Number(
      item.totalPrice ?? unitPrice * quantity
    );

    const image = getSafeImageUrl(
      item.image ||
      item.imageUrl ||
      item.images?.[0]
    );

    const name = escapeHTML(item.name || "Produk");

    const options = Array.isArray(item.selectedOptions)
      ? item.selectedOptions
          .map(option => {
            if (typeof option === "string") return option;
            return option?.name || option?.label || "";
          })
          .filter(Boolean)
          .join(", ")
      : "";

    return `
      <div class="order-product">
        ${
          image
            ? `
              <img
                src="${escapeHTML(image)}"
                alt="${name}"
                class="product-image"
                loading="lazy"
              >
            `
            : `
              <div class="product-image product-image-placeholder">
                <i class="fa-solid fa-mug-hot"></i>
              </div>
            `
        }

        <div class="product-info">
          <p class="product-name">
            ${quantity} × ${name}
          </p>

          ${
            options
              ? `
                <small class="product-options">
                  ${escapeHTML(options)}
                </small>
              `
              : ""
          }
        </div>

        <strong class="product-price">
          ${rupiah(totalPrice)}
        </strong>
      </div>
    `;
  }).join("");
}

function renderPriceSummary(order) {
  const items = getOrderItems(order.items);

  const subtotal = Number(
    order.subtotal ??
    items.reduce((total, item) => {
      const quantity = Number(item.quantity) || 1;
      const price = Number(
        item.unitPrice ??
        item.price ??
        item.basePrice ??
        0
      );

      return total + price * quantity;
    }, 0)
  );

  const discount = Number(
    order.voucherDiscount ??
    order.discount ??
    0
  );

  const serviceFee = Number(order.serviceFee) || 0;

  const deliveryFee = Number(order.deliveryFee) || 0;

  const total = Number(
    order.total ??
    subtotal - discount + serviceFee + deliveryFee
  );

  const menuCount = items.reduce(
    (count, item) => count + (Number(item.quantity) || 1),
    0
  );

  const subtotalElement = $("order-subtotal");
  const discountElement = $("order-discount");
  const serviceFeeElement = $("order-service-fee");
  const totalElement = $("order-total");

  if (subtotalElement) {
    subtotalElement.textContent =
      `${rupiah(subtotal)} (${menuCount} menu)`;
  }

  if (discountElement) {
    discountElement.textContent = `-${rupiah(discount)}`;
  }

  if (serviceFeeElement) {
    serviceFeeElement.textContent = rupiah(
      serviceFee + deliveryFee
    );
  }

  if (totalElement) {
    totalElement.textContent = rupiah(total);
  }
}

function getStoreAddress(order) {
  const store = order.store || {};

  return (
    store.address ||
    store.fullAddress ||
    store.alamat ||
    store.storeAddress ||
    order.storeAddress ||
    order.pickupAddress ||
    "Alamat toko belum tersedia."
  );
}

function renderOrder(order) {
  currentOrder = order;

  renderStatus(order.status, order.agreement);
  renderProducts(order.items);
  renderPriceSummary(order);

  orderNumber.textContent =
    order.orderNumber ||
    currentOrderId ||
    "—";

  orderDate.textContent = formatDate(
    order.createdAt ||
    order.orderDate ||
    order.timestamp
  );

  paymentMethod.textContent =
    order.paymentMethod || "—";

  const noteElement = $("order-note");

  if (noteElement) {
    noteElement.textContent =
      String(order.additionalNote || "").trim() || "Tidak Ada";
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

  if (isPickup) {
    renderStoreMap(order);
  }

  renderCancellationControls(order);
  schedulePendingCancellation(order);
}

function renderStoreMap(order) {
  const store = order.store || {};
  const address = getStoreAddress(order);

  const latitude =
    store.latitude ??
    store.lat ??
    order.storeLatitude;

  const longitude =
    store.longitude ??
    store.lng ??
    order.storeLongitude;

  if (!pickupAddress) return;

  pickupAddress.textContent = address;

  pickupAddress.style.display = "-webkit-box";
  pickupAddress.style.webkitBoxOrient = "vertical";
  pickupAddress.style.webkitLineClamp = "2";
  pickupAddress.style.overflow = "hidden";
  pickupAddress.style.overflowWrap = "anywhere";

  const pickupSection = document.querySelector(
    ".pickup-location-section"
  );

  if (!pickupSection) return;

  let mapContainer = $("pickup-map");

  if (!mapContainer) {
    mapContainer = document.createElement("div");
    mapContainer.id = "pickup-map";
    pickupAddress.insertAdjacentElement("afterend", mapContainer);
  }

  mapContainer.style.width = "100%";
  mapContainer.style.height = "180px";
  mapContainer.style.marginTop = "12px";
  mapContainer.style.overflow = "hidden";
  mapContainer.style.borderRadius = "12px";
  mapContainer.style.background = "#f5f5f5";

  let destination = "";

  if (
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    latitude !== "" &&
    longitude !== ""
  ) {
    destination = `${latitude},${longitude}`;
  } else if (
    address &&
    address !== "Alamat toko belum tersedia."
  ) {
    destination = address;
  }

  if (!destination) {
    mapContainer.innerHTML = `
      <div style="padding:20px;text-align:center;color:#777;">
        <i class="fa-solid fa-map-location-dot"></i>
        <p>Lokasi toko belum tersedia.</p>
      </div>
    `;
    return;
  }

  const destinationUrl = encodeURIComponent(destination);

  const showMap = origin => {
    const mapUrl = origin
      ? `https://maps.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${destinationUrl}&output=embed`
      : `https://maps.google.com/maps?q=${destinationUrl}&output=embed`;

    mapContainer.innerHTML = `
      <iframe
        src="${mapUrl}"
        width="100%"
        height="180"
        style="border:0;display:block;"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    `;
  };

  if (!navigator.geolocation) {
    showMap("");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      showMap(
        `${position.coords.latitude},${position.coords.longitude}`
      );
    },
    () => {
      showMap("");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

function renderOrderMessage(icon, message) {
  if (!orderList) return;

  orderList.innerHTML = `
    <div class="empty-order">
      <i class="fa-solid ${icon}"></i>
      <p>${escapeHTML(message)}</p>
    </div>
  `;

  if (actionSection) {
    actionSection.hidden = true;
  }

  const cancelSection = $("order-cancel-section");

  if (cancelSection) {
    cancelSection.hidden = true;
    cancelSection.innerHTML = "";
  }
}

function listenOrder() {
  if (!currentOrderId) {
    redirectToProduct();
    return;
  }

  const orderRef = ref(db, `orders/${currentOrderId}`);

  onValue(
    orderRef,
    snapshot => {
      if (!snapshot.exists()) {
        if (isCancellingOrder) return;

        redirectToProduct();
        return;
      }

      renderOrder(snapshot.val());
    },
    error => {
      console.error("Gagal memuat pesanan:", error);

      if (isCancellingOrder) return;

      renderOrderMessage(
        "fa-wifi",
        "Gagal memuat pesanan. Periksa koneksi internet kamu."
      );
    }
  );
}

function saveOrderHistory(order, status = "Dibatalkan") {
  let history = [];

  try {
    const storedHistory = JSON.parse(
      localStorage.getItem(ORDER_HISTORY_KEY) || "[]"
    );

    history = Array.isArray(storedHistory) ? storedHistory : [];
  } catch {
    history = [];
  }

  const savedOrder = {
    ...order,
    orderId: currentOrderId,
    orderNumber: order.orderNumber || currentOrderId,
    status,
    originalStatus: order.status || "",
    cancelledAt: Date.now()
  };

  const existingIndex = history.findIndex(
    item => item.orderId === currentOrderId
  );

  if (existingIndex >= 0) {
    history[existingIndex] = savedOrder;
  } else {
    history.unshift(savedOrder);
  }

  localStorage.setItem(
    ORDER_HISTORY_KEY,
    JSON.stringify(history)
  );
}

async function cancelOrder(automatic = false) {
  if (!currentOrder || !currentOrderId || isCancellingOrder) {
    return;
  }

  isCancellingOrder = true;

  const orderId = currentOrderId;
  const orderData = currentOrder;

  try {
    await remove(ref(db, `orders/${orderId}`));

    saveOrderHistory(orderData);

    if (pendingCancelTimer) {
      clearTimeout(pendingCancelTimer);
      pendingCancelTimer = null;
    }

    localStorage.removeItem(`kopicu_pending_since_${orderId}`);

    currentOrder = null;

    redirectToProduct();

  } catch (error) {
    console.error("Gagal membatalkan pesanan:", error);
    isCancellingOrder = false;

    alert("Pesanan gagal dibatalkan. Silakan coba kembali.");
  }
}

function confirmCancelOrder() {
  const section = $("order-cancel-section");

  if (!section) return;

  section.hidden = false;

  section.innerHTML = `
    <div class="cancel-confirmation">
      <p>Apa kamu yakin ingin membatalkan pesanan ini?</p>

      <div class="cancel-confirmation-actions">
        <button type="button" id="confirm-cancel-yes">
          Ya, Batalkan
        </button>

        <button type="button" id="confirm-cancel-no">
          Tidak
        </button>
      </div>
    </div>
  `;

  $("confirm-cancel-yes").addEventListener("click", () => {
    cancelOrder(false);
  });

  $("confirm-cancel-no").addEventListener("click", () => {
    if (currentOrder) {
      renderCancellationControls(currentOrder);
    }
  });
}

function renderCancellationControls(order) {
  let section = $("order-cancel-section");

  if (!section) {
    section = document.createElement("section");
    section.id = "order-cancel-section";
    section.className = "order-cancel-section";

    const page = document.querySelector(".order-page");

    if (page) {
      page.appendChild(section);
    }
  }

  if (!section) return;

  const agreement = String(order.agreement || "")
    .toLowerCase()
    .trim();

  section.innerHTML = "";

  if (["pending", "approved"].includes(agreement)) {
    section.hidden = false;

    section.innerHTML = `
      <button
        type="button"
        id="cancel-order-button"
        class="cancel-order-button"
      >
        <i class="fa-solid fa-xmark"></i>
        Batalkan Pesanan
      </button>
    `;

    $("cancel-order-button").addEventListener(
      "click",
      confirmCancelOrder
    );

  } else {
    section.hidden = true;
  }
}

function schedulePendingCancellation(order) {
  const agreement = String(order.agreement || "")
    .toLowerCase()
    .trim();

  if (pendingCancelTimer) {
    clearTimeout(pendingCancelTimer);
    pendingCancelTimer = null;
  }

  if (agreement !== "pending") {
    localStorage.removeItem(
      `kopicu_pending_since_${currentOrderId}`
    );

    return;
  }

  const storageKey =
    `kopicu_pending_since_${currentOrderId}`;

  function parseTimestamp(value) {
    if (!value) return 0;

    let timestamp;

    if (
      typeof value === "number" ||
      /^\d+$/.test(String(value))
    ) {
      timestamp = Number(value);

      if (timestamp < 1000000000000) {
        timestamp *= 1000;
      }
    } else {
      timestamp = new Date(value).getTime();
    }

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  let agreementTime =
    parseTimestamp(order.agreementAt) ||
    parseTimestamp(order.agreementPendingAt) ||
    parseTimestamp(localStorage.getItem(storageKey));

  if (!agreementTime) {
    agreementTime = Date.now();

    localStorage.setItem(
      storageKey,
      String(agreementTime)
    );
  }

  pendingCancelSince = agreementTime;

  const fiveMinutes = 5 * 60 * 1000;

  const remainingTime = Math.max(
    0,
    fiveMinutes - (Date.now() - agreementTime)
  );

  pendingCancelTimer = setTimeout(async () => {
    if (!currentOrder || isCancellingOrder) return;

    try {
      const latestSnapshot = await get(
        ref(db, `orders/${currentOrderId}`)
      );

      if (!latestSnapshot.exists()) {
        redirectToProduct();
        return;
      }

      const latestOrder = latestSnapshot.val();

      if (
        String(latestOrder.agreement || "")
          .toLowerCase()
          .trim() !== "pending"
      ) {
        return;
      }

      currentOrder = latestOrder;

      await cancelOrder(true);

    } catch (error) {
      console.error(
        "Gagal memeriksa status pembatalan otomatis:",
        error
      );
    }
  }, remainingTime);
}

async function copyOrderNumber() {
  const value = orderNumber.textContent.trim();

  if (!value || value === "—") return;

  try {
    await navigator.clipboard.writeText(value);

    copyButton.innerHTML = `
      <i class="fa-solid fa-check"></i>
      <span>Tersalin</span>
    `;

    copyButton.disabled = true;

    setTimeout(() => {
      copyButton.innerHTML = `
        <i class="fa-regular fa-copy"></i>
        <span>Salin</span>
      `;

      copyButton.disabled = false;
    }, 1600);

  } catch (error) {
    console.error("Gagal menyalin nomor pesanan:", error);

    const textArea = document.createElement("textarea");

    textArea.value = value;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand("copy");

      copyButton.innerHTML = `
        <i class="fa-solid fa-check"></i>
        <span>Tersalin</span>
      `;
    } catch {
      alert("Nomor pesanan gagal disalin.");
    }

    textArea.remove();

    setTimeout(() => {
      copyButton.innerHTML = `
        <i class="fa-regular fa-copy"></i>
        <span>Salin</span>
      `;
    }, 1600);
  }
}

function orderAgain() {
  window.location.href = "../product.html";
}

async function showHelp() {
  try {
    const snapshot = await get(
      ref(db, "store/restaurantPhone")
    );

    if (!snapshot.exists()) {
      alert("Nomor WhatsApp restoran belum tersedia.");
      return;
    }

    let phone = String(snapshot.val()).replace(/\D/g, "");

    if (phone.startsWith("0")) {
      phone = "62" + phone.slice(1);
    } else if (phone.startsWith("8")) {
      phone = "62" + phone;
    }

    if (!phone) {
      alert("Nomor WhatsApp restoran tidak valid.");
      return;
    }

    const orderCode =
      currentOrder?.orderNumber || currentOrderId || "";

    const message = encodeURIComponent(
      `Halo, saya ingin bertanya mengenai pesanan ${orderCode}.`
    );

    window.open(
      `https://wa.me/${phone}?text=${message}`,
      "_blank"
    );

  } catch (error) {
    console.error("Gagal mengambil nomor WhatsApp:", error);
    alert("Tidak dapat membuka WhatsApp. Silakan coba kembali.");
  }
}

function initializePesananku() {
  if (copyButton) {
    copyButton.addEventListener("click", copyOrderNumber);
  }

  if (orderAgainButton) {
    orderAgainButton.addEventListener("click", orderAgain);
  }

  const helpButton = document.querySelector(".help-button");

  if (helpButton) {
    helpButton.addEventListener("click", showHelp);
  }

  listenOrder();
}

initializePesananku();
