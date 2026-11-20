import { db } from "../database/firebase.js";
import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const bannerList = document.getElementById("banner-list");
const bannerDots = document.getElementById("banner-dots");
const categoryList = document.getElementById("category-list");
const productList = document.getElementById("product-list");
const searchInput = document.getElementById("product-search");
const clearSearch = document.getElementById("clear-search");
const emptyState = document.getElementById("empty-state");
const productsHeading = document.getElementById("products-heading");
const resetCategory = document.getElementById("reset-category");
const showAllCategories = document.getElementById("show-all-categories");
const storeLogo = document.getElementById("store-logo");
const brandFallback = document.getElementById("brand-fallback");

let allProducts = [];
let allCategories = [];
let activeCategory = "all";

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
    ...value
  }));
}

function renderStoreLogo(value) {
  const logoUrl = typeof value === "string"
    ? value
    : value?.url || value?.image || "";

  if (!logoUrl) {
    storeLogo.hidden = true;
    brandFallback.hidden = false;
    return;
  }

  storeLogo.onload = () => {
    storeLogo.hidden = false;
    brandFallback.hidden = true;
  };

  storeLogo.onerror = () => {
    storeLogo.hidden = true;
    brandFallback.hidden = false;
  };

  storeLogo.src = logoUrl;
}

function renderBanners(items) {
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

  const sorted = active.sort((a, b) =>
    (a.order || 0) - (b.order || 0)
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

  bannerDots.innerHTML = sorted.map((_, i) => `
    <span class="banner-dot ${i === 0 ? "active" : ""}"></span>
  `).join("");

  bannerList.addEventListener("scroll", updateBannerDots, {
    passive: true
  });
}

function updateBannerDots() {
  const cards = [...bannerList.querySelectorAll(".banner-card")];

  if (!cards.length) return;

  const index = Math.round(
    bannerList.scrollLeft / (cards[0].offsetWidth + 12)
  );

  [...bannerDots.children].forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
}

function renderCategories() {
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
  const query = searchInput.value.trim().toLocaleLowerCase("id");

  const products = allProducts.filter(product => {
    const available = product.available !== false;

    const categoryMatch =
      activeCategory === "all" ||
      product.categoryId === activeCategory;

    const searchMatch =
      !query ||
      `${product.name || ""} ${product.description || ""}`
        .toLocaleLowerCase("id")
        .includes(query);

    return available && categoryMatch && searchMatch;
  });

  productsHeading.textContent = query
    ? "Hasil pencarian"
    : "Menu";

  resetCategory.hidden = activeCategory === "all";

  if (!products.length) {
    productList.innerHTML = "";
    emptyState.textContent = query
      ? "Menu yang kamu cari belum tersedia."
      : "Produk belum tersedia.";
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
      settingsSnap,
      bannersSnap,
      categoriesSnap,
      productsSnap
    ] = await Promise.all([
      get(ref(db, "settings/storeLogo")),
      get(ref(db, "banners")),
      get(ref(db, "categories")),
      get(ref(db, "products"))
    ]);

    renderStoreLogo(settingsSnap.val());
    renderBanners(toArray(bannersSnap.val()));

    allCategories = toArray(categoriesSnap.val());
    allProducts = toArray(productsSnap.val());

    renderCategories();
    renderProducts();

  } catch (error) {
    console.error("Gagal memuat halaman KOPICU:", error);

    bannerList.innerHTML = `
      <div class="banner-card">
        <div class="banner-overlay">
          <strong>KOPICU</strong>
          <span>Belum dapat terhubung ke database.</span>
        </div>
      </div>
    `;

    categoryList.innerHTML = "";
    productList.innerHTML = "";

    emptyState.textContent =
      "Gagal memuat menu. Periksa konfigurasi Firebase dan koneksi internet.";

    emptyState.hidden = false;
  }
}

searchInput.addEventListener("input", () => {
  clearSearch.hidden = !searchInput.value;
  renderProducts();
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  clearSearch.hidden = true;
  renderProducts();
});

resetCategory.addEventListener("click", () => {
  activeCategory = "all";
  renderCategories();
  renderProducts();
});

showAllCategories.addEventListener("click", () => {
  activeCategory = "all";
  renderCategories();
  renderProducts();

  categoryList.scrollTo({
    left: 0,
    behavior: "smooth"
  });
});

loadHome();
