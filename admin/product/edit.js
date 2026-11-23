import { db } from "../../database/firebase.js";
import {
  ref,
  get,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("/admin/login.html");
}

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const form = document.getElementById("edit-product-form");
const nameInput = document.getElementById("product-name");
const descriptionInput = document.getElementById("product-description");
const categorySelect = document.getElementById("product-category");
const priceInput = document.getElementById("product-price");
const photoInput = document.getElementById("product-photos");
const photoPreview = document.getElementById("photo-preview");
const optionGroupsContainer = document.getElementById("product-option-groups");
const saveButton = document.getElementById("save-product-button");
const deleteButton = document.getElementById("delete-product-button");
const backButton = document.getElementById("back-button");

let currentProduct = null;
let productImages = [];
let categoriesData = {};
let optionGroupsData = {};
let isProcessing = false;

const MAX_PHOTOS = 4;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

backButton.addEventListener("click", () => {
  window.location.href = "product.html";
});

function createPopup(title, message, confirmMode = false) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");

    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0,0,0,.38);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
    `;

    const dialog = document.createElement("div");

    dialog.style.cssText = `
      width: 100%;
      max-width: 370px;
      padding: 25px 22px 20px;
      border: 1px solid #eee;
      border-radius: 15px;
      background: #fff;
      box-shadow: 0 15px 50px rgba(0,0,0,.15);
      font-family: 'DM Sans', sans-serif;
      text-align: center;
      animation: popupAppear .2s ease;
    `;

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.cssText = `
      margin: 0;
      color: #38251d;
      font-size: 17px;
      font-weight: 800;
    `;

    const description = document.createElement("p");
    description.textContent = message;
    description.style.cssText = `
      margin: 12px 0 22px;
      color: #777;
      font-size: 13px;
      line-height: 1.6;
    `;

    const actions = document.createElement("div");
    actions.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
    `;

    const closePopup = value => {
      overlay.remove();
      resolve(value);
    };

    const createButton = (text, primary, value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.style.cssText = `
        flex: 1;
        min-height: 42px;
        padding: 0 12px;
        border: none;
        border-radius: 8px;
        background: ${primary ? "#38251d" : "#eee"};
        color: ${primary ? "#fff" : "#555"};
        font-family: 'DM Sans', sans-serif;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      `;
      button.addEventListener("click", () => closePopup(value));
      return button;
    };

    if (confirmMode) {
      actions.append(
        createButton("Batal", false, false),
        createButton("Ya, lanjutkan", true, true)
      );
    } else {
      actions.append(createButton("Mengerti", true, true));
    }

    dialog.append(heading, description, actions);
    overlay.appendChild(dialog);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        closePopup(false);
      }
    });

    document.body.appendChild(overlay);
  });
}

function showAlert(icon, title, text) {
  return createPopup(title, text);
}

