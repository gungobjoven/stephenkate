
import { supabase } from "./supabaseClient.js";

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");
const productGrid = document.getElementById("productGrid");
const noResults = document.getElementById("noResults");

// Modal elements
const productModal = document.getElementById("productModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeProductModal = document.getElementById("closeProductModal");
const modalMainImage = document.getElementById("modalMainImage");
const modalThumbnails = document.getElementById("modalThumbnails");
const modalProductCategory = document.getElementById("modalProductCategory");
const modalProductName = document.getElementById("modalProductName");
const modalProductDescription = document.getElementById("modalProductDescription");
const modalProductPrice = document.getElementById("modalProductPrice");
const modalInquireButton = document.getElementById("modalInquireButton");

const BASE_CATEGORIES = [
  "Sticker",
  "Sintra",
  "Tarpaulin"
];

let allProducts = [];
let currentGalleryImages = [];

// ==========================================
// SCROLL REVEAL ANIMATIONS
// ==========================================


let revealObserver;

function setupReveal(root = document) {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        } else {
          entry.target.classList.remove("is-visible");
        }
      });
    }, {
      threshold: 0.10,
      rootMargin: "0px 0px -30px 0px"
    });
  }

  const elements = root.querySelectorAll(
    ".section-heading, .filter-area, .product-card, " +
    ".service-card, .about-image, .about-content, .contact-card"
  );

  elements.forEach(element => {
    if (element.classList.contains("reveal")) return;

    element.classList.add("reveal");

    if (
      element.classList.contains("product-card") ||
      element.classList.contains("service-card") ||
      element.classList.contains("contact-card")
    ) {
      const siblings = [...element.parentElement.children];
      const itemIndex = siblings.indexOf(element);

      element.style.setProperty(
        "--reveal-delay",
        `${(itemIndex % 4) * 100}ms`
      );
    }

    revealObserver.observe(element);
  });
}


// Animate the static landing page elements
setupReveal();

// ==========================================
// IMAGE URL
// ==========================================

function getProductImageUrl(imagePath) {
  if (!imagePath) return "";

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(imagePath);

  return data.publicUrl;
}

// ==========================================
// LOAD PRODUCTS AND GALLERY
// ==========================================

async function loadProducts() {
  productGrid.textContent = "Loading products...";

  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, category, price, image_path, published")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Product loading error:", error);

    productGrid.replaceChildren();
    noResults.hidden = false;
    noResults.textContent =
      "Unable to load products. Please try again later.";

    return;
  }

  allProducts = data || [];

  // Load additional gallery images
  if (allProducts.length > 0) {
    const productIds = allProducts.map(product => product.id);

    const { data: galleryRows, error: galleryError } = await supabase
      .from("product_images")
      .select("id, product_id, image_path, sort_order")
      .in("product_id", productIds)
      .order("sort_order", { ascending: true });

    if (galleryError) {
      console.error("Gallery loading error:", galleryError);
    }

    const galleryMap = new Map();

    (galleryRows || []).forEach(image => {
      if (!galleryMap.has(image.product_id)) {
        galleryMap.set(image.product_id, []);
      }

      galleryMap.get(image.product_id).push(image);
    });

    allProducts = allProducts.map(product => {
      const gallery = galleryMap.get(product.id) || [];

      const images = [];

      // Cover image comes first
      if (product.image_path) {
        images.push({
          path: product.image_path,
          url: getProductImageUrl(product.image_path)
        });
      }

      // Additional images follow
      gallery.forEach(image => {
        if (
          image.image_path &&
          image.image_path !== product.image_path
        ) {
          images.push({
            path: image.image_path,
            url: getProductImageUrl(image.image_path)
          });
        }
      });

      return {
        ...product,
        galleryImages: images
      };
    });
  } else {
    allProducts = [];
  }

  updateCategoryFilter();
  filterProducts();
}

// ==========================================
// DYNAMIC CATEGORY FILTER
// ==========================================

function updateCategoryFilter() {
  const existingCategories = allProducts
    .map(product => String(product.category || "").trim())
    .filter(Boolean);

  const uniqueCategories = new Map();

  [...BASE_CATEGORIES, ...existingCategories].forEach(category => {
    const normalized = category.toLowerCase();

    if (!uniqueCategories.has(normalized)) {
      uniqueCategories.set(normalized, category);
    }
  });

  const selectedValue = categoryFilter.value;

  categoryFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Categories";
  categoryFilter.appendChild(allOption);

  [...uniqueCategories.values()].forEach(category => {
    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    categoryFilter.appendChild(option);
  });

  const matchingOption = [...categoryFilter.options].find(
    option => option.value === selectedValue
  );

  categoryFilter.value = matchingOption ? selectedValue : "all";
}

