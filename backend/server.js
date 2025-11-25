import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { v2 as cloudinary } from "cloudinary";
import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();
const app = express();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// CORS allowlist (update to your GitHub Pages origin)
app.use(cors({
  origin: [
    "https://YOUR_GITHUB_USERNAME.github.io",
    "https://YOUR_GITHUB_USERNAME.github.io/ssc-funnel-frontend"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Email client (Resend)
const resend = new Resend(process.env.RESEND_API_KEY);

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// In-memory stores (replace with DB later)
const settingsStore = new Map();
const testimonialsStore = new Map();
const razorpayKeysStore = new Map();
const registrationsStore = new Map();

// Seed example tenant (replace via admin later)
settingsStore.set("your-tenant-id", {
  registrationLastDate: "2025-12-14T09:00:00+05:30",
  enrollmentFee: 12999,
  theme: { primary: "#004080", accent: "#d32f2f", background: "#f4f4f4" },
  title: "SSC Exam Coaching 2025 Registration",
  institute: "Your Institute"
});

function getTenant(req) {
  const id = req.query.tenantId || req.body?.tenantId;
  return id || null;
}
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
function logRegistration(tenantId, registration) {
  const list = registrationsStore.get(tenantId) || [];
  registrationsStore.set(tenantId, [registration, ...list].slice(0, 2000));
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Auth
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing credentials" });
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "2h" });
  res.json({ token });
});

// Settings
app.get("/api/settings", (req, res) => {
  const tenantId = getTenant(req);
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });
  res.json(settingsStore.get(tenantId) || {});
});
app.put("/api/settings", requireAuth, (req, res) => {
  const { tenantId, registrationLastDate, enrollmentFee, theme, title, institute } = req.body || {};
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });
  const current = settingsStore.get(tenantId) || {};
  const next = {
    ...current,
    ...(registrationLastDate !== undefined ? { registrationLastDate } : {}),
    ...(enrollmentFee !== undefined ? { enrollmentFee } : {}),
    ...(theme !== undefined ? { theme } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(institute !== undefined ? { institute } : {})
  };
  settingsStore.set(tenantId, next);
  res.json({ ok: true });
});

// Razorpay keys per tenant
app.put("/api/razorpay", requireAuth, (req, res) => {
  const { tenantId, keyId, keySecret } = req.body || {};
  if (!tenantId || !keyId || !keySecret) return res.status(400).json({ error: "Missing fields" });
  razorpayKeysStore.set(tenantId, { keyId, keySecret });
  res.json({ ok: true });
});

// Testimonials
app.get("/api/testimonials", (req, res) => {
  const tenantId = getTenant(req);
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });
  res.json(testimonialsStore.get(tenantId) || []);
});
app.post("/api/testimonials", requireAuth, (req, res) => {
  const { tenantId, name, text, videoUrl, photoUrl, visible, order } = req.body || {};
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });
  const list = testimonialsStore.get(tenantId) || [];
  const id = crypto.randomUUID();
  testimonialsStore.set(tenantId, [...list, { id, name, text, videoUrl, photoUrl, visible, order }]);
  res.json({ ok: true, id });
});
app.delete("/api/testimonials/:id", requireAuth, (req, res) => {
  const tenantId = getTenant(req);
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });
  const id = req.params.id;
  const list = testimonialsStore.get(tenantId) || [];
  testimonialsStore.set(tenantId, list.filter(t => t.id !== id));
  res.json({ ok: true });
});

// Registrations
app.get("/api/registrations", requireAuth, (req, res) => {
  const tenantId = getTenant(req);
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });
  res.json(registrationsStore.get(tenantId) || []);
});

// Registration — merged email logic
app.post("/api/register", async (req, res) => {
  const { tenantId, name, email, phone } = req.body || {};
  if (!tenantId || !name || !email || !phone) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const ts = Date.now();
  logRegistration(tenantId, { name, email, phone, status: "pending", ts });

  // Respond immediately
  res.status(202).json({ message: "Registration received" });

  // Send "payment pending" email (Resend) — merged from your earlier logic
  try {
    await resend.emails.send({
      from: "SSC Prep <noreply@sscprep.com>",
      to: [email, process.env.ADMIN_EMAIL].filter(Boolean),
      subject: "SSC Exam Registration - Payment Pending",
      text: `Hi ${name},

We’ve received your registration details. Please complete your payment to confirm your SSC exam seat.
Phone: ${phone}

Regards,
SSC Prep Team`
    });
  } catch (err) {
    console.error("Pending email failed:", err?.message);
  }
});

// Payments — order creation (uses amount from settings, not client)
app.post("/api/payments/order", async (req, res) => {
  const { tenantId, user } = req.body || {};
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });

  const settings = settingsStore.get(tenantId);
  const fee = settings?.enrollmentFee ?? 12999;

  const keys = razorpayKeysStore.get(tenantId) || {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_SECRET
  };
  if (!keys?.keyId || !keys?.keySecret) return res.status(500).json({ error: "Razorpay not configured" });

  const razorpay = new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(fee * 100),
      currency: "INR",
      receipt: `enroll-${tenantId}-${Date.now()}`,
      notes: { tenantId, name: user?.name, email: user?.email, phone: user?.phone }
    });
    // Return keyIdPublic for frontend checkout — merged behavior
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyIdPublic: keys.keyId });
  } catch (err) {
    console.error("Order creation failed:", err?.message);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// Payments — confirmation by signature (merged from earlier code)
app.post("/api/payments/confirm", async (req, res) => {
  const { tenantId, razorpay_order_id, razorpay_payment_id, razorpay_signature, name, email, phone } = req.body || {};
  if (!tenantId) return res.status(400).json({ error: "tenantId required" });

  const keys = razorpayKeysStore.get(tenantId) || {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_SECRET
  };
  if (!keys?.keySecret) return res.status(500).json({ error: "Razorpay not configured" });

  // Generate signature, compare to provided one — matches your earlier logic
  const generated_signature = crypto
    .createHmac("sha256", keys.keySecret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature !== razorpay_signature) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Update registration status
  const regs = registrationsStore.get(tenantId) || [];
  const idx = regs.findIndex(r => r.email === email);
  if (idx >= 0) regs[idx] = { ...regs[idx], status: "paid" };
  registrationsStore.set(tenantId, regs);

  // Send "payment confirmed" email (Resend) — merged from your earlier logic
  try {
    await resend.emails.send({
      from: "SSC Prep <noreply@sscprep.com>",
      to: [email, process.env.ADMIN_EMAIL].filter(Boolean),
      subject: "SSC Exam Registration - Payment Confirmed",
      text: `Hi ${name},

Your payment was successful! You are now registered for the SSC 2025 exam.
Phone: ${phone}

Regards,
SSC Prep Team`
    });
  } catch (err) {
    console.error("Confirmation email failed:", err?.message);
  }
  res.json({ ok: true });
});

// Cloudinary upload (owner-only)
app.post("/api/uploads/cloudinary", requireAuth, async (req, res) => {
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "Invalid form data" });
    const tenantId = fields.tenantId?.toString();
    if (!tenantId) return res.status(400).json({ error: "tenantId required" });

    const file = files.file;
    if (!file) return res.status(400).json({ error: "file required" });

    try {
      const result = await cloudinary.uploader.upload(file.filepath, {
        folder: `tenants/${tenantId}/testimonials`,
        resource_type: "auto"
      });
      res.json({ publicUrl: result.secure_url });
    } catch (e) {
      console.error("Cloudinary upload failed:", e?.message);
      res.status(500).json({ error: "Upload failed" });
    }
  });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Backend running on port ${PORT}`));
