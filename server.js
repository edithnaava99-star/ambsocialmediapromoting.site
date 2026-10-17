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

app.get('/', (req, res) => {
  res.send('AMB Social Media Promoting API is running.');
});

app.listen(PORT, () => {
  console.log(`AMB server running on port ${PORT}`);
});
