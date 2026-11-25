export function showCheckoutLoading() {
  document.getElementById("checkout-loading")?.classList.remove(
    "checkout-loading-hide"
  );
}

export function hideCheckoutLoading() {
  const loading = document.getElementById("checkout-loading");

  if (!loading) return;

  loading.classList.add("checkout-loading-hide");
}
