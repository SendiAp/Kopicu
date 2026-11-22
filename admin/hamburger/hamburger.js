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
  const email = String(value || "").trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(value) {
  const phone = String(value || "").replace(/[\s()-]/g, "");

  return /^\+628[0-9]{7,12}$/.test(phone);
}

function isValidOptionalEmail(value) {
  const email = String(value || "").trim();

  return email === "" || isValidEmail(email);
}

function isValidOptionalPhone(value) {
  const phone = String(value || "").trim();

  return phone === "" || isValidPhone(phone);
}

function isValidCoordinate(value) {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
}

function isValidOpeningHours(hours) {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) {
    return false;
  }

  const days = Object.values(hours);

  if (days.length !== 7) {
    return false;
  }

  return days.every(day => {
    if (!day || typeof day !== "object") {
      return false;
    }

    if (day.closed === true || day.allDay === true) {
      return true;
    }

    if (
      typeof day.open !== "string" ||
      typeof day.close !== "string"
    ) {
      return false;
    }

    const validTime = value => {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        return false;
      }

      return true;
    };

    return (
      validTime(day.open) &&
      validTime(day.close) &&
      day.open < day.close
    );
  });
}

function checkStoreCompleteness(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  const services = data.services || {};
  const hours = data.openingHours || {};

  const checks = {
    namaToko: Boolean(
      String(data.name || "").trim()
    ),

    layanan: Boolean(
      services.delivery ||
      services.pickup ||
      services.dineIn
    ),

    koordinat: (
      isValidCoordinate(data.latitude) &&
      isValidCoordinate(data.longitude)
    ),

    alamat: Boolean(
      String(data.locationType || "").trim() &&
      String(data.province || "").trim() &&
      String(data.city || "").trim() &&
      String(data.district || "").trim() &&
      String(data.village || "").trim() &&
      String(data.postalCode || "").trim() &&
      String(data.address || "").trim()
    ),

    emailOwner: isValidEmail(data.ownerEmail),

    teleponOwner: isValidPhone(data.ownerPhone),

    emailManager: isValidOptionalEmail(data.managerEmail),

    teleponManager: isValidOptionalPhone(data.managerPhone),

    teleponRestoran: isValidOptionalPhone(data.restaurantPhone),

    identitasDineIn: (
      !services.dineIn ||
      Boolean(String(services.dineInIdentifier || "").trim())
    ),

    jamOperasional: isValidOpeningHours(hours)
  };

  console.table(checks);

  const incomplete = Object.entries(checks)
    .filter(([, valid]) => !valid)
    .map(([name]) => name);

  if (incomplete.length > 0) {
    console.warn("Data toko yang belum valid:", incomplete);
    return false;
  }

  console.log("Semua informasi toko sudah lengkap.");

  return true;
}

function getMenuType(link) {
  const href = (link.getAttribute("href") || "").toLowerCase();

  const label = link.textContent
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (
    href.includes("/product/") ||
    href.endsWith("/product.html") ||
    label === "product"
  ) {
    return "product";
  }

  if (
    href.includes("/karyawan/") ||
    href.endsWith("/karyawan.html") ||
    label.includes("karyawan")
  ) {
    return "karyawan";
  }

  if (
    href.includes("/picture/") ||
    href.endsWith("/picture.html") ||
    label === "picture"
  ) {
    return "picture";
  }

  if (
    href.includes("/notifikasi/") ||
    href.endsWith("/notifikasi.html") ||
    label === "notifikasi"
  ) {
    return "notifikasi";
  }

  if (
    href.includes("/menu/") ||
    href.endsWith("/menu.html") ||
    label === "menu"
  ) {
    return "menu";
  }

  return null;
}

function getSidebarLinks() {
  return Array.from(
    document.querySelectorAll(".sidebar-menu a[href]")
  );
}

function reorderProductMenu() {
  const links = getSidebarLinks();

  const storeLink = links.find(link =>
    link.textContent
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .includes("toko saya")
  );

  const productLink = links.find(link =>
    getMenuType(link) === "product"
  );

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
  getSidebarLinks().forEach(link => {
    const menuType = getMenuType(link);

    if (!menuType || !restrictedMenus.includes(menuType)) {
      return;
    }

    const shouldLock = (
      !storeComplete ||
      (!productExists && menuType !== "product")
    );

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
        "Seluruh informasi wajib yang ada di halaman Toko Saya harus dilengkapi dan disimpan terlebih dahulu."
      );

      return;
    }

    if (!productExists) {
      showLockedPopup(
        "Buat Product Terlebih Dahulu",
        "Tambahkan minimal satu product di halaman Product. Setelah berhasil dibuat, seluruh menu akan terbuka."
      );
    }
  }, true);
}

function watchStoreData() {
  onValue(
    ref(db, "store"),
    snapshot => {
      const data = snapshot.exists()
        ? snapshot.val()
        : null;

      storeComplete = checkStoreCompleteness(data);

      console.log("Status informasi toko:", storeComplete);

      updateLockedMenus();
    },
    error => {
      console.error("Gagal memeriksa informasi toko:", error);

      storeComplete = false;
      updateLockedMenus();
    }
  );
}

function watchProducts() {
  onValue(
    ref(db, "products"),
    snapshot => {
      const products = snapshot.exists()
        ? snapshot.val()
        : null;

      productExists = Boolean(
        products &&
        typeof products === "object" &&
        Object.keys(products).length > 0
      );

      console.log("Status product:", productExists);

      updateLockedMenus();
    },
    error => {
      console.error("Gagal memeriksa product:", error);

      productExists = false;
      updateLockedMenus();
    }
  );
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

    openButton?.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");

    openButton?.setAttribute("aria-expanded", "false");
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

  document.querySelectorAll(".sidebar-menu a[href]").forEach(link => {
    try {
      const linkPath = new URL(link.href).pathname.replace(/\/+$/, "");

      link.classList.toggle("active", linkPath === currentPath);
    } catch (error) {
      console.warn("Link sidebar tidak valid:", link.href);
    }
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
