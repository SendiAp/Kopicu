
import { db } from "../../database/firebase.js";

import {
  ref,
  get,
  push,
  set,
  remove
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const loginStatus = sessionStorage.getItem("kopicu_admin_login");

if (loginStatus !== "true") {
  window.location.replace("/admin/login.html");
} else {
  const username = sessionStorage.getItem("kopicu_admin_username") || "Admin";

  const adminUsername = document.getElementById("admin-username");
  const adminAvatar = document.getElementById("admin-avatar");

  if (adminUsername) {
    adminUsername.textContent = username;
  }

  if (adminAvatar) {
    adminAvatar.textContent = username.charAt(0).toUpperCase();
  }
}

const $ = id => document.getElementById(id);

const promotionInput = $("promotion-input");
const promotionUploadButton = $("promotion-upload-button");
const promotionUploadArea = $("promotion-upload-area");
const promotionSlider = $("promotion-slider");
const promotionDots = $("promotion-dots");
const promotionPhotoList = $("promotion-photo-list");
const promotionCount = $("promotion-count");
const promotionPrev = $("promotion-prev");
const promotionNext = $("promotion-next");

const adminInput = $("admin-input");
const adminUploadButton = $("admin-upload-button");
const adminUploadArea = $("admin-upload-area");
const adminSlider = $("admin-slider");
const adminPhotoList = $("admin-photo-list");
const adminCount = $("admin-count");

const saveButton = $("save-button");
const saveStatus = $("save-status");

const promotionPath = "settings/promotionBanners";
const adminBannerPath = "settings/adminBanner";

let promotionOriginal = {};
let promotionRemoved = new Set();
let promotionNew = [];

let adminOriginal = null;
let adminRemoved = false;
let adminNew = null;

let promotionSlideIndex = 0;
let promotionTimer = null;

let isSaving = false;

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
      border:1px solid #eee;
      border-radius:15px;
      background:#fff;
      box-shadow:0 15px 50px rgba(0,0,0,.15);
      font-family:"DM Sans",sans-serif;
      text-align:center;
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
        createButton("Batal", "#eee", "#555", false),
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

function getPromotionItems() {
  const existing = Object.entries(promotionOriginal)
    .filter(([id]) => !promotionRemoved.has(id))
    .map(([id, data]) => ({
      id,
      url: typeof data === "string" ? data : data?.url || data?.image || "",
      type: "existing"
    }))
    .filter(item => item.url);

  const added = promotionNew.map(item => ({
    id: item.id,
    url: item.url,
    type: "new"
  }));

  return [...existing, ...added];
}

function getAdminItem() {
  if (adminRemoved) return null;

  if (adminNew) {
    return {
      id: adminNew.id,
      url: adminNew.url,
      type: "new"
    };
  }

  if (!adminOriginal) return null;

  const url = typeof adminOriginal === "string"
    ? adminOriginal
    : adminOriginal.url || adminOriginal.image || "";

  if (!url) return null;

  return {
    id: "admin-banner",
    url,
    type: "existing"
  };
}

function hasChanges() {
  return (
    promotionRemoved.size > 0 ||
    promotionNew.length > 0 ||
    adminRemoved ||
    adminNew !== null
  );
}

function updateSaveButton() {
  saveButton.disabled = !hasChanges() || isSaving;

  if (saveStatus) {
    saveStatus.textContent = isSaving
      ? "Sedang menyimpan perubahan..."
      : hasChanges()
        ? "Ada perubahan yang belum disimpan"
        : "Semua perubahan sudah tersimpan";
  }
}

function updatePromotionCount() {
  const total = getPromotionItems().length;

  if (promotionCount) {
    promotionCount.textContent = `${total} foto`;
  }
}

function updateAdminCount() {
  const total = getAdminItem() ? 1 : 0;

  if (adminCount) {
    adminCount.textContent = `${total}/1 foto`;
  }
}

function createPhotoElement(url, name, onDelete) {
  const item = document.createElement("div");
  item.className = "photo-item";

  const image = document.createElement("img");
  image.src = url;
  image.alt = name || "Foto banner";
  image.loading = "lazy";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-photo-button";
  deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
  deleteButton.setAttribute("aria-label", "Hapus foto");

  deleteButton.addEventListener("click", onDelete);

  item.append(image, deleteButton);

  return item;
}

function renderPromotionList() {
  if (!promotionPhotoList) return;

  promotionPhotoList.replaceChildren();

  const items = getPromotionItems();

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = "Belum ada foto banner promosi";
    promotionPhotoList.appendChild(empty);
  } else {
    items.forEach((item, index) => {
      const photo = createPhotoElement(
        item.url,
        `Banner Promosi ${index + 1}`,
        () => deletePromotionPhoto(item)
      );

      promotionPhotoList.appendChild(photo);
    });
  }

  updatePromotionCount();
}

function renderAdminList() {
  if (!adminPhotoList) return;

  adminPhotoList.replaceChildren();

  const item = getAdminItem();

  if (!item) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = "Belum ada foto Menu Utama Admin";
    adminPhotoList.appendChild(empty);
  } else {
    const photo = createPhotoElement(
      item.url,
      "Banner Menu Utama Admin",
      deleteAdminPhoto
    );

    adminPhotoList.appendChild(photo);
  }

  updateAdminCount();
}

