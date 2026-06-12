/** @typedef {{ n_draws: number, generated_at: string, hot_numbers: number[], draws_sorted: number[][], ball_counts: Record<string,number>, chance_counts: Record<string,number>, chance_most_frequent_empirical: number, ball_retard: Record<string,number>, chance_retard: Record<string,number>, avg_hot_in_draw_when_any_hot: number, best_pair_hot: number[], disclaimer: string }} Stats */

let stats = /** @type {Stats|null} */ (null);
let chartBalls = null;
let chartChance = null;

/** @returns {number} */
function randInt(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

/** @param {number} min @param {number} maxInclusive */
function randRange(min, maxInclusive) {
  return min + randInt(maxInclusive - min + 1);
}

/** @param {number[]} arr @param {number} k */
function sampleWithoutReplacement(arr, k) {
  const pool = arr.slice();
  const out = [];
  for (let i = 0; i < k && pool.length; i++) {
    const idx = randInt(pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out.sort((a, b) => a - b);
}

/** @param {Stats} s */
function pickPedagogical(s) {
  const hotSet = new Set(s.hot_numbers.map(Number));
  let pool = s.draws_sorted.map((row) => row.map(Number));
  if (!pool.length) return sampleWithoutReplacement(Array.from({ length: 49 }, (_, i) => i + 1), 5);

  const weighted = pool.filter((row) => row.some((n) => hotSet.has(n)));
  if (weighted.length) pool = weighted;

  const weights = pool.map((row) => {
    const n = row.filter((x) => hotSet.has(x)).length;
    return Math.max(1, n) ** 2;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = randInt(total);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i].slice().sort((a, b) => a - b);
  }
  return pool[pool.length - 1].slice().sort((a, b) => a - b);
}

/** @param {Stats|null} s @param {string} mode */
function pickChance(s, mode) {
  if (mode === "empirique" && s) return Number(s.chance_most_frequent_empirical);
  return randRange(1, 10);
}

/** @param {number[]} nums @param {number} chance */
function renderGrille(nums, chance) {
  const out = document.getElementById("grille-out");
  const balls = document.getElementById("grille-balls");
  const ch = document.getElementById("grille-chance");
  out.hidden = false;
  balls.innerHTML = nums.map((n) => `<span class="ball">${n}</span>`).join("");
  ch.innerHTML = `N° Chance : <strong>${chance}</strong>`;
}

function renderSummary(s) {
  const el = document.getElementById("summary");
  const date = new Date(s.generated_at).toLocaleDateString("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  });
  document.getElementById("meta").textContent =
    `${s.n_draws.toLocaleString("fr-FR")} tirages · mis à jour ${date}`;

  el.innerHTML = [
    { v: s.n_draws.toLocaleString("fr-FR"), l: "Tirages" },
    { v: (s.n_draws * 5).toLocaleString("fr-FR"), l: "Boules enregistrées" },
    { v: s.hot_numbers.slice(0, 5).join(", "), l: "Top 5 fréquence" },
    {
      v: s.chance_most_frequent_empirical,
      l: "Chance la plus fréquate (passé)",
    },
  ]
    .map(
      (c) =>
        `<article class="card"><div class="value">${c.v}</div><div class="label">${c.l}</div></article>`
    )
    .join("");

  const [a, b, cnt] = s.best_pair_hot || [];
  const hotHtml = `
    <p class="hot-list"><strong>Top ${s.hot_k || 10} numéros :</strong> ${s.hot_numbers.join(", ")}</p>
    <p class="hot-list">Quand au moins un « chaud » est tiré, il y en a en moyenne <strong>${s.avg_hot_in_draw_when_any_hot}</strong> dans le même tirage (passé uniquement).</p>
    ${a ? `<p class="hot-list">Paire la plus vue parmi eux : <strong>${a}</strong> et <strong>${b}</strong> (${cnt} fois).</p>` : ""}
  `;

  const ballRet = Object.entries(s.ball_retard || {})
    .map(([k, v]) => [Number(k), v])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([n, r]) => `${n} (${r})`)
    .join(", ");
  const chRet = Object.entries(s.chance_retard || {})
    .map(([k, v]) => [Number(k), v])
    .sort((a, b) => b[1] - a[1])
    .map(([n, r]) => `${n} (${r})`)
    .join(", ");

  document.getElementById("hot-retard").innerHTML =
    hotHtml +
    `<p class="retard-list"><strong>Retards boules</strong> (tirages depuis dernière sortie) : ${ballRet}</p>` +
    `<p class="retard-list"><strong>Retards Chance</strong> : ${chRet}</p>`;

  document.getElementById("disclaimer-text").textContent = s.disclaimer;
}

/** @param {Stats} s */
function renderCharts(s) {
  const ballLabels = Array.from({ length: 49 }, (_, i) => String(i + 1));
  const ballData = ballLabels.map((k) => s.ball_counts[k] || 0);
  const chLabels = Array.from({ length: 10 }, (_, i) => String(i + 1));
  const chData = chLabels.map((k) => s.chance_counts[k] || 0);

  const common = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#8b9cb3", maxRotation: 0, autoSkip: true, maxTicksLimit: 15 } },
      y: { ticks: { color: "#8b9cb3" }, grid: { color: "#2d3a4f44" } },
    },
  };

  chartBalls?.destroy();
  chartBalls = new Chart(document.getElementById("chart-balls"), {
    type: "bar",
    data: {
      labels: ballLabels,
      datasets: [{ data: ballData, backgroundColor: "#3b82f6aa" }],
    },
    options: common,
  });

  chartChance?.destroy();
  chartChance = new Chart(document.getElementById("chart-chance"), {
    type: "bar",
    data: {
      labels: chLabels,
      datasets: [{ data: chData, backgroundColor: "#f59e0baa" }],
    },
    options: common,
  });
}

async function init() {
  const res = await fetch("data.json");
  if (!res.ok) throw new Error("data.json introuvable");
  stats = await res.json();
  renderSummary(stats);
  renderCharts(stats);

  const modeEl = document.getElementById("chance-mode");
  document.getElementById("btn-random").addEventListener("click", () => {
    const nums = sampleWithoutReplacement(Array.from({ length: 49 }, (_, i) => i + 1), 5);
    renderGrille(nums, pickChance(stats, modeEl.value));
  });
  document.getElementById("btn-pedago").addEventListener("click", () => {
    renderGrille(pickPedagogical(stats), pickChance(stats, modeEl.value));
  });
}

init().catch((err) => {
  document.getElementById("meta").textContent = "Erreur de chargement des données.";
  console.error(err);
});
