const $ = id => document.getElementById(id);

const cartList = $("cart-list");
const cartEmpty = $("cart-empty");
const cartTotalCount = $("cart-total-count");
const editCartButton = $("edit-cart-button");
const selectAllCheckbox = $("select-all-checkbox");
const cartSelectedTotal = $("cart-selected-total");
const checkoutButton = $("checkout-button");
const deleteSelectedButton = $("delete-selected-button");
const cartFooter = document.querySelector(".cart-footer");

let cartItems = [];
let selectedItems = new Set();
let isEditMode = false;

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

function loadCartItems() {
  try {
    const data = JSON.parse(
      localStorage.getItem("kopicu_cart") || "[]"
    );

    cartItems = Array.isArray(data) ? data : [];

  } catch (error) {
    cartItems = [];
  }

  cartItems = cartItems.filter(item =>
    item && typeof item === "object"
  );

  cartItems.forEach((item, index) => {
    if (!item.id) {
      item.id = "item_" + Date.now() + "_" + index;
    }

    item.quantity = Math.max(1, Number(item.quantity) || 1);

    if (!Number.isFinite(Number(item.unitPrice))) {
      const optionsPrice = (item.selectedOptions || []).reduce(
        (total, group) => {
          return total + (group.options || []).reduce(
            (sum, option) => sum + Number(option.price || 0),
            0
          );
        },
        0
      );

      item.unitPrice = Number(item.basePrice || 0) + optionsPrice;
    }

    item.totalPrice = Number(item.unitPrice) * item.quantity;
  });

  saveCartItems();
}

function saveCartItems() {
  localStorage.setItem(
    "kopicu_cart",
    JSON.stringify(cartItems)
  );
}

function getItemOptions(item) {
  if (!Array.isArray(item.selectedOptions)) return "";

  return item.selectedOptions
    .flatMap(group =>
      Array.isArray(group.options)
        ? group.options.map(option => option.name)
        : []
    )
    .filter(Boolean)
    .join(" + ");
}

