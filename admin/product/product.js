import { db } from "../../database/firebase.js";

import {
  ref,
  get,
  push,
  set,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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
const helpButton = $("help-menu-button");

const categoryForm = $("category-form");
const categoryNameInput = $("category-name");
const saveCategoryButton = $("save-category-button");
const categoryList = $("category-list");
const categoryTotal = $("category-total");

const optionGroupForm = $("option-group-form");
const optionGroupName = $("option-group-name");
const optionItemsList = $("option-items-list");
const addOptionButton = $("add-option-button");
const optionRequired = $("option-required");
const optionMultiple = $("option-multiple");
const saveOptionGroupButton = $("save-option-group-button");
const optionGroupList = $("option-group-list");
const optionGroupTotal = $("option-group-total");
const productOptionGroups = $("product-option-groups");

let selectedPhotos = [];
let categories = {};
let products = {};
let optionGroups = {};

let isSavingProduct = false;
let isSavingCategory = false;
let isSavingOptionGroup = false;

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

function popup(message, title = "Informasi", confirmMode = false) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");

    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:rgba(0,0,0,.38);
      backdrop-filter:blur(3px);
    `;

    const dialog = document.createElement("div");

    dialog.style.cssText = `
      width:100%;
      max-width:370px;
      padding:25px 22px 20px;
      border:1px solid #eeeeee;
      border-radius:15px;
      background:#fff;
      box-shadow:0 15px 50px rgba(0,0,0,.15);
      font-family:"DM Sans",sans-serif;
      text-align:center;
      animation:popupAppear .2s ease;
    `;

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.cssText = `
      margin:0;
      color:#38251d;
      font-size:17px;
      font-weight:800;
    `;

    const description = document.createElement("p");
    description.textContent = message;
    description.style.cssText = `
      margin:12px 0 22px;
      color:#777;
      font-size:13px;
      line-height:1.6;
    `;

    const actions = document.createElement("div");
    actions.style.cssText = `
      display:flex;
      gap:9px;
      justify-content:center;
    `;

    function createButton(text, background, color, value) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.style.cssText = `
        flex:1;
        min-height:42px;
        border:0;
        border-radius:8px;
        background:${background};
        color:${color};
        font-family:inherit;
        font-size:12px;
        font-weight:700;
        cursor:pointer;
      `;

      button.addEventListener("click", () => {
        overlay.remove();
        resolve(value);
      });

      return button;
    }

    if (confirmMode) {
      actions.append(
        createButton("Batal", "#eeeeee", "#555", false),
        createButton("Ya, lanjutkan", "#38251d", "#fff", true)
      );
    } else {
      actions.append(
        createButton("Mengerti", "#38251d", "#fff", true)
      );
    }

    dialog.append(heading, description, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
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

function getOptionRows() {
  return Array.from(
    optionItemsList.querySelectorAll(".option-item")
  );
}

function getOptionData() {
  return getOptionRows().map(row => ({
    name: row.querySelector(".option-name").value.trim(),
    price: getPrice(row.querySelector(".option-price").value)
  }));
}

function updateOptionGroupButton() {
  const nameValid = optionGroupName.value.trim().length > 0;
  const rows = getOptionRows();

  const optionsValid =
    rows.length > 0 &&
    rows.every(row => {
      const optionName = row.querySelector(".option-name").value.trim();
      const optionPrice = row.querySelector(".option-price").value.trim();

      return (
        optionName !== "" &&
        /^\d[\d,]*$/.test(optionPrice)
      );
    });

  saveOptionGroupButton.disabled =
    !nameValid || !optionsValid || isSavingOptionGroup;
}

function createOptionRow(name = "", price = "0") {
  const row = document.createElement("div");
  row.className = "option-item";

  row.innerHTML = `
    <div class="option-item-fields">
      <div class="form-group">
        <label>Nama</label>
        <input
          type="text"
          class="option-name"
          placeholder="Cth. Jelly, besar, gula 50%"
          maxlength="50"
          value="${escapeHTML(name)}"
          required
        >
      </div>

      <div class="form-group">
        <label>Harga</label>
        <div class="price-input-wrapper option-price-wrapper">
          <span>+Rp</span>
          <input
            type="text"
            class="option-price"
            inputmode="numeric"
            value="${escapeHTML(formatRupiah(price))}"
            required
          >
        </div>
      </div>
    </div>

    <button type="button" class="option-item-remove">
      Hapus opsi
    </button>
  `;

  const nameInput = row.querySelector(".option-name");
  const priceInput = row.querySelector(".option-price");
  const removeButton = row.querySelector(".option-item-remove");

  nameInput.addEventListener("input", updateOptionGroupButton);

  priceInput.addEventListener("input", () => {
    priceInput.value = formatRupiah(priceInput.value);
    updateOptionGroupButton();
  });

  removeButton.addEventListener("click", () => {
    if (getOptionRows().length <= 1) {
      popup("Minimal harus ada satu opsi dalam grup ini.");
      return;
    }

    row.remove();
    updateOptionGroupButton();
  });

  optionItemsList.appendChild(row);
  updateOptionGroupButton();
}

function resetOptionGroupForm() {
  optionGroupForm.reset();
  optionItemsList.innerHTML = "";

  optionRequired.checked = true;
  optionMultiple.checked = false;

  createOptionRow();
  updateOptionGroupButton();
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
        aria-label="Hapus kategori"
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
    await popup("Kategori tersebut sudah tersedia.");
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

    await popup("Kategori berhasil ditambahkan.");

  } catch (error) {
    console.error("Gagal menyimpan kategori:", error);
    await popup("Kategori gagal disimpan. Silakan coba lagi.");
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
    await popup(
      "Kategori ini masih digunakan oleh hidangan. Ubah kategori hidangan terlebih dahulu."
    );
    return;
  }

  const confirmed = await popup(
    `Yakin ingin menghapus kategori "${name}"?`,
    "Hapus kategori",
    true
  );

  if (!confirmed) return;

  try {
    await remove(ref(db, `categories/${id}`));

    delete categories[id];

    renderCategories();
    updateCategorySelect();

    await popup("Kategori berhasil dihapus.");

  } catch (error) {
    console.error("Gagal menghapus kategori:", error);
    await popup("Kategori gagal dihapus. Silakan coba lagi.");
  }
}

function renderOptionGroups() {
  const entries = Object.entries(optionGroups).filter(([, group]) =>
    group && group.name
  );

  optionGroupTotal.textContent = `${entries.length} grup`;
  optionGroupList.innerHTML = "";

  if (entries.length === 0) {
    optionGroupList.innerHTML = `
      <div class="category-empty">
        Belum ada grup opsi.
      </div>
    `;
    return;
  }

  entries.forEach(([id, group]) => {
    const options = Array.isArray(group.options) ? group.options : [];

    const item = document.createElement("div");
    item.className = "option-group-card";

    item.innerHTML = `
      <div class="option-group-card-header">
        <strong>${escapeHTML(group.name)}</strong>

        <div class="option-group-card-actions">
          <button
            type="button"
            class="delete-option-group-button"
            aria-label="Hapus grup opsi"
            title="Hapus grup opsi"
          >
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>

      <div class="option-group-card-details">
        ${group.required ? "Wajib diisi" : "Tidak wajib"}
        ·
        ${group.multiple ? "Bisa pilih lebih dari satu" : "Hanya satu pilihan"}
      </div>

      <div class="option-group-card-options">
        ${options.map(option => `
          <span>
            ${escapeHTML(option.name)}
            ·
            +Rp${Number(option.price || 0).toLocaleString("id-ID")}
          </span>
        `).join("")}
      </div>
    `;

    item.querySelector(".delete-option-group-button").addEventListener("click", () => {
      deleteOptionGroup(id, group.name);
    });

    optionGroupList.appendChild(item);
  });
}

function renderProductOptionGroups() {
  const entries = Object.entries(optionGroups).filter(([, group]) =>
    group && group.name
  );

  productOptionGroups.innerHTML = "";

  if (entries.length === 0) {
    productOptionGroups.innerHTML = `
      <div class="option-group-empty">
        Belum ada grup opsi. Kamu bisa membuatnya di tab Grup opsi.
      </div>
    `;
    return;
  }

  entries.forEach(([id, group]) => {
    const label = document.createElement("label");
    label.className = "product-option-group-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = id;
    checkbox.className = "product-option-group-checkbox";

    const text = document.createElement("span");
    text.textContent = group.name;

    label.append(checkbox, text);
    productOptionGroups.appendChild(label);
  });
}

async function loadOptionGroups() {
  const snapshot = await get(ref(db, "optionGroups"));

  optionGroups = snapshot.exists() ? snapshot.val() : {};

  renderOptionGroups();
  renderProductOptionGroups();
}

async function deleteOptionGroup(id, name) {
  const usedByProduct = Object.values(products).some(product =>
    product &&
    Array.isArray(product.optionGroups) &&
    product.optionGroups.includes(id)
  );

  if (usedByProduct) {
    await popup(
      "Grup opsi ini masih digunakan oleh hidangan. Hapus hubungan grup dari hidangan terlebih dahulu."
    );
    return;
  }

  const confirmed = await popup(
    `Yakin ingin menghapus grup opsi "${name}"?`,
    "Hapus grup opsi",
    true
  );

  if (!confirmed) return;

  try {
    await remove(ref(db, `optionGroups/${id}`));

    delete optionGroups[id];

    renderOptionGroups();
    renderProductOptionGroups();

    await popup("Grup opsi berhasil dihapus.");

  } catch (error) {
    console.error("Gagal menghapus grup opsi:", error);
    await popup("Grup opsi gagal dihapus. Silakan coba lagi.");
  }
}

optionGroupName.addEventListener("input", updateOptionGroupButton);

optionItemsList.addEventListener("input", updateOptionGroupButton);

addOptionButton.addEventListener("click", () => {
  createOptionRow();
});

optionGroupForm.addEventListener("submit", async event => {
  event.preventDefault();

  updateOptionGroupButton();

  if (saveOptionGroupButton.disabled || isSavingOptionGroup) return;

  const name = optionGroupName.value.trim();
  const options = getOptionData();

  if (!name || options.length === 0) return;

  if (options.some(option => !option.name)) {
    await popup("Semua nama opsi wajib diisi.");
    return;
  }

  const duplicate = Object.values(optionGroups).some(group =>
    group &&
    String(group.name || "").trim().toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    await popup("Nama grup opsi tersebut sudah digunakan.");
    return;
  }

  isSavingOptionGroup = true;
  saveOptionGroupButton.disabled = true;
  saveOptionGroupButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i><span>Menyimpan...</span>';

  try {
    const groupRef = push(ref(db, "optionGroups"));

    const groupData = {
      name,
      options,
      required: optionRequired.checked,
      multiple: optionMultiple.checked,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(groupRef, groupData);

    optionGroups[groupRef.key] = groupData;

    resetOptionGroupForm();
    renderOptionGroups();
    renderProductOptionGroups();

    await popup("Grup opsi berhasil disimpan.");

  } catch (error) {
    console.error("Gagal menyimpan grup opsi:", error);
    await popup("Grup opsi gagal disimpan. Silakan periksa koneksi Firebase.");
  } finally {
    isSavingOptionGroup = false;
    saveOptionGroupButton.innerHTML =
      '<i class="fa-solid fa-check"></i><span>Simpan Grup opsi</span>';

    updateOptionGroupButton();
  }
});

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
      popup("Format foto harus JPG, PNG, atau WEBP.");
      continue;
    }

    if (file.size > 2 * 1024 * 1024) {
      popup("Ukuran setiap foto maksimal 2 MB.");
      continue;
    }

    if (selectedPhotos.length >= 4) {
      popup("Maksimal 4 foto untuk setiap hidangan.");
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

async function uploadProductPhotos() {
  const urls = [];

  for (const file of selectedPhotos) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://files.maelyn.eu/upload", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.ok || !result.url) {
      throw new Error(result.message || `Gagal mengunggah ${file.name}`);
    }

    urls.push(result.url);
  }

  return urls;
}

productForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSavingProduct) return;

  if (!productName.value.trim()) {
    await popup("Nama hidangan wajib diisi.");
    return;
  }

  if (!productDescription.value.trim()) {
    await popup("Deskripsi hidangan wajib diisi.");
    return;
  }

  if (!productCategory.value) {
    await popup("Silakan pilih kategori.");
    return;
  }

  if (getPrice(productPrice.value) <= 0) {
    await popup("Harga harus lebih dari 0.");
    return;
  }

  if (!selectedPhotos.length) {
    await popup("Tambahkan minimal satu foto hidangan.");
    return;
  }

  isSavingProduct = true;
  saveButton.disabled = true;
  saveButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i><span>Menyimpan...</span>';

  try {
    const productRef = push(ref(db, "products"));
    const productId = productRef.key;

    const imageUrls = await uploadProductPhotos();
    
    const selectedGroups = Array.from(
      productOptionGroups.querySelectorAll(
        ".product-option-group-checkbox:checked"
      )
    ).map(input => input.value);

    const productData = {
      name: productName.value.trim(),
      description: productDescription.value.trim(),
      categoryId: productCategory.value,
      price: getPrice(productPrice.value),
      image: imageUrls[0],
      images: imageUrls,
      available: true,
      optionGroups: selectedGroups,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(productRef, productData);

    products[productId] = productData;

    productForm.reset();
    selectedPhotos = [];

    renderPhotoPreview();
    renderProducts();
    renderProductOptionGroups();
    updateProductButton();

    await popup("Hidangan berhasil disimpan.");

  } catch (error) {
    console.error("Gagal menyimpan hidangan:", error);

    await popup(
      "Gagal menyimpan hidangan. Periksa koneksi dan Firebase Storage."
    );
  } finally {
    isSavingProduct = false;
    saveButton.innerHTML =
      '<i class="fa-solid fa-check"></i><span>Simpan Hidangan</span>';

    updateProductButton();
  }
});

function showAvailabilityOptions() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");

    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(0,0,0,.4);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    `;

    const dialog = document.createElement("div");

    dialog.style.cssText = `
      width:100%;
      max-width:350px;
      background:#fff;
      padding:22px;
      border-radius:14px;
      font-family:"DM Sans",sans-serif;
    `;

    dialog.innerHTML = `
      <h3 style="margin:0 0 16px;color:#38251d;font-size:17px;">
        Atur ketersediaan
      </h3>

      <div class="availability-options">
        <button data-value="today">
          Tidak tersedia hari ini
        </button>

        <button data-value="indefinite">
          Tidak tersedia sampai waktu tidak pasti
        </button>

        <button data-value="hidden">
          Sembunyikan item ini
        </button>
      </div>

      <button class="availability-cancel">
        Batal
      </button>
    `;

    dialog.querySelectorAll("[data-value]").forEach(button => {
      button.style.cssText = `
        display:block;
        width:100%;
        padding:13px;
        margin-bottom:9px;
        border:1px solid #eee;
        border-radius:9px;
        background:#fff;
        color:#38251d;
        text-align:left;
        font-size:13px;
        cursor:pointer;
      `;

      button.addEventListener("click", () => {
        overlay.remove();
        resolve(button.dataset.value);
      });
    });

    const cancel = dialog.querySelector(".availability-cancel");

    cancel.style.cssText = `
      width:100%;
      padding:12px;
      border:0;
      border-radius:9px;
      background:#eee;
      color:#555;
      cursor:pointer;
      margin-top:5px;
    `;

    cancel.addEventListener("click", () => {
      overlay.remove();
      resolve(null);
    });

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

async function handleProductAvailability(id, toggle, product) {
  const previousStatus = product.availabilityStatus || "";
  const previousAvailable = product.available !== false;

  toggle.disabled = true;

  try {
    if (toggle.checked) {
      await update(ref(db, `products/${id}`), {
        available: true,
        availabilityStatus: "",
        updatedAt: Date.now()
      });

      product.available = true;
      product.availabilityStatus = "";

      renderProducts();
      return;
    }

    toggle.checked = true;

    const selectedStatus = await showAvailabilityOptions();

    if (!selectedStatus) return;

    await update(ref(db, `products/${id}`), {
      available: false,
      availabilityStatus: selectedStatus,
      updatedAt: Date.now()
    });

    product.available = false;
    product.availabilityStatus = selectedStatus;

    renderProducts();

  } catch (error) {
    console.error("Gagal mengubah ketersediaan:", error);

    product.available = previousAvailable;
    product.availabilityStatus = previousStatus;

    await popup("Ketersediaan hidangan gagal diperbarui.");

    renderProducts();

  } finally {
    toggle.disabled = false;
  }
}

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

  const grouped = {};

  filteredProducts.forEach(([id, product]) => {
    const categoryId = product.categoryId || "uncategorized";

    if (!grouped[categoryId]) {
      grouped[categoryId] = [];
    }

    grouped[categoryId].push([id, product]);
  });

  Object.entries(grouped).forEach(([categoryId, items]) => {
    const categoryName = categories[categoryId]?.name || "Lainnya";

    const section = document.createElement("section");
    section.className = "menu-category-section";

    const heading = document.createElement("h3");
    heading.className = "menu-category-heading";
    heading.textContent = categoryName;

    section.appendChild(heading);

    items.forEach(([id, product]) => {
      const image = product.image || product.images?.[0] || "";
      const status = product.availabilityStatus || "";

      let statusText = "";
      let statusClass = "";

      if (status === "today") {
        statusText = "Tidak tersedia hari ini";
        statusClass = "status-today";
      } else if (status === "indefinite") {
        statusText = "Tidak tersedia sampai waktu tidak pasti";
        statusClass = "status-indefinite";
      } else if (status === "hidden") {
        statusText = "Tersembunyi";
        statusClass = "status-hidden";
      }

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
          <h3>${escapeHTML(product.name)}</h3>
          <p>Rp${Number(product.price || 0).toLocaleString("id-ID")}</p>
          ${
            statusText
              ? `<span class="menu-status ${statusClass}">${statusText}</span>`
              : ""
          }
        </div>

        <label class="menu-toggle">
          <input type="checkbox" ${product.available !== false ? "checked" : ""}>
          <span class="menu-toggle-slider"></span>
        </label>
      `;

      const toggle = item.querySelector('input[type="checkbox"]');

      toggle.addEventListener("change", () => {
        handleProductAvailability(id, toggle, product);
      });

      section.appendChild(item);
    });

    menuList.appendChild(section);
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

helpButton?.addEventListener("click", () => {
  popup(
    "Tambahkan hidangan melalui tab Hidangan. Kelola kategori melalui tab Kategori dan buat pilihan tambahan melalui tab Grup opsi.",
    "Bantuan"
  );
});

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

    if (target) {
      target.hidden = false;
    }
  });
});

async function initializeProductPage() {
  try {
    resetOptionGroupForm();

    console.log("Memulai koneksi Firebase...");

    await Promise.all([
      loadCategories(),
      loadProducts(),
      loadOptionGroups()
    ]);

    updateProductButton();
    updateCategoryButton();
    updateOptionGroupButton();

    console.log("Halaman produk berhasil dimuat.");

  } catch (error) {
    console.error("Firebase Error:", error);
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);

    await popup(
      "Gagal mengambil data Firebase: " +
      (error.code || error.message || "Kesalahan tidak diketahui")
    );
  }
}

initializeProductPage();
