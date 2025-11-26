const API_BASE = "https://ssc-funnel-backend.onrender.com/api";
const TENANT_ID = "kittur-training-academy";

let token = null;

// Login
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value.trim();
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) { alert("Login failed"); return; }
  const data = await res.json(); token = data.token;
  document.getElementById("login-section").style.display = "none";
  ["settings-section","razorpay-section","testimonials-section","registrations-section"]
    .forEach(id => document.getElementById(id).style.display = "block");
  await loadAdminData();
});

// Load settings/testimonials/registrations
async function loadAdminData() {
  const sRes = await fetch(`${API_BASE}/settings?tenantId=${TENANT_ID}`);
  const settings = await sRes.json();
  document.getElementById("registrationLastDate").value =
    settings.registrationLastDate ? toInputDateTime(settings.registrationLastDate) : "";
  document.getElementById("enrollmentFee").value = settings.enrollmentFee ?? 12999;
  document.getElementById("titleInput").value = settings.title || "SSC Exam Coaching 2025 Registration";
  document.getElementById("instituteInput").value = settings.institute || "Kittur Training Academy";
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
  tbody.innerHTML
