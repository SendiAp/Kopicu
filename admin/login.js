import { adminAccount } from "../akun.js";

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-button");

togglePassword.addEventListener("click", () => {
  const visible = passwordInput.type === "text";

  passwordInput.type = visible ? "password" : "text";

  togglePassword.innerHTML = visible
    ? '<i class="fa-regular fa-eye"></i>'
    : '<i class="fa-regular fa-eye-slash"></i>';
});

loginForm.addEventListener("submit", event => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  loginError.hidden = true;

  if (
    username === adminAccount.username &&
    password === adminAccount.password
  ) {
    sessionStorage.setItem("kopicu_admin_login", "true");
    window.location.href = "dashboard/dashboard.html";
    return;
  }

  loginError.textContent = "Username atau password yang kamu masukkan salah.";
  loginError.hidden = false;
  passwordInput.value = "";
  passwordInput.focus();
});
