const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'amb-admin-token';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
    console.error(`Failed to read JSON from ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function defaultPackages() {
  return [
    { id: 'instagram-1k-followers', name: 'Instagram 1k Followers', description: '1,000 Instagram followers', price: 50, currency: 'USD' },
    { id: 'youtube-watch-hours', name: 'YouTube 1k Watch Hours', description: '1,000 watch hours for YouTube growth', price: 200, currency: 'USD' },
    { id: 'youtube-subscribers', name: 'YouTube 1k Subscribers', description: '1,000 YouTube subscribers', price: 150, currency: 'USD' },
    { id: 'youtube-views-likes', name: 'YouTube 1k Views & Likes', description: '1,000 views and likes for a video', price: 30, currency: 'USD' },
    { id: 'facebook-followers', name: 'Facebook 1k Followers', description: '1,000 Facebook followers', price: 150, currency: 'USD' },
    { id: 'tiktok-likes-views', name: 'TikTok 1k Likes / 5k Views', description: '1,000 likes and 5,000 views', price: 50, currency: 'USD' }
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

function savePackages(packages) {
  ensureDataDir();
  writeJson(packagesFile, packages);
}

function getTotalFromCart(cartItems) {
  const packages = loadPackages();
  return cartItems.reduce((sum, item) => {
    const product = packages.find((p) => p.id === item.id);
    if (!product) {
      return sum;
    }
    return sum + product.price * (item.qty || 1);
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
  res.json({ ok: true });
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
  const exists = packages.some((p) => p.id === id);
  if (exists) {
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
  savePackages(packages);
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

  savePackages(packages);
  res.json({ ok: true, package: item });
});

app.delete('/api/admin/packages/:id', authAdmin, (req, res) => {
  const { id } = req.params;
  const packages = loadPackages();
  const filtered = packages.filter((p) => p.id !== id);
  if (filtered.length === packages.length) {
    return res.status(404).json({ error: 'Package not found.' });
  }

  savePackages(filtered);
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
    const { cart, customerName, customerEmail, currency } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }
    if (!customerName || !customerEmail) {
      return res.status(400).json({ error: 'Customer name and email are required.' });
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

    const tx_ref = `amb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const amount = Number(total).toFixed(2);
    const useCurrency = (currency || 'USD').toUpperCase();

    const paymentData = {
      tx_ref,
      amount,
      currency: useCurrency,
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
      payment_options: 'card',
      customer: {
        email: customerEmail,
        phonenumber: '0000000000',
        name: customerName
      },
      customizations: {
        title: 'AMB Promotion Payment',
        description: `Order for ${customerName}`
      }
    };

    const existingOrders = loadOrders();
    const newOrder = {
      tx_ref,
      customerName,
      customerEmail,
      items: cart,
      total: Number(amount),
      currency: useCurrency,
      status: 'initiated',
      createdAt: new Date().toISOString()
    };

    existingOrders.push(newOrder);
    saveOrders(existingOrders);

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: 'Flutterwave secret key is not configured.' });
    }

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Flutterwave init error:', result);
      return res.status(400).json({ error: result.message || 'Checkout initiation failed', detail: result });
    }

    const paymentUrl = (result && result.data && (result.data.link || result.data.checkout_url || result.data.url)) || null;

    const orders = loadOrders();
    const index = orders.findIndex((order) => order.tx_ref === tx_ref);
    if (index >= 0) {
      orders[index].paymentUrl = paymentUrl;
      saveOrders(orders);
    }

    return res.json({ ok: true, paymentUrl, tx_ref });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Server error while creating payment.' });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  try {
    const { transactionId, tx_ref } = req.body || {};
    if (!transactionId && !tx_ref) {
      return res.status(400).json({ error: 'transactionId or tx_ref are required.' });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: 'Flutterwave secret key is not configured.' });
    }

    const endpoint = transactionId
      ? `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_tx_ref?tx_ref=${encodeURIComponent(tx_ref)}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    });

    const result = await response.json();
    if (!response.ok) {
      return res.status(400).json({ error: result.message || 'Verification failed', detail: result });
    }

    const orders = loadOrders();
    const actualTxRef = (result && result.data && result.data.tx_ref) || tx_ref;
    const orderIndex = orders.findIndex((o) => o.tx_ref === actualTxRef);
    if (orderIndex >= 0) {
      orders[orderIndex].status = result.data && result.data.status ? result.data.status : 'paid';
      orders[orderIndex].flutterwave = result.data;
      saveOrders(orders);
    }

    return res.json({ ok: true, payment: result.data });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Server error while verifying payment.' });
  }
});

app.post('/api/payments/webhook', (req, res) => {
  console.log('Flutterwave webhook received:', req.body);
  res.status(200).send('OK');
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`AMB server running on port ${PORT}`);
});
