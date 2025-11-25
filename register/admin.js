const API_BASE = "https://your-render-backend.onrender.com/api";
const TENANT_ID = "ABC-123456789-ABC";

let token = null;

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
  ["settings-section","razorpay-section","testimonials-section","registrations-section","uploads-section"]
    .forEach(id => document.getElementById(id).style.display = "block");
  await loadAdminData();
});

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
  testimonials.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).forEach(t => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${escapeHtml(t.name || "Anonymous")}</strong>
      <p>${escapeHtml(t.text || "")}</p>
      <p class="muted">video: ${t.videoUrl || "-"}</p>
      <p class="muted">photo: ${t.photoUrl || "-"}</p>
      <p class="muted">visible: ${t.visible !== false ? "Yes" : "No"} | order: ${t.order ?? "-"}</p>
      <div class="row"><button data-id="${t.id}" class="del">Delete</button></div>
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
  registrations.slice(0,50).forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.phone)}</td><td>${r.status}</td><td>${new Date(r.ts).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById("save-settings-btn").addEventListener("click", async () => {
  const payload = {
    tenantId: TENANT_ID,
    registrationLastDate: fromInputDateTime(document.getElementById("registrationLastDate").value),
    enrollmentFee: Number(document.getElementById("enrollmentFee").value),
    title: document.getElementById("titleInput").value,
    institute: document.getElementById("instituteInput").value,
    theme: {
      primary: document.getElementById("themePrimary").value,
      accent: document.getElementById("themeAccent").value,
      background: document.getElementById("themeBackground").value
    }
  };
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  alert(res.ok ? "Settings saved" : "Failed to save settings");
});

document.getElementById("save-razorpay-btn").addEventListener("click", async () => {
  const res = await fetch(`${API_BASE}/razorpay`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tenantId: TENANT_ID,
      keyId: document.getElementById("razorpayKeyId").value,
      keySecret: document.getElementById("razorpayKeySecret").value
    })
  });
  alert(res.ok ? "Razorpay keys updated" : "Failed to update Razorpay keys");
});

document.getElementById("add-testimonial-btn").addEventListener("click", async () => {
  const res = await fetch(`${API_BASE}/testimonials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tenantId: TENANT_ID,
      name: document.getElementById("t-name").value,
      text: document.getElementById("t-text").value,
      videoUrl: document.getElementById("t-video").value,
      photoUrl: document.getElementById("t-photo").value,
      visible: document.getElementById("t-visible").value === "true",
      order: Number(document.getElementById("t-order").value)
    })
  });
  if (res.ok) loadAdminData();
});

document.getElementById("upload-btn").addEventListener("click", async () => {
  const fileInput = document.getElementById("upload-file");
  const statusEl = document.getElementById("upload-status");
  const file = fileInput.files?.[0];
  if (!file) { alert("Select a file first"); return; }

  statusEl.textContent = "Uploading...";
  const form = new FormData();
  form.append("tenantId", TENANT_ID);
  form.append("file", file);

  const res = await fetch(`${API_BASE}/uploads/cloudinary`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!res.ok) { statusEl.textContent = "Upload failed"; return; }
  const data = await res.json();
  statusEl.textContent = `Uploaded: ${data.publicUrl}`;
  if (file.type.startsWith("image")) document.getElementById("t-photo").value = data.publicUrl;
  else document.getElementById("t-video").value = data.publicUrl;
});

function toInputDateTime(iso) {
  const d = new Date(iso); const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromInputDateTime(val) { return val ? new Date(val).toISOString() : null; }
function escapeHtml(str) { return String(str||"").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
