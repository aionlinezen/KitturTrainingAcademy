const API_BASE = "https://ssc-funnel-backend.onrender.com/api";
const TENANT_ID = "your-tenant-id"; // change per institute

// Load settings
(async function init() {
  const res = await fetch(`${API_BASE}/settings?tenantId=${TENANT_ID}`);
  const settings = await res.json();
  document.getElementById("title").textContent = settings.title;
  document.getElementById("institute").textContent = settings.institute;
  document.getElementById("page-title").textContent = `${settings.institute} SSC Coaching Registration`;
  startCountdown(new Date(settings.registrationLastDate));
  loadTestimonials();
})();

function startCountdown(deadline) {
  const el = document.getElementById("countdown");
  function tick() {
    const diff = deadline - new Date();
    if (diff <= 0) { el.textContent = "00d 00h 00m 00s"; return; }
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60), sec = s % 60;
    el.textContent = `${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(sec).padStart(2,"0")}s`;
  }
  tick(); setInterval(tick, 1000);
}

async function loadTestimonials() {
  const res = await fetch(`${API_BASE}/testimonials?tenantId=${TENANT_ID}`);
  const list = await res.json();
  const container = document.getElementById("testimonials-list");
  container.innerHTML = "";
  list.filter(t => t.visible !== false).forEach(t => {
    const div = document.createElement("div");
    div.className = "testimonial";
    div.innerHTML = `
      ${t.photoUrl ? `<img src="${t.photoUrl}" alt="Student"/>` : ""}
      <blockquote>${t.text}</blockquote>
      <p><strong>- ${t.name || "Anonymous"}</strong></p>
    `;
    container.appendChild(div);
  });
}

// Registration + Razorpay
document.getElementById("registration-form").addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();

  await fetch(`${API_BASE}/registrations`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId: TENANT_ID, name, email, phone })
  });

  const orderRes = await fetch(`${API_BASE}/payments/order`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId: TENANT_ID, user: { name, email, phone } })
  });
  const order = await orderRes.json();

  const options = {
    key: order.keyIdPublic,
    amount: order.amount,
    currency: order.currency,
    name: "SSC Registration",
    description: "Secure your SSC coaching seat",
    order_id: order.orderId,
    prefill: { name, email, contact: phone },
    handler: async function (response) {
      await fetch(`${API_BASE}/payments/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          name, email, phone
        })
      });
      alert("Payment successful!");
    }
  };
  new window.Razorpay(options).open();
});