// ==========================================
// CREATE PRODUCT CARD
// ==========================================

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  card.dataset.category = product.category || "";
  card.dataset.price = Number(product.price) || 0;

  // Make the product card clickable
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", "View " + product.name);

  const img = document.createElement("img");
  img.src = getProductImageUrl(product.image_path);
  img.alt = product.name;
  img.loading = "lazy";

  const info = document.createElement("div");
  info.className = "product-info";

  const category = document.createElement("span");
  category.className = "category";
  category.textContent = product.category || "Other";

  const name = document.createElement("h3");
  name.textContent = product.name;

  const description = document.createElement("p");
  description.textContent = product.description;

  const bottom = document.createElement("div");
  bottom.className = "product-bottom";

  //const price = document.createElement("strong");
  //price.textContent =
   // "From ₱" + Number(product.price).toFixed(2);

  const inquiry = document.createElement("a");
  inquiry.href = "#contact";
  inquiry.textContent = "Inquire →";

  // Prevent inquiry link from opening the modal
  inquiry.addEventListener("click", event => {
    event.stopPropagation();
  });

  //bottom.append(price, inquiry);

  info.append(category, name, description, bottom);
  card.append(img, info);

  // Open modal when card is clicked
  card.addEventListener("click", () => {
    openProductModal(product);
  });

  // Keyboard support
  card.addEventListener("keydown", event => {
    if (event.target !== card) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductModal(product);
    }
  });

  return card;
}

// ==========================================
// OPEN PRODUCT DETAILS MODAL
// ==========================================

function openProductModal(product) {
  currentGalleryImages = product.galleryImages || [];

  modalProductName.textContent = product.name;
  modalProductCategory.textContent = product.category || "Other";
  modalProductDescription.textContent = product.description || "";

 // modalProductPrice.textContent =
    //"Starting Price: ₱" + Number(product.price).toFixed(2);

  modalThumbnails.replaceChildren();

  if (currentGalleryImages.length > 0) {
    showGalleryImage(0);
  } else {
    modalMainImage.src = "";
    modalMainImage.alt = "No product image available";
  }

  productModal.hidden = false;
  document.body.style.overflow = "hidden";
}

// ==========================================
// DISPLAY SELECTED GALLERY IMAGE
// ==========================================

function showGalleryImage(index) {
  const image = currentGalleryImages[index];

  if (!image) return;

  modalMainImage.src = image.url;
  modalMainImage.alt = modalProductName.textContent;

  modalThumbnails.replaceChildren();

  currentGalleryImages.forEach((galleryImage, imageIndex) => {
    const thumbnail = document.createElement("button");
    thumbnail.type = "button";
    thumbnail.className = "modal-thumbnail-button";

    const thumbnailImage = document.createElement("img");
    thumbnailImage.src = galleryImage.url;
    thumbnailImage.alt = "View image " + (imageIndex + 1);
    thumbnailImage.className = "modal-thumbnail";

    if (imageIndex === index) {
      thumbnailImage.classList.add("active");
      thumbnail.setAttribute("aria-current", "true");
    }

    thumbnail.appendChild(thumbnailImage);

    thumbnail.addEventListener("click", () => {
      showGalleryImage(imageIndex);
    });

    modalThumbnails.appendChild(thumbnail);
  });
}

// ==========================================
// CLOSE MODAL
// ==========================================

function closeModal() {
  productModal.hidden = true;
  document.body.style.overflow = "";

  modalMainImage.src = "";
  modalThumbnails.replaceChildren();
  currentGalleryImages = [];
}

closeProductModal.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !productModal.hidden) {
    closeModal();
  }
});

// Close modal when inquiry button is clicked
modalInquireButton.addEventListener("click", () => {
  closeModal();
});

// ==========================================
// SEARCH, FILTER AND SORT
// ==========================================

