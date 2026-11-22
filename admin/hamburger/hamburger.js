import { db } from "../../database/firebase.js";
import {
  ref,
  get,
  onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const container = document.getElementById("hamburger-container");

if (!container) {
  throw new Error("Elemen hamburger-container tidak ditemukan.");
}

let storeComplete = false;
let productExists = false;
let lockPopupOpen = false;

const restrictedMenus = [
  "menu",
  "karyawan",
  "product",
  "picture",
  "notifikasi"
];

function showLockedPopup(title, message) {
  if (lockPopupOpen) return;

  lockPopupOpen = true;

  const overlay = document.createElement("div");
  overlay.className = "store-lock-overlay";

  const dialog = document.createElement("div");
  dialog.className = "store-lock-dialog";

  const symbol = document.createElement("div");
  symbol.className = "store-lock-symbol";
  symbol.innerHTML = '<i class="fa-solid fa-lock"></i>';

  const heading = document.createElement("h3");
  heading.textContent = title;

  const description = document.createElement("p");
  description.textContent = message;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Mengerti";

  function closePopup() {
    overlay.remove();
    lockPopupOpen = false;
  }

  button.addEventListener("click", closePopup);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closePopup();
    }
  });

  dialog.append(symbol, heading, description, button);
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

  if (days.length !== 7) return false;

  return days.every(day => {
    if (!day || typeof day !== "object") return false;

    if (day.closed === true || day.allDay === true) {
      return true;
    }

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

function getMenuType(link) {
  const href = link.getAttribute("href") || "";
  const path = href.toLowerCase();
  const label = link.textContent
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (
    path.includes("/product/") ||
    path.endsWith("/product.html") ||
    label === "product"
  ) {
    return "product";
  }

  if (
    path.includes("/karyawan/") ||
    label === "karyawan"
  ) {
    return "karyawan";
  }

  if (
    path.includes("/picture/") ||
    path.endsWith("/picture.html") ||
    label === "picture"
  ) {
    return "picture";
  }

  if (
    path.includes("/notifikasi/") ||
    path.endsWith("/notifikasi.html") ||
    label === "notifikasi"
  ) {
    return "notifikasi";
  }

  if (
    path.includes("/menu/") ||
    path.endsWith("/menu.html") ||
    label === "menu"
  ) {
    return "menu";
  }

  return null;
}

function reorderProductMenu() {
  const links = Array.from(
    document.querySelectorAll(".sidebar-menu a[href]")
  );

  const storeLink = links.find(link => {
    const label = link.textContent
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    return label.includes("toko saya");
  });

  const productLink = links.find(link => {
    return getMenuType(link) === "product";
  });

  if (!storeLink || !productLink) return;

  const storeItem = storeLink.closest("li") || storeLink;
  const productItem = productLink.closest("li") || productLink;

  if (
    storeItem.parentElement &&
    storeItem.parentElement === productItem.parentElement
  ) {
    storeItem.parentElement.insertBefore(
      productItem,
      storeItem.nextSibling
    );
  }
}

function updateLockedMenus() {
  const links = document.querySelectorAll(".sidebar-menu a[href]");

  links.forEach(link => {
    const menuType = getMenuType(link);

    if (!menuType || !restrictedMenus.includes(menuType)) {
      return;
    }

    let shouldLock = false;

    if (!storeComplete) {
      shouldLock = true;
    } else if (!productExists && menuType !== "product") {
      shouldLock = true;
    }

    const existingIcon = link.querySelector(".store-lock-icon");

    if (shouldLock) {
      link.classList.add("store-setup-locked");
      link.setAttribute("aria-disabled", "true");
      link.dataset.storeLocked = "true";

      if (!existingIcon) {
        const icon = document.createElement("i");
        icon.className = "fa-solid fa-lock store-lock-icon";
        icon.setAttribute("aria-hidden", "true");
        link.appendChild(icon);
      }
    } else {
      link.classList.remove("store-setup-locked");
      link.removeAttribute("aria-disabled");
      delete link.dataset.storeLocked;

      existingIcon?.remove();
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

    if (!link) return;

    event.preventDefault();
    event.stopPropagation();

    if (!storeComplete) {
      showLockedPopup(
        "Lengkapi Informasi Toko",
        "Seluruh informasi toko wajib dilengkapi terlebih dahulu sebelum menggunakan menu ini."
      );
      return;
    }

    if (!productExists) {
      showLockedPopup(
        "Buat Product Terlebih Dahulu",
        "Tambahkan minimal satu product di halaman Product. Setelah product berhasil dibuat, seluruh menu akan terbuka."
      );
    }
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

function watchProducts() {
  onValue(ref(db, "products"), snapshot => {
    if (!snapshot.exists()) {
      productExists = false;
    } else {
      const products = snapshot.val();

      productExists = Boolean(
        products &&
        typeof products === "object" &&
        Object.keys(products).length > 0
      );
    }

    updateLockedMenus();
  }, error => {
    console.error("Gagal memeriksa data product:", error);

    productExists = false;
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

  reorderProductMenu();
  bindLockedMenuEvents();
  updateLockedMenus();

  watchStoreData();
  watchProducts();

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
