import { db } from "../../database/firebase.js";
import {
  ref,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const container = document.getElementById("hamburger-container");

if (!container) {
  throw new Error("Elemen hamburger-container tidak ditemukan.");
}

let storeComplete = false;
let lockPopupOpen = false;

const lockedMenuNames = [
  "menu",
  "karyawan",
  "product",
  "picture",
  "notifikasi"
];

function addLockStyles() {
  if (document.getElementById("store-lock-styles")) return;

  const style = document.createElement("style");
  style.id = "store-lock-styles";
  style.textContent = `
    .sidebar-menu a.store-setup-locked {
      opacity: .42 !important;
      color: #999 !important;
      cursor: not-allowed !important;
      pointer-events: auto !important;
      filter: grayscale(1);
    }

    .sidebar-menu a.store-setup-locked:hover {
      background: transparent !important;
      color: #999 !important;
    }

    .store-lock-icon {
      margin-left: auto;
      font-size: 12px;
      color: #999;
    }

    .store-lock-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0, 0, 0, .4);
      backdrop-filter: blur(3px);
    }

    .store-lock-dialog {
      width: 100%;
      max-width: 360px;
      padding: 25px 22px 20px;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 15px 50px rgba(0,0,0,.15);
      font-family: "DM Sans", sans-serif;
      text-align: center;
    }

    .store-lock-symbol {
      width: 54px;
      height: 54px;
      margin: 0 auto 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #f3f3f3;
      color: #888;
      font-size: 21px;
    }

    .store-lock-dialog h3 {
      margin: 0;
      color: #38251d;
      font-size: 17px;
      font-weight: 800;
    }

    .store-lock-dialog p {
      margin: 11px 0 20px;
      color: #777;
      font-size: 13px;
      line-height: 1.6;
    }

    .store-lock-dialog button {
      width: 100%;
      min-height: 43px;
      border: 0;
      border-radius: 9px;
      background: #38251d;
      color: #fff;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
  `;

  document.head.appendChild(style);
}

function showLockedPopup() {
  if (lockPopupOpen) return;

  lockPopupOpen = true;

  const overlay = document.createElement("div");
  overlay.className = "store-lock-overlay";

  const dialog = document.createElement("div");
  dialog.className = "store-lock-dialog";

  dialog.innerHTML = `
    <div class="store-lock-symbol">
      <i class="fa-solid fa-lock"></i>
    </div>
    <h3>Lengkapi Informasi Toko</h3>
    <p>
      Menu ini belum dapat digunakan karena masih ada informasi
      atau data toko yang belum lengkap. Silakan lengkapi seluruh
      informasi toko terlebih dahulu.
    </p>
    <button type="button">Mengerti</button>
  `;

  function closePopup() {
    overlay.remove();
    lockPopupOpen = false;
  }

  dialog.querySelector("button").addEventListener("click", closePopup);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closePopup();
    }
  });

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}

function isValidPhone(value) {
  const phone = String(value || "").replace(/[\s()-]/g, "");
  return /^\+628[0-9]{7,12}$/.test(phone);
}

function isValidCoordinate(value) {
  return value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value));
}

function isValidOpeningHours(hours) {
  if (!hours || typeof hours !== "object") return false;

  const days = Object.values(hours);

  if (days.length < 7) return false;

  return days.every(day => {
    if (!day || typeof day !== "object") return false;

    if (day.closed === true) return true;

    if (day.allDay === true) return true;

    return Boolean(
      day.open &&
      day.close &&
      /^\d{2}:\d{2}$/.test(day.open) &&
      /^\d{2}:\d{2}$/.test(day.close) &&
      day.open < day.close
    );
  });
}

function checkStoreCompleteness(data) {
  if (!data || typeof data !== "object") return false;

  const services = data.services || {};

  const hasService = Boolean(
    services.delivery ||
    services.pickup ||
    services.dineIn
  );

  const addressComplete = Boolean(
    isValidCoordinate(data.latitude) &&
    isValidCoordinate(data.longitude) &&
    data.locationType &&
    data.province &&
    data.city &&
    data.district &&
    data.village &&
    String(data.postalCode || "").trim() &&
    String(data.address || "").trim()
  );

  const ownerComplete = Boolean(
    isValidEmail(data.ownerEmail) &&
    isValidPhone(data.ownerPhone)
  );

  const managerComplete = Boolean(
    isValidEmail(data.managerEmail) &&
    isValidPhone(data.managerPhone)
  );

  const restaurantComplete = isValidPhone(data.restaurantPhone);

  const dineInComplete = !services.dineIn ||
    Boolean(services.dineInIdentifier);

  const openingHoursComplete = isValidOpeningHours(
    data.openingHours || data.jamOperasional
  );

  return Boolean(
    String(data.name || data.nama || "").trim() &&
    hasService &&
    addressComplete &&
    ownerComplete &&
    managerComplete &&
    restaurantComplete &&
    dineInComplete &&
    openingHoursComplete
  );
}

