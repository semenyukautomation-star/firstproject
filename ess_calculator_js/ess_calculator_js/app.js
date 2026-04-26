// ESS Calculator — pure JavaScript static version.
// No Python server is required.

const CONTAINER_MODELS = ["LUNA2000-5015 Series"];
const PCS_MODELS = ["LUNA2000-213KTL-H0"];
const STS_MODELS = [
  "JUPITER 3000K-H1",
  "JUPITER 6000K-H1",
  "JUPITER 9000K-H1-1000",
];
const STS_VOLTAGES = ["10/0.8 кВ", "35/0.8 кВ"];
const SMART_STATION_NAME = "Smart transformer station DTS-200K-D0";
const STORAGE_KEY = "ess_calculator_js_state_v1";
const N8N_URL_KEY = "ess_calculator_n8n_url";
const N8N_SECRET_KEY = "ess_calculator_n8n_secret";

const DEFAULT_DATA = {
  project: {
    project_name: "Новий кошторис ESS",
    container_model: CONTAINER_MODELS[0],
    container_count: 1,
    pcs_model: PCS_MODELS[0],
    pcs_count: 1,
    sts_model: STS_MODELS[0],
    sts_voltage: STS_VOLTAGES[0],
    sts_count: 0,
    include_smart_station: false,
    currency: "USD",
    notes: "",
  },
  price_settings: {
    container_prices: { [CONTAINER_MODELS[0]]: 0 },
    pcs_prices: { [PCS_MODELS[0]]: 0 },
    sts_prices: {
      [STS_MODELS[0]]: { [STS_VOLTAGES[0]]: 0, [STS_VOLTAGES[1]]: 0 },
      [STS_MODELS[1]]: { [STS_VOLTAGES[0]]: 0, [STS_VOLTAGES[1]]: 0 },
      [STS_MODELS[2]]: { [STS_VOLTAGES[0]]: 0, [STS_VOLTAGES[1]]: 0 },
    },
    smart_station_price: 0,
  },
  container_spec: [
    {
      name: "Монтаж контейнера ESS",
      qty: 1,
      unit: "посл",
      price: 0,
      note: "На кожен контейнер",
    },
    {
      name: "Кабельна продукція та дрібні матеріали для контейнера",
      qty: 1,
      unit: "компл",
      price: 0,
      note: "На кожен контейнер",
    },
  ],
  pcs_spec: [
    {
      name: "Монтаж PCS",
      qty: 1,
      unit: "посл",
      price: 0,
      note: "На кожен PCS",
    },
    {
      name: "Кабельне підключення PCS",
      qty: 1,
      unit: "компл",
      price: 0,
      note: "На кожен PCS",
    },
  ],
  sts_spec: [
    {
      name: "Монтаж комплектної підвищувальної трансформаторної підстанції STS",
      qty: 1,
      unit: "посл",
      price: 0,
      note: "На кожну STS",
    },
    {
      name: "Підключення та кабельна обв'язка STS",
      qty: 1,
      unit: "компл",
      price: 0,
      note: "На кожну STS",
    },
    {
      name: "Пусконалагоджувальні роботи STS",
      qty: 1,
      unit: "посл",
      price: 0,
      note: "На кожну STS",
    },
  ],
  common_spec: [
    {
      name: "Проєктні роботи",
      qty: 1,
      unit: "посл",
      price: 0,
      note: "Разова витрата на проєкт",
    },
    {
      name: "Пусконалагоджувальні роботи",
      qty: 1,
      unit: "посл",
      price: 0,
      note: "Разова витрата на проєкт",
    },
    {
      name: "Логістика",
      qty: 1,
      unit: "посл",
      price: 0,
      note: "Разова витрата на проєкт",
    },
  ],
};

