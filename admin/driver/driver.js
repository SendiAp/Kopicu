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

if (!isLoggedIn || userRole !== "driver") {
  logout();
} else {
  const map = document.getElementById("google-map");

  if (map) {
    map.setAttribute("title", "Peta Google Maps");
  }

  const logoutButton = document.createElement("button");

  logoutButton.type = "button";
  logoutButton.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Keluar';

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

window.addEventListener("pageshow", () => {
  const loggedIn = sessionStorage.getItem("kopicu_admin_login") === "true";
  const role = String(
    sessionStorage.getItem("kopicu_user_role") || ""
  ).toLowerCase();

  if (!loggedIn || role !== "driver") {
    logout();
  }
});
