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
const outletServicesList = document.getElementById("outlet-services-list");

let storeData = null;
let selectedOutlet = null;
let bannerInterval = null;
let activeBannerIndex = 0;
let bannerInteractionTimeout = null;

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

function getOutletName(outlet) {
  return outlet.name ||
    outlet.storeName ||
    outlet.outletName ||
    outlet.title ||
    "Outlet KOPICU";
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

  return [
    {
      key: "delivery",
      label: "Delivery",
      icon: "fa-motorcycle"
    },
    {
      key: "pickup",
      label: "Pickup",
      icon: "fa-bag-shopping"
    },
    {
      key: "dineIn",
      label: "Dine In",
      icon: "fa-utensils"
    }
  ].filter(service => services[service.key] === true);
}

function renderOutlet() {
  if (!outletSelector || !outletTitle || !outletAddress) return;

  const outlets = getOutlets();
  const services = getServiceLabels();
  const selectorIcon = outletSelector.querySelector(".outlet-selector-icon");

  if (selectorIcon) {
    selectorIcon.hidden = false;
    selectorIcon.innerHTML = '<i class="fa-solid fa-expand"></i>';
    selectorIcon.setAttribute("aria-label", "Scan outlet");
  }

  if (outletServices) {
    outletServices.hidden = true;
  }

  if (!outlets.length) {
    outletTitle.textContent = "Outlet belum tersedia";
    outletAddress.hidden = true;
    outletAddress.textContent = "";
    outletSelector.disabled = true;
    return;
  }

  outletSelector.disabled = false;

  if (
    !selectedOutlet ||
    !outlets.some(outlet => outlet.id === selectedOutlet.id)
  ) {
    selectedOutlet = outlets.length === 1 ? outlets[0] : null;
  }

  if (!selectedOutlet) {
    outletTitle.textContent = "Pilih outlet";
    outletAddress.hidden = true;
    outletAddress.textContent = "";
    outletSelector.setAttribute("aria-label", "Pilih outlet toko");
    return;
  }

  outletTitle.textContent = getOutletName(selectedOutlet);
  outletAddress.textContent = getOutletAddress(selectedOutlet);
  outletAddress.hidden = false;

  outletSelector.setAttribute(
    "aria-label",
    `Outlet terpilih: ${getOutletName(selectedOutlet)}, ${getOutletAddress(selectedOutlet)}`
  );

  if (services.length && outletServices && outletServicesList) {
    outletServicesList.innerHTML = services.map(service => `
      <span class="outlet-service-item">
        <i class="fa-solid ${service.icon}"></i>
        <span>${service.label}</span>
      </span>
    `).join("");

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
              <strong>${safe(index === 0 ? "Outlet Utama" : `Outlet Cabang ${index}`)}</strong>
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

outletSelector?.addEventListener("click", event => {
  if (event.target.closest(".outlet-selector-icon")) {
    showOutletPicker();
    return;
  }

  showOutletPicker();
});

function getBannerCards() {
  if (!bannerList) return [];

  return [...bannerList.querySelectorAll(".banner-card")];
}

function renderBanners(items) {
  if (!bannerList || !bannerDots) return;

  const active = items
    .filter(item => item.active !== false && item.image)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  stopBannerAutoplay();

  if (!active.length) {
    bannerList.innerHTML = "";
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

  activeBannerIndex = 0;

  updateBannerDots();
  startBannerAutoplay();
}

function updateBannerDots() {
  if (!bannerList || !bannerDots) return;

  const cards = getBannerCards();

  if (!cards.length) return;

  let closestIndex = 0;
  let smallestDistance = Infinity;

  cards.forEach((card, index) => {
    const distance = Math.abs(
      card.offsetLeft - bannerList.scrollLeft
    );

    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestIndex = index;
    }
  });

  activeBannerIndex = closestIndex;

  [...bannerDots.children].forEach((dot, index) => {
    dot.classList.toggle("active", index === closestIndex);
  });
}

function goToBanner(index) {
  const cards = getBannerCards();

  if (!cards.length || !bannerList) return;

  const nextIndex = Math.max(0, Math.min(index, cards.length - 1));

  activeBannerIndex = nextIndex;

  bannerList.scrollTo({
    left: cards[nextIndex].offsetLeft - cards[0].offsetLeft,
    behavior: "smooth"
  });

  updateBannerDots();
}

function startBannerAutoplay() {
  stopBannerAutoplay();

  const cards = getBannerCards();

  if (cards.length <= 1) return;

  bannerInterval = setInterval(() => {
    if (document.hidden) return;

    const nextIndex =
      activeBannerIndex >= cards.length - 1
        ? 0
        : activeBannerIndex + 1;

    goToBanner(nextIndex);
  }, 4000);
}

function stopBannerAutoplay() {
  if (bannerInterval) {
    clearInterval(bannerInterval);
    bannerInterval = null;
  }
}

function pauseBannerAutoplay() {
  stopBannerAutoplay();

  clearTimeout(bannerInteractionTimeout);

  bannerInteractionTimeout = setTimeout(() => {
    startBannerAutoplay();
  }, 7000);
}

bannerList?.addEventListener("scroll", updateBannerDots, {
  passive: true
});

bannerList?.addEventListener("touchstart", pauseBannerAutoplay, {
  passive: true
});

bannerList?.addEventListener("pointerdown", pauseBannerAutoplay, {
  passive: true
});

bannerList?.addEventListener("mouseenter", stopBannerAutoplay);

bannerList?.addEventListener("mouseleave", startBannerAutoplay);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopBannerAutoplay();
  } else {
    startBannerAutoplay();
  }
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

    stopBannerAutoplay();

    if (bannerList) {
      bannerList.innerHTML = "";
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

    const selectorIcon = outletSelector?.querySelector(".outlet-selector-icon");

    if (selectorIcon) {
      selectorIcon.hidden = false;
      selectorIcon.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
  }
}


async function loadProducts() {
  const [categorySnap, productSnap] = await Promise.all([
    get(ref(db, "categories")),
    get(ref(db, "products"))
  ]);

  const categories = categorySnap.exists() ? categorySnap.val() : {};
  const products = productSnap.exists() ? productSnap.val() : {};

  renderProducts(categories, products);
}

function renderProducts(categories, products) {
  const menu = document.getElementById("menu");

  if (!menu) return;

  const grouped = {};

  Object.entries(products).forEach(([id, product]) => {
    if (!product || !product.categoryId) return;

    const categoryId = product.categoryId;

    if (!grouped[categoryId]) {
      grouped[categoryId] = [];
    }

    grouped[categoryId].push({ id, ...product });
  });

  menu.innerHTML = Object.entries(grouped).map(([categoryId, items]) => {
    const categoryName = categories[categoryId]?.name || "Lainnya";

    return `
      <div class="product-category" id="category-${safe(categoryId)}">
        <div class="product-category-heading">
          <h2>${safe(categoryName)}</h2>
        </div>

        <div class="product-grid" id="product-list-${safe(categoryId)}">
          ${items.map(product => {
            const image = product.image || product.images?.[0] || "";

            return `
              <article
                class="product-card"
                data-product-id="${safe(product.id)}"
              >
                <div class="product-image">
                  ${
                    image
                      ? `<img src="${safe(image)}" alt="${safe(product.name)}">`
                      : `<div class="product-image-placeholder">
                           <i class="fa-solid fa-image"></i>
                         </div>`
                  }
                </div>

                <div class="product-info">
                  <h3 class="product-name">${safe(product.name)}</h3>
                  <p class="product-price">
                    Rp${Number(product.price || 0).toLocaleString("id-ID")}
                  </p>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");

  menu.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.productId;

      window.location.href =
        `preview/preview.html?id=${encodeURIComponent(id)}`;
    });
  });
}

loadHome();
loadProducts();