let state = loadInitialState();
let lastSummary = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fmt(value) {
  return toNumber(value).toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeSafeId(...parts) {
  return parts.join("_").replace(/[^\wа-яА-ЯіІїЇєЄґҐ-]+/g, "_");
}

function loadInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return clone(DEFAULT_DATA);
    return normalizeData(JSON.parse(saved));
  } catch {
    return clone(DEFAULT_DATA);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeData(raw) {
  const data = clone(DEFAULT_DATA);

  if (raw && typeof raw === "object") {
    for (const key of Object.keys(data)) {
      if (raw[key] !== undefined) data[key] = raw[key];
    }
  }

  data.project = { ...DEFAULT_DATA.project, ...(data.project || {}) };

  if (!CONTAINER_MODELS.includes(data.project.container_model)) data.project.container_model = CONTAINER_MODELS[0];
  if (!PCS_MODELS.includes(data.project.pcs_model)) data.project.pcs_model = PCS_MODELS[0];
  if (!STS_MODELS.includes(data.project.sts_model)) data.project.sts_model = STS_MODELS[0];

  data.project.sts_voltage = String(data.project.sts_voltage || STS_VOLTAGES[0]).replace("0,8", "0.8");
  if (!STS_VOLTAGES.includes(data.project.sts_voltage)) data.project.sts_voltage = STS_VOLTAGES[0];

  data.project.container_count = toNumber(data.project.container_count, 1);
  data.project.pcs_count = toNumber(data.project.pcs_count, 1);
  data.project.sts_count = toNumber(data.project.sts_count, 0);
  data.project.include_smart_station = Boolean(data.project.include_smart_station);
  data.project.currency = data.project.currency || "USD";
  data.project.notes = data.project.notes || "";
  data.project.project_name = data.project.project_name || "Новий кошторис ESS";

  data.price_settings = {
    container_prices: {},
    pcs_prices: {},
    sts_prices: {},
    smart_station_price: 0,
    ...(data.price_settings || {}),
  };

  data.price_settings.container_prices = {
    [CONTAINER_MODELS[0]]: toNumber(data.price_settings.container_prices?.[CONTAINER_MODELS[0]], 0),
  };

  data.price_settings.pcs_prices = {
    [PCS_MODELS[0]]: toNumber(data.price_settings.pcs_prices?.[PCS_MODELS[0]], 0),
  };

  const stsPrices = {};
  for (const model of STS_MODELS) {
    stsPrices[model] = {};
    for (const voltage of STS_VOLTAGES) {
      stsPrices[model][voltage] = toNumber(data.price_settings.sts_prices?.[model]?.[voltage], 0);
    }
  }
  data.price_settings.sts_prices = stsPrices;
  data.price_settings.smart_station_price = toNumber(data.price_settings.smart_station_price, 0);

  for (const key of ["container_spec", "pcs_spec", "sts_spec", "common_spec"]) {
    data[key] = Array.isArray(data[key])
      ? data[key].map(item => ({
          name: item?.name || "",
          qty: toNumber(item?.qty, 0),
          unit: item?.unit || "шт",
          price: toNumber(item?.price, 0),
          note: item?.note || "",
        }))
      : clone(DEFAULT_DATA[key]);
  }

  return data;
}

function fillSelect(id, options) {
  const select = document.getElementById(id);
  select.innerHTML = options.map(option => `<option>${escapeHtml(option)}</option>`).join("");
}

function initStaticControls() {
  fillSelect("container_model", CONTAINER_MODELS);
  fillSelect("pcs_model", PCS_MODELS);
  fillSelect("sts_model", STS_MODELS);
  fillSelect("sts_voltage", STS_VOLTAGES);

  const n8nUrl = localStorage.getItem(N8N_URL_KEY) || "";
  const n8nSecret = localStorage.getItem(N8N_SECRET_KEY) || "";
  document.getElementById("n8nWebhookUrl").value = n8nUrl;
  document.getElementById("n8nSecret").value = n8nSecret;
}

function fillFormFromState() {
  const p = state.project;
  const prices = state.price_settings;

  document.getElementById("project_name").value = p.project_name;
  document.getElementById("currency").value = p.currency;
  document.getElementById("container_model").value = p.container_model;
  document.getElementById("container_count").value = p.container_count;
  document.getElementById("pcs_model").value = p.pcs_model;
  document.getElementById("pcs_count").value = p.pcs_count;
  document.getElementById("sts_model").value = p.sts_model;
  document.getElementById("sts_voltage").value = p.sts_voltage;
  document.getElementById("sts_count").value = p.sts_count;
  document.getElementById("include_smart_station").checked = p.include_smart_station;
  document.getElementById("notes").value = p.notes;

  document.getElementById("container_price").value = prices.container_prices[CONTAINER_MODELS[0]] ?? 0;
  document.getElementById("pcs_price").value = prices.pcs_prices[PCS_MODELS[0]] ?? 0;
  document.getElementById("smart_station_price").value = prices.smart_station_price ?? 0;

  renderStsPriceInputs();
  renderSpecTables();
  recalculateAndRender();
}

function collectStateFromForm() {
  const p = state.project;
  p.project_name = document.getElementById("project_name").value.trim() || "Новий кошторис ESS";
  p.currency = document.getElementById("currency").value || "USD";
  p.container_model = document.getElementById("container_model").value || CONTAINER_MODELS[0];
  p.container_count = toNumber(document.getElementById("container_count").value, 0);
  p.pcs_model = document.getElementById("pcs_model").value || PCS_MODELS[0];
  p.pcs_count = toNumber(document.getElementById("pcs_count").value, 0);
  p.sts_model = document.getElementById("sts_model").value || STS_MODELS[0];
  p.sts_voltage = document.getElementById("sts_voltage").value || STS_VOLTAGES[0];
  p.sts_count = toNumber(document.getElementById("sts_count").value, 0);
  p.include_smart_station = document.getElementById("include_smart_station").checked;
  p.notes = document.getElementById("notes").value;

  state.price_settings.container_prices[CONTAINER_MODELS[0]] = toNumber(document.getElementById("container_price").value, 0);
  state.price_settings.pcs_prices[PCS_MODELS[0]] = toNumber(document.getElementById("pcs_price").value, 0);
  state.price_settings.smart_station_price = toNumber(document.getElementById("smart_station_price").value, 0);

  for (const model of STS_MODELS) {
    for (const voltage of STS_VOLTAGES) {
      const input = document.getElementById(makeSafeId("sts", model, voltage));
      state.price_settings.sts_prices[model][voltage] = toNumber(input?.value, 0);
    }
  }

  for (const key of ["container_spec", "pcs_spec", "sts_spec", "common_spec"]) {
    state[key] = [...document.querySelectorAll(`#${key} tr`)].map(row => ({
      name: row.querySelector("[data-field='name']").value.trim(),
      qty: toNumber(row.querySelector("[data-field='qty']").value, 0),
      unit: row.querySelector("[data-field='unit']").value.trim() || "шт",
      price: toNumber(row.querySelector("[data-field='price']").value, 0),
      note: row.querySelector("[data-field='note']").value.trim(),
    }));
  }

  saveState();
}

function renderStsPriceInputs() {
  const body = document.getElementById("stsPricesBody");
  body.innerHTML = "";

  for (const model of STS_MODELS) {
    const row = document.createElement("tr");
    const cells = [`<td>${escapeHtml(model)}</td>`];

    for (const voltage of STS_VOLTAGES) {
      const id = makeSafeId("sts", model, voltage);
      const value = state.price_settings.sts_prices[model][voltage] ?? 0;
      cells.push(`<td><input id="${id}" type="number" min="0" step="0.01" value="${value}"></td>`);
    }

    row.innerHTML = cells.join("");
    body.appendChild(row);
  }
}

function renderSpecTables() {
  for (const key of ["container_spec", "pcs_spec", "sts_spec", "common_spec"]) {
    const body = document.getElementById(key);
    body.innerHTML = "";
    for (const item of state[key]) {
      appendSpecRow(key, item, false);
    }
  }
}

function appendSpecRow(key, item = { name: "", qty: 1, unit: "шт", price: 0, note: "" }, shouldRecalculate = true) {
  const body = document.getElementById(key);
  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input data-field="name" value="${escapeHtml(item.name)}"></td>
    <td><input data-field="qty" type="number" min="0" step="0.01" value="${toNumber(item.qty, 1)}"></td>
    <td><input data-field="unit" value="${escapeHtml(item.unit || "шт")}"></td>
    <td><input data-field="price" type="number" min="0" step="0.01" value="${toNumber(item.price, 0)}"></td>
    <td><input data-field="note" value="${escapeHtml(item.note)}"></td>
    <td><button type="button" class="remove-row">Видалити</button></td>
  `;

  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    recalculateAndRender();
  });

  body.appendChild(row);

  if (shouldRecalculate) {
    recalculateAndRender();
  }
}

function calculateEquipmentRows(data) {
  const project = data.project;
  const prices = data.price_settings;
  const rows = [];
  let total = 0;

  const containerModel = project.container_model;
  const containerCount = toNumber(project.container_count, 0);
  const containerPrice = toNumber(prices.container_prices[containerModel], 0);
  const containerTotal = containerCount * containerPrice;

  rows.push({
    section: "Обладнання",
    name: containerModel,
    base_qty: 1,
    multiplier: containerCount,
    final_qty: containerCount,
    unit: "шт",
    price: containerPrice,
    total: containerTotal,
    note: "Базова ціна контейнера ESS",
  });
  total += containerTotal;

  const pcsModel = project.pcs_model;
  const pcsCount = toNumber(project.pcs_count, 0);
  const pcsPrice = toNumber(prices.pcs_prices[pcsModel], 0);
  const pcsTotal = pcsCount * pcsPrice;

  rows.push({
    section: "Обладнання",
    name: pcsModel,
    base_qty: 1,
    multiplier: pcsCount,
    final_qty: pcsCount,
    unit: "шт",
    price: pcsPrice,
    total: pcsTotal,
    note: "Базова ціна PCS",
  });
  total += pcsTotal;

  const stsModel = project.sts_model;
  const stsVoltage = project.sts_voltage;
  const stsCount = toNumber(project.sts_count, 0);
  const stsPrice = toNumber(prices.sts_prices[stsModel]?.[stsVoltage], 0);

  if (stsCount > 0) {
    const stsTotal = stsCount * stsPrice;
    rows.push({
      section: "Обладнання",
      name: `${stsModel} (${stsVoltage})`,
      base_qty: 1,
      multiplier: stsCount,
      final_qty: stsCount,
      unit: "шт",
      price: stsPrice,
      total: stsTotal,
      note: "Ціна STS за вибраною напругою перетворення",
    });
    total += stsTotal;
  }

  if (project.include_smart_station) {
    const smartPrice = toNumber(prices.smart_station_price, 0);
    rows.push({
      section: "Обладнання",
      name: SMART_STATION_NAME,
      base_qty: 1,
      multiplier: 1,
      final_qty: 1,
      unit: "шт",
      price: smartPrice,
      total: smartPrice,
      note: "Опційне обладнання",
    });
    total += smartPrice;
  }

  return { rows, total };
}

function calculateSection(data, key, multiplier, sectionName) {
  const rows = [];
  let sectionTotal = 0;

  for (const item of data[key] || []) {
    const baseQty = toNumber(item.qty, 0);
    const price = toNumber(item.price, 0);
    const finalQty = baseQty * multiplier;
    const total = finalQty * price;

    sectionTotal += total;
    rows.push({
      section: sectionName,
      name: item.name || "",
      base_qty: baseQty,
      multiplier,
      final_qty: finalQty,
      unit: item.unit || "",
      price,
      total,
      note: item.note || "",
    });
  }

  return { rows, total: sectionTotal };
}

function calculateSummary(data) {
  const normalized = normalizeData(data);
  const project = normalized.project;

  const equipment = calculateEquipmentRows(normalized);
  const container = calculateSection(normalized, "container_spec", project.container_count, "Контейнери");
  const pcs = calculateSection(normalized, "pcs_spec", project.pcs_count, "PCS");
  const sts = calculateSection(normalized, "sts_spec", project.sts_count, "STS");
  const common = calculateSection(normalized, "common_spec", 1, "Загальні");

  const rows = [
    ...equipment.rows,
    ...container.rows,
    ...pcs.rows,
    ...sts.rows,
    ...common.rows,
  ];

  const totals = {
    equipment: equipment.total,
    container: container.total,
    pcs: pcs.total,
    sts: sts.total,
    common: common.total,
    project: equipment.total + container.total + pcs.total + sts.total + common.total,
  };

  return {
    data: normalized,
    rows,
    totals,
    currency: project.currency || "USD",
    created_at: new Date().toISOString(),
  };
}

function recalculateAndRender() {
  collectStateFromForm();
  lastSummary = calculateSummary(state);
  renderSummary(lastSummary);
}

function renderSummary(summary) {
  const c = summary.currency;
  const t = summary.totals;

  document.getElementById("totalProjectTop").textContent = `${fmt(t.project)} ${c}`;
  document.getElementById("totalEquipment").textContent = `${fmt(t.equipment)} ${c}`;
  document.getElementById("totalContainer").textContent = `${fmt(t.container)} ${c}`;
  document.getElementById("totalPcs").textContent = `${fmt(t.pcs)} ${c}`;
  document.getElementById("totalSts").textContent = `${fmt(t.sts)} ${c}`;
  document.getElementById("totalCommon").textContent = `${fmt(t.common)} ${c}`;

  const body = document.getElementById("summaryBody");
  body.innerHTML = "";

  for (const row of summary.rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.section)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${fmt(row.base_qty)}</td>
      <td>${fmt(row.multiplier)}</td>
      <td>${fmt(row.final_qty)}</td>
      <td>${escapeHtml(row.unit)}</td>
      <td>${fmt(row.price)}</td>
      <td><strong>${fmt(row.total)}</strong></td>
      <td>${escapeHtml(row.note)}</td>
    `;
    body.appendChild(tr);
  }
}

