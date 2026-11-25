export function showCheckoutLoading() {
  if (document.getElementById("checkout-loading")) return;

  const loading = document.createElement("div");
  loading.id = "checkout-loading";

  loading.innerHTML = `
    <div class="checkout-loading-content">
      <div class="checkout-loading-spinner">
        <div class="checkout-loading-ring"></div>
        <div class="checkout-loading-icon">
          <i class="fas fa-store"></i>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(loading);
}

export function hideCheckoutLoading() {
  const loading = document.getElementById("checkout-loading");

  if (!loading) return;

  loading.classList.add("checkout-loading-hide");

  setTimeout(() => {
    loading.remove();
  }, 250);
}
