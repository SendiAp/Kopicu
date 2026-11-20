import { db, storage } from "../../database/firebase.js";

import {
  ref,
  get,
  push,
  set,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("/admin/login.html");
}

const $ = id => document.getElementById(id);

const productForm = $("product-form");
const productName = $("product-name");
const productPhotos = $("product-photos");
const productDescription = $("product-description");
const productCategory = $("product-category");
const productPrice = $("product-price");
const photoPreview = $("photo-preview");
const saveButton = $("save-product-button");
const menuList = $("menu-list");
const menuListSection = $("menu-list-section");
const searchInput = $("search-menu-input");
const searchButton = $("search-menu-button");
const searchContainer = $("product-search");

const categoryForm = $("category-form");
const categoryNameInput = $("category-name");
const saveCategoryButton = $("save-category-button");
const categoryList = $("category-list");
const categoryTotal = $("category-total");

let selectedPhotos = [];
let categories = {};
let products = {};
let isSavingProduct = false;
let isSavingCategory = false;

const username = sessionStorage.getItem("kopicu_admin_username") || "Admin";

if ($("admin-username")) {
  $("admin-username").textContent = username;
}

if ($("admin-avatar")) {
  $("admin-avatar").textContent = username.charAt(0).toUpperCase();
}

function formatRupiah(value) {
  const number = String(value).replace(/\D/g, "");
  return number.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getPrice(value) {
  return Number(String(value).replace(/\D/g, "")) || 0;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function updateProductButton() {
  const valid =
    productName.value.trim() &&
    productDescription.value.trim() &&
    productCategory.value &&
    getPrice(productPrice.value) > 0 &&
    selectedPhotos.length > 0;

  saveButton.disabled = !valid || isSavingProduct;
}

function updateCategoryButton() {
  saveCategoryButton.disabled =
    !categoryNameInput.value.trim() || isSavingCategory;
}

async function loadCategories() {
  const snapshot = await get(ref(db, "categories"));

  categories = snapshot.exists() ? snapshot.val() : {};

  renderCategories();
  updateCategorySelect();
}

function updateCategorySelect() {
  const currentValue = productCategory.value;

  productCategory.innerHTML =
    '<option value="" disabled selected>Pilih kategori</option>';

  Object.entries(categories).forEach(([id, category]) => {
    if (!category || category.active === false) return;

    const option = document.createElement("option");
    option.value = id;
    option.textContent = category.name || "Kategori";

    productCategory.appendChild(option);
  });

  if (
    currentValue &&
    categories[currentValue] &&
    categories[currentValue].active !== false
  ) {
    productCategory.value = currentValue;
  }
}

function renderCategories() {
  const entries = Object.entries(categories).filter(([, category]) =>
    category && category.active !== false
  );

  categoryTotal.textContent = `${entries.length} kategori`;

  categoryList.innerHTML = "";

  if (entries.length === 0) {
    categoryList.innerHTML = `
      <div class="category-empty">
        Belum ada kategori.
      </div>
    `;
    return;
  }

  entries.forEach(([id, category]) => {
    const item = document.createElement("div");
    item.className = "category-item";

    item.innerHTML = `
      <div class="category-item-info">
        <div class="category-item-icon">
          <i class="fa-solid fa-layer-group"></i>
        </div>

        <span>${escapeHTML(category.name || "Kategori")}</span>
      </div>

      <button
        type="button"
        class="delete-category-button"
        aria-label="Hapus kategori ${escapeHTML(category.name || "")}"
        title="Hapus kategori"
      >
        <i class="fa-regular fa-trash-can"></i>
      </button>
    `;

    item.querySelector(".delete-category-button").addEventListener("click", () => {
      deleteCategory(id, category.name);
    });

    categoryList.appendChild(item);
  });
}

categoryNameInput.addEventListener("input", updateCategoryButton);

categoryForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = categoryNameInput.value.trim();

  if (!name || isSavingCategory) return;

  const duplicate = Object.values(categories).some(category =>
    category &&
    String(category.name || "").trim().toLowerCase() === name.toLowerCase() &&
    category.active !== false
  );

  if (duplicate) {
    alert("Kategori tersebut sudah tersedia.");
    return;
  }

  isSavingCategory = true;
  saveCategoryButton.disabled = true;
  saveCategoryButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i><span>Menyimpan...</span>';

  try {
    const categoryRef = push(ref(db, "categories"));

    const categoryData = {
      name,
      active: true,
      createdAt: Date.now()
    };

    await set(categoryRef, categoryData);

    categories[categoryRef.key] = categoryData;

    categoryForm.reset();

    renderCategories();
    updateCategorySelect();

    alert("Kategori berhasil ditambahkan.");

  } catch (error) {
    console.error("Gagal menyimpan kategori:", error);
    alert("Kategori gagal disimpan. Silakan coba lagi.");
  } finally {
    isSavingCategory = false;
    saveCategoryButton.innerHTML =
      '<i class="fa-solid fa-plus"></i><span>Simpan Kategori</span>';

    updateCategoryButton();
  }
});

