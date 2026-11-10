
import { supabase } from "../supabaseClient.js";

const $ = id => document.getElementById(id);

let currentSession = null;
let currentProfile = null;
let productsCache = [];
let selectedImageFiles = [];
let previewObjectUrls = [];
let existingGalleryImages = [];

const BASE_CATEGORIES = [
  "Sticker",
  "Sintra",
  "Tarpaulin"
];

const OTHER_CATEGORY_VALUE = "__other__";

function updateOtherCategoryField() {
  const isOther =
    $("productCategory").value === OTHER_CATEGORY_VALUE;

  $("otherCategoryField").hidden = !isOther;
  $("otherCategory").required = isOther;

  if (!isOther) {
    $("otherCategory").value = "";
  }
}

// ==========================================
// DYNAMIC ADMIN CATEGORY OPTIONS
// ==========================================

function updateProductCategoryOptions() {
  const select = $("productCategory");
  const selectedValue = select.value;

  const categories = [
    ...BASE_CATEGORIES,
    ...productsCache.map(product =>
      String(product.category || "").trim()
    )
  ];

  const uniqueCategories = new Map();

  categories.forEach(category => {
    if (!category) return;

    const normalized = category.toLowerCase();

    if (!uniqueCategories.has(normalized)) {
      uniqueCategories.set(normalized, category);
    }
  });

  select.replaceChildren();

  // Add existing categories
  uniqueCategories.forEach(category => {
    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    select.appendChild(option);
  });

  // Keep Other option at the bottom
  const otherOption = document.createElement("option");
  otherOption.value = OTHER_CATEGORY_VALUE;
  otherOption.textContent = "Other";

  select.appendChild(otherOption);

  // Restore previous selection
  const matchingOption = [...select.options].find(
    option => option.value === selectedValue
  );

  select.value = matchingOption
    ? selectedValue
    : BASE_CATEGORIES[0];
}

$("productCategory").addEventListener(
  "change",
  updateOtherCategoryField
);

// ==========================================
// AUTHENTICATION
// ==========================================

async function showDashboard() {
  try {
    const { data: { session }, error } =
      await supabase.auth.getSession();

    if (error) throw error;

    currentSession = session;

    if (!session) {
      currentProfile = null;
      $("loginPage").hidden = false;
      $("dashboardPage").hidden = true;
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, username, role")
        .eq("id", session.user.id)
        .single();

    if (profileError) {
  console.error("Profile verification failed:", profileError);

  $("loginError").textContent =
    "Unable to verify administrator profile: " +
    profileError.message;

  return;
}

if (!profile || profile.role !== "admin") {
  console.error("Unauthorized profile:", profile);

  await supabase.auth.signOut();

  currentSession = null;
  currentProfile = null;

  $("loginPage").hidden = false;
  $("dashboardPage").hidden = true;

  $("loginError").textContent =
    "This account does not have administrator privileges.";

  return;
}

    currentProfile = profile;

    $("loginPage").hidden = true;
    $("dashboardPage").hidden = false;
    $("welcomeAdmin").textContent =
      "Hello, " + profile.username;

    await renderDashboard();

  } catch (error) {
    console.error("Dashboard error:", error);

    $("loginPage").hidden = false;
    $("dashboardPage").hidden = true;
    $("loginError").textContent = error.message;
  }
}


// LOGIN

$("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const email = $("username").value.trim();
  const password = $("password").value;

  $("loginError").textContent = "";

  const button = $("loginForm").querySelector('button[type="submit"]');

  button.disabled = true;
  button.textContent = "Logging in...";

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    $("loginForm").reset();

    await showDashboard();

  } catch (error) {
    console.error("Login error:", error);
    $("loginError").textContent = error.message;

  } finally {
  button.disabled = false;
  button.textContent =
    $("editProductId").value ? "Save Changes" : "Add Product";
}
});


// LOGOUT

$("logoutBtn").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Logout failed: " + error.message);
    return;
  }

  currentSession = null;
  currentProfile = null;

  await showDashboard();
});


// ==========================================
// MULTIPLE PRODUCT IMAGE PREVIEW
// ==========================================

