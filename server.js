const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const packages = [
  {
    id: 'instagram-basic',
    name: 'Instagram Basic Promotion',
    description: 'Starter promotion package',
    price: 5000,
    currency: 'UGX'
  },
  {
    id: 'tiktok-basic',
    name: 'TikTok Basic Promotion',
    description: 'Starter TikTok promotion package',
    price: 5000,
    currency: 'UGX'
  },
  {
    id: 'facebook-basic',
    name: 'Facebook Basic Promotion',
    description: 'Starter Facebook promotion package',
    price: 5000,
    currency: 'UGX'
  }
];

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/packages', (req, res) => {
  res.json({ packages });
});

app.post('/api/payments/initiate', async (req, res) => {
  try {
    const { packageId, customerName, customerEmail, amount } = req.body;

    const selectedPackage = packages.find((p) => p.id === packageId);
    if (!selectedPackage) {
      return res.status(400).json({ error: 'Invalid package selected' });
    }

    const paymentData = {
      tx_ref: `amb_${Date.now()}`,
      amount: amount || selectedPackage.price,
      currency: 'UGX',
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
      payment_options: 'card',
      customer: {
        email: customerEmail,
        phonenumber: '256700000000',
        name: customerName
      },
      customizations: {
        title: 'AMB Promotion Payment',
        description: selectedPackage.name
      }
    };

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
      return res.status(400).json({ error: result.message || 'Payment init failed' });
    }

    return res.json({
      ok: true,
      paymentUrl: result.data.link,
      tx_ref: paymentData.tx_ref
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  try {
    const { transactionId } = req.body;

    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: result.message || 'Verification failed' });
    }

    return res.json({
      ok: true,
      payment: result.data
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.send('AMB Social Media Promoting API is running.');
});

app.listen(PORT, () => {
  console.log(`AMB server running on port ${PORT}`);
});
