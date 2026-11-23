import { db } from "../database/firebase.js";

import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const $ = id => document.getElementById(id);

const bannerList = $("banner-list");
const bannerDots = $("banner-dots");
const categoryList = $("category-list");
const productList = $("product-list");
const emptyState = $("empty-state");
const productsHeading = $("products-heading");
const resetCategory = $("reset-category");
const showAllCategories = $("show-all-categories");

let allProducts = [];
let allCategories = [];
let allOutlets = [];
let selectedOutlet = null;
let activeCategory = "all";
let bannerScrollHandler = null;

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

function getAvailableServices() {
  const services = selectedOutlet?.services || {};

  return [
    services.delivery ? "Delivery" : null,
    services.pickup ? "Pickup" : null,
    services.dineIn ? "Dine In" : null
  ].filter(Boolean);
}

function createOutletHeader() {
  let header = $("outlet-header");

  if (!header) {
    header = document.createElement("header");
    header.id = "outlet-header";
    header.className = "outlet-header";

    const page = document.querySelector(".page");

    if (page) {
      document.body.insertBefore(header, page);
    } else {
      document.body.prepend(header);
    }
  }

  header.style.position = "sticky";
  header.style.top = "0";
  header.style.zIndex = "100";
  header.style.background = "#fff";
  header.style.width = "100%";

  header.innerHTML = `
    <div class="outlet-header-inner">
      <div class="outlet-decoration">
        <span class="outlet-star outlet-star-one">✦</span>
        <span class="outlet-star outlet-star-two">✧</span>
        <span class="outlet-moon">☾</span>
      </div>

      <div class="outlet-selector-wrapper">
        <button
          type="button"
          id="outlet-selector"
          class="outlet-selector"
        >
          <span class="outlet-selector-text">
            <strong id="outlet-title">Pilih outlet</strong>
            <small id="outlet-address"></small>
          </span>

          <i class="fa-solid fa-chevron-down" id="outlet-chevron"></i>
        </button>

        <div id="outlet-dropdown" class="outlet-dropdown" hidden></div>

        <div class="outlet-selector-icon">
          <i class="fa-solid fa-location-dot"></i>
        </div>
      </div>

      <p id="outlet-services" class="outlet-services" hidden></p>
    </div>
  `;

  const selector = $("outlet-selector");
  const dropdown = $("outlet-dropdown");

  selector.addEventListener("click", () => {
    if (allOutlets.length <= 1) return;

    dropdown.hidden = !dropdown.hidden;
    selector.classList.toggle("open", !dropdown.hidden);
  });

  document.addEventListener("click", event => {
    if (
      !event.target.closest("#outlet-selector") &&
      !event.target.closest("#outlet-dropdown")
    ) {
      dropdown.hidden = true;
      selector.classList.remove("open");
    }
  });
}

function renderOutletDropdown() {
  const dropdown = $("outlet-dropdown");

  if (!dropdown) return;

  dropdown.innerHTML = allOutlets.map(outlet => `
    <button
      type="button"
      class="outlet-option ${selectedOutlet?.id === outlet.id ? "active" : ""}"
      data-outlet-id="${safe(outlet.id)}"
    >
      <span class="outlet-option-icon">
        <i class="fa-solid fa-store"></i>
      </span>

      <span class="outlet-option-info">
        <strong>${safe(outlet.name)}</strong>
        <small>${safe(getOutletAddress(outlet))}</small>
      </span>

      ${selectedOutlet?.id === outlet.id
        ? '<i class="fa-solid fa-circle-check outlet-option-check"></i>'
        : ""}
    </button>
  `).join("");

  dropdown.querySelectorAll("[data-outlet-id]").forEach(button => {
    button.addEventListener("click", () => {
      const outlet = allOutlets.find(item =>
        item.id === button.dataset.outletId
      );

      if (!outlet) return;

      selectedOutlet = outlet;
      renderSelectedOutlet();
      dropdown.hidden = true;
      $("outlet-selector")?.classList.remove("open");
    });
  });
}

