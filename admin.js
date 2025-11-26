const API_BASE = "https://backendtutuion.onrender.com/api";
const TENANT_ID = "kittur-training-academy1"; // set per institute
let token = null;

// Login (with forced reset flow)
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value.trim();
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, tenantId: TENANT_ID })
  });
  if (!res.ok) { alert("Login failed"); return; }
  const data = await res.json();
  token = data.token;
  console.log(token);
  // Force reset UI
  if (data.forceReset) {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("reset-section").style.display = "block";
    document.getElementById("reset-email").value = email;
    return;
  }

  proceedToDashboard();
});

document.getElementById("reset-btn").addEventListener("click", async () => {
  const email = document.getElementById("reset-email").value.trim();
  const newPassword = document.getElementById("reset-password").value.trim();
  if (!newPassword || newPassword.length < 8) { alert("Password must be at least 8 characters"); return; }
  const res = await fetch(`${API_BASE}/auth/reset`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, tenantId: TENANT_ID, newPassword })
  });
  if (!res.ok) { alert("Password reset failed"); return; }
  alert("Password updated. Please login again.");
  window.location.reload();
});

function proceedToDashboard() {
  document.getElementById("login-section").style.display = "none";
  ["settings-section","razorpay-section","testimonials-section","registrations-section"]
    .forEach(id => document.getElementById(id).style.display = "block");
  loadAdminData();
}

// Helpers
function toInputDateTime(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function escapeHtml(str) {
  return (str || "").replace(/[&<>"]/g, s => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[s]));
}

// Load settings/testimonials/registrations
async function loadAdminData() {
  const sRes = await fetch(`${API_BASE}/settings?tenantId=${TENANT_ID}`);
  const settings = await sRes.json();
  document.getElementById("registrationLastDate").value =
    settings.registrationLastDate ? toInputDateTime(settings.registrationLastDate) : "";
  document.getElementById("enrollmentFee").value = settings.enrollmentFee ?? 12999;
  document.getElementById("titleInput").value = settings.title || "SSC Exam Coaching 2025 Registration";
  document.getElementById("instituteInput").value = settings.institute || "Your Institute";
  document.getElementById("themePrimary").value = settings.theme?.primary || "#004080";
  document.getElementById("themeAccent").value = settings.theme?.accent || "#d32f2f";
  document.getElementById("themeBackground").value = settings.theme?.background || "#f4f4f4";

  const tRes = await fetch(`${API_BASE}/testimonials?tenantId=${TENANT_ID}`);
  const testimonials = await tRes.json();
  const grid = document.getElementById("admin-testimonials");
  grid.innerHTML = "";
  testimonials.forEach(t => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${escapeHtml(t.name || "Anonymous")}</strong>
      <p>${escapeHtml(t.text || "")}</p>
      <p class="muted">video: ${t.videoUrl || "-"}</p>
      <p class="muted">photo: ${t.photoUrl || "-"}</p>
      <p class="muted">visible: ${t.visible !== false ? "Yes" : "No"} | order: ${t.order ?? "-"}</p>
      <button data-id="${t.id}" class="del">Delete</button>
    `;
    grid.appendChild(div);
  });
  grid.querySelectorAll(".del").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const res = await fetch(`${API_BASE}/testimonials/${id}?tenantId=${TENANT_ID}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) loadAdminData();
    });
  });

  const rRes = await fetch(`${API_BASE}/registrations?tenantId=${TENANT_ID}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const registrations = await rRes.json();
  const tbody = document.getElementById("registrations-table");
  tbody.innerHTML = "";
  registrations.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${escapeHtml(r.status)}</td>
      <td>${new Date(Number(r.ts)).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Save settings
document.getElementById("save-settings-btn").addEventListener("click", async () => {
  const payload = {
    tenantId: TENANT_ID,
    registrationLastDate: document.getElementById("registrationLastDate").value || null,
    enrollmentFee: Number(document.getElementById("enrollmentFee").value) || 12999,
    theme: {
      primary: document.getElementById("themePrimary").value,
      accent: document.getElementById("themeAccent").value,
      background: document.getElementById("themeBackground").value,
    },
    title: document.getElementById("titleInput").value.trim(),
    institute: document.getElementById("instituteInput").value.trim()
  };
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (res.ok) alert("Settings saved"); else alert("Failed to save settings");
});

// Save Razorpay keys
document.getElementById("save-razorpay-btn").addEventListener("click", async () => {
  const keyId = document.getElementById("razorpayKeyId").value.trim();
  const keySecret = document.getElementById("razorpayKeySecret").value.trim();
  const res = await fetch(`${API_BASE}/payments/keys`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId: TENANT_ID, keyId, keySecret })
  });
  if (res.ok) alert("Razorpay keys updated"); else alert("Failed to update keys");
});

// Add testimonial
document.getElementById("add-testimonial-btn").addEventListener("click", async () => {
  const payload = {
    tenantId: TENANT_ID,
    name: document.getElementById("t-name").value.trim(),
    text: document.getElementById("t-text").value.trim(),
    videoUrl: document.getElementById("t-video").value.trim() || null,
    photoUrl: document.getElementById("t-photo").value.trim() || null,
    visible: document.getElementById("t-visible").value === "true",
    order: Number(document.getElementById("t-order").value) || null
  };
  const res = await fetch(`${API_BASE}/testimonials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (res.ok) { alert("Added"); loadAdminData(); } else { alert("Failed to add"); }
});
