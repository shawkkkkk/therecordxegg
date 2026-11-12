const $ = (selector) => document.querySelector(selector);

const state = {
  site: null,
  leaderboard: [],
};

function safeExternalUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function configureLink(element, value, pendingLabel) {
  const url = safeExternalUrl(value);
  if (!url) {
    element.classList.add("is-disabled");
    element.setAttribute("aria-disabled", "true");
    element.removeAttribute("target");
    element.removeAttribute("rel");
    element.href = "#";
    const label = element.querySelector(".button-label");
    if (label) label.textContent = pendingLabel;
    return;
  }
  element.href = url.href;
  element.target = "_blank";
  element.rel = "noopener noreferrer";
  element.classList.remove("is-disabled");
  element.removeAttribute("aria-disabled");
}

function formatLikes(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "POST COMING SOON";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value).toUpperCase() + " LIKES";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function renderSite() {
  const site = state.site;
  $("#campaign-status").textContent = (site.campaignStatus || "PRE-LAUNCH").toUpperCase();
  $("#like-count").textContent = formatLikes(site.currentLikes);
  $("#record-target").textContent = `GOAL ${site.recordTargetLabel || "6.7M+"}`;
  configureLink($("#like-button"), site.xPostUrl, "X POST LINK COMING");
  configureLink($("#xmoney-button"), site.xMoneyUrl, "X MONEY LINK COMING");

  const current = Number.isSafeInteger(site.currentLikes) ? site.currentLikes : 0;
  const target = Number.isSafeInteger(site.recordTarget) && site.recordTarget > 0 ? site.recordTarget : 6_700_001;
  const progress = Math.max(0, Math.min(100, current / target * 100));
  $("#progress-fill").style.width = `${progress}%`;
}

function validDonor(item) {
  return item && item.verified === true && ["xmoney", "site"].includes(item.route) &&
    typeof item.donor === "string" && item.donor.trim().length > 0 && item.donor.length <= 32 &&
    typeof item.eggName === "string" && item.eggName.trim().length > 0 && item.eggName.length <= 32 &&
    Number.isFinite(item.amountUsd) && item.amountUsd > 0 && item.amountUsd <= 1_000_000 &&
    typeof item.verifiedAt === "string" && Number.isFinite(Date.parse(item.verifiedAt));
}

function renderLeaderboard() {
  const list = $("#donor-list");
  list.replaceChildren();
  const donors = state.leaderboard.filter(validDonor).sort((a, b) => b.amountUsd - a.amountUsd || Date.parse(a.verifiedAt) - Date.parse(b.verifiedAt)).slice(0, 10);
  $("#empty-state").hidden = donors.length > 0;

  donors.forEach((donor, index) => {
    const item = document.createElement("li");
    item.className = "donor";

    const main = document.createElement("div");
    main.className = "donor-main";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const identity = document.createElement("span");
    identity.className = "donor-identity";
    const name = document.createElement("span");
    name.className = "donor-name";
    name.textContent = donor.donor.trim();
    const route = document.createElement("span");
    route.className = "route-badge";
    route.textContent = donor.route === "xmoney" ? "𝕏 MONEY" : "ON SITE";
    identity.append(name, route);
    main.append(rank, identity);

    const eggName = document.createElement("span");
    eggName.className = "egg-name";
    eggName.textContent = donor.eggName.trim();
    const amount = document.createElement("span");
    amount.className = "donor-amount";
    amount.textContent = formatCurrency(donor.amountUsd);
    item.append(main, eggName, amount);
    list.append(item);
  });
}

async function loadData() {
  try {
    const [siteResponse, leaderboardResponse] = await Promise.all([
      fetch("/data/site.json", { cache: "no-store" }),
      fetch("/data/leaderboard.json", { cache: "no-store" }),
    ]);
    if (!siteResponse.ok || !leaderboardResponse.ok) throw new Error("Campaign data unavailable");
    const site = await siteResponse.json();
    const leaderboard = await leaderboardResponse.json();
    state.site = site;
    state.leaderboard = Array.isArray(leaderboard.donors) ? leaderboard.donors : [];
    renderSite();
    renderLeaderboard();
  } catch {
    state.site = { campaignStatus: "Pre-launch", recordTarget: 6_700_001, recordTargetLabel: "6.7M+" };
    renderSite();
    renderLeaderboard();
  }
}

const dialog = $("#contribution-dialog");
$("#direct-button").addEventListener("click", () => dialog.showModal());
$("#dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

$("#contribution-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const status = $("#form-status");
  const checkout = safeExternalUrl(state.site?.directDonationCheckoutUrl);
  if (!checkout) {
    status.textContent = "Secure direct checkout is not connected yet. Please use X Money once its payment link is live.";
    return;
  }
  const donor = $("#donor-name").value.trim() || "Anonymous";
  const eggName = $("#egg-name").value.trim();
  const amount = Number($("#amount").value);
  if (!eggName || eggName.length > 32 || !Number.isInteger(amount) || amount < 1 || amount > 1_000_000 || !$("#public-consent").checked) {
    status.textContent = "Check the name, whole-dollar amount, and leaderboard consent before continuing.";
    return;
  }
  checkout.searchParams.set("donor", donor);
  checkout.searchParams.set("eggName", eggName);
  checkout.searchParams.set("amount", String(amount));
  window.location.assign(checkout.href);
});

$("#year").textContent = new Date().getFullYear();
loadData();
