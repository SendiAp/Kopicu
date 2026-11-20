import { db } from "../../database/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const container = document.getElementById("hamburger-container");

if (!container) {
  throw new Error("Elemen hamburger-container tidak ditemukan.");
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
    sidebar.classList.add("open");
    overlay.classList.add("show");

    if (openButton) {
      openButton.setAttribute("aria-expanded", "true");
    }
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");

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
