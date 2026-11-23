import { db } from "../../database/firebase.js";
import { adminAccount } from "../akun.js";
import {
  ref,
  get,
  push,
  set,
  remove
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("/admin/login.html");
  throw new Error("Akses tidak diizinkan.");
}

const username = sessionStorage.getItem("kopicu_admin_username") || "Admin";

const adminUsername = document.getElementById("admin-username");
const adminAvatar = document.getElementById("admin-avatar");

if (adminUsername) {
  adminUsername.textContent = username;
}

if (adminAvatar) {
  adminAvatar.textContent = username.charAt(0).toUpperCase();
}

const form = document.getElementById("employee-form");
const usernameInput = document.getElementById("employee-username");
const passwordInput = document.getElementById("employee-password");
const togglePassword = document.getElementById("toggle-password");
const nameInput = document.getElementById("employee-name");
const emailInput = document.getElementById("employee-email");
const phoneInput = document.getElementById("employee-phone");
const storeSelect = document.getElementById("employee-store");
const saveButton = document.getElementById("save-employee");
const employeeList = document.getElementById("employee-list");
const employeeCount = document.getElementById("employee-count");

let storeData = {};
let employees = {};
let isSavingEmployee = false;

function escapeHTML(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function getSelectedRole() {
  return document.querySelector(
    'input[name="employee-role"]:checked'
  )?.value || "";
}

function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");

  if (phone.startsWith("62")) {
    phone = phone.substring(2);
  }

  if (phone.startsWith("0")) {
    phone = phone.substring(1);
  }

  return phone;
}

function formatPhone(value) {
  return `+62${normalizePhone(value)}`;
}

function getOwnerData() {
  return {
    id: "owner",
    username: adminAccount.username || "Pemilik",
    name: adminAccount.name || "Pemilik",
    email: adminAccount.email || "-",
    phone: adminAccount.phone || "-",
    role: "pemilik",
    storeName: storeData.name || "Toko Utama",
    isOwner: true
  };
}

function validateForm() {
  const employeeUsername = usernameInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const phone = normalizePhone(phoneInput.value);
  const role = getSelectedRole();
  const storeId = storeSelect.value;

  const ownerUsername = String(adminAccount.username || "").toLowerCase();
  const ownerEmail = String(adminAccount.email || "").toLowerCase();

  const usernameExists =
    employeeUsername.toLowerCase() === ownerUsername ||
    Object.values(employees).some(employee =>
      String(employee?.username || "").toLowerCase() === employeeUsername.toLowerCase()
    );

  const emailExists =
    (Boolean(ownerEmail) && email === ownerEmail) ||
    Object.values(employees).some(employee =>
      String(employee?.email || "").toLowerCase() === email
    );

  const valid =
    /^[a-zA-Z0-9._-]{4,30}$/.test(employeeUsername) &&
    password.length >= 8 &&
    name.length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    /^8[0-9]{8,12}$/.test(phone) &&
    Boolean(role) &&
    Boolean(storeId) &&
    !usernameExists &&
    !emailExists &&
    !isSavingEmployee;

  saveButton.disabled = !valid;

  return valid;
}

