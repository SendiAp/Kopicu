import { db, storage } from "../../database/firebase.js";

import {
  ref,
  get,
  push,
  set,
  update
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
const optionGroupsButton = $("product-option-groups");
const selectedOptionCount = $("selected-option-count");

let selectedPhotos = [];
let selectedGroups = [];
let categories = {};
let products = {};
let isSaving = false;

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

function updateSaveButton() {
  const valid =
    productName.value.trim() &&
    productCategory.value &&
    getPrice(productPrice.value) > 0 &&
    selectedPhotos.length > 0;

  saveButton.disabled = !valid || isSaving;
}

async function loadCategories() {
  const snapshot = await get(ref(db, "categories"));

  categories = snapshot.exists() ? snapshot.val() : {};

  productCategory.innerHTML =
    '<option value="">Pilih kategori</option>';

  Object.entries(categories).forEach(([id, category]) => {
    if (category.active === false) return;

    const option = document.createElement("option");
    option.value = id;
    option.textContent = category.name || "Kategori";

    productCategory.appendChild(option);
  });
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
      updateSaveButton();
    });

    wrapper.append(image, removeButton);
    photoPreview.appendChild(wrapper);
  });
}

productPhotos.addEventListener("change", () => {
  const files = Array.from(productPhotos.files || []);

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar.");
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
  updateSaveButton();
});

productPrice.addEventListener("input", () => {
  productPrice.value = formatRupiah(productPrice.value);
  updateSaveButton();
});

productName.addEventListener("input", updateSaveButton);
productCategory.addEventListener("change", updateSaveButton);

function openGroupEditor() {
  const modal = document.createElement("div");
  modal.className = "option-modal-overlay";

  modal.innerHTML = `
    <div class="option-modal">
      <div class="option-modal-header">
        <h3>Grup Opsi</h3>
        <button type="button" class="option-modal-close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="option-modal-body">
        <div id="option-group-list"></div>

        <button type="button" class="add-option-group" id="add-option-group">
          <i class="fa-solid fa-plus"></i>
          Tambah Grup Opsi
        </button>
      </div>

      <div class="option-modal-footer">
        <button type="button" class="option-cancel">Batal</button>
        <button type="button" class="option-save">Simpan Pilihan</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const groupList = modal.querySelector("#option-group-list");

  function renderGroups() {
    groupList.innerHTML = "";

    selectedGroups.forEach((group, index) => {
      const card = document.createElement("div");
      card.className = "option-group-card";

      card.innerHTML = `
        <div class="option-group-heading">
          <input
            class="option-group-name"
            type="text"
            placeholder="Nama grup, contoh: Ukuran"
            value="${escapeHTML(group.name)}"
          >

          <button type="button" class="remove-option-group">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>

        <div class="option-group-settings">
          <label>
            <input type="checkbox" class="group-required" ${group.required ? "checked" : ""}>
            Wajib dipilih
          </label>

          <label>
            <input type="checkbox" class="group-multiple" ${group.multiple ? "checked" : ""}>
            Bisa pilih lebih dari satu
          </label>
        </div>

        <div class="option-items"></div>

        <button type="button" class="add-option-item">
          <i class="fa-solid fa-plus"></i>
          Tambah pilihan
        </button>
      `;

      const optionItems = card.querySelector(".option-items");

      group.options.forEach((option, optionIndex) => {
        const item = document.createElement("div");
        item.className = "option-item";

        item.innerHTML = `
          <input
            type="text"
            class="option-name"
            placeholder="Nama pilihan"
            value="${escapeHTML(option.name)}"
          >

          <input
            type="text"
            class="option-price"
            placeholder="Tambahan harga"
            value="${formatRupiah(option.price || 0)}"
          >

          <button type="button" class="remove-option-item">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;

        item.querySelector(".option-price").addEventListener("input", event => {
          event.target.value = formatRupiah(event.target.value);
        });

        item.querySelector(".remove-option-item").addEventListener("click", () => {
          group.options.splice(optionIndex, 1);
          renderGroups();
        });

        optionItems.appendChild(item);
      });

      card.querySelector(".add-option-item").addEventListener("click", () => {
        group.options.push({ name: "", price: 0 });
        renderGroups();
      });

      card.querySelector(".remove-option-group").addEventListener("click", () => {
        selectedGroups.splice(index, 1);
        renderGroups();
      });

      groupList.appendChild(card);
    });
  }

  function readGroups() {
    const cards = Array.from(groupList.querySelectorAll(".option-group-card"));

    return cards.map(card => ({
      name: card.querySelector(".option-group-name").value.trim(),
      required: card.querySelector(".group-required").checked,
      multiple: card.querySelector(".group-multiple").checked,
      options: Array.from(card.querySelectorAll(".option-item")).map(item => ({
        name: item.querySelector(".option-name").value.trim(),
        price: getPrice(item.querySelector(".option-price").value)
      }))
    }));
  }

  modal.querySelector("#add-option-group").addEventListener("click", () => {
    selectedGroups = readGroups();

    selectedGroups.push({
      name: "",
      required: false,
      multiple: false,
      options: [{ name: "", price: 0 }]
    });

    renderGroups();
  });

  modal.querySelector(".option-modal-close").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector(".option-cancel").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector(".option-save").addEventListener("click", () => {
    const groups = readGroups();

    const invalid = groups.some(group =>
      !group.name ||
      group.options.length === 0 ||
      group.options.some(option => !option.name)
    );

    if (invalid) {
      alert("Lengkapi nama grup dan semua pilihan terlebih dahulu.");
      return;
    }

    selectedGroups = groups;

    selectedOptionCount.textContent =
      `${selectedGroups.length} terpilih`;

    modal.remove();
  });

  modal.addEventListener("click", event => {
    if (event.target === modal) modal.remove();
  });

  renderGroups();
}

optionGroupsButton.addEventListener("click", openGroupEditor);

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

    const url = await getDownloadURL(imageRef);
    urls.push(url);
  }

  return urls;
}

productForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSaving) return;

  if (!productName.value.trim()) {
    alert("Nama hidangan wajib diisi.");
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

  isSaving = true;
  saveButton.disabled = true;
  saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

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
      optionGroups: selectedGroups,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(productRef, productData);

    alert("Hidangan berhasil disimpan.");

    productForm.reset();
    selectedPhotos = [];
    selectedGroups = [];

    photoPreview.innerHTML = "";
    selectedOptionCount.textContent = "0 terpilih";

    await loadProducts();

  } catch (error) {
    console.error("Gagal menyimpan hidangan:", error);
    alert("Gagal menyimpan hidangan. Periksa koneksi dan Firebase Storage.");
  } finally {
    isSaving = false;
    saveButton.innerHTML = "Simpan Hidangan";
    updateSaveButton();
  }
});

function renderProducts() {
  const search = (searchInput?.value || "").trim().toLowerCase();

  const filteredProducts = Object.entries(products).filter(([id, product]) => {
    return String(product.name || "").toLowerCase().includes(search);
  });

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

      <label class="menu-item-toggle">
        <input type="checkbox" ${available ? "checked" : ""}>
        <span></span>
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

    const target = $( `${tab.dataset.tab}-panel` );

    if (target) target.hidden = false;
  });
});

async function initializeProductPage() {
  try {
    await loadCategories();
    await loadProducts();
    updateSaveButton();
  } catch (error) {
    console.error("Gagal memuat halaman produk:", error);
    alert("Gagal mengambil data dari Firebase.");
  }
}

initializeProductPage();