function clearImagePreview() {
  previewObjectUrls.forEach(url => {
    URL.revokeObjectURL(url);
  });

  previewObjectUrls = [];

  $("imagePreviewContainer").replaceChildren();

  $("imagePreview").src = "";
  $("imagePreview").hidden = true;
}

function renderImagePreviews() {
  const container = $("imagePreviewContainer");

  container.replaceChildren();

  // Display existing gallery images when editing.
  existingGalleryImages.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "image-preview-item";

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = "Existing product image";

    const label = document.createElement("span");
    label.textContent = index === 0 ? "Existing Cover" : "Existing";

    item.append(img, label);
    container.appendChild(item);
  });

  // Display newly selected images.
  selectedImageFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "image-preview-item";

    const img = document.createElement("img");

    const url = URL.createObjectURL(file);
    previewObjectUrls.push(url);

    img.src = url;
    img.alt = file.name;

    const label = document.createElement("span");
    label.textContent =
      existingGalleryImages.length === 0 &&
      index === 0
        ? "New Cover"
        : "New Image";

    item.append(img, label);
    container.appendChild(item);
  });
}

$("productImage").addEventListener("change", function() {
  const files = Array.from(this.files);

  if (!files.length) return;

  const validFiles = files.filter(file => {
    if (!file.type.startsWith("image/")) {
      alert(file.name + " is not a valid image.");
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(file.name + " exceeds the 5 MB limit.");
      return false;
    }

    return true;
  });

  selectedImageFiles = [
    ...selectedImageFiles,
    ...validFiles
  ];

  // Reset input so the same file can be selected again.
  this.value = "";

  renderImagePreviews();
});

// ==========================================
// IMAGE STORAGE
// ==========================================

async function uploadProductImage(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  const filePath =
    currentSession.user.id + "/" +
    crypto.randomUUID() + "." + extension;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  return filePath;
}



async function deleteProductImages(paths) {
  const validPaths = paths.filter(Boolean);

  if (!validPaths.length) return;

  const { error } = await supabase.storage
    .from("product-images")
    .remove(validPaths);

  if (error) {
    console.error("Multiple image deletion error:", error);
  }
}





function getProductImageUrl(filePath) {
  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}



// ==========================================
// ADD AND EDIT PRODUCTS WITH MULTIPLE IMAGES
// ==========================================

$("productForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  if (!currentSession) {
    $("productMessage").textContent =
      "Your session has expired. Please log in again.";
    return;
  }

  const name = $("productName").value.trim();
  const description = $("productDescription").value.trim();
  const price = Number($("productPrice").value);
  const selectedCategory = $("productCategory").value;

  const category =
    selectedCategory === OTHER_CATEGORY_VALUE
      ? $("otherCategory").value.trim()
      : selectedCategory;

  const editId = $("editProductId").value;
  const button = $("saveProductBtn");

  if (
    !name ||
    !description ||
    !category ||
    category.length > 50 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    $("productMessage").textContent =
      "Please enter valid product details and category.";
    return;
  }

  const existing = productsCache.find(p => p.id === editId);

  if (!editId && selectedImageFiles.length === 0) {
    $("productMessage").textContent =
      "Please upload at least one product image.";
    return;
  }

  button.disabled = true;
  button.textContent = "Saving...";

  const uploadedPaths = [];

  try {
    let imagePath = existing?.image_path || "";

    // Upload images.
    for (let i = 0; i < selectedImageFiles.length; i++) {
      const path = await uploadProductImage(selectedImageFiles[i]);
      uploadedPaths.push(path);

      // First image is the cover for a new product.
      if (!editId && i === 0) {
        imagePath = path;
      }
    }

    const productData = {
      name,
      description,
      category,
      price,
      image_path: imagePath
    };

    let productId = editId;

    if (editId) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editId);

      if (error) throw error;

    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({
          ...productData,
          published: true,
          created_by: currentSession.user.id
        })
        .select("id")
        .single();

      if (error) throw error;

      productId = data.id;
    }

    // Additional images become gallery images.
    // For a new product, the first image is already the cover.
    const galleryPaths = editId
      ? uploadedPaths
      : uploadedPaths.slice(1);

    if (galleryPaths.length > 0) {
      const galleryRecords = galleryPaths.map((path, index) => ({
        product_id: productId,
        image_path: path,
        sort_order: index
      }));

      const { error } = await supabase
        .from("product_images")
        .insert(galleryRecords);

      if (error) throw error;
    }

    $("productMessage").textContent = editId
      ? "Product and gallery updated successfully!"
      : "Product and gallery added successfully!";

    resetProductForm();

    await renderProducts();

  } catch (error) {
    console.error("Product save error:", error);

    // Clean up newly uploaded files if saving failed.
    if (uploadedPaths.length > 0) {
      await deleteProductImages(uploadedPaths);
    }

    $("productMessage").textContent =
      "Failed to save product: " + error.message;

  } finally {
    button.disabled = false;
    button.textContent = $("editProductId").value
      ? "Save Changes"
      : "Add Product";
  }
});


