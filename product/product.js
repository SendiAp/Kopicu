import { db } from "../database/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const bannerList = document.getElementById("banner-list");
const bannerDots = document.getElementById("banner-dots");

const outletSelector = document.getElementById("outlet-selector");
const outletTitle = document.getElementById("outlet-title");
const outletAddress = document.getElementById("outlet-address");
const outletServices = document.getElementById("outlet-services");
const outletServicesText = document.getElementById("outlet-services-text");

let storeData = null;
let selectedOutlet = null;

const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char]));

function toArray(data) {
  if (!data || typeof data !== "object") return [];

  return Object.entries(data).map(([id, value]) => ({
    id,
    ...(value && typeof value === "object" ? value : {})
  }));
}

function getOutletAddress(outlet) {
  return [
    outlet.locationType,
    outlet.address,
    outlet.village,
    outlet.district,
    outlet.city,
    outlet.province,
    outlet.postalCode
  ].filter(Boolean).join(", ");
}

function getOutlets() {
  if (!storeData) return [];

  const mainOutlet = {
    id: "main",
    ...storeData
  };

  const branches = toArray(storeData.branches).map((branch, index) => ({
    ...branch,
    id: branch.id || `branch_${index + 1}`
  }));

  return [mainOutlet, ...branches].filter(outlet =>
    getOutletAddress(outlet)
  );
}

function getServiceLabels() {
  const services = storeData?.services || {};
  const labels = [];

  if (services.delivery === true) labels.push("Delivery");
  if (services.pickup === true) labels.push("Pickup");
  if (services.dineIn === true) labels.push("Dine In");

  return labels;
}

function renderOutlet() {
  if (!outletSelector || !outletTitle || !outletAddress) return;

  const outlets = getOutlets();
  const services = getServiceLabels();
  const selectorIcon = outletSelector.querySelector(".outlet-selector-icon");

  if (outletServices) {
    outletServices.hidden = true;
  }

  if (!outlets.length) {
    outletTitle.textContent = "Outlet belum tersedia";
    outletAddress.hidden = true;
    outletAddress.textContent = "";
    outletSelector.disabled = true;

    if (selectorIcon) selectorIcon.hidden = true;

    return;
  }

  outletSelector.disabled = false;

  if (selectorIcon) {
    selectorIcon.hidden = outlets.length <= 1;
  }

  if (outlets.length === 1) {
    selectedOutlet = outlets[0];
  } else if (
    !selectedOutlet ||
    !outlets.some(outlet => outlet.id === selectedOutlet.id)
  ) {
    selectedOutlet = null;
  }

  if (!selectedOutlet) {
    outletTitle.textContent = "Pilih outlet";
    outletAddress.hidden = true;
    outletAddress.textContent = "";
    outletSelector.setAttribute("aria-label", "Pilih outlet toko");
    return;
  }

  outletTitle.textContent = "Lokasi outlet";
  outletAddress.textContent = getOutletAddress(selectedOutlet);
  outletAddress.hidden = false;

  outletSelector.setAttribute(
    "aria-label",
    `Outlet terpilih: ${getOutletAddress(selectedOutlet)}`
  );

  if (services.length && outletServices && outletServicesText) {
    outletServicesText.textContent = `Melayani ${services.join(" / ")}`;
    outletServices.hidden = false;
  }
}

function showOutletPicker() {
  const outlets = getOutlets();

  if (outlets.length <= 1) return;

  document.getElementById("outlet-picker-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "outlet-picker-overlay";
  overlay.className = "outlet-picker-overlay";

  overlay.innerHTML = `
    <div class="outlet-picker">
      <div class="outlet-picker-heading">
        <div>
          <h3>Pilih outlet toko</h3>
          <p>Pilih lokasi outlet yang ingin kamu kunjungi</p>
        </div>

        <button class="outlet-picker-close" type="button" aria-label="Tutup">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="outlet-picker-list">
        ${outlets.map((outlet, index) => `
          <button
            class="outlet-option ${selectedOutlet?.id === outlet.id ? "active" : ""}"
            type="button"
            data-outlet-id="${safe(outlet.id)}"
          >
            <span class="outlet-option-icon">
              <i class="fa-solid fa-location-dot"></i>
            </span>

            <span class="outlet-option-content">
              <strong>${index === 0 ? "Outlet Utama" : `Outlet Cabang ${index}`}</strong>
              <span>${safe(getOutletAddress(outlet))}</span>
            </span>

            <i class="fa-solid fa-circle-check outlet-option-check"></i>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".outlet-picker-close")?.addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  overlay.querySelectorAll("[data-outlet-id]").forEach(button => {
    button.addEventListener("click", () => {
      const outlet = outlets.find(item =>
        item.id === button.dataset.outletId
      );

      if (!outlet) return;

      selectedOutlet = outlet;
      overlay.remove();
      renderOutlet();
    });
  });
}

outletSelector?.addEventListener("click", showOutletPicker);

function renderBanners(items) {
  if (!bannerList || !bannerDots) return;

  const active = items
    .filter(item => item.active !== false && item.image)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  if (!active.length) {
    bannerList.innerHTML = `
      <div class="banner-card"></div>
    `;

    bannerDots.innerHTML = "";
    return;
  }

  bannerList.innerHTML = active.map(item => `
    <article class="banner-card">
      <img
        src="${safe(item.image)}"
        alt="${safe(item.title || "Banner KOPICU")}"
        loading="eager"
      >
    </article>
  `).join("");

  bannerDots.innerHTML = active.map((_, index) => `
    <span class="banner-dot ${index === 0 ? "active" : ""}"></span>
  `).join("");

  updateBannerDots();
}

function updateBannerDots() {
  if (!bannerList || !bannerDots) return;

  const cards = [...bannerList.querySelectorAll(".banner-card")];

  if (!cards.length) return;

  const scrollPosition = bannerList.scrollLeft;

  let activeIndex = 0;
  let smallestDistance = Infinity;

  cards.forEach((card, index) => {
    const distance = Math.abs(card.offsetLeft - scrollPosition);

    if (distance < smallestDistance) {
      smallestDistance = distance;
      activeIndex = index;
    }
  });

  [...bannerDots.children].forEach((dot, index) => {
    dot.classList.toggle("active", index === activeIndex);
  });
}

bannerList?.addEventListener("scroll", updateBannerDots, {
  passive: true
});

window.addEventListener("resize", updateBannerDots);

async function loadHome() {
  try {
    const [storeSnap, bannersSnap] = await Promise.all([
      get(ref(db, "store")),
      get(ref(db, "settings/promotionBanners"))
    ]);

    storeData = storeSnap.val() || {};
    selectedOutlet = null;

    renderOutlet();

    const bannerData = bannersSnap.val() || {};

    const bannerItems = Object.entries(bannerData).map(([id, item]) => ({
      id,
      image: typeof item === "string"
        ? item
        : item?.url || item?.image || "",
      title: item?.title || "",
      subtitle: item?.subtitle || "",
      active: item?.active !== false,
      order: item?.order ?? 0
    }));

    renderBanners(bannerItems);

  } catch (error) {
    console.error("Gagal memuat halaman KOPICU:", error);

    if (bannerList) {
      bannerList.innerHTML = `
        <div class="banner-card"></div>
      `;
    }

    if (bannerDots) {
      bannerDots.innerHTML = "";
    }

    if (outletTitle) {
      outletTitle.textContent = "Outlet belum tersedia";
    }

    if (outletAddress) {
      outletAddress.hidden = true;
      outletAddress.textContent = "";
    }

    if (outletServices) {
      outletServices.hidden = true;
    }
  }
}

loadHome();
