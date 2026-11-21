import { db } from "../../database/firebase.js";
import {
  ref,
  get,
  update
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const productId = new URLSearchParams(window.location.search).get("id");

const productName = document.getElementById("product-name");
const productPrice = document.getElementById("product-price");
const productImage = document.getElementById("product-image");

const stockEnabled = document.getElementById("stock-enabled");
const stockSettings = document.getElementById("stock-settings");
const currentStock = document.getElementById("current-stock");

const autoResetEnabled = document.getElementById("auto-reset-enabled");
const autoResetSettings = document.getElementById("auto-reset-settings");
const resetStock = document.getElementById("reset-stock");
const resetFrequency = document.getElementById("reset-frequency");
const resetDay = document.getElementById("reset-day");
const resetTime = document.getElementById("reset-time");

const resetDayGroup = document.getElementById("reset-day-group");
const resetTimeGroup = document.getElementById("reset-time-group");
const nextResetCard = document.getElementById("next-reset-card");
const nextResetText = document.getElementById("next-reset-text");

const saveButton = document.getElementById("save-stock-button");
const stockForm = document.getElementById("stock-form");

const WIB_OFFSET = 7 * 60 * 60 * 1000;
const TIME_ZONE = "Asia/Jakarta";

let productData = null;
let originalFormState = null;
let isSaving = false;

saveButton.disabled = true;

const rupiah = (value) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
};

function getFormState() {
  return JSON.stringify({
    stockEnabled: stockEnabled.checked,
    currentStock: currentStock.value,
    autoResetEnabled: autoResetEnabled.checked,
    resetStock: resetStock.value,
    resetFrequency: resetFrequency.value,
    resetDay: resetDay.value,
    resetTime: resetTime.value
  });
}

function updateSaveButton() {
  const hasChanges =
    originalFormState !== null &&
    getFormState() !== originalFormState;

  saveButton.disabled = isSaving || !hasChanges;
}

function getWIBParts(date = new Date()) {
  const wibDate = new Date(date.getTime() + WIB_OFFSET);

  return {
    year: wibDate.getUTCFullYear(),
    month: wibDate.getUTCMonth() + 1,
    day: wibDate.getUTCDate(),
    hour: wibDate.getUTCHours(),
    minute: wibDate.getUTCMinutes(),
    weekday: wibDate.getUTCDay()
  };
}

function createWIBTimestamp(year, month, day, hour, minute) {
  return Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute
  ) - WIB_OFFSET;
}

function getNextResetTimestamp(frequency, day, time) {
  const now = Date.now();
  const parts = getWIBParts(new Date(now));

  if (frequency === "hourly") {
    return createWIBTimestamp(
      parts.year,
      parts.month,
      parts.day,
      parts.hour + 1,
      0
    );
  }

  const [hour, minute] = time.split(":").map(Number);

  let targetTimestamp = createWIBTimestamp(
    parts.year,
    parts.month,
    parts.day,
    hour,
    minute
  );

  if (frequency === "daily") {
    if (targetTimestamp <= now) {
      targetTimestamp += 24 * 60 * 60 * 1000;
    }

    return targetTimestamp;
  }

  if (frequency === "weekly") {
    const targetDay = Number(day);
    let dayDifference = (targetDay - parts.weekday + 7) % 7;

    targetTimestamp += dayDifference * 24 * 60 * 60 * 1000;

    if (targetTimestamp <= now) {
      targetTimestamp += 7 * 24 * 60 * 60 * 1000;
    }

    return targetTimestamp;
  }

  return null;
}

function formatWIBDate(timestamp) {
  const date = new Date(timestamp);

  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);

  const formattedTime = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);

  return `${formattedDate} pukul ${formattedTime} WIB`;
}

function updateSchedulePreview() {
  const frequency = resetFrequency.value;

  resetDayGroup.hidden = frequency !== "weekly";
  resetTimeGroup.hidden = !["daily", "weekly"].includes(frequency);
  nextResetCard.hidden = true;

  if (!autoResetEnabled.checked || !frequency) {
    return;
  }

  if (frequency === "weekly" && !resetDay.value) {
    return;
  }

  const timestamp = getNextResetTimestamp(
    frequency,
    resetDay.value,
    resetTime.value || "00:00"
  );

  if (!timestamp) {
    return;
  }

  nextResetText.textContent = formatWIBDate(timestamp);
  nextResetCard.hidden = false;
}

function updateStockVisibility() {
  stockSettings.hidden = !stockEnabled.checked;
  autoResetSettings.hidden = !autoResetEnabled.checked;

  updateSchedulePreview();
}

function displayProduct(product) {
  productName.textContent = product.name || "Produk tanpa nama";
  productPrice.textContent = rupiah(product.price);

  const imageUrl = product.image || product.images?.[0];

  productImage.replaceChildren();

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = product.name || "Foto produk";

    image.onerror = () => {
      productImage.innerHTML = '<i class="fa-solid fa-image"></i>';
    };

    productImage.appendChild(image);
  } else {
    productImage.innerHTML = '<i class="fa-solid fa-image"></i>';
  }
}