function filterProducts() {
  const search = searchInput.value.toLowerCase().trim();
  const category = categoryFilter.value;
  const sort = sortFilter.value;

  let results = allProducts.filter(product => {
    const name = String(product.name || "").toLowerCase();
    const description =
      String(product.description || "").toLowerCase();

    const productCategory =
      String(product.category || "").toLowerCase();

    const matchesSearch =
      name.includes(search) ||
      description.includes(search) ||
      productCategory.includes(search);

    const matchesCategory =
      category === "all" ||
      productCategory === category.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  if (sort === "low") {
    results.sort(
      (a, b) => Number(a.price) - Number(b.price)
    );
  }

  if (sort === "high") {
    results.sort(
      (a, b) => Number(b.price) - Number(a.price)
    );
  }

  productGrid.replaceChildren();

  results.forEach(product => {
    productGrid.appendChild(createProductCard(product));
  });

  setupReveal(productGrid);
  noResults.hidden = results.length > 0;

  if (results.length === 0) {
    noResults.textContent = allProducts.length
      ? "No products found. Try another search or category."
      : "No products available yet.";
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

searchInput.addEventListener("input", filterProducts);
categoryFilter.addEventListener("change", filterProducts);
sortFilter.addEventListener("change", filterProducts);

// ==========================================
// INITIALIZE
// ==========================================

loadProducts();


/* ==========================================
   SERVICE DETAILS POPUP
========================================== */

const serviceModal = document.getElementById("serviceModal");
const serviceModalBackdrop = document.getElementById("serviceModalBackdrop");
const closeServiceModal = document.getElementById("closeServiceModal");

const serviceModalIcon = document.getElementById("serviceModalIcon");
const serviceModalTitle = document.getElementById("serviceModalTitle");
const serviceModalDescription = document.getElementById("serviceModalDescription");
const serviceModalFeatures = document.getElementById("serviceModalFeatures");

const serviceInquireButton = document.getElementById("serviceInquireButton");


/* FULL SERVICE INFORMATION */

const serviceDetails = {

    "Tarpaulin": {
        icon: "🖨️",
        description:
            "Get high-quality and customized tarpaulin printing for personal, business, and promotional needs. Our tarpaulin prints are suitable for indoor and outdoor displays, celebrations, and advertisements.",
        features: [
            "Birthday and event tarpaulins",
            "Business and promotional banners",
            "Customized layouts and designs",
            "Different sizes depending on your requirements",
            "Clear and colorful printed designs"
        ]
    },

    "Sticker": {
        icon: "🏷️",
        description:
            "Create customized stickers for your personal projects, business branding, product packaging, and promotional materials. Choose designs that represent your brand or personal style.",
        features: [
            "Customized sticker designs",
            "Business and product labels",
            "Promotional and decorative stickers",
            "Different shapes and sizes",
            "Print and cut services"
        ]
    },

    "Vinyl Glossy": {
        icon: "✨",
        description:
            "Vinyl glossy printing provides attractive and vibrant printed materials with a glossy finish. Ideal for promotional graphics, signage, labels, and other creative applications.",
        features: [
            "Glossy vinyl printing",
            "Colorful and attractive designs",
            "Customized sizes",
            "Promotional and business applications"
        ]
    },

    "Print & Cut": {
        icon: "✂️",
        description:
            "Turn your digital artwork into printed and precisely cut materials. Print and cut services are suitable for customized stickers, labels, graphics, and promotional designs.",
        features: [
            "Customized printed designs",
            "Shape-based cutting",
            "Sticker and label production",
            "Customized artwork and layouts"
        ]
    },

    "Sintra": {
        icon: "📋",
        description:
            "Sintra board printing is suitable for durable-looking displays, signs, business promotions, and customized presentation materials. Make your designs stand out with professionally prepared layouts.",
        features: [
            "Customized Sintra board prints",
            "Business and promotional signage",
            "Display and presentation materials",
            "Customized sizes and layouts"
        ]
    },

    "Board Standee": {
        icon: "🪧",
        description:
            "Make your events and promotions more noticeable with customized board standees. These are suitable for displaying messages, promotional graphics, and decorative designs.",
        features: [
            "Customized standee layouts",
            "Event and birthday standees",
            "Business promotional displays",
            "Customized graphics and designs"
        ]
    },

    "PVC ID": {
        icon: "🪪",
        description:
            "Get customized PVC identification cards for schools, organizations, employees, and businesses. These cards provide a professional identification format with personalized layouts.",
        features: [
            "School and student IDs",
            "Employee identification cards",
            "Organization IDs",
            "Customized names, photos, and layouts"
        ]
    },

    "Layout": {
        icon: "🎨",
        description:
            "Need a creative design for your printing project? Our layout service helps prepare attractive and organized designs based on your preferred style, purpose, and requirements.",
        features: [
            "Graphic layout and design",
            "Tarpaulin layouts",
            "Promotional materials",
            "Customized text and image arrangements",
            "Design preparation for printing"
        ]
    },

    "DTF/Subli": {
        icon: "👕",
        description:
            "Customize your clothing and other suitable materials with DTF and sublimation printing. Perfect for personalized designs, group apparel, and promotional products.",
        features: [
            "Customized DTF designs",
            "Sublimation printing",
            "Personalized graphics",
            "Group and organization designs",
            "Custom printing requirements"
        ]
    },

    "Banner": {
        icon: "☕",
        description:
            "Promote your business, products, or events with customized banners. We offer banner printing for different promotional and display requirements.",
        features: [
            "Customized banner designs",
            "Business and event promotions",
            "Personalized text and graphics",
            "Different sizes depending on requirements"
        ]
    },

    "ID Sling": {
        icon: "🎗️",
        description:
            "Customize your ID slings with designs suitable for schools, companies, organizations, and special events. Add your preferred colors, logos, and other design elements.",
        features: [
            "School ID slings",
            "Company and organization slings",
            "Customized colors and layouts",
            "Personalized logos and designs"
        ]
    },

    "T-Shirt Print": {
        icon: "👕",
        description:
            "Create personalized printed shirts for individuals, organizations, businesses, reunions, and special occasions. Bring your preferred artwork and turn it into a customized shirt design.",
        features: [
            "Customized shirt designs",
            "Event and reunion shirts",
            "Business and organization shirts",
            "Personalized graphics and text"
        ]
    },

    "Mug Print": {
        icon: "☕",
        description:
            "Make personalized mugs for gifts, souvenirs, celebrations, and promotional purposes. Add names, photos, messages, or creative designs to make every mug special.",
        features: [
            "Personalized mug designs",
            "Photo and name printing",
            "Customized gifts and souvenirs",
            "Promotional mug designs"
        ]
    },

    "Ref Magnet": {
        icon: "🧲",
        description:
            "Create customized refrigerator magnets for souvenirs, giveaways, celebrations, and promotional activities. Personalize them with photos, messages, and creative artwork.",
        features: [
            "Customized refrigerator magnets",
            "Photo magnets",
            "Event souvenirs",
            "Promotional giveaways"
        ]
    },

    "Bookbind": {
        icon: "📚",
        description:
            "Keep your documents organized and professionally presented through bookbinding services. Suitable for school requirements, reports, projects, and other printed materials.",
        features: [
            "School project binding",
            "Document and report binding",
            "Organized printed materials",
            "Customized binding requirements"
        ]
    },

    "Laminate": {
        icon: "📑",
        description:
            "Protect your printed documents with lamination. This service helps provide an additional protective layer against everyday handling and moisture exposure.",
        features: [
            "Document lamination",
            "Identification card lamination",
            "Printed materials protection",
            "Different document sizes"
        ]
    }

};


/* OPEN SERVICE MODAL */

function openServiceDetails(card) {

    const title = card.querySelector("h3").textContent.trim();

    const details = serviceDetails[title];

    if (!details) return;

    serviceModalIcon.textContent = details.icon;
    serviceModalTitle.textContent = title;
    serviceModalDescription.textContent = details.description;

    serviceModalFeatures.replaceChildren();

    details.features.forEach(feature => {

        const li = document.createElement("li");

        li.textContent = feature;

        serviceModalFeatures.appendChild(li);

    });

    serviceModal.hidden = false;

    document.body.style.overflow = "hidden";

    closeServiceModal.focus();
}


/* MAKE ALL SERVICE CARDS CLICKABLE */

document.querySelectorAll(".service-card").forEach(card => {

    card.setAttribute("role", "button");

    card.setAttribute("tabindex", "0");

    card.setAttribute(
        "aria-label",
        "View details for " + card.querySelector("h3").textContent
    );

    card.addEventListener("click", () => {

        openServiceDetails(card);

    });

    card.addEventListener("keydown", event => {

        if (event.key === "Enter" || event.key === " ") {

            event.preventDefault();

            openServiceDetails(card);

        }

    });

});


/* CLOSE SERVICE MODAL */

function closeServiceDetails() {

    serviceModal.hidden = true;

    document.body.style.overflow = "";

}

closeServiceModal.addEventListener("click", closeServiceDetails);

serviceModalBackdrop.addEventListener("click", closeServiceDetails);

serviceInquireButton.addEventListener("click", closeServiceDetails);


/* ==========================================
   ABOUT LOGO FULL IMAGE VIEWER
========================================== */

const logoViewer = document.getElementById("imageViewer");

const openLogoViewer = document.getElementById("openLogoViewer");

const closeLogoViewer = document.getElementById("closeImageViewer");

const logoViewerBackdrop = document.getElementById("imageViewerBackdrop");


/* OPEN IMAGE */

openLogoViewer.addEventListener("click", () => {

    logoViewer.hidden = false;

    document.body.style.overflow = "hidden";

    closeLogoViewer.focus();

});


/* CLOSE IMAGE */

function closeFullLogoViewer() {

    logoViewer.hidden = true;

    document.body.style.overflow = "";

}

closeLogoViewer.addEventListener("click", closeFullLogoViewer);

logoViewerBackdrop.addEventListener("click", closeFullLogoViewer);


/* ESCAPE KEY FOR BOTH NEW MODALS */

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        if (!serviceModal.hidden) {
            closeServiceDetails();
        }

        if (!logoViewer.hidden) {
            closeFullLogoViewer();
        }

    }

});

