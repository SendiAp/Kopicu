const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("/admin/login.html");
} else {
  const username = sessionStorage.getItem("kopicu_admin_username") || "Admin";

  const adminUsername = document.getElementById("admin-username");
  const adminAvatar = document.getElementById("admin-avatar");
  const currentDate = document.getElementById("current-date");

  if (adminUsername) {
    adminUsername.textContent = username;
  }

  if (adminAvatar) {
    adminAvatar.textContent = username.charAt(0).toUpperCase();
  }

  if (currentDate) {
    currentDate.textContent = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());
  }
}
