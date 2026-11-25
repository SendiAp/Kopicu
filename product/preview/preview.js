import { db } from "../../database/firebase.js";

import {
  ref,
  get,
  push,
  set,
  update
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
  showPreviewLoading,
  hidePreviewLoading
} from "./loading.js";

const $ = id => document.getElementById(id);

const headerProductName = $("header-product-name");
const productNameElement = $("product-name");
const productDescription = $("product-description");
const productPriceElement = $("product-price");
const productOptions = $("product-options");
const quantityElement = $("product-quantity");
const decreaseQuantityButton = $("decrease-quantity");
const increaseQuantityButton = $("increase-quantity");
const addToCartButton = $("add-to-cart-button");
const cartTotalPrice = $("cart-total-price");
const shareProductButton = $("share-product-button");
const productImage = $("product-image");
const additionalNote = $("additional-note");
const recommendationCard = $("recommendation-card");
const recommendationImage = $("recommendation-image");
const recommendationName = $("recommendation-name");
const recommendationPrice = $("recommendation-price");

const productId = new URLSearchParams(window.location.search).get("id");

let currentProduct = null;
let currentCategory = null;
let categories = {};
let optionGroups = {};
let selectedQuantity = 1;
let isAddingToCart = false;
let recommendationProductId = null;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatRupiah(value) {
  return "Rp" + Number(value || 0).toLocaleString("id-ID");
}

function getOptionGroups() {
  if (!Array.isArray(currentProduct?.optionGroups)) {
    return [];
  }

  return currentProduct.optionGroups
    .map(id => ({
      id,
      group: optionGroups[id]
    }))
    .filter(item => item.group && item.group.name);
}

function getSelectedOptions() {
  const selected = [];

  productOptions.querySelectorAll(".option-group").forEach(groupElement => {
    const groupId = groupElement.dataset.groupId;
    const group = optionGroups[groupId];

    if (!group) return;

    const checkedInputs = Array.from(
      groupElement.querySelectorAll(".option-checkbox:checked")
    );

    selected.push({
      groupId,
      groupName: group.name,
      options: checkedInputs.map(input => ({
        name: input.dataset.optionName,
        price: Number(input.dataset.optionPrice || 0)
      }))
    });
  });

  return selected;
}

function calculateTotalPrice() {
  if (!currentProduct) return 0;

  const basePrice = Number(currentProduct.price || 0);

  const optionsPrice = getSelectedOptions().reduce((total, group) => {
    return total + group.options.reduce((sum, option) => {
      return sum + option.price;
    }, 0);
  }, 0);

  return (basePrice + optionsPrice) * selectedQuantity;
}

function updateCartTotal() {
  const total = calculateTotalPrice();

  cartTotalPrice.textContent = formatRupiah(total);
  quantityElement.textContent = selectedQuantity;

  addToCartButton.disabled =
    !currentProduct ||
    currentProduct.available === false ||
    isAddingToCart;
}

function renderProductOptions() {
  productOptions.innerHTML = "";

  const groups = getOptionGroups();

  if (groups.length === 0) {
    productOptions.hidden = true;
    return;
  }

  productOptions.hidden = false;

  groups.forEach(({ id, group }) => {
    const options = Array.isArray(group.options) ? group.options : [];

    const section = document.createElement("section");
    section.className = "option-group";
    section.dataset.groupId = id;

    const groupDescription = [
      group.required ? "Wajib diisi" : "Opsional",
      group.multiple ? "Dapat memilih beberapa" : "Pilih satu"
    ].join(" · ");

    section.innerHTML = `
      <div class="option-group-heading">
        <h3>${escapeHTML(group.name)}</h3>
        <span>${escapeHTML(groupDescription)}</span>
      </div>

      <div class="option-items"></div>
    `;

    const itemsContainer = section.querySelector(".option-items");

    options.forEach((option, index) => {
      const optionName = String(option?.name || "");
      const optionPrice = Number(option?.price || 0);

      const label = document.createElement("label");
      label.className = "option-item";

      label.innerHTML = `
        <div class="option-item-info">
          <span class="option-item-name">
            ${escapeHTML(optionName)}
          </span>
        </div>

        <div class="option-item-action">
          <span class="option-item-price">
            ${optionPrice > 0 ? "+ " + formatRupiah(optionPrice) : "Gratis"}
          </span>

          <input
            type="checkbox"
            class="option-checkbox"
            data-option-name="${escapeHTML(optionName)}"
            data-option-price="${optionPrice}"
            data-option-index="${index}"
            aria-label="${escapeHTML(optionName)}"
          >
        </div>
      `;

      const checkbox = label.querySelector(".option-checkbox");

      checkbox.addEventListener("change", () => {
        if (checkbox.checked && !group.multiple) {
          itemsContainer
            .querySelectorAll(".option-checkbox")
            .forEach(input => {
              if (input !== checkbox) {
                input.checked = false;
              }
            });
        }

        updateCartTotal();
      });

      itemsContainer.appendChild(label);
    });

    productOptions.appendChild(section);
  });
}


