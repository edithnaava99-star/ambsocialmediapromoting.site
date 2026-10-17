const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend from /public
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Product packages (prices in USD to accept international cards reliably)
const packages = [
  { id: 'instagram-1k-followers', name: 'Instagram 1k Followers', description: '1,000 real-ish Instagram followers', price: 50, currency: 'USD' },
  { id: 'youtube-1k-watch-hours', name: 'YouTube 1k Watch Hours', description: '1,000 watch hours for YouTube monetization', price: 200, currency: 'USD' },
  { id: 'youtube-1k-subscribers', name: 'YouTube 1k Subscribers (Music Promo)', description: '1,000 YouTube subscribers — music promotion', price: 150, currency: 'USD' },
  { id: 'youtube-1k-views-likes', name: 'YouTube 1k Views & Likes', description: '1,000 views and likes on a video', price: 30, currency: 'USD' },
  { id: 'facebook-1k-followers', name: 'Facebook 1k Followers', description: '1,000 Facebook followers', price: 150, currency: 'USD' },
  { id: 'tiktok-1k-likes-5k-views', name: 'TikTok 1k Likes / 5k Views', description: '1,000 likes and 5,000 views', price: 50, currency: 'USD' }
];

// Simple in-memory order store (replace with DB in production)
const orders = new Map();

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/packages', (req, res) => {
  res.json({ packages });
});

// Initiate a payment with Flutterwave. Returns a redirect/payment URL.
// Body: { packageId, customerName, customerEmail, currency }
app.post('/api/payments/initiate', async (req, res) => {
  try {
    const { packageId, customerName, customerEmail, currency } = req.body;

    if (!packageId || !customerName || !customerEmail) {
      return res.status(400).json({ error: 'packageId, customerName and customerEmail are required' });
    }

    const selected = packages.find((p) => p.id === packageId);
    if (!selected) return res.status(400).json({ error: 'Invalid packageId' });

    const useCurrency = (currency || selected.currency || 'USD').toUpperCase();
    const amount = selected.price;

    const tx_ref = `amb_${Date.now()}`;

    const paymentData = {
      tx_ref,
      amount: amount.toString(),
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
        description: selected.name
      }
    };

    // Save order in memory
    orders.set(tx_ref, { tx_ref, packageId, amount, currency: useCurrency, customerName, customerEmail, status: 'initiated', createdAt: Date.now() });

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Flutterwave init error', result);
      return res.status(400).json({ error: result.message || 'Payment initiation failed', detail: result });
    }

    // Flutterwave v3 returns a link in result.data.link (or checkout_url / data.link)
    const paymentUrl = (result && result.data && (result.data.link || result.data.checkout_url || result.data.url)) || null;

    return res.json({ ok: true, paymentUrl, tx_ref });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Verify a transaction by Flutterwave transaction id.
// Body: { transactionId }
app.post('/api/payments/verify', async (req, res) => {
  try {
    const { transactionId, tx_ref } = req.body;

    if (!transactionId && !tx_ref) return res.status(400).json({ error: 'transactionId or tx_ref required' });

    // Prefer verifying by transactionId when provided
    let endpoint = null;
    if (transactionId) {
      endpoint = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;
    } else {
      endpoint = `https://api.flutterwave.com/v3/transactions/verify_by_tx_ref?tx_ref=${encodeURIComponent(tx_ref)}`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
      }
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Verification error', result);
      return res.status(400).json({ error: result.message || 'Verification failed', detail: result });
    }

    // Update order store if we have tx_ref
    const foundTxRef = (result && result.data && result.data.tx_ref) || tx_ref;
    if (foundTxRef && orders.has(foundTxRef)) {
      const order = orders.get(foundTxRef);
      order.status = (result.data && result.data.status) || 'unknown';
      order.flutterwave = result.data;
      orders.set(foundTxRef, order);
    }

    return res.json({ ok: true, payment: result.data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Checkout route for frontend cart
app.post('/api/checkout', async (req, res) => {
  try {
    const { cart, customerName, customerEmail, currency } = req.body;
    if (!cart || !Array.isArray(cart) || cart.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    if (!customerName || !customerEmail) return res.status(400).json({ error: 'Customer name and email are required' });

    // Calculate total
    let total = 0;
    // cart items: { id, qty }
    for (const item of cart) {
      const p = packages.find(x => x.id === item.id);
      if (!p) return res.status(400).json({ error: `Invalid product ${item.id}` });
      total += p.price * (item.qty || 1);
    }

    const useCurrency = (currency || 'USD').toUpperCase();
    const tx_ref = `amb_${Date.now()}`;

    const paymentData = {
      tx_ref,
      amount: total.toString(),
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

    orders.set(tx_ref, { tx_ref, cart, total, currency: useCurrency, customerName, customerEmail, status: 'initiated', createdAt: Date.now() });

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Checkout init error', result);
      return res.status(400).json({ error: result.message || 'Checkout initiation failed', detail: result });
    }

    const paymentUrl = (result && result.data && (result.data.link || result.data.checkout_url || result.data.url)) || null;
    return res.json({ ok: true, paymentUrl, tx_ref });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Simple webhook endpoint to receive Flutterwave notifications (logs only).
app.post('/api/payments/webhook', (req, res) => {
  console.log('Webhook received', { headers: req.headers, body: req.body });
  res.status(200).send('OK');
});

// Serve index.html for root (static middleware above will serve files automatically)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`AMB server running on port ${PORT}`);
});