function updateLockedMenus() {
  const links = document.querySelectorAll(".sidebar-menu a");

  links.forEach(link => {
    const label = [
      link.textContent,
      link.getAttribute("aria-label"),
      link.getAttribute("title")
    ].join(" ").toLowerCase().trim();

    const shouldLock = lockedMenuNames.some(name => {
      return label.includes(name);
    });

    if (!shouldLock) return;

    const icon = link.querySelector(".store-lock-icon");

    if (!storeComplete) {
      link.classList.add("store-setup-locked");
      link.setAttribute("aria-disabled", "true");
      link.dataset.storeLocked = "true";

      if (!icon) {
        const lockIcon = document.createElement("i");
        lockIcon.className = "fa-solid fa-lock store-lock-icon";
        lockIcon.setAttribute("aria-hidden", "true");
        link.appendChild(lockIcon);
      }
    } else {
      link.classList.remove("store-setup-locked");
      link.removeAttribute("aria-disabled");
      delete link.dataset.storeLocked;

      icon?.remove();
    }
  });
}

function bindLockedMenuEvents() {
  const sidebarMenu = document.querySelector(".sidebar-menu");

  if (!sidebarMenu || sidebarMenu.dataset.lockEventBound === "true") {
    return;
  }

  sidebarMenu.dataset.lockEventBound = "true";

  sidebarMenu.addEventListener("click", event => {
    const link = event.target.closest("a[data-store-locked='true']");

    if (!link || storeComplete) return;

    event.preventDefault();
    event.stopPropagation();

    showLockedPopup();
  }, true);
}

function watchStoreData() {
  onValue(ref(db, "store"), snapshot => {
    const data = snapshot.exists() ? snapshot.val() : null;

    storeComplete = checkStoreCompleteness(data);

    updateLockedMenus();
  }, error => {
    console.error("Gagal memeriksa kelengkapan data toko:", error);

    storeComplete = false;
    updateLockedMenus();
  });
}

async function loadHamburger() {
  try {
    const response = await fetch("/admin/hamburger/hamburger.html");

    if (!response.ok) {
      throw new Error("Gagal memuat hamburger.html");
    }

    container.innerHTML = await response.text();

    initializeHamburger();
  } catch (error) {
    console.error("Gagal memuat menu hamburger:", error);
  }
}

function initializeHamburger() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const openButton = document.getElementById("hamburger-button");
  const closeButton = document.getElementById("close-sidebar");
  const logoutButton = document.getElementById("logout-button");
  const sidebarLogo = document.getElementById("sidebar-logo");

  function openSidebar() {
    sidebar?.classList.add("open");
    overlay?.classList.add("show");

    if (openButton) {
      openButton.setAttribute("aria-expanded", "true");
    }
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");

    if (openButton) {
      openButton.setAttribute("aria-expanded", "false");
    }
  }

  openButton?.addEventListener("click", openSidebar);
  closeButton?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeSidebar();
    }
  });

  document.querySelectorAll(".sidebar-link[href]").forEach(link => {
    link.addEventListener("click", closeSidebar);
  });

  logoutButton?.addEventListener("click", () => {
    sessionStorage.removeItem("kopicu_admin_login");
    sessionStorage.removeItem("kopicu_admin_username");

    window.location.replace("/admin/login.html");
  });

  const currentPath = window.location.pathname.replace(/\/+$/, "");

  document.querySelectorAll(".sidebar-menu a").forEach(link => {
    const linkPath = new URL(link.href).pathname.replace(/\/+$/, "");

    link.classList.toggle("active", linkPath === currentPath);
  });

  addLockStyles();
  bindLockedMenuEvents();
  updateLockedMenus();
  watchStoreData();

  loadSidebarLogo(sidebar, sidebarLogo);
}

async function loadSidebarLogo(sidebar, sidebarLogo) {
  if (!sidebar || !sidebarLogo) return;

  sidebar.classList.add("no-logo");
  sidebarLogo.hidden = true;
  sidebarLogo.removeAttribute("src");

  try {
    const snapshot = await get(ref(db, "settings/storeLogo"));

    if (!snapshot.exists()) return;

    const data = snapshot.val();

    const logoUrl = typeof data === "string"
      ? data.trim()
      : typeof data === "object" && data !== null
        ? String(data.url || data.image || "").trim()
        : "";

    if (!logoUrl) return;

    sidebarLogo.onload = () => {
      sidebarLogo.hidden = false;
      sidebar.classList.remove("no-logo");
    };

    sidebarLogo.onerror = () => {
      sidebarLogo.hidden = true;
      sidebarLogo.removeAttribute("src");
      sidebar.classList.add("no-logo");
    };

    sidebarLogo.src = logoUrl;
  } catch (error) {
    console.error("Gagal memuat logo sidebar:", error);

    sidebarLogo.hidden = true;
    sidebarLogo.removeAttribute("src");
    sidebar.classList.add("no-logo");
  }
}

loadHamburger();