async function loadRecommendation() {
  try {
    const snapshot = await get(ref(db, "products"));

    if (!snapshot.exists()) {
      recommendationCard.hidden = true;
      return;
    }

    const entries = Object.entries(snapshot.val()).filter(([id, product]) =>
      id !== productId &&
      product &&
      product.available !== false &&
      product.availabilityStatus !== "hidden"
    );

    if (entries.length === 0) {
      recommendationCard.hidden = true;
      return;
    }

    const [id, product] = entries[
      Math.floor(Math.random() * entries.length)
    ];

    recommendationProductId = id;

    recommendationImage.src =
      product.image || product.images?.[0] || "";

    recommendationImage.alt = product.name || "Product";

    recommendationName.textContent = product.name || "Product";

    recommendationPrice.textContent = formatRupiah(product.price);

    recommendationCard.hidden = false;

  } catch (error) {
    console.error("Gagal mengambil rekomendasi product:", error);
    recommendationCard.hidden = true;
  }
}

function renderProduct() {
  if (!currentProduct) return;

  const name = currentProduct.name || "Product";
  const description = currentProduct.description || "";
  const price = Number(currentProduct.price || 0);

  const image = currentProduct.image || currentProduct.images?.[0] || "";
  
  productImage.src = image;
  productImage.alt = name;
  productImage.hidden = !image;
  
  headerProductName.textContent = name;
  productNameElement.textContent = name;
  productDescription.textContent = description;
  productPriceElement.textContent = formatRupiah(price);

  renderProductOptions();
  updateCartTotal();

  if (currentProduct.available === false) {
    addToCartButton.innerHTML = "<span>Product Tidak Tersedia</span>";
    addToCartButton.disabled = true;
  }
}

function validateSelectedOptions() {
  const groups = getOptionGroups();

  for (const { id, group } of groups) {
    if (!group.required) continue;

    const section = productOptions.querySelector(
      `.option-group[data-group-id="${CSS.escape(id)}"]`
    );

    if (!section) continue;

    const selected = section.querySelector(
      ".option-checkbox:checked"
    );

    if (!selected) {
      alert(`Silakan pilih opsi pada grup ${group.name}.`);
      section.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      return false;
    }
  }

  return true;
}

function getCartId() {
  let cartId = localStorage.getItem("kopicu_cart_id");

  if (!cartId) {
    cartId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "cart_" + Date.now() + "_" + Math.random().toString(36).slice(2);

    localStorage.setItem("kopicu_cart_id", cartId);
  }

  return cartId;
}

