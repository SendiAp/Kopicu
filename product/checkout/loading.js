const $ = id => document.getElementById(id);

function createSkeleton(className) {
  const element = document.createElement("div");
  element.className = `skeleton ${className}`;
  return element;
}

export function showCheckoutLoading() {
  const targets = [
    $("address-section"),
    $("delivery-section"),
    $("checkout-products-section"),
    $("checkout-extra-section"),
    $("checkout-summary-section")
  ];

  targets.forEach(section => {
    if (!section) return;

    section.classList.add("checkout-loading-active");

    const skeleton = document.createElement("div");
    skeleton.className = "checkout-skeleton";

    if (section.id === "address-section") {
      skeleton.append(
        createSkeleton("skeleton-address-title"),
        createSkeleton("skeleton-address-line"),
        createSkeleton("skeleton-address-line short")
      );
    }

    if (section.id === "delivery-section") {
      skeleton.append(
        createSkeleton("skeleton-section-title"),
        createSkeleton("skeleton-delivery"),
        createSkeleton("skeleton-delivery"),
        createSkeleton("skeleton-delivery")
      );
    }

    if (section.id === "checkout-products-section") {
      skeleton.append(
        createSkeleton("skeleton-store"),
        createSkeleton("skeleton-product"),
        createSkeleton("skeleton-product")
      );
    }

    if (section.id === "checkout-extra-section") {
      skeleton.append(
        createSkeleton("skeleton-extra"),
        createSkeleton("skeleton-extra")
      );
    }

    if (section.id === "checkout-summary-section") {
      skeleton.append(
        createSkeleton("skeleton-section-title"),
        createSkeleton("skeleton-summary"),
        createSkeleton("skeleton-summary"),
        createSkeleton("skeleton-summary"),
        createSkeleton("skeleton-summary-total")
      );
    }

    section.appendChild(skeleton);
  });
}

export function hideCheckoutLoading() {
  const targets = [
    $("address-section"),
    $("delivery-section"),
    $("checkout-products-section"),
    $("checkout-extra-section"),
    $("checkout-summary-section")
  ];

  targets.forEach(section => {
    if (!section) return;

    section.querySelectorAll(".checkout-skeleton").forEach(element => {
      element.remove();
    });

    section.classList.remove("checkout-loading-active");
  });
}
