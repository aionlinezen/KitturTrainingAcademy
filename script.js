const API_BASE = "https://ssc-funnel-backend.onrender.com/api";
const TENANT_ID = "kittur-training-academy"; // unique tenant for this institute

// Countdown timer
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
startCountdown(new Date("2025-12-14T09:00:00+05:30"));

// Registration form
document.getElementById("registration-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();

  try {
    await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_ID, name, email, phone })
    });

    const orderRes = await fetch(`${API_BASE}/payments/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_ID, user: { name, email, phone } })
    });

    const order = await orderRes.json();
    const options = {
      key: order.keyIdPublic,
      amount: order.amount,
      currency: order.currency,
      name: "Kittur Training Academy SSC Registration",
      description: "Secure your SSC coaching seat",
      order_id: order.orderId,
      prefill