async function addToCart() {
  if (!currentProduct || isAddingToCart) return;

  if (currentProduct.available === false) {
    alert("Product sedang tidak tersedia.");
    return;
  }

  if (!validateSelectedOptions()) return;

  const selectedOptions = getSelectedOptions();
  const cartId = getCartId();

  const basePrice = Number(currentProduct.price || 0);

  const optionsPrice = selectedOptions.reduce((total, group) => {
    return total + group.options.reduce((sum, option) => {
      return sum + option.price;
    }, 0);
  }, 0);

  const unitPrice = basePrice + optionsPrice;
  const totalPrice = unitPrice * selectedQuantity;
  const now = Date.now();

  const cartItem = {
    productId,
    name: currentProduct.name || "",
    description: currentProduct.description || "",
    categoryId: currentProduct.categoryId || "",
    categoryName: currentCategory?.name || "Lainnya",
    basePrice,
    selectedOptions,
    unitPrice,
    quantity: selectedQuantity,
    totalPrice,
    additionalNote: additionalNote.value.trim(),
    createdAt: now,
    updatedAt: now
  };

  isAddingToCart = true;
  addToCartButton.innerHTML = `
    <i class="fa-solid fa-spinner fa-spin"></i>
    <span>Menambahkan...</span>
  `;

  addToCartButton.disabled = true;

  try {
    const cartRef = ref(db, `carts/${cartId}`);
    const cartItemsRef = ref(db, `carts/${cartId}/items`);
    const newCartItemRef = push(cartItemsRef);

    await set(newCartItemRef, cartItem);

    await update(cartRef, {
      updatedAt: now
    });

    alert("Product berhasil dimasukkan ke keranjang.");

  } catch (error) {
    console.error("Gagal menambahkan ke keranjang:", error);

    alert(
      "Product gagal dimasukkan ke keranjang. Silakan coba lagi."
    );

  } finally {
    isAddingToCart = false;

    addToCartButton.innerHTML = `
      <span>+ Keranjang</span>
      <span id="cart-total-price">${formatRupiah(calculateTotalPrice())}</span>
    `;

    updateCartTotal();
  }
}

async function loadProduct() {
  if (!productId) {
    hidePreviewLoading();
    alert("ID product tidak ditemukan.");
    window.history.back();
    return;
  }

  try {
    const [productSnapshot, categoriesSnapshot, optionGroupsSnapshot] =
      await Promise.all([
        get(ref(db, `products/${productId}`)),
        get(ref(db, "categories")),
        get(ref(db, "optionGroups"))
      ]);

    if (!productSnapshot.exists()) {
      alert("Product tidak ditemukan.");
      window.history.back();
      return;
    }

    if (!productSnapshot.exists()) {
      hidePreviewLoading();
      alert("Product tidak ditemukan.");
      window.history.back();
      return;
    }
    
    currentProduct = productSnapshot.val();
    categories = categoriesSnapshot.exists()
      ? categoriesSnapshot.val()
      : {};

    optionGroups = optionGroupsSnapshot.exists()
      ? optionGroupsSnapshot.val()
      : {};

    currentCategory = categories[currentProduct.categoryId] || null;

    hidePreviewLoading();
    renderProduct();

  } catch (error) {
    hidePreviewLoading();
    console.error("Gagal mengambil data product:", error);

    alert("Product gagal dimuat. Silakan periksa koneksi internet.");
  }
}

decreaseQuantityButton.addEventListener("click", () => {
  if (selectedQuantity <= 1) return;

  selectedQuantity--;
  updateCartTotal();
});

increaseQuantityButton.addEventListener("click", () => {
  const stock = currentProduct?.stock;

  if (stock?.enabled && selectedQuantity >= Number(stock.quantity || 0)) {
    alert("Jumlah product melebihi stok yang tersedia.");
    return;
  }

  selectedQuantity++;
  updateCartTotal();
});

addToCartButton.addEventListener("click", addToCart);

shareProductButton.addEventListener("click", async () => {
  if (!currentProduct) return;

  const shareData = {
    title: currentProduct.name || "KOPICU",
    text: currentProduct.description || "",
    url: window.location.href
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link product berhasil disalin.");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Gagal membagikan product:", error);
    }
  }
});

recommendationCard.addEventListener("click", () => {
  if (!recommendationProductId) return;

  window.location.href =
    `preview.html?id=${encodeURIComponent(recommendationProductId)}`;
});

showPreviewLoading();
loadProduct();
loadRecommendation();