async function deleteCategory(id, name) {
  const usedByProduct = Object.values(products).some(product =>
    product && product.categoryId === id
  );

  if (usedByProduct) {
    alert("Kategori ini masih digunakan oleh hidangan. Ubah kategori hidangan terlebih dahulu.");
    return;
  }

  const confirmed = confirm(
    `Yakin ingin menghapus kategori "${name}"?`
  );

  if (!confirmed) return;

  try {
    await remove(ref(db, `categories/${id}`));

    delete categories[id];

    renderCategories();
    updateCategorySelect();

    alert("Kategori berhasil dihapus.");

  } catch (error) {
    console.error("Gagal menghapus kategori:", error);
    alert("Kategori gagal dihapus. Silakan coba lagi.");
  }
}

function renderPhotoPreview() {
  photoPreview.innerHTML = "";

  selectedPhotos.forEach((file, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "photo-preview-item";

    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = `Foto hidangan ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-photo";
    removeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    removeButton.setAttribute("aria-label", "Hapus foto");

    removeButton.addEventListener("click", () => {
      selectedPhotos.splice(index, 1);
      renderPhotoPreview();
      updateProductButton();
    });

    wrapper.append(image, removeButton);
    photoPreview.appendChild(wrapper);
  });
}

productPhotos.addEventListener("change", () => {
  const files = Array.from(productPhotos.files || []);

  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Format foto harus JPG, PNG, atau WEBP.");
      continue;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran setiap foto maksimal 2 MB.");
      continue;
    }

    if (selectedPhotos.length >= 4) {
      alert("Maksimal 4 foto untuk setiap hidangan.");
      break;
    }

    selectedPhotos.push(file);
  }

  productPhotos.value = "";
  renderPhotoPreview();
  updateProductButton();
});

productPrice.addEventListener("input", () => {
  productPrice.value = formatRupiah(productPrice.value);
  updateProductButton();
});

productName.addEventListener("input", updateProductButton);
productDescription.addEventListener("input", updateProductButton);
productCategory.addEventListener("change", updateProductButton);

async function uploadProductPhotos(productId) {
  const urls = [];

  for (let index = 0; index < selectedPhotos.length; index++) {
    const file = selectedPhotos[index];
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const imageRef = storageRef(
      storage,
      `products/${productId}/${Date.now()}_${index}_${safeName}`
    );

    await uploadBytes(imageRef, file);

    urls.push(await getDownloadURL(imageRef));
  }

  return urls;
}

productForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSavingProduct) return;

  if (!productName.value.trim()) {
    alert("Nama hidangan wajib diisi.");
    return;
  }

  if (!productDescription.value.trim()) {
    alert("Deskripsi hidangan wajib diisi.");
    return;
  }

  if (!productCategory.value) {
    alert("Silakan pilih kategori.");
    return;
  }

  if (getPrice(productPrice.value) <= 0) {
    alert("Harga harus lebih dari 0.");
    return;
  }

  if (!selectedPhotos.length) {
    alert("Tambahkan minimal satu foto hidangan.");
    return;
  }

  isSavingProduct = true;
  saveButton.disabled = true;
  saveButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i><span>Menyimpan...</span>';

  try {
    const productRef = push(ref(db, "products"));
    const productId = productRef.key;

    const imageUrls = await uploadProductPhotos(productId);

    const productData = {
      name: productName.value.trim(),
      description: productDescription.value.trim(),
      categoryId: productCategory.value,
      price: getPrice(productPrice.value),
      image: imageUrls[0],
      images: imageUrls,
      available: true,
      optionGroups: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(productRef, productData);

    alert("Hidangan berhasil disimpan.");

    productForm.reset();
    selectedPhotos = [];

    photoPreview.innerHTML = "";

    await loadProducts();

  } catch (error) {
    console.error("Gagal menyimpan hidangan:", error);
    alert("Gagal menyimpan hidangan. Periksa koneksi dan Firebase Storage.");
  } finally {
    isSavingProduct = false;
    saveButton.innerHTML =
      '<i class="fa-solid fa-check"></i><span>Simpan Hidangan</span>';

    updateProductButton();
  }
});

function renderProducts() {
  const search = (searchInput?.value || "").trim().toLowerCase();

  const filteredProducts = Object.entries(products).filter(([, product]) =>
    String(product?.name || "").toLowerCase().includes(search)
  );

  menuList.innerHTML = "";

  if (filteredProducts.length === 0) {
    menuListSection.hidden = true;
    return;
  }

  menuListSection.hidden = false;

  filteredProducts.forEach(([id, product]) => {
    const category = categories[product.categoryId];
    const categoryName = category?.name || "Tanpa kategori";
    const image = product.image || product.images?.[0] || "";
    const available = product.available !== false;

    const item = document.createElement("article");
    item.className = "menu-item";

    item.innerHTML = `
      <div class="menu-item-image">
        ${
          image
            ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}">`
            : '<i class="fa-solid fa-image"></i>'
        }
      </div>

      <div class="menu-item-info">
        <span class="menu-item-category">${escapeHTML(categoryName)}</span>
        <h3>${escapeHTML(product.name)}</h3>
        <p>Rp${Number(product.price || 0).toLocaleString("id-ID")}</p>
      </div>

      <label class="menu-toggle">
        <input type="checkbox" ${available ? "checked" : ""}>
        <span class="menu-toggle-slider"></span>
      </label>
    `;

    const toggle = item.querySelector('input[type="checkbox"]');

    toggle.addEventListener("change", async () => {
      toggle.disabled = true;

      try {
        await update(ref(db, `products/${id}`), {
          available: toggle.checked,
          updatedAt: Date.now()
        });

        products[id].available = toggle.checked;

      } catch (error) {
        console.error("Gagal mengubah status hidangan:", error);
        toggle.checked = !toggle.checked;
        alert("Status hidangan gagal diperbarui.");
      } finally {
        toggle.disabled = false;
      }
    });

    menuList.appendChild(item);
  });
}

async function loadProducts() {
  const snapshot = await get(ref(db, "products"));

  products = snapshot.exists() ? snapshot.val() : {};

  renderProducts();
}

searchButton?.addEventListener("click", () => {
  searchContainer.hidden = !searchContainer.hidden;

  if (!searchContainer.hidden) {
    searchInput?.focus();
  } else {
    searchInput.value = "";
    renderProducts();
  }
});

searchInput?.addEventListener("input", renderProducts);

document.querySelectorAll(".product-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".product-tab").forEach(item => {
      item.classList.remove("active");
    });

    document.querySelectorAll(".product-tab-content").forEach(panel => {
      panel.hidden = true;
    });

    tab.classList.add("active");

    const target = $(`${tab.dataset.tab}-panel`);

    if (target) target.hidden = false;
  });
});

async function initializeProductPage() {
  try {
    console.log("Memulai koneksi Firebase...");

    console.log("Membaca kategori...");
    await loadCategories();
    console.log("Kategori berhasil dibaca:", categories);

    console.log("Membaca produk...");
    await loadProducts();
    console.log("Produk berhasil dibaca:", products);

    updateProductButton();
    updateCategoryButton();

    console.log("Halaman produk berhasil dimuat.");

  } catch (error) {
    console.error("Firebase Error:", error);
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);

    alert(
      "Gagal mengambil data Firebase: " +
      (error.code || error.message || "Kesalahan tidak diketahui")
    );
  }
}

initializeProductPage();
