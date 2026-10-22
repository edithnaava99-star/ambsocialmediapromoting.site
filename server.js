const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'amb-admin-token';
const APP_URL = (process.env.APP_URL || process.env.SITE_URL || 'https://ambsocialmediapromoting.site').replace(/\/$/, '');
const WHATSAPP_NUMBER = '256775460880';

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
const packagesFile = path.join(dataDir, 'packages.json');
const ordersFile = path.join(dataDir, 'orders.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function defaultPackages() {
  return [
    { id: 'instagram-followers-1k', name: 'Instagram Followers 1k', description: '1,000 Instagram followers', price: 60, currency: 'USD' },
    { id: 'instagram-likes-1k', name: 'Instagram Likes 1k', description: '1,000 Instagram likes', price: 35, currency: 'USD' },
    { id: 'instagram-views-10k', name: 'Instagram Views 10k', description: '10,000 Instagram views', price: 25, currency: 'USD' },
    { id: 'tiktok-likes-1k', name: 'TikTok Likes 1k', description: '1,000 TikTok likes', price: 25, currency: 'USD' },
    { id: 'tiktok-views-10k', name: 'TikTok Views 10k', description: '10,000 TikTok views', price: 30, currency: 'USD' },
    { id: 'facebook-followers-1k', name: 'Facebook Followers 1k', description: '1,000 Facebook followers', price: 45, currency: 'USD' },
    { id: 'facebook-video-views-10k', name: 'Facebook Video Views 10k', description: '10,000 Facebook video views', price: 35, currency: 'USD' },
    { id: 'youtube-subscribers-1k', name: 'YouTube Subscribers 1k', description: '1,000 YouTube subscribers', price: 70, currency: 'USD' },
    { id: 'youtube-views-10k', name: 'YouTube Views 10k', description: '10,000 YouTube views', price: 40, currency: 'USD' },
    { id: 'music-promotion', name: 'Music Promotion', description: 'Song promotion and viral music reach support', price: 50, currency: 'USD' },
    { id: 'business-ad-boost', name: 'Business Ad Boost', description: 'Business promotion and ad visibility boost', price: 100, currency: 'USD' },
    { id: 'livestream-views-10k', name: 'Livestream Views 10k', description: '10,000 livestream views', price: 35, currency: 'USD' }
  ];
}

function loadPackages() {
  ensureDataDir();
  const packages = readJson(packagesFile, defaultPackages());
  writeJson(packagesFile, packages);
  return packages;
}

function loadOrders() {
  ensureDataDir();
  const orders = readJson(ordersFile, []);
  writeJson(ordersFile, orders);
  return orders;
}

function saveOrders(orders) {
  ensureDataDir();
  writeJson(ordersFile, orders);
}

function getTotalFromCart(cartItems) {
  const packages = loadPackages();
  return cartItems.reduce((sum, item) => {
    const product = packages.find((p) => p.id === item.id);
    if (!product) return sum;
    return sum + Number(product.price) * (Number(item.qty) || 1);
  }, 0);
}

function authAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Invalid admin token.' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'AMB Social Media Promoting' });
});

app.get('/api/packages', (req, res) => {
  res.json({ packages: loadPackages() });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  res.json({ ok: true, token: ADMIN_TOKEN });
});

app.get('/api/admin/packages', authAdmin, (req, res) => {
  res.json({ packages: loadPackages() });
});

app.post('/api/admin/packages', authAdmin, (req, res) => {
  const { name, description, price, currency, id } = req.body || {};
  if (!name || !description || !price || !id) {
    return res.status(400).json({ error: 'name, description, price and id are required.' });
  }

  const packages = loadPackages();
  if (packages.some((p) => p.id === id)) {
    return res.status(400).json({ error: 'A product with this id already exists.' });
  }

  const item = {
    id,
    name,
    description,
    price: Number(price),
    currency: (currency || 'USD').toUpperCase()
  };

  packages.push(item);
  writeJson(packagesFile, packages);
  res.json({ ok: true, package: item });
});

app.put('/api/admin/packages/:id', authAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, price, currency } = req.body || {};
  const packages = loadPackages();
  const item = packages.find((p) => p.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Package not found.' });
  }

  if (name) item.name = name;
  if (description) item.description = description;
  if (price !== undefined) item.price = Number(price);
  if (currency) item.currency = currency.toUpperCase();

  writeJson(packagesFile, packages);
  res.json({ ok: true, package: item });
});

app.delete('/api/admin/packages/:id', authAdmin, (req, res) => {
  const { id } = req.params;
  const packages = loadPackages();
  const filtered = packages.filter((p) => p.id !== id);
  if (filtered.length === packages.length) {
    return res.status(404).json({ error: 'Package not found.' });
  }

  writeJson(packagesFile, filtered);
  res.json({ ok: true, deletedId: id });
});

