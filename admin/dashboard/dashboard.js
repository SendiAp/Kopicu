import { db } from "../../database/firebase.js";

import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("/admin/login.html");
} else {
  const username = sessionStorage.getItem("kopicu_admin_username") || "Admin";

  const adminUsername = document.getElementById("admin-username");
  const adminAvatar = document.getElementById("admin-avatar");
  const currentDate = document.getElementById("current-date");

  if (adminUsername) {
    adminUsername.textContent = username;
  }

  if (adminAvatar) {
    adminAvatar.textContent = username.charAt(0).toUpperCase();
  }

  if (currentDate) {
    currentDate.textContent = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());
  }
}

async function initializeSetupProgress() {
  const list = document.getElementById("setup-progress-list");
  const count = document.getElementById("setup-progress-count");
  const fill = document.getElementById("setup-progress-fill");
  const message = document.getElementById("setup-progress-message");

  if (!list || !count || !fill || !message) return;

  const steps = [
    "Buat Semua Data Toko",
    "Buat Minimal 1 Kategori",
    "Buat Minimal 1 Grup Opsi",
    "Buat Minimal 1 Product",
    "Buat Account Karyawan Dan Tambahkan Minimal 1 Karyawan"
  ];

  if (completedCount === 5) {
    document.getElementById("setup-progress").style.display = "none";
    return;
  }
  
  list.innerHTML = `
    <div class="setup-loading">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>Memeriksa persiapan toko...</span>
    </div>
  `;

  try {
    const paths = [
      "store",
      "categories",
      "optionGroups",
      "products",
      "employees"
    ];

    const snapshots = await Promise.all(
      paths.map(path => get(ref(db, path)))
    );

    const store = snapshots[0].exists()
      ? snapshots[0].val()
      : {};

    const categories = snapshots[1].exists()
      ? snapshots[1].val()
      : {};

    const optionGroups = snapshots[2].exists()
      ? snapshots[2].val()
      : {};

    const products = snapshots[3].exists()
      ? snapshots[3].val()
      : {};

    const employees = snapshots[4].exists()
      ? snapshots[4].val()
      : {};

    const normalizePhone = value =>
      String(value || "").replace(/[\s()-]/g, "");

    const validEmail = value =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(value || "").trim()
      );

    const validPhone = (value, required = false) => {
      const phone = normalizePhone(value);

      if (!phone) return !required;

      return /^\+628[0-9]{7,12}$/.test(phone);
    };

    const services = store.services || {};

    const hasService = Boolean(
      services.delivery ||
      services.pickup ||
      services.dineIn
    );

    const latitude = store.latitude;
    const longitude = store.longitude;

    const hasLocation =
      latitude !== undefined &&
      latitude !== null &&
      latitude !== "" &&
      longitude !== undefined &&
      longitude !== null &&
      longitude !== "";

    const storeComplete = Boolean(
      String(store.name || store.nama || "").trim() &&
      hasService &&
      hasLocation &&
      (store.locationType || store.jenisLokasi) &&
      (store.province || store.provinsi) &&
      (store.city || store.kota) &&
      (store.district || store.kecamatan) &&
      (store.village || store.kelurahan) &&
      String(store.postalCode || store.kodePos || "").trim() &&
      String(store.address || store.alamat || "").trim() &&
      validEmail(store.ownerEmail) &&
      validPhone(store.ownerPhone, true) &&
      validPhone(store.restaurantPhone)
    );

    const categoryCount = Object.values(categories).filter(
      item => item && item.active !== false
    ).length;

    const optionGroupCount = Object.values(optionGroups).filter(
      item => item && String(item.name || "").trim()
    ).length;

    const productCount = Object.values(products).filter(
      item => item && String(item.name || "").trim()
    ).length;

    const employeeCount = Object.values(employees).filter(
      item => item && typeof item === "object"
    ).length;

    const completed = [
      storeComplete,
      categoryCount > 0,
      optionGroupCount > 0,
      productCount > 0,
      employeeCount > 0
    ];

    const completedTotal = completed.filter(Boolean).length;
    const percentage = (completedTotal / steps.length) * 100;

    count.textContent = `${completedTotal}/5 Selesai`;
    fill.style.width = `${percentage}%`;

    list.innerHTML = steps.map((step, index) => `
      <div class="setup-step ${completed[index] ? "completed" : ""}">
        <div class="setup-step-icon">
          <i class="fa-solid ${
            completed[index] ? "fa-check" : "fa-circle"
          }"></i>
        </div>

        <span class="setup-step-text">${step}</span>

        <span class="setup-step-status">
          ${completed[index] ? "Selesai" : "Belum selesai"}
        </span>
      </div>
    `).join("");

    if (completedTotal === 5) {
      message.innerHTML = `
        <i class="fa-solid fa-circle-check"></i>
        Semua tahapan persiapan toko sudah selesai!
      `;

      message.classList.add("all-completed");
    } else {
      message.innerHTML = `
        <i class="fa-solid fa-bell"></i>
        Perhatian Admin: Masih ada ${5 - completedTotal}
        tahapan yang harus diselesaikan.
      `;

      message.classList.remove("all-completed");
    }

  } catch (error) {
    console.error("Gagal memeriksa persiapan toko:", error);

    list.innerHTML = `
      <div class="setup-error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Gagal memuat progres persiapan toko.
      </div>
    `;

    message.textContent =
      "Periksa koneksi Firebase lalu muat ulang dashboard.";
  }
}

if (loginStatus === "true") {
  initializeSetupProgress();
}
