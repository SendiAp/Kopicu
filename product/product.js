import { db } from "../database/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const bannerList = document.getElementById("banner-list");
const bannerDots = document.getElementById("banner-dots");
const categoryList = document.getElementById("category-list");
const productList = document.getElementById("product-list");
const emptyState = document.getElementById("empty-state");
const productsHeading = document.getElementById("products-heading");
const resetCategory = document.getElementById("reset-category");
const showAllCategories = document.getElementById("show-all-categories");

let allProducts = [];
let allCategories = [];
let activeCategory = "all";
let storeData = null;
let selectedOutlet = null;

const rupiah = value => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

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

function ensureOutletSection() {
  const existing = [...document.querySelectorAll("#outlet-section")];

  let section = existing.shift();

  existing.forEach(element => element.remove());

  if (!section) {
    section = document.createElement("section");
    section.id = "outlet-section";
    section.className = "outlet-section";
  }

  const bannerSection = document.querySelector(".banner-section");

  if (bannerSection?.parentElement) {
    bannerSection.parentElement.insertBefore(section, bannerSection);
  } else {
    document.querySelector("main")?.prepend(section);
  }

  section.style.position = "sticky";
  section.style.top = "0";
  section.style.zIndex = "25";
  section.style.background = "#fff";

  return section;
}

function renderOutlet() {
  const section = ensureOutletSection();
  const outlets = getOutlets();

  if (!outlets.length) {
    section.innerHTML = `
      <div class="outlet-selector">
        <div class="outlet-selector-icon">
          <i class="fa-solid fa-location-dot"></i>
        </div>
        <div class="outlet-selector-content">
          <span class="outlet-label">Outlet belum tersedia</span>
          <strong>Alamat toko belum diatur</strong>
        </div>
      </div>
    `;
    return;
  }

  if (outlets.length === 1) {
    selectedOutlet = outlets[0];
    renderSelectedOutlet(section);
    return;
  }

  if (!selectedOutlet || !outlets.some(outlet => outlet.id === selectedOutlet.id)) {
    selectedOutlet = null;
  }

  if (!selectedOutlet) {
    section.innerHTML = `
      <button class="outlet-selector outlet-select-button" id="choose-outlet-button" type="button">
        <span class="outlet-selector-icon">
          <i class="fa-solid fa-location-dot"></i>
        </span>
        <span class="outlet-selector-content">
          <span class="outlet-label">Lokasi pengambilan</span>
          <strong>Pilih outlet toko</strong>
        </span>
        <span class="outlet-chevron">
          <i class="fa-solid fa-chevron-down"></i>
        </span>
      </button>
    `;

    section.querySelector("#choose-outlet-button")?.addEventListener("click", showOutletPicker);
    return;
  }

  renderSelectedOutlet(section);
}

function renderSelectedOutlet(section) {
  const address = getOutletAddress(selectedOutlet);
  const services = getServiceLabels();

  section.innerHTML = `
    <button class="outlet-selector outlet-select-button" id="choose-outlet-button" type="button">
      <span class="outlet-selector-icon">
        <i class="fa-solid fa-location-dot"></i>
      </span>
      <span class="outlet-selector-content">
        <span class="outlet-label">Lokasi outlet</span>
        <strong class="outlet-address">${safe(address)}</strong>
      </span>
      ${getOutlets().length > 1 ? `
        <span class="outlet-chevron">
          <i class="fa-solid fa-chevron-down"></i>
        </span>
      ` : ""}
    </button>

    ${services.length ? `
      <div class="outlet-services">
        <i class="fa-solid fa-circle-check"></i>
        <span>Melayani ${services.map(safe).join(" / ")}</span>
      </div>
    ` : ""}
  `;

  section.querySelector("#choose-outlet-button")?.addEventListener("click", () => {
    if (getOutlets().length > 1) showOutletPicker();
  });
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
    if (event.target === overlay) overlay.remove();
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

function renderBanners(items) {
  if (!bannerList || !bannerDots) return;

  const active = items.filter(item =>
    item.active !== false && item.image
  );

  if (!active.length) {
    bannerList.innerHTML = `
      <div class="banner-card">
        <div class="banner-overlay">
          <strong>Selamat datang di KOPICU</strong>
          <span>Temukan menu favoritmu hari ini</span>
        </div>
      </div>
    `;

    bannerDots.innerHTML = "";
    return;
  }

  const sorted = [...active].sort((a, b) =>
    (Number(a.order) || 0) - (Number(b.order) || 0)
  );

  bannerList.innerHTML = sorted.map(item => `
    <article class="banner-card">
      <img
        src="${safe(item.image)}"
        alt="${safe(item.title || "Banner KOPICU")}"
        loading="lazy"
      >

      <div class="banner-overlay">
        ${item.title ? `<strong>${safe(item.title)}</strong>` : ""}
        ${item.subtitle ? `<span>${safe(item.subtitle)}</span>` : ""}
      </div>
    </article>
  `).join("");

  bannerDots.innerHTML = sorted.map((_, index) => `
    <span class="banner-dot ${index === 0 ? "active" : ""}"></span>
  `).join("");
}

function updateBannerDots() {
  if (!bannerList || !bannerDots) return;

  const cards = [...bannerList.querySelectorAll(".banner-card")];

  if (!cards.length) return;

  const index = Math.round(
    bannerList.scrollLeft / (cards[0].offsetWidth + 12)
  );

  [...bannerDots.children].forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
}

bannerList?.addEventListener("scroll", updateBannerDots, {
  passive: true
});

function renderCategories() {
  if (!categoryList) return;

  const visible = allCategories.filter(category =>
    category.active !== false
  );

  categoryList.innerHTML = `
    <button
      class="category-item ${activeCategory === "all" ? "active" : ""}"
      data-category="all"
      type="button"
    >
      Semua
    </button>
  ` + visible.map(category => `
    <button
      class="category-item ${activeCategory === category.id ? "active" : ""}"
      data-category="${safe(category.id)}"
      type="button"
    >
      ${safe(category.name)}
    </button>
  `).join("");

  categoryList.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      renderCategories();
      renderProducts();
    });
  });
}