function renderPromotionSlider() {
  if (!promotionSlider) return;

  const items = getPromotionItems();

  promotionSlider.replaceChildren();

  if (promotionDots) {
    promotionDots.replaceChildren();
  }

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-preview";
    empty.textContent = "Preview banner promosi akan muncul di sini";
    promotionSlider.appendChild(empty);

    clearInterval(promotionTimer);
    promotionSlideIndex = 0;
    return;
  }

  items.forEach((item, index) => {
    const slide = document.createElement("div");
    slide.className = "slider-slide";

    const image = document.createElement("img");
    image.src = item.url;
    image.alt = `Banner Promosi ${index + 1}`;

    slide.appendChild(image);
    promotionSlider.appendChild(slide);

    if (promotionDots) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.setAttribute("aria-label", `Lihat banner ${index + 1}`);

      dot.addEventListener("click", () => {
        promotionSlideIndex = index;
        updatePromotionSlider();
        restartPromotionTimer();
      });

      promotionDots.appendChild(dot);
    }
  });

  if (promotionSlideIndex >= items.length) {
    promotionSlideIndex = 0;
  }

  updatePromotionSlider();
  restartPromotionTimer();
}

function updatePromotionSlider() {
  const items = getPromotionItems();

  if (!promotionSlider || items.length === 0) return;

  promotionSlider.style.transform =
    `translateX(-${promotionSlideIndex * 100}%)`;

  if (promotionDots) {
    Array.from(promotionDots.children).forEach((dot, index) => {
      dot.classList.toggle("active", index === promotionSlideIndex);
    });
  }

  if (promotionPrev) {
    promotionPrev.disabled = items.length <= 1;
  }

  if (promotionNext) {
    promotionNext.disabled = items.length <= 1;
  }
}

function restartPromotionTimer() {
  clearInterval(promotionTimer);

  const items = getPromotionItems();

  if (items.length <= 1) return;

  promotionTimer = setInterval(() => {
    promotionSlideIndex =
      (promotionSlideIndex + 1) % items.length;

    updatePromotionSlider();
  }, 4000);
}

function renderAdminSlider() {
  if (!adminSlider) return;

  adminSlider.replaceChildren();

  const item = getAdminItem();

  if (!item) {
    const empty = document.createElement("div");
    empty.className = "empty-preview";
    empty.textContent = "Preview Menu Utama Admin akan muncul di sini";
    adminSlider.appendChild(empty);
    return;
  }

  const slide = document.createElement("div");
  slide.className = "slider-slide";

  const image = document.createElement("img");
  image.src = item.url;
  image.alt = "Banner Menu Utama Admin";

  slide.appendChild(image);
  adminSlider.appendChild(slide);
}

function renderAll() {
  renderPromotionList();
  renderAdminList();
  renderPromotionSlider();
  renderAdminSlider();
  updateSaveButton();
}

async function validateImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(
        new Error(`Gambar ${file.name} tidak dapat dibaca.`)
      );

      image.src = imageUrl;
    });

    const ratio = image.naturalWidth / image.naturalHeight;
    const targetRatio = 16 / 9;

    if (Math.abs(ratio - targetRatio) > 0.01) {
      throw new Error(
        `Ukuran gambar "${file.name}" harus memiliki rasio 16:9 seperti thumbnail YouTube.`
      );
    }
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://files.maelyn.eu/upload", {
    method: "POST",
    body: formData
  });

  const result = await response.json();

  if (!response.ok || !result.ok || !result.url) {
    throw new Error(
      result.message || `Gagal mengunggah ${file.name}`
    );
  }

  return result.url;
}

async function loadPromotionBanners() {
  const snapshot = await get(ref(db, promotionPath));

  promotionOriginal = snapshot.exists()
    ? snapshot.val() || {}
    : {};

  if (typeof promotionOriginal !== "object" || Array.isArray(promotionOriginal)) {
    promotionOriginal = {};
  }
}

async function loadAdminBanner() {
  const snapshot = await get(ref(db, adminBannerPath));

  adminOriginal = snapshot.exists()
    ? snapshot.val()
    : null;

  adminRemoved = false;
  adminNew = null;
}

async function loadPictures() {
  try {
    await Promise.all([
      loadPromotionBanners(),
      loadAdminBanner()
    ]);

    renderAll();
  } catch (error) {
    console.error("Gagal memuat banner:", error);

    await popup(
      "Data banner gagal dimuat. Periksa koneksi atau pengaturan database.",
      "Gagal Memuat Data"
    );
  }
}

async function addPromotionPhotos(files) {
  const selectedFiles = Array.from(files || []);

  if (selectedFiles.length === 0) return;

  try {
    for (const file of selectedFiles) {
      await validateImage(file);
    }

    selectedFiles.forEach(file => {
      promotionNew.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file)
      });
    });

    renderAll();
  } catch (error) {
    await popup(error.message, "Foto Tidak Sesuai");
  } finally {
    promotionInput.value = "";
  }
}

