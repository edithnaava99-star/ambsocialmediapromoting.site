let products = [];
let cart = [];

async function loadProducts() {
  const res = await fetch("/api/products");
  products = await res.json();
  renderProducts();
}

function renderProducts() {
  const productsContainer = document.getElementById("products");

  productsContainer.innerHTML = products.map(product => `
    <div class="product-card">
      <img src="${product.image}" alt="${product.name}" />
      <div class="product-content">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-footer">
          <strong>$${product.price}</strong>
          <button onclick="addToCart(${product.id})">Add to cart</button>
        </div>
      </div>
    </div>
  `).join("");
}

function addToCart(productId) {
  const product = products.find(item => item.id === productId);
  if (!product) return;

  cart.push(product);
  updateCart();
}

function updateCart() {
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  cartCount.textContent = cart.length;

  if (cart.length === 0) {
    cartItems.innerHTML = "<p>Your cart is empty.</p>";
    return;
  }

  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <span>${item.name}</span>
      <strong>$${item.price}</strong>
    </div>
  `).join("");
}

document.getElementById("cartButton").addEventListener("click", () => {
  document.getElementById("cartPanel").classList.toggle("hidden");
});

document.getElementById("checkoutBtn").addEventListener("click", async () => {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ cart })
  });

  const result = await res.json();
  alert(result.message);
  cart = [];
  updateCart();
});

loadProducts();