function showConfirm(title, text) {
  return createPopup(title, text, true);
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

function setLoading(button, loading, loadingText, normalText) {
  button.disabled = loading;
  button.innerHTML = loading
    ? `<i class="fa-solid fa-spinner fa-spin"></i><span>${loadingText}</span>`
    : normalText;
}

async function loadProduct() {
  if (!productId) {
    await showAlert("error", "Produk tidak ditemukan", "ID produk tidak tersedia.");
    window.location.href = "product.html";
    return;
  }

  try {
    const snapshot = await get(ref(db, `products/${productId}`));

    if (!snapshot.exists()) {
      await showAlert("error", "Produk tidak ditemukan", "Data produk mungkin sudah dihapus.");
      window.location.href = "product.html";
      return;
    }

    currentProduct = snapshot.val();

    nameInput.value = currentProduct.name || "";
    descriptionInput.value = currentProduct.description || "";
    priceInput.value = formatRupiah(currentProduct.price || 0);

    const images = Array.isArray(currentProduct.images) && currentProduct.images.length
      ? currentProduct.images
      : currentProduct.image
        ? [currentProduct.image]
        : [];

    productImages = images
      .filter(url => typeof url === "string" && url.trim())
      .map(url => ({
        type: "existing",
        url
      }));

    renderPhotoPreview();

    await Promise.all([
      loadCategories(),
      loadOptionGroups()
    ]);

    categorySelect.value = currentProduct.categoryId || "";

  } catch (error) {
    console.error("Gagal memuat produk:", error);

    await showAlert(
      "error",
      "Gagal memuat produk",
      "Terjadi kesalahan saat mengambil data produk."
    );

    window.location.href = "product.html";
  }
}

async function loadCategories() {
  const snapshot = await get(ref(db, "categories"));
  categoriesData = snapshot.exists() ? snapshot.val() : {};

  const currentCategoryId = currentProduct.categoryId || "";

  categorySelect.innerHTML = '<option value="">Pilih kategori</option>';

  Object.entries(categoriesData).forEach(([id, category]) => {
    if (!category || typeof category !== "object") return;

    const isCurrentCategory = id === currentCategoryId;

    if (category.active === false && !isCurrentCategory) return;

    const option = document.createElement("option");
    option.value = id;
    option.textContent = category.name || "Kategori tanpa nama";

    if (category.active === false) {
      option.textContent += " (Nonaktif)";
    }

    categorySelect.appendChild(option);
  });

  if (
    currentCategoryId &&
    !categorySelect.querySelector(`option[value="${CSS.escape(currentCategoryId)}"]`)
  ) {
    const option = document.createElement("option");
    option.value = currentCategoryId;
    option.textContent = "Kategori sebelumnya";
    categorySelect.appendChild(option);
  }

  categorySelect.value = currentCategoryId;
}

async function loadOptionGroups() {
  const snapshot = await get(ref(db, "optionGroups"));
  optionGroupsData = snapshot.exists() ? snapshot.val() : {};

  renderOptionGroups();
}

function renderOptionGroups() {
  const selectedGroups = Array.isArray(currentProduct.optionGroups)
    ? currentProduct.optionGroups
    : [];

  const groups = Object.entries(optionGroupsData);

  if (!groups.length) {
    optionGroupsContainer.innerHTML = `
      <div class="option-group-empty">
        <i class="fa-solid fa-layer-group"></i>
        Belum ada grup opsi
      </div>
    `;
    return;
  }

  optionGroupsContainer.innerHTML = groups.map(([id, group]) => {
    if (!group || typeof group !== "object") return "";

    const checked = selectedGroups.includes(id) ? "checked" : "";

    return `
      <label class="product-option-group-item">
        <input
          type="checkbox"
          name="product-option-group"
          value="${escapeHTML(id)}"
          ${checked}
        >
        <span>${escapeHTML(group.name || "Grup opsi tanpa nama")}</span>
      </label>
    `;
  }).join("");
}

function renderPhotoPreview() {
  photoPreview.innerHTML = "";

  productImages.forEach((item, index) => {
    const imageUrl = item.type === "existing"
      ? item.url
      : item.previewUrl;

    const wrapper = document.createElement("div");
    wrapper.className = "photo-preview-item";

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = `Foto produk ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.dataset.index = index;
    removeButton.setAttribute("aria-label", "Hapus foto");
    removeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    wrapper.append(image, removeButton);
    photoPreview.appendChild(wrapper);
  });

  updatePhotoButton();
}

function updatePhotoButton() {
  const uploadLabel = document.querySelector(".photo-upload-button");

  if (!uploadLabel) return;

  const isFull = productImages.length >= MAX_PHOTOS;

  uploadLabel.style.opacity = isFull ? "0.45" : "1";
  uploadLabel.style.pointerEvents = isFull ? "none" : "auto";
  uploadLabel.style.cursor = isFull ? "not-allowed" : "pointer";
}

photoInput.addEventListener("change", async () => {
  const files = Array.from(photoInput.files || []);

  for (const file of files) {
    if (productImages.length >= MAX_PHOTOS) {
      await showAlert(
        "warning",
        "Batas foto tercapai",
        "Maksimal hanya 4 foto produk."
      );
      break;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      await showAlert(
        "warning",
        "Format tidak didukung",
        `${file.name} bukan file JPG, PNG, atau WEBP.`
      );
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      await showAlert(
        "warning",
        "Ukuran foto terlalu besar",
        `${file.name} melebihi batas 2 MB.`
      );
      continue;
    }

    const previewUrl = URL.createObjectURL(file);

    productImages.push({
      type: "new",
      file,
      previewUrl
    });
  }

  photoInput.value = "";
  renderPhotoPreview();
});

photoPreview.addEventListener("click", event => {
  const button = event.target.closest("button[data-index]");

  if (!button) return;

  const index = Number(button.dataset.index);
  const item = productImages[index];

  if (!item) return;

  if (item.type === "new") {
    URL.revokeObjectURL(item.previewUrl);
  }

  productImages.splice(index, 1);
  renderPhotoPreview();
});

priceInput.addEventListener("input", () => {
  priceInput.value = formatRupiah(priceInput.value);
});

async function uploadProductPhoto(file) {
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

  return result.url;
}

async function saveProduct(event) {
  event.preventDefault();

  if (isProcessing) return;

  const name = nameInput.value.trim();
  const description = descriptionInput.value.trim();
  const categoryId = categorySelect.value;
  const price = getPrice(priceInput.value);

  if (!name) {
    await showAlert("warning", "Nama belum diisi", "Masukkan nama produk terlebih dahulu.");
    nameInput.focus();
    return;
  }

  if (!categoryId) {
    await showAlert("warning", "Kategori belum dipilih", "Silakan pilih kategori produk.");
    categorySelect.focus();
    return;
  }

  if (price <= 0) {
    await showAlert("warning", "Harga tidak valid", "Masukkan harga produk yang benar.");
    priceInput.focus();
    return;
  }

  const selectedGroups = Array.from(
    document.querySelectorAll('input[name="product-option-group"]:checked')
  ).map(input => input.value);

  isProcessing = true;

  setLoading(
    saveButton,
    true,
    "Menyimpan...",
    '<i class="fa-solid fa-floppy-disk"></i><span>Simpan Perubahan</span>'
  );

  try {
    const imageUrls = [];

    for (const item of productImages) {
      if (item.type === "existing") {
        imageUrls.push(item.url);
      } else {
        const uploadedUrl = await uploadProductPhoto(item.file);
        imageUrls.push(uploadedUrl);
      }
    }

    const updatedData = {
      name,
      description,
      categoryId,
      price,
      image: imageUrls[0] || "",
      images: imageUrls,
      optionGroups: selectedGroups,
      updatedAt: Date.now()
    };

    await update(ref(db, `products/${productId}`), updatedData);

    await showAlert(
      "success",
      "Perubahan berhasil disimpan",
      "Informasi produk sudah diperbarui."
    );

    window.location.href = "product.html";

  } catch (error) {
    console.error("Gagal menyimpan produk:", error);

    await showAlert(
      "error",
      "Gagal menyimpan perubahan",
      error.message || "Terjadi kesalahan saat memperbarui produk."
    );

  } finally {
    isProcessing = false;

    setLoading(
      saveButton,
      false,
      "",
      '<i class="fa-solid fa-floppy-disk"></i><span>Simpan Perubahan</span>'
    );
  }
}

async function deleteProduct() {
  if (isProcessing) return;

  const confirmation = await showConfirm(
    "Hapus hidangan ini?",
    "Produk yang dihapus tidak dapat dikembalikan."
  );

  if (!confirmation) return;

  isProcessing = true;

  setLoading(
    deleteButton,
    true,
    "Menghapus...",
    '<i class="fa-regular fa-trash-can"></i><span>Hapus Hidangan</span>'
  );

  try {
    await remove(ref(db, `products/${productId}`));

    await showAlert(
      "success",
      "Produk berhasil dihapus",
      "Produk sudah dihapus dari daftar menu."
    );

    window.location.href = "product.html";

  } catch (error) {
    console.error("Gagal menghapus produk:", error);

    await showAlert(
      "error",
      "Gagal menghapus produk",
      "Terjadi kesalahan saat menghapus produk."
    );

  } finally {
    isProcessing = false;

    setLoading(
      deleteButton,
      false,
      "",
      '<i class="fa-regular fa-trash-can"></i><span>Hapus Hidangan</span>'
    );
  }
}

form.addEventListener("submit", saveProduct);
deleteButton.addEventListener("click", deleteProduct);

loadProduct();