function buildCsv(summary) {
  const project = summary.data.project;
  const c = summary.currency;
  const rows = [];

  rows.push(["Назва проєкту", project.project_name]);
  rows.push(["Контейнер", project.container_model]);
  rows.push(["Кількість контейнерів", project.container_count]);
  rows.push(["PCS", project.pcs_model]);
  rows.push(["Кількість PCS", project.pcs_count]);
  rows.push(["STS", project.sts_model]);
  rows.push(["Напруга STS", project.sts_voltage]);
  rows.push(["Кількість STS", project.sts_count]);
  rows.push(["Smart transformer station", project.include_smart_station ? "Так" : "Ні"]);
  rows.push([]);
  rows.push([
    "Розділ",
    "Позиція",
    "База",
    "Множник",
    "Підсумкова к-сть",
    "Од.",
    `Ціна, ${c}`,
    `Сума, ${c}`,
    "Примітка",
  ]);

  for (const row of summary.rows) {
    rows.push([
      row.section,
      row.name,
      row.base_qty,
      row.multiplier,
      row.final_qty,
      row.unit,
      row.price,
      row.total,
      row.note,
    ]);
  }

  rows.push([]);
  rows.push(["Базове обладнання", summary.totals.equipment, c]);
  rows.push(["Додатково по контейнерах", summary.totals.container, c]);
  rows.push(["Додатково по PCS", summary.totals.pcs, c]);
  rows.push(["Додатково по STS", summary.totals.sts, c]);
  rows.push(["Загальні витрати", summary.totals.common, c]);
  rows.push(["Загальна вартість проєкту", summary.totals.project, c]);

  return rows.map(csvRow => csvRow.map(csvCell).join(";")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setStatus(message, type = "ok") {
  const box = document.getElementById("statusBox");
  box.classList.remove("ok", "error");
  box.classList.add(type);
  box.textContent = message;
}

function handleJsonUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = normalizeData(parsed);
      saveState();
      fillFormFromState();
      setStatus("JSON успішно завантажено в сайт.", "ok");
    } catch (error) {
      setStatus(`Помилка JSON: ${error.message}`, "error");
    }
  };
  reader.onerror = () => setStatus("Не вдалося прочитати файл.", "error");
  reader.readAsText(file);
}

