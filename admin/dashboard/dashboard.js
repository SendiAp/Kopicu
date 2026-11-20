const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("../login.html");
}

const username = sessionStorage.getItem("kopicu_admin_username") || "Admin";

const adminUsername = document.getElementById("admin-username");
const adminAvatar = document.getElementById("admin-avatar");
const hamburgerButton = document.getElementById("hamburger-button");
const closeSidebar = document.getElementById("close-sidebar");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const logoutButton = document.getElementById("logout-button");
const currentDate = document.getElementById("current-date");

adminUsername.textContent = username;
adminAvatar.textContent = username.charAt(0).toUpperCase();

currentDate.textContent = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
}).format(new Date());

function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("show");
}

function hideSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
}

hamburgerButton.addEventListener("click", openSidebar);
closeSidebar.addEventListener("click", hideSidebar);
sidebarOverlay.addEventListener("click", hideSidebar);

document.querySelectorAll(".sidebar-link[href]").forEach(link => {
  link.addEventListener("click", hideSidebar);
});

logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem("kopicu_admin_login");
  sessionStorage.removeItem("kopicu_admin_username");
  window.location.replace("../login.html");
});
