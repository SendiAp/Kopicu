import { db } from "../../database/firebase.js";
import {
  ref,
  get,
  set,
  push,
  remove
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("/admin/login.html");
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
  return document.querySelector('input[name="employee-role"]:checked')?.value || "";
}

function normalizePhone(value) {
  return value.replace(/\D/g, "").replace(/^0/, "");
}

function validateForm() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = normalizePhone(phoneInput.value);
  const role = getSelectedRole();
  const storeId = storeSelect.value;

  const valid =
    username.length >= 4 &&
    password.length >= 8 &&
    name.length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    /^(\+?62)?8[0-9]{8,12}$/.test(phoneInput.value.replace(/\s/g, "").replace(/^\+/, "")) &&
    Boolean(role) &&
    Boolean(storeId);

  saveButton.disabled = !valid;
  return valid;
}

async function loadStores() {
  const snapshot = await get(ref(db, "store"));

  if (!snapshot.exists()) {
    storeSelect.innerHTML = '<option value="">Toko belum tersedia</option>';
    return;
  }

  storeData = snapshot.val();

  const stores = [{
    id: "default",
    name: storeData.name || "Toko Utama"
  }];

  (storeData.branches || []).forEach((branch, index) => {
    stores.push({
      id: branch.id || `branch_${index}`,
      name: branch.name || branch.address || `Cabang ${index + 1}`
    });
  });

  storeSelect.innerHTML = stores.map(store => `
    <option value="${escapeHTML(store.id)}">
      ${escapeHTML(store.name)}
    </option>
  `).join("");

  validateForm();
}

async function loadEmployees() {
  const snapshot = await get(ref(db, "employees"));

  employees = snapshot.exists() ? snapshot.val() : {};

  renderEmployees();
}

function renderEmployees() {
  const entries = Object.entries(employees);

  employeeCount.textContent = entries.length;

  if (!entries.length) {
    employeeList.innerHTML = `
      <div class="employee-empty">
        <i class="fa-solid fa-users"></i>
        <p>Belum ada karyawan.</p>
      </div>
    `;
    return;
  }

  employeeList.innerHTML = entries.map(([id, employee]) => {
    const name = escapeHTML(employee.name || "Tanpa Nama");
    const email = escapeHTML(employee.email || "-");
    const phone = escapeHTML(employee.phone || "-");
    const role = escapeHTML(employee.role || "-");
    const initial = escapeHTML((employee.name || "K").charAt(0).toUpperCase());

    return `
      <div class="employee-card" data-id="${escapeHTML(id)}">
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

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!validateForm()) return;

  showMessage(
    "Pembuatan akun karyawan belum diaktifkan. Sistem autentikasi backend perlu disiapkan terlebih dahulu.",
    "warning"
  );
});

employeeList.addEventListener("click", event => {
  const card = event.target.closest(".employee-card");
  if (!card) return;

  const employee = employees[card.dataset.id];
  if (!employee) return;

  showMessage(
    `${employee.name || "-"}\nUsername: ${employee.username || "-"}\nPeran: ${employee.role || "-"}`,
    "info"
  );
});

async function initializePage() {
  try {
    await loadStores();
    await loadEmployees();
  } catch (error) {
    console.error("Gagal memuat data karyawan:", error);
    showMessage("Gagal memuat data toko atau karyawan.", "error");
  }
}

initializePage();
