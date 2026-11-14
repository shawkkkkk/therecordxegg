const $ = (selector) => document.querySelector(selector);
const loginPanel = $("#login-panel");
const dashboard = $("#dashboard");

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function localDateTimeValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

function showLogin() {
  loginPanel.hidden = false;
  dashboard.hidden = true;
}

function renderLedger(entries) {
  const list = $("#ledger-list");
  list.replaceChildren();
  $("#ledger-empty").hidden = entries.length > 0;
  entries.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "ledger-entry";
    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `${entry.donor} · ${entry.eggName}`;
    const meta = document.createElement("p");
    meta.className = "ledger-meta";
    meta.textContent = `${entry.xHandle} · ${new Date(entry.paidAt).toLocaleString()} · ${entry.transactionId}`;
    details.append(title, meta);

    const side = document.createElement("div");
    const amount = document.createElement("div");
    amount.className = "ledger-amount";
    amount.textContent = money(entry.amountUsd);
    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.textContent = "REMOVE";
    remove.addEventListener("click", () => removeEntry(entry.transactionId));
    side.append(amount, remove);
    article.append(details, side);
    list.append(article);
  });
}

async function loadLedger() {
  const response = await fetch("/api/admin-xmoney", { cache: "no-store" });
  if (response.status === 401) {
    showLogin();
    return;
  }
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Ledger unavailable");
  showDashboard();
  renderLedger(Array.isArray(payload.entries) ? payload.entries : []);
}

async function removeEntry(transactionId) {
  if (!window.confirm("Remove this verified payment from the ledger?")) return;
  const response = await fetch("/api/admin-xmoney", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  const payload = await response.json();
  if (!response.ok) return window.alert(payload.error || "Could not remove payment");
  await loadLedger();
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("#login-status");
  status.textContent = "Signing in…";
  const response = await fetch("/api/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: $("#password").value }),
  });
  const payload = await response.json();
  if (!response.ok) {
    status.textContent = payload.error || "Sign-in failed";
    return;
  }
  $("#password").value = "";
  status.textContent = "";
  await loadLedger();
});

$("#entry-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("#entry-status");
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = "Saving verified payment…";
  const body = {
    transactionId: $("#transaction-id").value,
    xHandle: $("#x-handle").value,
    donor: $("#donor-name").value,
    eggName: $("#egg-name").value,
    amount: $("#amount").value,
    paidAt: new Date($("#paid-at").value).toISOString(),
  };
  try {
    const response = await fetch("/api/admin-xmoney", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not save payment");
    event.currentTarget.reset();
    $("#paid-at").value = localDateTimeValue();
    status.textContent = "Payment recorded and leaderboard total updated.";
    await loadLedger();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#logout-button").addEventListener("click", async () => {
  await fetch("/api/admin-logout", { method: "POST" });
  showLogin();
});
$("#refresh-button").addEventListener("click", () => loadLedger().catch(() => {}));
$("#paid-at").value = localDateTimeValue();
loadLedger().catch(() => showLogin());
