// AniZe Backend — Auth + Watchlist API
const express    = require('express');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please try again later.' }
});

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000
  });
  isConnected = true;
  console.log('✅ MongoDB connected');
}

const userSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 32 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const watchlistSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  animeId:   { type: String, required: true },
  title:     { type: String, required: true },
  image:     { type: String, default: '' },
  status:    { type: String, enum: ['watching','planned','completed','dropped','on-hold'], default: 'planned' },
  progress:  { type: Number, default: 0 },
  totalEps:  { type: Number, default: 0 },
  score:     { type: Number, min: 0, max: 10, default: 0 },
  addedAt:   { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

watchlistSchema.index({ userId: 1, animeId: 1 }, { unique: true });

const User      = mongoose.models.User      || mongoose.model('User',      userSchema);
const Watchlist = mongoose.models.Watchlist || mongoose.model('Watchlist', watchlistSchema);

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    await connectDB();
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'Email' : 'Username';
      return res.status(409).json({ error: `${field} is already in use.` });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ username, email, password: hashed });
    const token  = signToken(user._id);
    return res.status(201).json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = signToken(user._id);
    return res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/user/watchlist', authMiddleware, async (req, res) => {
  try {
    await connectDB();
    const list = await Watchlist.find({ userId: req.userId }).sort({ updatedAt: -1 });
    return res.json({ watchlist: list });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch watchlist.' });
  }
});

app.post('/api/user/watchlist', authMiddleware, async (req, res) => {
  try {
    await connectDB();
    const { animeId, title, image, status, progress, totalEps, score } = req.body;
    if (!animeId || !title) {
      return res.status(400).json({ error: 'animeId and title are required.' });
    }
    const entry = await Watchlist.findOneAndUpdate(
      { userId: req.userId, animeId },
      { title, image, status, progress, totalEps, score, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ entry });
  } catch (err) {
    console.error('Watchlist upsert error:', err);
    return res.status(500).json({ error: 'Failed to update watchlist.' });
  }
});

app.delete('/api/user/watchlist/:animeId', authMiddleware, async (req, res) => {
  try {
    await connectDB();
    await Watchlist.deleteOne({ userId: req.userId, animeId: req.params.animeId });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to remove entry.' });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => console.log(`🚀 AniZe API running on http://localhost:${PORT}`));
}

module.exports = app;