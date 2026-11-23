function createPageLoading() {
  if (document.getElementById("page-loading")) return;

  const loading = document.createElement("div");
  loading.id = "page-loading";
  
  loading.innerHTML = `
  <div class="loading-spinner">
  <i class="fa-solid fa-store"></i>
  </div>
  `;


  document.body.appendChild(loading);

  return loading;
}

window.showPageLoading = function(duration = 2000) {
  const loading = createPageLoading();

  if (!loading) return;

  loading.classList.remove("hide");

  setTimeout(() => {
    loading.classList.add("hide");

    setTimeout(() => {
      loading.remove();
    }, 300);
  }, duration);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.showPageLoading(2000);
  }, { once: true });
} else {
  window.showPageLoading(2000);
}