function loadStockSettings(stock) {
  if (!stock || typeof stock !== "object") {
    return;
  }

  stockEnabled.checked = stock.enabled === true;
  currentStock.value = stock.quantity ?? "";

  const autoReset = stock.autoReset || {};

  autoResetEnabled.checked = autoReset.enabled === true;
  resetStock.value = autoReset.quantity ?? "";
  resetFrequency.value = autoReset.frequency || "";
  resetDay.value = autoReset.day ?? "";
  resetTime.value = autoReset.time || "00:00";

  updateStockVisibility();
}

async function loadProduct() {
  if (!sessionStorage.getItem("kopicu_admin_login")) {
    window.location.href = "../login/login.html";
    return;
  }

  if (!productId) {
    Swal.fire({
      icon: "error",
      title: "Produk tidak ditemukan",
      text: "ID produk tidak tersedia."
    });

    return;
  }

  try {
    const snapshot = await get(ref(db, `products/${productId}`));

    if (!snapshot.exists()) {
      Swal.fire({
        icon: "error",
        title: "Produk tidak ditemukan",
        text: "Data produk tidak tersedia."
      });

      return;
    }

    productData = snapshot.val();

    displayProduct(productData);
    loadStockSettings(productData.stock);

    originalFormState = getFormState();
    updateSaveButton();
  } catch (error) {
    console.error("Gagal memuat produk:", error);

    Swal.fire({
      icon: "error",
      title: "Gagal memuat produk",
      text: "Periksa koneksi internet dan coba kembali."
    });
  }
}

stockEnabled.addEventListener("change", updateStockVisibility);
autoResetEnabled.addEventListener("change", updateStockVisibility);

resetFrequency.addEventListener("change", updateSchedulePreview);
resetDay.addEventListener("change", updateSchedulePreview);
resetTime.addEventListener("input", updateSchedulePreview);

stockForm.addEventListener("input", updateSaveButton);
stockForm.addEventListener("change", updateSaveButton);

document.getElementById("back-button").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "product.html";
  }
});

stockForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!productData || !productId || isSaving) {
    return;
  }

  const enabled = stockEnabled.checked;
  const autoEnabled = enabled && autoResetEnabled.checked;

  const quantity = Number(currentStock.value);
  const resetQuantity = Number(resetStock.value);

  if (enabled) {
    if (
      currentStock.value.trim() === "" ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      Swal.fire({
        icon: "warning",
        title: "Jumlah stok tidak valid",
        text: "Masukkan jumlah stok berupa angka bulat minimal 0."
      });

      currentStock.focus();
      return;
    }
  }

  if (autoEnabled) {
    if (
      resetStock.value.trim() === "" ||
      !Number.isInteger(resetQuantity) ||
      resetQuantity < 0
    ) {
      Swal.fire({
        icon: "warning",
        title: "Jumlah reset tidak valid",
        text: "Masukkan jumlah stok tujuan berupa angka bulat minimal 0."
      });

      resetStock.focus();
      return;
    }

    if (!resetFrequency.value) {
      Swal.fire({
        icon: "warning",
        title: "Pilih frekuensi",
        text: "Silakan pilih jadwal pengaturan ulang stok."
      });

      resetFrequency.focus();
      return;
    }

    if (resetFrequency.value === "weekly" && !resetDay.value) {
      Swal.fire({
        icon: "warning",
        title: "Pilih hari",
        text: "Silakan pilih hari untuk reset stok."
      });

      resetDay.focus();
      return;
    }
  }

  let autoResetData = {
    enabled: false,
    quantity: null,
    frequency: null,
    day: null,
    time: null,
    nextResetAt: null
  };

  if (autoEnabled) {
    const frequency = resetFrequency.value;
    const day = frequency === "weekly" ? Number(resetDay.value) : null;
    const time = ["daily", "weekly"].includes(frequency)
      ? resetTime.value || "00:00"
      : null;

    const nextResetAt = getNextResetTimestamp(
      frequency,
      day,
      time || "00:00"
    );

    autoResetData = {
      enabled: true,
      quantity: resetQuantity,
      frequency,
      day,
      time,
      nextResetAt
    };
  }

  const stockData = {
    enabled,
    quantity: enabled ? quantity : 0,
    autoReset: autoResetData
  };

  isSaving = true;
  saveButton.disabled = true;
  saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Menyimpan...</span>';

  try {
    await update(ref(db, `products/${productId}`), {
      stock: stockData,
      updatedAt: Date.now()
    });

    productData.stock = stockData;
    originalFormState = getFormState();

    await Swal.fire({
      icon: "success",
      title: "Berhasil disimpan",
      text: "Pengaturan stok produk berhasil diperbarui."
    });
  } catch (error) {
    console.error("Gagal menyimpan stok:", error);

    Swal.fire({
      icon: "error",
      title: "Gagal menyimpan",
      text: "Terjadi kesalahan saat menyimpan pengaturan stok."
    });
  } finally {
    isSaving = false;
    saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Simpan Perubahan</span>';
    updateSaveButton();
  }
});

loadProduct();