async function addAdminPhoto(file) {
  if (!file) return;

  try {
    await validateImage(file);

    const currentItem = getAdminItem();

    if (currentItem) {
      const confirmed = await popup(
        "Foto Menu Utama Admin yang lama akan diganti dengan foto baru.",
        "Ganti Banner?",
        true
      );

      if (!confirmed) return;
    }

    if (adminNew?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(adminNew.url);
    }

    adminRemoved = true;

    adminNew = {
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file)
    };

    renderAll();
  } catch (error) {
    await popup(error.message, "Foto Tidak Sesuai");
  } finally {
    adminInput.value = "";
  }
}

async function deletePromotionPhoto(item) {
  const confirmed = await popup(
    "Foto ini akan dihapus setelah perubahan disimpan.",
    "Hapus Foto?",
    true
  );

  if (!confirmed) return;

  if (item.type === "existing") {
    promotionRemoved.add(item.id);
  } else {
    const index = promotionNew.findIndex(photo => photo.id === item.id);

    if (index !== -1) {
      URL.revokeObjectURL(promotionNew[index].url);
      promotionNew.splice(index, 1);
    }
  }

  renderAll();
}

async function deleteAdminPhoto() {
  const confirmed = await popup(
    "Foto Menu Utama Admin akan dihapus setelah perubahan disimpan.",
    "Hapus Foto?",
    true
  );

  if (!confirmed) return;

  if (adminNew?.url?.startsWith("blob:")) {
    URL.revokeObjectURL(adminNew.url);
  }

  adminNew = null;
  adminRemoved = true;

  renderAll();
}

async function savePromotionChanges() {
  for (const id of promotionRemoved) {
    await remove(ref(db, `${promotionPath}/${id}`));
  }

  for (const item of promotionNew) {
    const url = await uploadImage(item.file);
    const newRef = push(ref(db, promotionPath));

    await set(newRef, {
      url,
      createdAt: Date.now()
    });
  }
}

async function saveAdminChanges() {
  if (adminRemoved && !adminNew) {
    await remove(ref(db, adminBannerPath));
    return;
  }

  if (adminNew) {
    const url = await uploadImage(adminNew.file);

    await set(ref(db, adminBannerPath), {
      url,
      updatedAt: Date.now()
    });
  }
}

async function saveChanges() {
  if (isSaving || !hasChanges()) return;

  const confirmed = await popup(
    "Simpan semua perubahan banner yang sudah dibuat?",
    "Simpan Perubahan?",
    true
  );

  if (!confirmed) return;

  isSaving = true;
  saveButton.disabled = true;

  if (saveStatus) {
    saveStatus.textContent = "Sedang menyimpan perubahan...";
  }

  try {
    await savePromotionChanges();
    await saveAdminChanges();

    promotionNew.forEach(item => {
      if (item.url.startsWith("blob:")) {
        URL.revokeObjectURL(item.url);
      }
    });

    if (adminNew?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(adminNew.url);
    }

    promotionRemoved.clear();
    promotionNew = [];

    adminRemoved = false;
    adminNew = null;

    await Promise.all([
      loadPromotionBanners(),
      loadAdminBanner()
    ]);

    renderAll();

    await popup(
      "Semua perubahan banner berhasil disimpan.",
      "Berhasil"
    );
  } catch (error) {
    console.error("Gagal menyimpan banner:", error);

    await popup(
      error.message || "Terjadi kesalahan saat menyimpan perubahan.",
      "Gagal Menyimpan"
    );
  } finally {
    isSaving = false;
    updateSaveButton();
  }
}

if (promotionUploadButton && promotionInput) {
  promotionUploadButton.addEventListener("click", event => {
    event.stopPropagation();
    promotionInput.click();
  });

  promotionInput.addEventListener("change", event => {
    addPromotionPhotos(event.target.files);
  });
}

if (promotionUploadArea && promotionInput) {
  promotionUploadArea.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    promotionInput.click();
  });
}

if (adminUploadButton && adminInput) {
  adminUploadButton.addEventListener("click", event => {
    event.stopPropagation();
    adminInput.click();
  });

  adminInput.addEventListener("change", event => {
    addAdminPhoto(event.target.files?.[0]);
  });
}

if (adminUploadArea && adminInput) {
  adminUploadArea.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    adminInput.click();
  });
}

if (promotionPrev) {
  promotionPrev.addEventListener("click", () => {
    const total = getPromotionItems().length;

    if (total <= 1) return;

    promotionSlideIndex =
      (promotionSlideIndex - 1 + total) % total;

    updatePromotionSlider();
    restartPromotionTimer();
  });
}

if (promotionNext) {
  promotionNext.addEventListener("click", () => {
    const total = getPromotionItems().length;

    if (total <= 1) return;

    promotionSlideIndex =
      (promotionSlideIndex + 1) % total;

    updatePromotionSlider();
    restartPromotionTimer();
  });
}

if (saveButton) {
  saveButton.addEventListener("click", saveChanges);
}

loadPictures();
