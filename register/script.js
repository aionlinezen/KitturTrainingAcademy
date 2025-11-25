const API_BASE = "https://your-render-backend.onrender.com/api";
const TENANT_ID = "ABC-123456789-ABC"; // change per institute

(async function init() {
  try {
    const [sRes, tRes] = await Promise.all([
      fetch(`${API_BASE}/settings?tenantId=${TENANT_ID}`),
      fetch(`${API_BASE}/testimonials?tenantId=${TENANT_ID}`)
    ]);
    const settings = await sRes.json();
    const testimonials = await tRes.json();

    // Apply settings and theme
    if (settings?.theme) {
      document.documentElement.style.setProperty("--primary", settings.theme.primary || "#004080");
      document.documentElement.style.setProperty("--accent", settings.theme.accent || "#d32f2f");
      document.body.style.background = settings.theme.background || "#f4f4f4";
    }
    document.getElementById("title").textContent = settings.title || "SSC Exam Coaching 2025 Registration";
    document.getElementById("institute").textContent = settings.institute || "Your Institute";
    document.getElementById("page-title").textContent = settings.title || "SSC Exam Coaching Registration";

    const lastDate = settings.registrationLastDate ? new Date(settings.registrationLastDate) : new Date("2025-12-14T09:00:00+05:30");
    startCountdown(lastDate);
    document.getElementById("class-date").textContent =
      lastDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

    const fee = Number(settings.enrollmentFee ?? 12999);
    document.getElementById("discounted-price").textContent = `₹${fee}`;
    document.getElementById("original-price").textContent = `₹${Math.round(fee * 1.23)}`;

    // Testimonials
    const list = document.getElementById("testimonials-list");
    list.innerHTML = "";
    testimonials
      .filter(t => t.visible !== false)
      .sort((a,b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach(t => {
        const card = document.createElement("div");
        card.className = "testimonial";
        if (t.photoUrl) {
          const img = document.createElement("img");
          img.src = t.photoUrl; img.alt = t.name || "Student";
          card.appendChild(img);
        }
        const block = document.createElement("blockquote");
        block.textContent = t.text || "";
        card.appendChild(block);
        const p = document.createElement("p");
        p.innerHTML = `<strong>- ${t.name || "Anonymous"}</strong>`;
        card.appendChild(p);
        if (t.videoUrl) {
          const iframe = document.createElement("iframe");
          iframe.width = "100%"; iframe.height = "200"; iframe.src = t.videoUrl;
          iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
          iframe.allowFullscreen = true;
          card.appendChild(iframe);
        }
        list.appendChild(card);
      });
  } catch (err) {
    console.warn("Failed to load settings/testimonials:", err);
  }
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

document.getElementById("registration-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  if (!name || !email || !phone) { alert("Please fill all fields."); return; }

  try {
    const [registerRes, orderRes] = await Promise.all([
      fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: TENANT_ID, name, email, phone })
      }),
      fetch(`${API_BASE}/payments/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: TENANT_ID, user: { name, email, phone } })
      })
    ]);

    if (!orderRes.ok) {
      alert("Unable to create payment order. Please try again.");
      console.error(await orderRes.text());
      return;
    }

    const order = await orderRes.json();
    const options = {
      key: order.keyIdPublic,
      amount: order.amount,
      currency: order.currency,
      name: "SSC Exam Coaching Registration",
      description: "Secure your SSC coaching seat",
      order_id: order.orderId,
      prefill: { name, email, contact: phone },
      theme: { color: getComputedStyle(document.documentElement).getPropertyValue("--primary") || "#004080" },
      handler: async function (response) {
        try {
          const verify = await fetch(`${API_BASE}/payments/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId: TENANT_ID,
              razorpay_order_id: order.orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              name, email, phone
            })
          });
          if (verify.ok) {
            alert("Payment successful! Razorpay ID: " + response.razorpay_payment_id);
            const seatCount = document.getElementById("seat-count");
            seatCount.textContent = Math.max(0, (parseInt(seatCount.textContent, 10) || 0) - 1);
          } else {
            alert("Payment captured, verification failed. We will contact you.");
          }
        } catch (err) {
          console.error("Verification error:", err);
          alert("Payment captured, verification pending. We will contact you.");
        }
      }
    };
    const rzp = new Razorpay(options);
    rzp.open();

    if (!registerRes.ok) {
      console.warn("Registration email may not be sent:", await registerRes.text());
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    alert("Something went wrong. Please try again.");
  }
});
