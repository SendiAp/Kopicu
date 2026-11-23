import { db } from "../../database/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const isLoggedIn = sessionStorage.getItem("kopicu_admin_login") === "true";
const userRole = String(
  sessionStorage.getItem("kopicu_user_role") || ""
).toLowerCase();

const loginPage = "../login.html";

function logout() {
  sessionStorage.removeItem("kopicu_admin_login");
  sessionStorage.removeItem("kopicu_admin_username");
  sessionStorage.removeItem("kopicu_user_role");
  sessionStorage.removeItem("kopicu_employee_id");
  sessionStorage.removeItem("kopicu_employee_name");

  window.location.replace(loginPage);
}

function createProfileAvatar() {
  const employeeName = (
    sessionStorage.getItem("kopicu_employee_name") ||
    sessionStorage.getItem("kopicu_admin_username") ||
    "Driver"
  ).trim();

  const avatar = document.createElement("div");

  avatar.textContent = employeeName.charAt(0).toUpperCase() || "D";

  avatar.style.cssText = `
    position: fixed;
    top: 18px;
    left: 18px;
    z-index: 10;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #38251d;
    color: #ffffff;
    font-family: 'DM Sans', sans-serif;
    font-size: 17px;
    font-weight: 800;
    box-shadow: 0 4px 18px rgba(0, 0, 0, .12);
  `;

  document.body.appendChild(avatar);
}

function createLogoutButton() {
  const logoutButton = document.createElement("button");

  logoutButton.type = "button";
  logoutButton.innerHTML =
    '<i class="fa-solid fa-right-from-bracket"></i> Keluar';

  logoutButton.style.cssText = `
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 12px 17px;
    border: 1px solid #eeeeee;
    border-radius: 12px;
    background: #ffffff;
    color: #38251d;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(0, 0, 0, .10);
  `;

  logoutButton.addEventListener("click", () => {
    const confirmed = window.confirm("Apakah kamu yakin ingin keluar?");

    if (confirmed) {
      logout();
    }
  });

  document.body.appendChild(logoutButton);
}

function updateStatus(title, description) {
  const titleElement = document.querySelector(".status-info h1");
  const descriptionElement = document.querySelector(".status-info p");

  if (titleElement) {
    titleElement.textContent = title;
  }

  if (descriptionElement) {
    descriptionElement.textContent = description;
  }
}

async function loadStoreLocation() {
  const map = document.getElementById("google-map");

  if (!map) return;

  map.setAttribute("title", "Peta Google Maps");

  try {
    const snapshot = await get(ref(db, "store"));

    if (!snapshot.exists()) {
      updateStatus(
        "Lokasi Toko Belum Tersedia",
        "Admin belum mengatur lokasi utama toko."
      );
      return;
    }

    const storeData = snapshot.val();

    const latitude = Number(storeData.latitude);
    const longitude = Number(storeData.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      updateStatus(
        "Lokasi Toko Belum Tersedia",
        "Koordinat lokasi utama toko belum diatur dengan benar."
      );
      return;
    }

    map.src = `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;

    updateStatus(
      "Menunggu Pengiriman",
      "Lokasi toko berhasil dimuat. Belum ada pesanan yang perlu diantar."
    );
  } catch (error) {
    console.error("Gagal memuat lokasi toko:", error);

    updateStatus(
      "Gagal Memuat Lokasi",
      "Periksa koneksi internet lalu muat ulang halaman."
    );
  }
}

if (!isLoggedIn || userRole !== "driver") {
  logout();
} else {
  createProfileAvatar();
  createLogoutButton();
  loadStoreLocation();
}

window.addEventListener("pageshow", () => {
  const loggedIn =
    sessionStorage.getItem("kopicu_admin_login") === "true";

  const role = String(
    sessionStorage.getItem("kopicu_user_role") || ""
  ).toLowerCase();

  if (!loggedIn || role !== "driver") {
    logout();
  }
});
