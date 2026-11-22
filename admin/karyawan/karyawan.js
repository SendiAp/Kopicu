import { db } from "../../database/firebase.js";
import {
  ref,
  get
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

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
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

function validateForm() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = normalizePhone(phoneInput.value);
  const role = getSelectedRole();
  const storeId = storeSelect.value;

  const usernameExists = Object.values(employees).some(employee =>
    String(employee.username || "").toLowerCase() === username.toLowerCase()
  );

  const emailExists = Object.values(employees).some(employee =>
    String(employee.email || "").toLowerCase() === email.toLowerCase()
  );

  const valid =
    /^[a-zA-Z0-9._-]{4,30}$/.test(username) &&
    password.length >= 8 &&
    name.length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    /^8[0-9]{8,12}$/.test(phone) &&
    Boolean(role) &&
    Boolean(storeId) &&
    !usernameExists &&
    !emailExists;

  saveButton.disabled = !valid;

  return valid;
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

  const stores = [{
    id: "default",
    name: storeData.name || "Toko Utama"
  }];

  (Array.isArray(storeData.branches) ? storeData.branches : []).forEach(
    (branch, index) => {
      stores.push({
        id: branch.id || `branch_${index}`,
        name: branch.name || branch.address || `Cabang ${index + 1}`
      });
    }
  );

  storeSelect.innerHTML = `
    <option value="">Pilih toko</option>
    ${stores.map(store => `
      <option value="${escapeHTML(store.id)}">
        ${escapeHTML(store.name)}
      </option>
    `).join("")}
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

function getRoleName(role) {
  const roles = {
    manajer: "Manajer",
    kasir: "Kasir",
    driver: "Driver"
  };

  return roles[role] || "Tidak diketahui";
}

function renderEmployees() {
  const entries = Object.entries(employees);

  employeeCount.textContent = `${entries.length} Karyawan`;

  if (!entries.length) {
    employeeList.innerHTML = `
      <div class="employee-empty">
        <div class="empty-icon">
          <i class="fa-solid fa-users"></i>
        </div>
        <h3>Belum Ada Karyawan</h3>
        <p>Karyawan yang berhasil ditambahkan akan muncul di sini.</p>
      </div>
    `;
    return;
  }

  employeeList.innerHTML = entries.map(([id, employee]) => {
    const name = escapeHTML(employee.name || "Tanpa Nama");
    const email = escapeHTML(employee.email || "-");
    const phone = escapeHTML(employee.phone || "-");
    const role = escapeHTML(getRoleName(employee.role));
    const initial = escapeHTML(
      (employee.name || "K").charAt(0).toUpperCase()
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

function showMessage(message, icon = "info") {
  if (window.Swal) {
    Swal.fire({
      text: message,
      icon,
      confirmButtonText: "Mengerti"
    });
  } else {
    alert(message);
  }
}

function showEmployeeDetail(id) {
  const employee = employees[id];

  if (!employee) return;

  const storeName =
    employee.storeName ||
    employee.storeId ||
    "-";

  if (window.Swal) {
    Swal.fire({
      title: escapeHTML(employee.name || "Detail Karyawan"),
      html: `
        <div style="text-align:left;line-height:1.9">
          <p><strong>Username:</strong> ${escapeHTML(employee.username || "-")}</p>
          <p><strong>Email:</strong> ${escapeHTML(employee.email || "-")}</p>
          <p><strong>Nomor HP:</strong> ${escapeHTML(employee.phone || "-")}</p>
          <p><strong>Peran:</strong> ${escapeHTML(getRoleName(employee.role))}</p>
          <p><strong>Toko:</strong> ${escapeHTML(storeName)}</p>
        </div>
      `,
      confirmButtonText: "Tutup"
    });
  } else {
    showMessage(
      `Nama: ${employee.name || "-"}\nUsername: ${employee.username || "-"}\nEmail: ${employee.email || "-"}\nNomor HP: ${employee.phone || "-"}\nPeran: ${getRoleName(employee.role)}\nToko: ${storeName}`
    );
  }
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

form.addEventListener("submit", event => {
  event.preventDefault();

  if (!validateForm()) {
    showMessage(
      "Periksa kembali data karyawan. Pastikan username dan email belum digunakan.",
      "warning"
    );
    return;
  }

  showMessage(
    "Formulir sudah valid. Penyimpanan akun belum diaktifkan karena backend autentikasi karyawan belum tersedia.",
    "warning"
  );
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

    showMessage(
      "Gagal memuat data toko atau karyawan. Silakan periksa koneksi Firebase.",
      "error"
    );
  }
}

initializePage();