// RESET PRODUCT FORM

function resetProductForm() {
  $("productForm").reset();

  $("editProductId").value = "";
  $("saveProductBtn").textContent = "Add Product";
  $("cancelEditBtn").hidden = true;

  selectedImageFiles = [];
  existingGalleryImages = [];

  clearImagePreview();

  updateOtherCategoryField();
}

$("cancelEditBtn").addEventListener("click", resetProductForm);


// ==========================================
// DISPLAY PRODUCTS FROM SUPABASE
// ==========================================

async function renderProducts() {
  const container = $("adminProductList");

  container.replaceChildren();

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load products error:", error);

    $("totalProducts").textContent = "—";
    container.textContent =
      "Unable to load products: " + error.message;

    return;
  }

  productsCache = products || [];

// Automatically update admin category dropdown
updateProductCategoryOptions();

$("totalProducts").textContent = productsCache.length;

  if (!productsCache.length) {
    container.textContent = "No products added yet.";
    return;
  }

  productsCache.forEach(product => {
    const card = document.createElement("div");
    card.className = "admin-product";

    const img = document.createElement("img");
    img.src = getProductImageUrl(product.image_path);
    img.alt = product.name;

    const info = document.createElement("div");
    info.className = "admin-product-info";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const price = document.createElement("p");
    price.textContent = "₱" + Number(product.price).toFixed(2);

    const description = document.createElement("p");
    description.textContent = product.description;

    const actions = document.createElement("div");
    actions.className = "admin-product-actions";

    const edit = document.createElement("button");
    edit.className = "edit-btn";
    edit.textContent = "Edit";

    edit.addEventListener("click", () => {
      editProduct(product.id);
    });

    const remove = document.createElement("button");
    remove.className = "delete-btn";
    remove.textContent = "Delete";

    remove.addEventListener("click", () => {
      deleteProduct(product.id);
    });

    actions.append(edit, remove);
    info.append(title, price, description, actions);
    card.append(img, info);

    container.appendChild(card);
  });
}


// ==========================================
// EDIT PRODUCT
// ==========================================


async function editProduct(id) {
  const product = productsCache.find(p => p.id === id);

  if (!product) return;

  try {
    const { data: gallery, error } = await supabase
      .from("product_images")
      .select("id, image_path, sort_order")
      .eq("product_id", id)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    existingGalleryImages = (gallery || []).map(image => ({
      ...image,
      url: getProductImageUrl(image.image_path)
    }));

    selectedImageFiles = [];

    $("editProductId").value = product.id;
    $("productName").value = product.name;
    $("productDescription").value = product.description;
    $("productPrice").value = product.price;

    const matchingCategory = [...$("productCategory").options].find(
  option =>
    option.value !== OTHER_CATEGORY_VALUE &&
    option.value.toLowerCase() ===
    String(product.category).toLowerCase()
);

if (matchingCategory) {
  $("productCategory").value = matchingCategory.value;
  $("otherCategory").value = "";
} else {
  $("productCategory").value = OTHER_CATEGORY_VALUE;
  $("otherCategory").value = product.category;
}

    updateOtherCategoryField();

    $("productImage").value = "";

    clearImagePreview();
    renderImagePreviews();

    $("imagePreview").src =
      getProductImageUrl(product.image_path);

    $("imagePreview").hidden = false;

    $("saveProductBtn").textContent = "Save Changes";
    $("cancelEditBtn").hidden = false;

    $("productForm").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    console.error("Load product gallery error:", error);
    alert("Unable to load product images: " + error.message);
  }
}