function popup(message, title = "Informasi", type = "info") {
  return new Promise(resolve => {
    const overlay = document.createElement("div");

    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:rgba(0,0,0,.38);
      backdrop-filter:blur(3px);
    `;

    const dialog = document.createElement("div");

    dialog.style.cssText = `
      width:100%;
      max-width:370px;
      padding:25px 22px 20px;
      border:1px solid #eeeeee;
      border-radius:15px;
      background:#fff;
      box-shadow:0 15px 50px rgba(0,0,0,.15);
      font-family:"DM Sans",sans-serif;
      text-align:center;
      animation:employeePopupAppear .2s ease;
    `;

    const icons = {
      success: {
        icon: "fa-circle-check",
        color: "#16a36a",
        background: "#eaf8f1"
      },
      error: {
        icon: "fa-circle-xmark",
        color: "#dc4545",
        background: "#fff0f0"
      },
      warning: {
        icon: "fa-triangle-exclamation",
        color: "#d99425",
        background: "#fff7e8"
      },
      info: {
        icon: "fa-circle-info",
        color: "#6b7280",
        background: "#f2f3f5"
      }
    };

    const selectedIcon = icons[type] || icons.info;

    const iconWrapper = document.createElement("div");

    iconWrapper.style.cssText = `
      width:48px;
      height:48px;
      margin:0 auto 15px;
      display:grid;
      place-items:center;
      border-radius:50%;
      background:${selectedIcon.background};
      color:${selectedIcon.color};
      font-size:21px;
    `;

    iconWrapper.innerHTML = `<i class="fa-solid ${selectedIcon.icon}"></i>`;

    const heading = document.createElement("h3");
    heading.textContent = title;

    heading.style.cssText = `
      margin:0;
      color:#38251d;
      font-size:17px;
      font-weight:800;
    `;

    const description = document.createElement("p");
    description.textContent = message;

    description.style.cssText = `
      margin:12px 0 22px;
      color:#777;
      font-size:13px;
      line-height:1.6;
    `;

    const actions = document.createElement("div");

    actions.style.cssText = `
      display:flex;
      gap:9px;
      justify-content:center;
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Mengerti";

    button.style.cssText = `
      flex:1;
      min-height:42px;
      border:0;
      border-radius:8px;
      background:#38251d;
      color:#fff;
      font-family:inherit;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
    `;

    button.addEventListener("click", () => {
      overlay.remove();
      resolve(true);
    });

    actions.appendChild(button);
    dialog.append(iconWrapper, heading, description, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

function formatStoreAddress(location = {}) {
  return [
    location.address || location.alamat,
    location.village || location.kelurahan,
    location.district || location.kecamatan,
    location.city || location.kota,
    location.province || location.provinsi,
    location.postalCode || location.kodePos
  ]
    .filter(Boolean)
    .join(", ");
}

async function loadStores() {
  const snapshot = await get(ref(db, "store"));

  if (!snapshot.exists()) {
    storeSelect.innerHTML = `
      <option value="">Toko belum tersedia</option>
    `;
    storeSelect.disabled = true;
    validateForm();
    return;
  }

  storeData = snapshot.val();

  const storeName = storeData.name || storeData.nama || "Toko Utama";
  const mainAddress = formatStoreAddress(storeData);

  const stores = [
    {
      id: "default",
      name: storeName,
      address: mainAddress
    }
  ];

  const branches = Array.isArray(storeData.branches)
    ? storeData.branches
    : Object.values(storeData.branches || {});

  branches.forEach((branch, index) => {
    stores.push({
      id: branch.id || `branch_${index}`,
      name: `${storeName} - Cabang ${index + 1}`,
      address: formatStoreAddress(branch)
    });
  });

  storeSelect.innerHTML = `
    <option value="">Pilih toko</option>
    ${stores.map(store => {
      const label = `${store.name} — ${store.address || "Alamat belum tersedia"}`;

      return `
        <option value="${escapeHTML(store.id)}">
          ${escapeHTML(label)}
        </option>
      `;
    }).join("")}
  `;

  storeSelect.disabled = false;
  validateForm();
}

async function loadEmployees() {
  const snapshot = await get(ref(db, "employees"));

  employees = snapshot.exists() ? snapshot.val() : {};

  if (
    typeof employees !== "object" ||
    employees === null ||
    Array.isArray(employees)
  ) {
    employees = {};
  }

  renderEmployees();
  validateForm();
}

async function revokeEmployeeAccess(id, overlay) {
  if (!id || id === "owner") return;

  const button = overlay.querySelector(".employee-revoke-access");

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  }

  try {
    await remove(ref(db, `employees/${id}`));

    overlay.remove();

    await loadEmployees();

    await popup(
      "Seluruh data karyawan berhasil dihapus. Akun tersebut tidak dapat digunakan untuk login kembali.",
      "Akses Dicabut",
      "success"
    );
  } catch (error) {
    console.error("Gagal mencabut akses karyawan:", error);

    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fa-solid fa-key"></i> Cabut Access';
    }

    await popup(
      "Gagal mencabut akses. Periksa koneksi dan Firebase Database Rules.",
      "Gagal",
      "error"
    );
  }
}

function getRoleName(role) {
  const roles = {
    pemilik: "Pemilik",
    manajer: "Manajer",
    kasir: "Kasir",
    driver: "Driver"
  };

  return roles[role] || "Tidak diketahui";
}

function renderEmployees() {
  const owner = getOwnerData();
  const entries = [
    ["owner", owner],
    ...Object.entries(employees).filter(([id]) => id !== "owner")
  ];

  employeeCount.textContent = `${entries.length} Karyawan`;

  employeeList.innerHTML = entries.map(([id, employee]) => {
    const name = escapeHTML(employee.name || "Tanpa Nama");
    const email = escapeHTML(employee.email || "-");
    const phone = escapeHTML(employee.phone || "-");
    const role = escapeHTML(getRoleName(employee.role));
    const initial = escapeHTML(
      (employee.name || employee.username || "K").charAt(0).toUpperCase()
    );

    return `
      <div class="employee-card" data-id="${escapeHTML(id)}" role="button" tabindex="0">
        <div class="employee-avatar">${initial}</div>

        <div class="employee-info">
          <h3>${name}</h3>
          <p>${email}</p>
          <p>${phone}</p>
        </div>

        <span class="employee-role-badge">${role}</span>

        <i class="fa-solid fa-chevron-right employee-arrow"></i>
      </div>
    `;
  }).join("");
}

function showEmployeeDetail(id) {
  const employee = id === "owner"
    ? getOwnerData()
    : employees[id];

  if (!employee) return;

  const storeName =
    employee.storeName ||
    employee.storeId ||
    "-";

  const detailRows = [
    ["Username", employee.username || "-"],
    ["Email", employee.email || "-"],
    ["Nomor HP", employee.phone || "-"],
    ["Peran", getRoleName(employee.role)],
    ["Toko", storeName]
  ];

  const overlay = document.createElement("div");

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:99999;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
    background:rgba(0,0,0,.38);
    backdrop-filter:blur(3px);
  `;

  const dialog = document.createElement("div");

  dialog.style.cssText = `
    width:100%;
    max-width:390px;
    padding:24px 22px 20px;
    border:1px solid #eeeeee;
    border-radius:15px;
    background:#fff;
    box-shadow:0 15px 50px rgba(0,0,0,.15);
    font-family:"DM Sans",sans-serif;
    animation:employeePopupAppear .2s ease;
  `;

  const initial = (employee.name || employee.username || "K")
    .charAt(0)
    .toUpperCase();

  dialog.innerHTML = `
    <div style="display:flex;align-items:center;gap:13px;margin-bottom:21px;">
      <div style="
        width:46px;
        height:46px;
        flex-shrink:0;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:#f1e9e3;
        color:#38251d;
        font-size:17px;
        font-weight:800;
      ">${escapeHTML(initial)}</div>

      <div style="min-width:0;flex:1;">
        <h3 style="
          margin:0 0 4px;
          color:#38251d;
          font-size:17px;
          font-weight:800;
          overflow-wrap:anywhere;
        ">${escapeHTML(employee.name || "Detail Karyawan")}</h3>

        <span style="
          display:inline-block;
          padding:4px 9px;
          border-radius:20px;
          background:${employee.isOwner ? "#f1e9e3" : "#edf7f1"};
          color:${employee.isOwner ? "#38251d" : "#168653"};
          font-size:11px;
          font-weight:700;
        ">${escapeHTML(getRoleName(employee.role))}</span>
      </div>
    </div>

    <div class="employee-detail-rows">
      ${detailRows.map(([label, value]) => `
        <div style="
          display:flex;
          justify-content:space-between;
          gap:15px;
          padding:11px 0;
          border-bottom:1px solid #f0f0f0;
          font-size:12px;
        ">
          <span style="color:#888;flex-shrink:0;">${escapeHTML(label)}</span>
          <strong style="
            color:#38251d;
            text-align:right;
            overflow-wrap:anywhere;
            font-weight:700;
          ">${escapeHTML(value)}</strong>
        </div>
      `).join("")}
    </div>

    ${!employee.isOwner ? `
    <button type="button" class="employee-revoke-access" style="
    width:100%;
    min-height:42px;
    margin-top:20px;
    border:1px solid #f1d5d5;
    border-radius:8px;
    background:#fff5f5;
    color:#dc4545;
    font-family:inherit;
    font-size:12px;
    font-weight:700;
    cursor:pointer;
    ">
    <i class="fa-solid fa-key"></i>
    Cabut Access
    </button>
    ` : ""}

    <button type="button" class="employee-detail-close" style="
      width:100%;
      min-height:42px;
      margin-top:20px;
      border:0;
      border-radius:8px;
      background:#38251d;
      color:#fff;
      font-family:inherit;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
    ">Tutup</button>
  `;

  const close = () => overlay.remove();

  dialog.querySelector(".employee-detail-close")
    .addEventListener("click", close);

  const revokeButton = dialog.querySelector(".employee-revoke-access");
  
  revokeButton?.addEventListener("click", () => {
    revokeEmployeeAccess(id, overlay);
  });
  
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

togglePassword?.addEventListener("click", () => {
  const visible = passwordInput.type === "password";

  passwordInput.type = visible ? "text" : "password";

  togglePassword.innerHTML = visible
    ? '<i class="fa-regular fa-eye-slash"></i>'
    : '<i class="fa-regular fa-eye"></i>';
});

[
  usernameInput,
  passwordInput,
  nameInput,
  emailInput,
  phoneInput,
  storeSelect
].forEach(input => {
  input.addEventListener("input", validateForm);
  input.addEventListener("change", validateForm);
});

document.querySelectorAll('input[name="employee-role"]').forEach(input => {
  input.addEventListener("change", validateForm);
});

phoneInput.addEventListener("input", () => {
  let value = phoneInput.value.replace(/\D/g, "");

  if (value.startsWith("0")) {
    value = value.substring(1);
  }

  if (value.startsWith("62")) {
    value = value.substring(2);
  }

  phoneInput.value = value;
  validateForm();
});

employeeList.addEventListener("click", event => {
  const card = event.target.closest(".employee-card");

  if (!card) return;

  showEmployeeDetail(card.dataset.id);
});

employeeList.addEventListener("keydown", event => {
  if (
    event.key !== "Enter" &&
    event.key !== " "
  ) {
    return;
  }

  const card = event.target.closest(".employee-card");

  if (!card) return;

  event.preventDefault();
  showEmployeeDetail(card.dataset.id);
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSavingEmployee) return;

  if (!validateForm()) {
    await popup(
      "Periksa kembali data karyawan. Pastikan username dan email belum digunakan.",
      "Data belum valid",
      "warning"
    );
    return;
  }

  isSavingEmployee = true;
  saveButton.disabled = true;

  const originalButtonHTML = saveButton.innerHTML;

  saveButton.innerHTML = `
    <i class="fa-solid fa-spinner fa-spin"></i>
    <span>Menyimpan...</span>
  `;

  try {
    const selectedStore = storeSelect.options[storeSelect.selectedIndex];

    const employeeData = {
      username: usernameInput.value.trim(),
      password: passwordInput.value,
      name: nameInput.value.trim(),
      email: emailInput.value.trim().toLowerCase(),
      phone: formatPhone(phoneInput.value),
      role: getSelectedRole(),
      storeId: storeSelect.value,
      storeName: selectedStore.textContent.trim(),
      createdAt: Date.now()
    };

    const employeeRef = push(ref(db, "employees"));

    await set(employeeRef, employeeData);

    await loadEmployees();

    form.reset();

    await popup(
      "Akun karyawan berhasil dibuat dan disimpan.",
      "Berhasil",
      "success"
    );

  } catch (error) {
    console.error("Gagal menyimpan karyawan:", error);

    await popup(
      "Akun karyawan gagal disimpan. Periksa koneksi dan Firebase Database Rules.",
      "Gagal menyimpan",
      "error"
    );

  } finally {
    isSavingEmployee = false;
    saveButton.innerHTML = originalButtonHTML;
    validateForm();
  }
});

async function initializePage() {
  try {
    saveButton.disabled = true;

    await Promise.all([
      loadStores(),
      loadEmployees()
    ]);

  } catch (error) {
    console.error("Gagal memuat halaman karyawan:", error);

    await popup(
      "Gagal memuat data toko atau karyawan. Silakan periksa koneksi Firebase.",
      "Gagal memuat data",
      "error"
    );
  }
}

if (!document.getElementById("employee-popup-animation")) {
  const style = document.createElement("style");
  style.id = "employee-popup-animation";
  style.textContent = `
    @keyframes employeePopupAppear {
      from {
        opacity:0;
        transform:translateY(8px) scale(.98);
      }
      to {
        opacity:1;
        transform:translateY(0) scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}

initializePage();