function renderProductCard(product) {
  const productUrl = `customer/product.html?id=${encodeURIComponent(product.id)}`;

  return `
    <article class="product-card">
      <a class="product-image-link" href="${productUrl}">
        <img
          class="product-image"
          src="${safe(product.image || "assets/images/product-placeholder.png")}"
          alt="${safe(product.name)}"
          loading="lazy"
        >
      </a>

      <div class="product-info">
        <div>
          <h3 class="product-name">
            ${safe(product.name || "Produk")}
          </h3>

          <p class="product-description">
            ${safe(product.description || "Menu pilihan KOPICU")}
          </p>
        </div>

        <div class="product-bottom">
          <span class="product-price">
            ${rupiah(product.price)}
          </span>

          <a
            class="add-button"
            href="${productUrl}"
            aria-label="Pilih ${safe(product.name)}"
          >
            <i class="fa-solid fa-plus"></i>
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  if (!productList || !productsHeading || !emptyState) return;

  const products = allProducts.filter(product => {
    const available = product.available !== false;

    const categoryMatch =
      activeCategory === "all" ||
      product.categoryId === activeCategory;

    return available && categoryMatch;
  });

  productsHeading.textContent = "Menu";

  if (resetCategory) {
    resetCategory.hidden = activeCategory === "all";
  }

  if (!products.length) {
    productList.innerHTML = "";
    emptyState.textContent = "Produk belum tersedia.";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  if (activeCategory !== "all") {
    productList.innerHTML = `
      <section class="product-category-group">
        <h3 class="product-category-title">
          ${safe(allCategories.find(item =>
            item.id === activeCategory
          )?.name || "Menu")}
        </h3>

        <div class="product-category-items">
          ${products.map(renderProductCard).join("")}
        </div>
      </section>
    `;

    return;
  }

  const groups = allCategories
    .filter(category => category.active !== false)
    .map(category => ({
      category,
      products: products.filter(product =>
        product.categoryId === category.id
      )
    }))
    .filter(group => group.products.length > 0);

  const categorizedIds = new Set(
    groups.flatMap(group =>
      group.products.map(product => product.id)
    )
  );

  const uncategorized = products.filter(product =>
    !categorizedIds.has(product.id)
  );

  productList.innerHTML = groups.map(group => `
    <section class="product-category-group">
      <h3 class="product-category-title">
        ${safe(group.category.name)}
      </h3>

      <div class="product-category-items">
        ${group.products.map(renderProductCard).join("")}
      </div>
    </section>
  `).join("");

  if (uncategorized.length) {
    productList.innerHTML += `
      <section class="product-category-group">
        <h3 class="product-category-title">Lainnya</h3>

        <div class="product-category-items">
          ${uncategorized.map(renderProductCard).join("")}
        </div>
      </section>
    `;
  }
}

async function loadHome() {
  try {
    const [
      storeSnap,
      bannersSnap,
      categoriesSnap,
      productsSnap
    ] = await Promise.all([
      get(ref(db, "store")),
      get(ref(db, "banners")),
      get(ref(db, "categories")),
      get(ref(db, "products"))
    ]);

    storeData = storeSnap.val() || {};
    selectedOutlet = null;

    renderOutlet();
    renderBanners(toArray(bannersSnap.val()));

    allCategories = toArray(categoriesSnap.val());
    allProducts = toArray(productsSnap.val());

    renderCategories();
    renderProducts();

  } catch (error) {
    console.error("Gagal memuat halaman KOPICU:", error);

    if (bannerList) {
      bannerList.innerHTML = `
        <div class="banner-card">
          <div class="banner-overlay">
            <strong>KOPICU</strong>
            <span>Belum dapat terhubung ke database.</span>
          </div>
        </div>
      `;
    }

    if (categoryList) categoryList.innerHTML = "";
    if (productList) productList.innerHTML = "";

    if (emptyState) {
      emptyState.textContent =
        "Gagal memuat menu. Periksa konfigurasi Firebase dan koneksi internet.";
      emptyState.hidden = false;
    }
  }
}

resetCategory?.addEventListener("click", () => {
  activeCategory = "all";
  renderCategories();
  renderProducts();
});

showAllCategories?.addEventListener("click", () => {
  activeCategory = "all";
  renderCategories();
  renderProducts();

  categoryList?.scrollTo({
    left: 0,
    behavior: "smooth"
  });
});

loadHome();