function renderSelectedOutlet() {
  const title = $("outlet-title");
  const address = $("outlet-address");
  const servicesElement = $("outlet-services");
  const selector = $("outlet-selector");
  const chevron = $("outlet-chevron");

  if (!selectedOutlet) {
    title.textContent = "Pilih outlet";
    address.textContent = "";
    servicesElement.hidden = true;
    selector.disabled = allOutlets.length <= 1;
    chevron.hidden = allOutlets.length <= 1;
    return;
  }

  title.textContent = selectedOutlet.name || "Outlet KOPICU";
  address.textContent = getOutletAddress(selectedOutlet);

  const services = getAvailableServices();

  servicesElement.textContent = services.length
    ? `Melayani ${services.join(" / ")}`
    : "Belum ada layanan yang tersedia";

  servicesElement.hidden = false;

  selector.disabled = allOutlets.length <= 1;
  chevron.hidden = allOutlets.length <= 1;

  renderOutletDropdown();
}

function renderOutlets(storeData) {
  const mainOutlet = {
    id: "main",
    name: storeData.name || "Outlet Utama",
    latitude: storeData.latitude,
    longitude: storeData.longitude,
    locationType: storeData.locationType || "",
    province: storeData.province || "",
    city: storeData.city || "",
    district: storeData.district || "",
    village: storeData.village || "",
    postalCode: storeData.postalCode || "",
    address: storeData.address || "",
    services: storeData.services || {}
  };

  const branches = Array.isArray(storeData.branches)
    ? storeData.branches
    : Object.entries(storeData.branches || {}).map(([id, branch]) => ({
        id,
        ...branch
      }));

  allOutlets = [
    mainOutlet,
    ...branches.map((branch, index) => ({
      ...branch,
      id: String(branch.id || `branch_${index + 1}`),
      name: branch.name || branch.title || `Cabang ${index + 1}`,
      services: storeData.services || {}
    }))
  ];

  if (allOutlets.length === 1) {
    selectedOutlet = allOutlets[0];
  } else {
    selectedOutlet = null;
  }

  renderSelectedOutlet();
}

function renderBanners(data) {
  if (!bannerList || !bannerDots) return;

  const banners = Object.entries(data || {})
    .map(([id, item]) => ({
      id,
      url: typeof item === "string"
        ? item
        : item?.url || item?.image || ""
    }))
    .filter(item => item.url);

  if (bannerScrollHandler) {
    bannerList.removeEventListener("scroll", bannerScrollHandler);
    bannerScrollHandler = null;
  }

  if (!banners.length) {
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

  bannerList.innerHTML = banners.map((item, index) => `
    <article class="banner-card">
      <img
        src="${safe(item.url)}"
        alt="Banner promosi KOPICU ${index + 1}"
        loading="${index === 0 ? "eager" : "lazy"}"
      >
    </article>
  `).join("");

  bannerDots.innerHTML = banners.map((_, index) => `
    <span class="banner-dot ${index === 0 ? "active" : ""}"></span>
  `).join("");

  bannerScrollHandler = updateBannerDots;

  bannerList.addEventListener("scroll", bannerScrollHandler, {
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
  const productUrl =
    `customer/product.html?id=${encodeURIComponent(product.id)}`;

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
  if (!productList) return;

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
    const categoryName = allCategories.find(item =>
      item.id === activeCategory
    )?.name || "Menu";

    productList.innerHTML = `
      <section class="product-category-group">
        <h3 class="product-category-title">
          ${safe(categoryName)}
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
    createOutletHeader();

    const [
      storeSnap,
      bannersSnap,
      categoriesSnap,
      productsSnap
    ] = await Promise.all([
      get(ref(db, "store")),
      get(ref(db, "settings/promotionBanners")),
      get(ref(db, "categories")),
      get(ref(db, "products"))
    ]);

    const storeData = storeSnap.exists()
      ? storeSnap.val() || {}
      : {};

    renderOutlets(storeData);
    renderBanners(bannersSnap.exists() ? bannersSnap.val() : {});

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
        "Gagal memuat menu. Periksa koneksi Firebase dan coba lagi.";

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