app.get('/api/admin/orders', authAdmin, (req, res) => {
  const orders = loadOrders();
  res.json({ orders });
});

app.get('/api/admin/stats', authAdmin, (req, res) => {
  const orders = loadOrders();
  const packages = loadPackages();
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  res.json({
    totalOrders: orders.length,
    totalRevenue,
    totalPackages: packages.length,
    pending: orders.filter((o) => o.status !== 'paid').length
  });
});

app.post('/api/checkout', async (req, res) => {
  try {
    const { cart, customerName, customerEmail, customerPhone, targetUrl, notes } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }

    if (!customerName || !customerEmail) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const packages = loadPackages();
    const total = cart.reduce((sum, item) => {
      const selected = packages.find((p) => p.id === item.id);
      if (!selected) return sum;
      return sum + Number(selected.price) * (Number(item.qty) || 1);
    }, 0);

    if (total <= 0) {
      return res.status(400).json({ error: 'Total must be greater than zero.' });
    }

    const txRef = `AMB_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const order = {
      id: crypto.randomUUID(),
      tx_ref: txRef,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail).trim(),
      customerPhone: customerPhone ? String(customerPhone).trim() : '',
      targetUrl: targetUrl ? String(targetUrl).trim() : '',
      notes: notes ? String(notes).trim() : '',
      items: cart,
      total: Number(total),
      currency: 'USD',
      status: 'initiated',
      createdAt: new Date().toISOString(),
      paymentUrl: ''
    };

    const existing = loadOrders();
    existing.unshift(order);
    saveOrders(existing);

    const flutterwaveKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (flutterwaveKey) {
      try {
        const response = await fetch('https://api.flutterwave.com/v3/payments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${flutterwaveKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tx_ref: txRef,
            amount: Number(total).toFixed(2),
            currency: 'USD',
            redirect_url: `${APP_URL}/payment/callback`,
            payment_options: 'card',
            customer: {
              email: order.customerEmail,
              phonenumber: order.customerPhone || '0000000000',
              name: order.customerName
            },
            customizations: {
              title: 'AMB Social Media Promoting',
              description: 'Social media growth services'
            }
          })
        });

        const data = await response.json();
        if (response.ok && data?.data?.link) {
          const updated = loadOrders();
          const idx = updated.findIndex((entry) => entry.tx_ref === txRef);
          if (idx >= 0) {
            updated[idx].paymentUrl = data.data.link;
            saveOrders(updated);
          }
          return res.json({ ok: true, paymentUrl: data.data.link, tx_ref: txRef, orderId: order.id });
        }
      } catch (paymentError) {
        console.error('Flutterwave checkout failed:', paymentError.message);
      }
    }

    const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      `Hello AMB Social Media Promoting, I want to order: ${cart.map((p) => `${p.name} x${p.qty}`).join(', ')}. Total: $${Number(total).toFixed(2)}.`
    )}`;

    const updated = loadOrders();
    const idx = updated.findIndex((entry) => entry.tx_ref === txRef);
    if (idx >= 0) {
      updated[idx].paymentUrl = whatsappLink;
      updated[idx].status = 'pending-whatsapp';
      saveOrders(updated);
    }

    return res.json({ ok: true, paymentUrl: whatsappLink, tx_ref: txRef, orderId: order.id, fallback: true });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return res.status(500).json({ error: 'Unable to create your order right now.' });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  try {
    const { tx_ref, transactionId } = req.body || {};
    if (!tx_ref && !transactionId) {
      return res.status(400).json({ error: 'tx_ref or transactionId required.' });
    }
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return res.status(400).json({ error: 'Flutterwave secret key is not configured.' });
    }

    const endpoint = transactionId
      ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_tx_ref?tx_ref=${encodeURIComponent(tx_ref)}`;

    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });

    const data = await response.json();
    if (!response.ok || !data?.data) {
      return res.status(400).json({ error: data?.message || 'Payment verification failed.' });
    }

    const orders = loadOrders();
    const order = orders.find((entry) => entry.tx_ref === (data.data.tx_ref || tx_ref));
    if (order) {
      order.status = data.data.status === 'successful' ? 'paid' : 'pending';
      order.flutterwave = data.data;
      saveOrders(orders);
    }

    return res.json({ ok: true, data: data.data });
  } catch (error) {
    console.error('Verify payment failed:', error.message);
    return res.status(500).json({ error: 'Could not verify payment.' });
  }
});

app.get('/payment/callback', (req, res) => {
  const status = req.query.status || 'pending';
  const txRef = req.query.tx_ref || '';
  const paymentStatus = status === 'successful' ? 'Payment successful' : 'Payment is still being processed';
  res.sendFile(path.join(__dirname, 'public', 'payment-callback.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`AMB Social Media Promoting server listening on port ${PORT}`);
});

module.exports = app;

