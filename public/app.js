let products = [];
let cart = [];

async function loadProducts() {
  try {
    const res = await fetch('/api/packages');
    const data = await res.json();
    products = Array.isArray(data) ? data : (data.packages || []);
    renderProducts();
  } catch (error) {
    console.error('Failed to load packages:', error);
    document.getElementById('products').innerHTML = '<p class="error">Could not load service packages right now.</p>';
  }
}

function renderProducts() {
  const container = document.getElementById('products');
  if (!products.length) {
    container.innerHTML = '<p class="empty-state">No packages available yet.</p>';
    return;
  }

  container.innerHTML = products.map((product) => `
    <article class="product-card">
      <div>
        <span class="pill">Popular</span>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
      </div>
      <div class="product-price">
        <strong>${product.currency || 'USD'} ${Number(product.price).toFixed(2)}</strong>
        <span>service</span>
      </div>
      <div class="product-actions">
        <button class="button secondary" type="button" onclick="addToCart('${product.id}')">Add to cart</button>
      </div>
    </article>
  `).join('');
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: Number(product.price), currency: product.currency || 'USD', qty: 1 });
  }

  updateCart();
  toggleCart(true);
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);
  updateCart();
}

function updateCart() {
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);

  document.getElementById('cartCount').textContent = count;
  const itemsEl = document.getElementById('cartItems');

  if (!cart.length) {
    itemsEl.innerHTML = '<p>Your cart is empty.</p>';
    document.getElementById('cartTotal').textContent = '$0.00';
    return;
  }

  itemsEl.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <div>
        <strong>${item.name}</strong><br>
        <span>Qty: ${item.qty}</span>
      </div>
      <div>
        <strong>${item.currency || 'USD'} ${(item.price * item.qty).toFixed(2)}</strong><br>
        <button class="remove-btn" type="button" onclick="removeFromCart('${item.id}')">Remove</button>
      </div>
    </div>
  `).join('');

  document.getElementById('cartTotal').textContent = `${cart[0].currency || 'USD'} ${total.toFixed(2)}`;
}

function toggleCart(show) {
  const cartPanel = document.getElementById('cartPanel');
  const shouldShow = typeof show === 'boolean' ? show : !cartPanel.classList.contains('hidden');
  cartPanel.classList.toggle('hidden', !shouldShow);
}

document.getElementById('cartToggle').addEventListener('click', () => toggleCart());
document.getElementById('closeCart').addEventListener('click', () => toggleCart(false));

document.getElementById('checkoutBtn').addEventListener('click', async () => {
  if (!cart.length) {
    alert('Your cart is empty.');
    return;
  }

  const customerName = document.getElementById('customerName').value.trim();
  const customerEmail = document.getElementById('customerEmail').value.trim();
  const customerPhone = document.getElementById('customerPhone').value.trim();
  const targetUrl = document.getElementById('targetUrl').value.trim();
  const notes = document.getElementById('orderNotes').value.trim();

  if (!customerName || !customerEmail || !targetUrl) {
    alert('Please fill in your name, email and profile link.');
    return;
  }

  const payload = {
    cart,
    customerName,
    customerEmail,
    customerPhone,
    targetUrl,
    notes
  };

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Checkout failed');
    }

    if (result.paymentUrl) {
      window.location.href = result.paymentUrl;
    } else {
      alert('Your order was created. We will contact you on WhatsApp.');
    }
  } catch (error) {
    alert(error.message || 'Unable to create order.');
  }
});

document.getElementById('orderForm').addEventListener('submit', (event) => {
  event.preventDefault();
  document.getElementById('checkoutBtn').click();
});

loadProducts();
updateCart();

