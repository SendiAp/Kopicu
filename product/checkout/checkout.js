import { db } from "../../database/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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

  const fullAddress = addressData?.fullAddress ||
    addressData?.address ||
    addressData?.alamat ||
    "";

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

  const hasAddress = Boolean(fullAddress.trim());

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
}

function renderServices() {
  const services = storeData?.services || {};

  const serviceButtons = [
    {
      key: "delivery",
      label: "Delivery"
    },
    {
      key: "pickup",
      label: "Pickup"
    },
    {
      key: "dineIn",
      label: "Dine In"
    }
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

  addressCard.hidden = !isDelivery || !addressData;
  addressEmpty.hidden = !isDelivery || Boolean(addressData);
  deliverySection.hidden = !isDelivery || !addressData;

  $("summary-delivery-row").hidden = !isDelivery;

  deliveryFee = isDelivery
    ? deliveryPrices[selectedDelivery]
    : 0;

  updateSummary();
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
  const current = paymentMethod || "Belum dipilih";

  const selected = window.prompt(
    `Pilih metode pembayaran:\n1. COD\n2. QRIS\n\nMetode saat ini: ${current}\n\nKetik COD atau QRIS`
  );

  if (!selected) return;

  const method = selected.trim().toUpperCase();

  if (!["COD", "QRIS"].includes(method)) {
    window.alert("Metode pembayaran tidak valid.");
    return;
  }

  paymentMethod = method;

  localStorage.setItem(
    "kopicu_payment_method",
    paymentMethod
  );

  $("payment-method").textContent = paymentMethod;
}

function showVoucher() {
  window.alert("Voucher belum tersedia.");
}

function editProductOptions(itemId) {
  window.alert(
    "Pengaturan grup opsi akan dibuat pada tahap berikutnya."
  );
}

function placeOrder() {
  if (!checkoutItems.length) {
    window.alert("Belum ada produk yang dipilih.");
    return;
  }

  const activeService = document.querySelector(
    ".service-option.active"
  )?.dataset.service;

  if (!activeService) {
    window.alert("Layanan belum tersedia.");
    return;
  }

  if (
    activeService === "delivery" &&
    !addressData
  ) {
    window.alert("Tambahkan alamat terlebih dahulu!");
    window.location.href = "alamat.html";
    return;
  }

  if (!paymentMethod) {
    window.alert("Silakan pilih metode pembayaran terlebih dahulu.");
    return;
  }

  window.alert(
    "Fitur pengiriman pesanan akan dihubungkan pada tahap berikutnya."
  );
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

function initializeCheckout() {
  loadCheckoutItems();
  loadAddress();

  if (paymentMethod) {
    $("payment-method").textContent = paymentMethod;
  }

  updateDeliverySelection();
  renderProducts();
  loadStore();
}

initializeCheckout();
