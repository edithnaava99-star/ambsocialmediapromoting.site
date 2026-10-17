let products = [];
let cart = [];

async function loadProducts() {
  const res = await fetch("/api/packages");
  const data = await res.json();
  products = Array.isArray(data) ? data : (data.packages || data);
  renderProducts();
}

function renderProducts() {
  const productsContainer = document.getElementById("products");

  productsContainer.innerHTML = products.map(product => `
    <div class="product-card">
      <div class="product-content">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-footer">
          <strong>${product.currency || '$'}${product.price}</strong>
          <button onclick="addToCart('${product.id}')">Add to cart</button>
        </div>
      </div>
    </div>
  `).join("");
}

function addToCart(productId) {
  const product = products.find(item => item.id === productId);
  if (!product) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) existing.qty += 1;
  else cart.push({ id: product.id, name: product.name, price: product.price, currency: product.currency, qty: 1 });
  updateCart();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  updateCart();
}

function updateCart() {
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
  cartCount.textContent = cart.reduce((s, i) => s + i.qty, 0);

  if (cart.length === 0) {
    cartItems.innerHTML = "<p>Your cart is empty.</p>";
    return;
  }

  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <span>${item.name} × ${item.qty}</span>
      <strong>${item.currency || '$'}${item.price * item.qty}</strong>
      <button onclick="removeFromCart('${item.id}')">Remove</button>
    </div>
  `).join("") + `<div class="cart-total"><strong>Total: ${cart[0].currency || '$'}${total}</strong></div>`;
}

document.getElementById("cartButton").addEventListener("click", () => {
  document.getElementById("cartPanel").classList.toggle("hidden");
});

document.getElementById("checkoutBtn").addEventListener("click", async () => {
  if (cart.length === 0) { alert('Cart is empty'); return; }
  const customerName = prompt('Your name');
  const customerEmail = prompt('Your email');
  if (!customerName || !customerEmail) { alert('Name and email are required'); return; }

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cart, customerName, customerEmail })
  });

  const result = await res.json();
  if (res.ok && result.paymentUrl) {
    window.location.href = result.paymentUrl;
  } else {
    alert(result.error || result.message || 'Checkout failed');
  }
});

loadProducts();
