require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const movieRoutes = require('./routes/movieRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
app.disable('x-powered-by');
const port = process.env.PORT || 3000;
const allowedOrigins = new Set(['http://localhost:4200', 'http://localhost:4201']);

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Movie Explorer API is running' });
});

app.use('/api/users', userRoutes);
app.use('/api/movies', movieRoutes);

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing. Add it to backend/.env.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  void startServer();
}

module.exports = app;