// ==========================================
// DELETE PRODUCT
// ==========================================


async function deleteProduct(id) {
  const product = productsCache.find(p => p.id === id);

  if (!product) return;

  if (!confirm("Are you sure you want to delete this product and all its images?")) {
    return;
  }

  try {
    const { data: gallery, error: galleryError } = await supabase
      .from("product_images")
      .select("image_path")
      .eq("product_id", id);

    if (galleryError) throw galleryError;

    const imagePaths = [
      product.image_path,
      ...(gallery || []).map(image => image.image_path)
    ].filter(Boolean);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await deleteProductImages(imagePaths);

    $("productMessage").textContent =
      "Product and its images deleted successfully!";

    await renderProducts();

  } catch (error) {
    console.error("Delete product error:", error);

    $("productMessage").textContent =
      "Failed to delete product: " + error.message;
  }
}



// ==========================================
// CREATE ADMIN ACCOUNT THROUGH EDGE FUNCTION
// ==========================================

$("adminForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const username = $("newAdminUsername").value.trim();
  const email = $("newAdminEmail").value.trim();
  const password = $("newAdminPassword").value;

  const message = $("adminMessage");
  const button = $("createAdminBtn");

  message.textContent = "";

  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    message.textContent =
      "Username must be 3-30 characters (letters, numbers, _ or -).";
    return;
  }

  if (password.length < 8) {
    message.textContent =
      "Password must contain at least 8 characters.";
    return;
  }

  if (!currentSession) {
    message.textContent =
      "Your session has expired. Please log in again.";
    return;
  }

  button.disabled = true;
  button.textContent = "Creating Account...";

  try {
    const { data, error } = await supabase.functions.invoke(
      "create-admin",
      {
        body: {
          username,
          email,
          password
        }
      }
    );

    if (error) {
      let errorMessage = error.message;

      if (error.context) {
        try {
          const response = await error.context.json();

          if (response.error) {
            errorMessage = response.error;
          }
        } catch {}
      }

      throw new Error(errorMessage);
    }

    if (!data || data.success !== true) {
      throw new Error(
        data?.error || "Admin account creation was not confirmed."
      );
    }

    $("adminForm").reset();

    message.textContent =
      "Admin account created successfully!";

    await renderAdmins();

  } catch (error) {
    console.error("Admin creation error:", error);

    message.textContent =
      "Failed to create admin: " + error.message;

  } finally {
    button.disabled = false;
    button.textContent = "Create Admin Account";
  }
});


// ==========================================
// DISPLAY ADMIN ACCOUNTS FROM SUPABASE
// ==========================================

async function renderAdmins() {
  const container = $("adminList");

  container.replaceChildren();

  const { data: admins, error } = await supabase
    .from("profiles")
    .select("id, username, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Load admins error:", error);

    $("totalAdmins").textContent = "—";

    container.textContent =
      "Unable to load admin accounts: " + error.message;

    return;
  }

  $("totalAdmins").textContent = admins.length;

  if (!admins.length) {
    container.textContent = "No administrator accounts found.";
    return;
  }

  admins.forEach(admin => {
    const row = document.createElement("div");
    row.className = "admin-user";

    const name = document.createElement("strong");
    name.textContent = admin.username;

    const role = document.createElement("span");
    role.textContent = admin.role;

    row.append(name, role);
    container.appendChild(row);
  });
}


// ==========================================
// REFRESH DASHBOARD
// ==========================================

async function renderDashboard() {
  await Promise.all([
    renderProducts(),
    renderAdmins()
  ]);
}


// ==========================================
// INITIALIZE
// ==========================================

showDashboard();
