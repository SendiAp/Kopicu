const $ = id => document.getElementById(id);

function createSkeleton(className) {
  const element = document.createElement("div");
  element.className = `skeleton ${className}`;
  return element;
}

export function showPreviewLoading() {
  const productDetail = $("product-detail");
  const productOptions = $("product-options");

  if (!productDetail || !productOptions) return;

  productDetail.classList.add("preview-loading-active");
  productOptions.classList.add("preview-loading-active");

  const productSkeleton = document.createElement("div");
  productSkeleton.className = "preview-skeleton";

  productSkeleton.append(
    createSkeleton("skeleton-image"),
    createSkeleton("skeleton-title"),
    createSkeleton("skeleton-description"),
    createSkeleton("skeleton-description short"),
    createSkeleton("skeleton-price")
  );

  const optionsSkeleton = document.createElement("div");
  optionsSkeleton.className = "preview-skeleton";

  for (let i = 0; i < 2; i++) {
    const group = document.createElement("div");
    group.style.marginBottom = "28px";

    group.append(
      createSkeleton("skeleton-group-title"),
      createSkeleton("skeleton-option"),
      createSkeleton("skeleton-option"),
      createSkeleton("skeleton-option")
    );

    optionsSkeleton.appendChild(group);
  }

  productDetail.appendChild(productSkeleton);
  productOptions.appendChild(optionsSkeleton);
}

export function hidePreviewLoading() {
  const productDetail = $("product-detail");
  const productOptions = $("product-options");

  if (!productDetail || !productOptions) return;

  productDetail.querySelectorAll(".preview-skeleton").forEach(element => {
    element.remove();
  });

  productOptions.querySelectorAll(".preview-skeleton").forEach(element => {
    element.remove();
  });

  productDetail.classList.remove("preview-loading-active");
  productOptions.classList.remove("preview-loading-active");
}