async function sendToN8n() {
  recalculateAndRender();

  const webhookUrl = document.getElementById("n8nWebhookUrl").value.trim();
  const secret = document.getElementById("n8nSecret").value.trim();

  localStorage.setItem(N8N_URL_KEY, webhookUrl);
  localStorage.setItem(N8N_SECRET_KEY, secret);

  if (!webhookUrl) {
    setStatus("Вкажи n8n Webhook URL.", "error");
    return;
  }

  const payload = {
    source: "ess_calculator_js",
    secret: secret || null,
    project: lastSummary.data.project,
    price_settings: lastSummary.data.price_settings,
    container_spec: lastSummary.data.container_spec,
    pcs_spec: lastSummary.data.pcs_spec,
    sts_spec: lastSummary.data.sts_spec,
    common_spec: lastSummary.data.common_spec,
    rows: lastSummary.rows,
    totals: lastSummary.totals,
    currency: lastSummary.currency,
    created_at: lastSummary.created_at,
  };

  try {
    setStatus("Відправляю дані в n8n...", "ok");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`n8n повернув HTTP ${response.status}`);
    }

    setStatus("Дані успішно відправлено в n8n.", "ok");
  } catch (error) {
    setStatus(`Помилка відправки в n8n: ${error.message}. Якщо це CORS, розмісти сайт на хостингу або налаштуй відповідь Webhook.`, "error");
  }
}