function renderCart() {
  cartTotalCount.textContent = `(${cartItems.length})`;

  const isEmpty = cartItems.length === 0;

  cartEmpty.hidden = !isEmpty;
  cartList.hidden = isEmpty;
  cartFooter.hidden = isEmpty;
  editCartButton.hidden = isEmpty;

  if (isEmpty) {
    selectedItems.clear();
    isEditMode = false;
    return;
  }

  const validIds = new Set(cartItems.map(item => item.id));

  selectedItems = new Set(
    [...selectedItems].filter(id => validIds.has(id))
  );

  cartList.innerHTML = cartItems.map(item => {
    const image = item.image || item.images?.[0] || "";
    const options = getItemOptions(item);

    return `
      <article class="cart-item" data-cart-item-id="${escapeHTML(item.id)}">

        <label class="cart-item-checkbox">
          <input
            type="checkbox"
            class="cart-select-checkbox"
            ${selectedItems.has(item.id) ? "checked" : ""}
          >
          <span class="custom-checkbox"></span>
        </label>

        <div class="cart-item-image">
          ${
            image
              ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(item.name)}">`
              : `<div class="cart-image-placeholder">
                   <i class="fa-solid fa-image"></i>
                 </div>`
          }
        </div>

        <div class="cart-item-content">

          <div class="cart-item-top">
            <h2 class="cart-item-name">
              ${escapeHTML(item.name || "Product")}
            </h2>

            <div class="cart-item-quantity">
              <button
                class="quantity-decrease"
                type="button"
                aria-label="Kurangi jumlah"
              >
                <i class="fa-solid fa-minus"></i>
              </button>

              <span class="quantity-value">${item.quantity}</span>

              <button
                class="quantity-increase"
                type="button"
                aria-label="Tambah jumlah"
              >
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          ${
            options
              ? `<p class="cart-item-options">${escapeHTML(options)}</p>`
              : ""
          }

          <p class="cart-item-price">
          ${formatRupiah(item.unitPrice)}
          </p>

        </div>

      </article>
    `;
  }).join("");

  updateCartSummary();
}

function updateCartSummary() {
  const selectedCartItems = cartItems.filter(item =>
    selectedItems.has(item.id)
  );

  const totalPrice = selectedCartItems.reduce(
    (total, item) => total + Number(item.totalPrice || 0),
    0
  );

  cartSelectedTotal.textContent = formatRupiah(totalPrice);

  checkoutButton.textContent =
    `Checkout (${selectedCartItems.length})`;

  checkoutButton.disabled = selectedCartItems.length === 0;

  selectAllCheckbox.checked =
    cartItems.length > 0 &&
    selectedCartItems.length === cartItems.length;

  selectAllCheckbox.indeterminate =
    selectedCartItems.length > 0 &&
    selectedCartItems.length < cartItems.length;

  editCartButton.textContent = isEditMode ? "Selesai" : "Ubah";

  cartSelectedTotal.hidden = isEditMode;
  checkoutButton.hidden = isEditMode;
  deleteSelectedButton.hidden = !isEditMode;

  deleteSelectedButton.disabled = selectedCartItems.length === 0;
}

function updateCartItemQuantity(itemId, change) {
  const item = cartItems.find(item => item.id === itemId);

  if (!item) return;

  const newQuantity = item.quantity + change;

  if (newQuantity < 1) return;

  item.quantity = newQuantity;
  item.totalPrice = Number(item.unitPrice || 0) * newQuantity;
  item.updatedAt = Date.now();

  saveCartItems();
  renderCart();
}

function toggleEditMode() {
  isEditMode = !isEditMode;
  updateCartSummary();
}

async function deleteSelectedItems() {
  const selectedCartItems = cartItems.filter(item =>
    selectedItems.has(item.id)
  );

  if (!selectedCartItems.length) return;

  const confirmed = window.confirm(
    `Hapus ${selectedCartItems.length} produk yang dipilih dari keranjang?`
  );

  if (!confirmed) return;

  cartItems = cartItems.filter(item =>
    !selectedItems.has(item.id)
  );

  selectedItems.clear();

  saveCartItems();
  renderCart();
}

function checkoutSelectedItems() {
  const selectedCartItems = cartItems.filter(item =>
    selectedItems.has(item.id)
  );

  if (!selectedCartItems.length) return;

  localStorage.setItem(
    "kopicu_checkout",
    JSON.stringify(selectedCartItems)
  );

  window.location.href = "../checkout/checkout.html";
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "../product.html";
  }
}

cartList.addEventListener("change", event => {
  const checkbox = event.target.closest(".cart-select-checkbox");

  if (!checkbox) return;

  const itemElement = checkbox.closest(".cart-item");
  const itemId = itemElement?.dataset.cartItemId;

  if (!itemId) return;

  if (checkbox.checked) {
    selectedItems.add(itemId);
  } else {
    selectedItems.delete(itemId);
  }

  updateCartSummary();
});

cartList.addEventListener("click", event => {
  const button = event.target.closest("button");

  if (!button) return;

  const itemElement = button.closest(".cart-item");
  const itemId = itemElement?.dataset.cartItemId;

  if (!itemId) return;

  if (button.classList.contains("quantity-decrease")) {
    updateCartItemQuantity(itemId, -1);
  }

  if (button.classList.contains("quantity-increase")) {
    updateCartItemQuantity(itemId, 1);
  }
});

selectAllCheckbox.addEventListener("change", () => {
  if (selectAllCheckbox.checked) {
    selectedItems = new Set(cartItems.map(item => item.id));
  } else {
    selectedItems.clear();
  }

  renderCart();
});

editCartButton.addEventListener("click", toggleEditMode);

deleteSelectedButton.addEventListener(
  "click",
  deleteSelectedItems
);

checkoutButton.addEventListener(
  "click",
  checkoutSelectedItems
);

$("back-button").addEventListener("click", goBack);

window.addEventListener("pageshow", () => {
  loadCartItems();
  renderCart();
});

window.addEventListener("storage", event => {
  if (event.key === "kopicu_cart") {
    loadCartItems();
    renderCart();
  }
});

loadCartItems();
renderCart();
