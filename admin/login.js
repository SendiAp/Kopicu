import { adminAccount } from "./akun.js";
import { db } from "../database/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-button");

togglePassword.addEventListener("click", (event) => {
  event.preventDefault();

  const visible = passwordInput.type === "password";

  passwordInput.type = visible ? "text" : "password";

  togglePassword.innerHTML = visible
    ? '<i class="fa-regular fa-eye-slash"></i>'
    : '<i class="fa-regular fa-eye"></i>';
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  loginError.hidden = true;
  loginButton.disabled = true;

  try {
    if (
      username === adminAccount.username &&
      password === adminAccount.password
    ) {
      sessionStorage.setItem("kopicu_admin_login", "true");
      sessionStorage.setItem("kopicu_admin_username", username);
      sessionStorage.setItem("kopicu_user_role", "admin");

      window.location.href = "dashboard/dashboard.html";
      return;
    }

    const snapshot = await get(ref(db, "employees"));

    if (snapshot.exists()) {
      const employees = snapshot.val();

      const employeeEntry = Object.entries(employees).find(
        ([, employee]) =>
          String(employee.username || "").toLowerCase() === username.toLowerCase() &&
          employee.password === password
      );

      if (employeeEntry) {
        const [employeeId, employee] = employeeEntry;

        const role = String(employee.role || "").toLowerCase();

        sessionStorage.setItem("kopicu_admin_login", "true");
        sessionStorage.setItem("kopicu_admin_username", employee.username);
        sessionStorage.setItem("kopicu_user_role", employee.role);
        sessionStorage.setItem("kopicu_employee_id", employeeId);
        sessionStorage.setItem("kopicu_employee_name", employee.name || "");

        if (role === "driver") {
          window.location.href = "driver/driver.html";
        } else {
          window.location.href = "dashboard/dashboard.html";
        }

        return;
      }
    }

    loginError.textContent = "Username atau password yang kamu masukkan salah.";
    loginError.hidden = false;
    passwordInput.value = "";
    passwordInput.focus();

  } catch (error) {
    console.error("Gagal melakukan login:", error);

    loginError.textContent = "Terjadi kesalahan saat menghubungi database.";
    loginError.hidden = false;

  } finally {
    loginButton.disabled = false;
  }
});