function wireEvents() {
  document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });

  document.body.addEventListener("input", event => {
    if (event.target.matches("input, select, textarea")) {
      recalculateAndRender();
    }
  });

  document.querySelectorAll("[data-add-section]").forEach(button => {
    button.addEventListener("click", () => {
      appendSpecRow(button.dataset.addSection);
    });
  });

  document.getElementById("resetProjectBtn").addEventListener("click", () => {
    const ok = confirm("Скинути всі дані до стартового шаблону?");
    if (!ok) return;
    state = clone(DEFAULT_DATA);
    saveState();
    fillFormFromState();
    setStatus("Дані скинуто до шаблону.", "ok");
  });

  document.getElementById("downloadJsonBtn").addEventListener("click", () => {
    recalculateAndRender();
    downloadFile(JSON.stringify(lastSummary.data, null, 2), "ess_project.json", "application/json;charset=utf-8");
    setStatus("JSON сформовано.", "ok");
  });

  document.getElementById("uploadJsonInput").addEventListener("change", event => {
    handleJsonUpload(event.target.files[0]);
    event.target.value = "";
  });

  document.getElementById("downloadCsvBtn").addEventListener("click", () => {
    recalculateAndRender();
    const csv = "\ufeff" + buildCsv(lastSummary);
    downloadFile(csv, "ess_calculation.csv", "text/csv;charset=utf-8");
    setStatus("CSV сформовано.", "ok");
  });

  document.getElementById("sendToN8nBtn").addEventListener("click", sendToN8n);

  document.getElementById("printBtn").addEventListener("click", () => {
    recalculateAndRender();
    window.print();
  });
}

initStaticControls();
wireEvents();
fillFormFromState();
