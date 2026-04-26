// ESS Calculator — static JavaScript version with logic synchronized from Python Tkinter v8.
// No Python server is required.

const CONTAINER_MODELS = ["LUNA2000-5015 Series"];
const PCS_MODELS = ["LUNA2000-213KTL-H0"];
const STS_MODELS = [
  "JUPITER-3000K-H1",
  "JUPITER-6000K-H1",
  "JUPITER-9000K-H1",
  "STS-3000K-H1",
  "STS-6000K-H1",
  "STS-9000K-H1",
  "Силова ТП власного виробництва",
];

const STS_MODEL_ALIASES = {
  "JUPITER 3000K-H1": "JUPITER-3000K-H1",
  "JUPITER 6000K-H1": "JUPITER-6000K-H1",
  "JUPITER 9000K-H1-1000": "JUPITER-9000K-H1",
  "JUPITER 9000K-H1": "JUPITER-9000K-H1",
  "STS 3000K-H1": "STS-3000K-H1",
  "STS 6000K-H1": "STS-6000K-H1",
  "STS 9000K-H1": "STS-9000K-H1",
};
const STS_VOLTAGES = ["10/0.8 кВ", "35/0.8 кВ"];
const DTS_OPTIONS = ["Не додавати", "DTS-200K-D0", "ТП власного виробництва"];
const CURRENCIES = ["USD", "EUR", "UAH"];
const LINE_TYPES = ["Повітряна лінія", "Кабельна лінія"];
const VOLTAGE_CLASSES = ["0.4 кВ", "6 кВ", "10 кВ", "20 кВ", "35 кВ", "110 кВ"];

const STORAGE_KEY = "ess_calculator_js_state_v2";
const LEGACY_STORAGE_KEY = "ess_calculator_js_state_v1";
const N8N_URL_KEY = "ess_calculator_n8n_url";
const N8N_SECRET_KEY = "ess_calculator_n8n_secret";

function defaultLinePrices() {
  return Object.fromEntries(
    LINE_TYPES.map(lineType => [
      lineType,
      Object.fromEntries(VOLTAGE_CLASSES.map(voltage => [voltage, 0])),
    ]),
  );
}

function defaultStsPrices() {
  return Object.fromEntries(
    STS_MODELS.map(model => [
      model,
      Object.fromEntries(STS_VOLTAGES.map(voltage => [voltage, 0])),
    ]),
  );
}

function normalizeStsModelName(model) {
  const value = String(model || "").trim();
  return STS_MODEL_ALIASES[value] || value;
}

function toInteger(value, fallback = 0) {
  return Math.round(toNumber(value, fallback));
}

const DEFAULT_DATA = {
  project: {
    project_name: "Новий кошторис ESS",
    currency: "USD",
    container_model: CONTAINER_MODELS[0],
    container_count: 1,
    pcs_model: PCS_MODELS[0],
    pcs_count: 1,
    include_sts: false,
    sts_model: STS_MODELS[0],
    sts_voltage: STS_VOLTAGES[0],
    sts_count: 1,
    dts_or_own_production: DTS_OPTIONS[0],
    include_saku: false,
    include_huawei_services: false,
    include_other: false,
    other_description: "",
    power_kw: 0,
    voltage_class: "10 кВ",
    include_askoe: false,
    include_ems: false,
    include_telemechanics: false,
    include_rza: false,
    line_type: "Повітряна лінія",
    line_length_m: 0,
    include_vop: false,
    include_recloser: false,
    notes: "",
  },
  connection: {
    connection_price_per_kw: 0,
    askoe_price: 0,
    ems_price: 0,
    telemechanics_price: 0,
    rza_price: 0,
    line_prices_by_voltage: defaultLinePrices(),
    vop_price: 0,
    recloser_price: 0,
  },
  price_settings: {
    container_prices: { [CONTAINER_MODELS[0]]: 0 },
    pcs_prices: { [PCS_MODELS[0]]: 0 },
    sts_prices: defaultStsPrices(),
    dts_or_own_production_price: 0,
    saku_price: 0,
    own_production_tp_price: 0,
    huawei_services_price: 0,
    other_price: 0,
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
      name: "Монтаж СТС",
      qty: 1,
      unit: "посл",
      price: 0,
      note: "На кожну СТС",
    },
    {
      name: "Підключення та кабельна обв'язка СТС",
      qty: 1,
      unit: "компл",
      price: 0,
      note: "На кожну СТС",
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
let isHydrating = false;

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

function fmtSimple(value) {
  const number = toNumber(value, 0);
  if (Number.isInteger(number)) return String(number);
  return String(Number(number.toFixed(2))).replace(".", ",");
}

function money(value, currency = state?.project?.currency || "USD") {
  return `${fmt(value)} ${currency}`;
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

function getElement(id) {
  return document.getElementById(id);
}

function loadInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!saved) return clone(DEFAULT_DATA);
    return normalizeData(JSON.parse(saved));
  } catch {
    return clone(DEFAULT_DATA);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeSpecList(value, defaultValue) {
  if (!Array.isArray(value)) return clone(defaultValue);
  return value.map(item => ({
    name: item?.name || "",
    qty: toInteger(item?.qty, 0),
    unit: item?.unit || "шт",
    price: toNumber(item?.price, 0),
    note: item?.note || "",
  }));
}

function normalizeData(raw) {
  const data = clone(DEFAULT_DATA);

  if (raw && typeof raw === "object") {
    for (const key of Object.keys(DEFAULT_DATA)) {
      if (raw[key] !== undefined) data[key] = raw[key];
    }
  }

  const rawProject = raw?.project || {};
  const rawConnection = raw?.connection || {};
  const rawPrices = raw?.price_settings || {};

  data.project = { ...clone(DEFAULT_DATA.project), ...(data.project || {}) };

  // Compatibility with the previous JS version.
  if (rawProject.include_smart_station && !rawProject.dts_or_own_production) {
    data.project.dts_or_own_production = "DTS-200K-D0";
  }
  if (rawProject.sts_count > 0 && rawProject.include_sts === undefined) {
    data.project.include_sts = true;
  }

  data.project.project_name = data.project.project_name || DEFAULT_DATA.project.project_name;
  data.project.currency = CURRENCIES.includes(data.project.currency) ? data.project.currency : DEFAULT_DATA.project.currency;
  data.project.container_model = CONTAINER_MODELS.includes(data.project.container_model) ? data.project.container_model : CONTAINER_MODELS[0];
  data.project.pcs_model = PCS_MODELS.includes(data.project.pcs_model) ? data.project.pcs_model : PCS_MODELS[0];
  data.project.sts_model = normalizeStsModelName(data.project.sts_model);
  data.project.sts_model = STS_MODELS.includes(data.project.sts_model) ? data.project.sts_model : STS_MODELS[0];
  data.project.sts_voltage = String(data.project.sts_voltage || STS_VOLTAGES[0]).replace("0,8", "0.8");
  data.project.sts_voltage = STS_VOLTAGES.includes(data.project.sts_voltage) ? data.project.sts_voltage : STS_VOLTAGES[0];
  data.project.dts_or_own_production = DTS_OPTIONS.includes(data.project.dts_or_own_production) ? data.project.dts_or_own_production : DTS_OPTIONS[0];
  data.project.voltage_class = VOLTAGE_CLASSES.includes(data.project.voltage_class) ? data.project.voltage_class : DEFAULT_DATA.project.voltage_class;
  data.project.line_type = LINE_TYPES.includes(data.project.line_type) ? data.project.line_type : DEFAULT_DATA.project.line_type;

  for (const key of ["container_count", "pcs_count", "sts_count", "power_kw", "line_length_m"]) {
    data.project[key] = toInteger(data.project[key], DEFAULT_DATA.project[key]);
  }
  for (const key of [
    "include_sts",
    "include_saku",
    "include_huawei_services",
    "include_other",
    "include_askoe",
    "include_ems",
    "include_telemechanics",
    "include_rza",
    "include_vop",
    "include_recloser",
  ]) {
    data.project[key] = Boolean(data.project[key]);
  }
  data.project.other_description = data.project.other_description || "";
  data.project.notes = data.project.notes || "";

  // Compatibility with older Python JSON where object parameters were stored in connection.
  for (const key of ["power_kw", "voltage_class", "include_askoe", "include_ems", "include_telemechanics", "include_rza", "line_type", "line_length_m", "include_vop", "include_recloser"]) {
    if (rawConnection[key] !== undefined && rawProject[key] === undefined) {
      data.project[key] = rawConnection[key];
    }
  }
  data.project.voltage_class = VOLTAGE_CLASSES.includes(data.project.voltage_class) ? data.project.voltage_class : DEFAULT_DATA.project.voltage_class;
  data.project.line_type = LINE_TYPES.includes(data.project.line_type) ? data.project.line_type : DEFAULT_DATA.project.line_type;

  data.connection = { ...clone(DEFAULT_DATA.connection), ...(data.connection || {}) };
  for (const key of ["connection_price_per_kw", "askoe_price", "ems_price", "telemechanics_price", "rza_price", "vop_price", "recloser_price"]) {
    data.connection[key] = toNumber(data.connection[key], 0);
  }

  const linePrices = defaultLinePrices();
  const incomingLinePrices = data.connection.line_prices_by_voltage || {};
  for (const lineType of LINE_TYPES) {
    for (const voltage of VOLTAGE_CLASSES) {
      linePrices[lineType][voltage] = toNumber(incomingLinePrices?.[lineType]?.[voltage], 0);
    }
  }

  if (rawConnection.line_price_per_m !== undefined) {
    linePrices[data.project.line_type][data.project.voltage_class] ||= toNumber(rawConnection.line_price_per_m, 0);
  }
  if (rawConnection.air_line_price_per_m !== undefined) {
    linePrices["Повітряна лінія"][data.project.voltage_class] ||= toNumber(rawConnection.air_line_price_per_m, 0);
  }
  if (rawConnection.cable_line_price_per_m !== undefined) {
    linePrices["Кабельна лінія"][data.project.voltage_class] ||= toNumber(rawConnection.cable_line_price_per_m, 0);
  }

  data.connection.line_prices_by_voltage = linePrices;

  data.price_settings = { ...clone(DEFAULT_DATA.price_settings), ...(data.price_settings || {}) };
  data.price_settings.container_prices = {
    [CONTAINER_MODELS[0]]: toNumber(data.price_settings.container_prices?.[CONTAINER_MODELS[0]], 0),
  };
  data.price_settings.pcs_prices = {
    [PCS_MODELS[0]]: toNumber(data.price_settings.pcs_prices?.[PCS_MODELS[0]], 0),
  };
  data.price_settings.sts_prices = defaultStsPrices();
  const normalizedRawStsPrices = {};
  for (const [rawModel, rawVoltagePrices] of Object.entries(rawPrices.sts_prices || {})) {
    const normalizedModel = normalizeStsModelName(rawModel);
    if (!STS_MODELS.includes(normalizedModel)) continue;
    normalizedRawStsPrices[normalizedModel] = {
      ...(normalizedRawStsPrices[normalizedModel] || {}),
      ...(rawVoltagePrices || {}),
    };
  }
  for (const model of STS_MODELS) {
    for (const voltage of STS_VOLTAGES) {
      data.price_settings.sts_prices[model][voltage] = toNumber(normalizedRawStsPrices[model]?.[voltage], 0);
    }
  }
  data.price_settings.dts_or_own_production_price = toNumber(
    data.price_settings.dts_or_own_production_price ?? rawPrices.smart_station_price,
    0,
  );
  data.price_settings.saku_price = toNumber(data.price_settings.saku_price, 0);
  data.price_settings.own_production_tp_price = toNumber(data.price_settings.own_production_tp_price, 0);
  data.price_settings.huawei_services_price = toNumber(data.price_settings.huawei_services_price, 0);
  data.price_settings.other_price = toNumber(data.price_settings.other_price, 0);

  data.container_spec = normalizeSpecList(data.container_spec, DEFAULT_DATA.container_spec);
  data.pcs_spec = normalizeSpecList(data.pcs_spec, DEFAULT_DATA.pcs_spec);
  data.sts_spec = normalizeSpecList(data.sts_spec, DEFAULT_DATA.sts_spec);
  data.common_spec = normalizeSpecList(data.common_spec, DEFAULT_DATA.common_spec);

  data.project.sts_voltage = mapConnectionVoltageToStsVoltage(data.project.voltage_class);

  return data;
}

function fillSelect(id, options) {
  const select = getElement(id);
  select.innerHTML = options.map(option => `<option>${escapeHtml(option)}</option>`).join("");
}

function initStaticControls() {
  fillSelect("container_model", CONTAINER_MODELS);
  fillSelect("pcs_model", PCS_MODELS);
  fillSelect("sts_model", STS_MODELS);
  fillSelect("sts_voltage", STS_VOLTAGES);
  fillSelect("dts_or_own_production", DTS_OPTIONS);
  fillSelect("connection_voltage_class", VOLTAGE_CLASSES);
  fillSelect("line_type", LINE_TYPES);

  const n8nUrl = localStorage.getItem(N8N_URL_KEY) || "";
  const n8nSecret = localStorage.getItem(N8N_SECRET_KEY) || "";
  getElement("n8nWebhookUrl").value = n8nUrl;
  getElement("n8nSecret").value = n8nSecret;
}

function fillFormFromState() {
  isHydrating = true;
  state = normalizeData(state);
  const p = state.project;
  const prices = state.price_settings;
  const connection = state.connection;

  getElement("project_name").value = p.project_name;
  getElement("currency").value = p.currency;
  getElement("container_model").value = p.container_model;
  getElement("container_count").value = p.container_count;
  getElement("pcs_model").value = p.pcs_model;
  getElement("pcs_count").value = p.pcs_count;
  getElement("include_sts").checked = p.include_sts;
  getElement("sts_model").value = p.sts_model;
  getElement("sts_voltage").value = p.sts_voltage;
  getElement("sts_count").value = p.sts_count;
  getElement("dts_or_own_production").value = p.dts_or_own_production;
  getElement("include_saku").checked = p.include_saku;
  getElement("include_huawei_services").checked = p.include_huawei_services;
  getElement("include_other").checked = p.include_other;
  getElement("other_description").value = p.other_description;
  getElement("connection_power").value = p.power_kw;
  getElement("connection_voltage_class").value = p.voltage_class;
  getElement("include_askoe").checked = p.include_askoe;
  getElement("include_ems").checked = p.include_ems;
  getElement("include_telemechanics").checked = p.include_telemechanics;
  getElement("include_rza").checked = p.include_rza;
  getElement("line_type").value = p.line_type;
  getElement("line_length").value = p.line_length_m;
  getElement("include_vop").checked = p.include_vop;
  getElement("include_recloser").checked = p.include_recloser;
  getElement("notes").value = p.notes;

  getElement("container_price").value = prices.container_prices[CONTAINER_MODELS[0]] ?? 0;
  getElement("pcs_price").value = prices.pcs_prices[PCS_MODELS[0]] ?? 0;
  getElement("dts_or_own_production_price").value = prices.dts_or_own_production_price ?? 0;
  getElement("saku_price").value = prices.saku_price ?? 0;
  getElement("own_production_tp_price").value = prices.own_production_tp_price ?? 0;
  getElement("huawei_services_price").value = prices.huawei_services_price ?? 0;
  getElement("other_price").value = prices.other_price ?? 0;

  getElement("connection_price_per_kw").value = connection.connection_price_per_kw ?? 0;
  getElement("askoe_price").value = connection.askoe_price ?? 0;
  getElement("ems_price").value = connection.ems_price ?? 0;
  getElement("telemechanics_price").value = connection.telemechanics_price ?? 0;
  getElement("rza_price").value = connection.rza_price ?? 0;
  getElement("vop_price").value = connection.vop_price ?? 0;
  getElement("recloser_price").value = connection.recloser_price ?? 0;

  renderStsPriceInputs();
  renderLinePriceInputs();
  renderSpecTables();
  isHydrating = false;
  recalculateAndRender();
}

function collectStateFromForm() {
  const p = state.project;

  p.project_name = getElement("project_name").value.trim() || DEFAULT_DATA.project.project_name;
  p.currency = getElement("currency").value || DEFAULT_DATA.project.currency;
  p.container_model = getElement("container_model").value || CONTAINER_MODELS[0];
  p.container_count = toInteger(getElement("container_count").value, 0);
  p.pcs_model = getElement("pcs_model").value || PCS_MODELS[0];
  p.pcs_count = toInteger(getElement("pcs_count").value, 0);
  p.include_sts = getElement("include_sts").checked;
  p.sts_model = getElement("sts_model").value || STS_MODELS[0];
  p.sts_voltage = getElement("sts_voltage").value || STS_VOLTAGES[0];
  p.sts_count = toInteger(getElement("sts_count").value, 0);
  p.dts_or_own_production = getElement("dts_or_own_production").value || DTS_OPTIONS[0];
  p.include_saku = getElement("include_saku").checked;
  p.include_huawei_services = getElement("include_huawei_services").checked;
  p.include_other = getElement("include_other").checked;
  p.other_description = getElement("other_description").value.trim();
  p.power_kw = toInteger(getElement("connection_power").value, 0);
  p.voltage_class = getElement("connection_voltage_class").value || DEFAULT_DATA.project.voltage_class;
  p.include_askoe = getElement("include_askoe").checked;
  p.include_ems = getElement("include_ems").checked;
  p.include_telemechanics = getElement("include_telemechanics").checked;
  p.include_rza = getElement("include_rza").checked;
  p.line_type = getElement("line_type").value || DEFAULT_DATA.project.line_type;
  p.line_length_m = toInteger(getElement("line_length").value, 0);
  p.include_vop = getElement("include_vop").checked;
  p.include_recloser = getElement("include_recloser").checked;
  p.notes = getElement("notes").value;

  state.price_settings.container_prices[CONTAINER_MODELS[0]] = toNumber(getElement("container_price").value, 0);
  state.price_settings.pcs_prices[PCS_MODELS[0]] = toNumber(getElement("pcs_price").value, 0);
  state.price_settings.dts_or_own_production_price = toNumber(getElement("dts_or_own_production_price").value, 0);
  state.price_settings.saku_price = toNumber(getElement("saku_price").value, 0);
  state.price_settings.own_production_tp_price = toNumber(getElement("own_production_tp_price").value, 0);
  state.price_settings.huawei_services_price = toNumber(getElement("huawei_services_price").value, 0);
  state.price_settings.other_price = toNumber(getElement("other_price").value, 0);

  for (const model of STS_MODELS) {
    for (const voltage of STS_VOLTAGES) {
      const input = getElement(makeSafeId("sts", model, voltage));
      state.price_settings.sts_prices[model][voltage] = toNumber(input?.value, 0);
    }
  }

  state.connection.connection_price_per_kw = toNumber(getElement("connection_price_per_kw").value, 0);
  state.connection.askoe_price = toNumber(getElement("askoe_price").value, 0);
  state.connection.ems_price = toNumber(getElement("ems_price").value, 0);
  state.connection.telemechanics_price = toNumber(getElement("telemechanics_price").value, 0);
  state.connection.rza_price = toNumber(getElement("rza_price").value, 0);
  state.connection.vop_price = toNumber(getElement("vop_price").value, 0);
  state.connection.recloser_price = toNumber(getElement("recloser_price").value, 0);

  for (const lineType of LINE_TYPES) {
    for (const voltage of VOLTAGE_CLASSES) {
      const input = getElement(makeSafeId("line", lineType, voltage));
      state.connection.line_prices_by_voltage[lineType][voltage] = toNumber(input?.value, 0);
    }
  }

  for (const key of ["container_spec", "pcs_spec", "sts_spec", "common_spec"]) {
    state[key] = [...document.querySelectorAll(`#${key} tr`)].map(row => ({
      name: row.querySelector("[data-field='name']").value.trim(),
      qty: toInteger(row.querySelector("[data-field='qty']").value, 0),
      unit: row.querySelector("[data-field='unit']").value.trim() || "шт",
      price: toNumber(row.querySelector("[data-field='price']").value, 0),
      note: row.querySelector("[data-field='note']").value.trim(),
    }));
  }

  saveState();
}

function mapConnectionVoltageToStsVoltage(voltageClass) {
  const value = String(voltageClass || "").trim();
  if (value === "35 кВ" || value === "110 кВ") return "35/0.8 кВ";
  return "10/0.8 кВ";
}

function syncVoltageDependentFields() {
  const voltageClass = getElement("connection_voltage_class").value || DEFAULT_DATA.project.voltage_class;
  getElement("sts_voltage").value = mapConnectionVoltageToStsVoltage(voltageClass);
  updateSelectedLinePrice();
}

function getSelectedLinePrice() {
  const lineType = getElement("line_type").value || DEFAULT_DATA.project.line_type;
  const voltageClass = getElement("connection_voltage_class").value || DEFAULT_DATA.project.voltage_class;
  const input = getElement(makeSafeId("line", lineType, voltageClass));
  return toNumber(input?.value, 0);
}

function updateSelectedLinePrice() {
  const currency = getElement("currency")?.value || state.project.currency || "USD";
  getElement("selected_line_price").value = money(getSelectedLinePrice(), currency);
}

function renderStsPriceInputs() {
  const body = getElement("stsPricesBody");
  body.innerHTML = "";

  for (const model of STS_MODELS) {
    const row = document.createElement("tr");
    const cells = [`<td>${escapeHtml(model)}</td>`];

    for (const voltage of STS_VOLTAGES) {
      const id = makeSafeId("sts", model, voltage);
      const value = state.price_settings.sts_prices[model]?.[voltage] ?? 0;
      cells.push(`<td><input id="${id}" type="number" min="0" step="0.01" value="${value}"></td>`);
    }

    row.innerHTML = cells.join("");
    body.appendChild(row);
  }
}

function renderLinePriceInputs() {
  const body = getElement("linePricesBody");
  body.innerHTML = "";

  for (const voltage of VOLTAGE_CLASSES) {
    const row = document.createElement("tr");
    const cells = [`<td>${escapeHtml(voltage)}</td>`];

    for (const lineType of LINE_TYPES) {
      const id = makeSafeId("line", lineType, voltage);
      const value = state.connection.line_prices_by_voltage?.[lineType]?.[voltage] ?? 0;
      cells.push(`<td><input id="${id}" type="number" min="0" step="0.01" value="${value}"></td>`);
    }

    row.innerHTML = cells.join("");
    body.appendChild(row);
  }
}

function renderSpecTables() {
  for (const key of ["container_spec", "pcs_spec", "sts_spec", "common_spec"]) {
    const body = getElement(key);
    body.innerHTML = "";
    for (const item of state[key]) {
      appendSpecRow(key, item, false);
    }
  }
}

function appendSpecRow(key, item = { name: "", qty: 1, unit: "шт", price: 0, note: "" }, shouldRecalculate = true) {
  const body = getElement(key);
  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input data-field="name" value="${escapeHtml(item.name)}"></td>
    <td><input data-field="qty" type="number" min="0" step="1" value="${toInteger(item.qty, 1)}"></td>
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

function summaryRow(section, name, baseQty, multiplier, unit, price, note = "") {
  const finalQty = toNumber(baseQty, 0) * toNumber(multiplier, 0);
  const total = finalQty * toNumber(price, 0);

  return {
    section,
    name,
    base_qty: toNumber(baseQty, 0),
    multiplier: toNumber(multiplier, 0),
    final_qty: finalQty,
    unit,
    price: toNumber(price, 0),
    total,
    note,
  };
}

function calculateEquipmentRows(data) {
  const project = data.project;
  const prices = data.price_settings;
  const rows = [];
  let total = 0;

  const containerPrice = toNumber(prices.container_prices[project.container_model], 0);
  const containerRow = summaryRow("Обладнання", project.container_model, 1, project.container_count, "шт", containerPrice, "Базова ціна контейнера ESS");
  rows.push(containerRow);
  total += containerRow.total;

  const pcsPrice = toNumber(prices.pcs_prices[project.pcs_model], 0);
  const pcsRow = summaryRow("Обладнання", project.pcs_model, 1, project.pcs_count, "шт", pcsPrice, "Базова ціна PCS");
  rows.push(pcsRow);
  total += pcsRow.total;

  if (project.include_sts && toNumber(project.sts_count, 0) > 0) {
    const stsPrice = toNumber(prices.sts_prices[project.sts_model]?.[project.sts_voltage], 0);
    const stsRow = summaryRow(
      "Обладнання",
      `${project.sts_model} (${project.sts_voltage})`,
      1,
      project.sts_count,
      "шт",
      stsPrice,
      "Додано через параметри проєкту",
    );
    rows.push(stsRow);
    total += stsRow.total;
  }

  if (project.dts_or_own_production !== "Не додавати") {
    const dtsRow = summaryRow(
      "Обладнання",
      project.dts_or_own_production,
      1,
      1,
      "компл",
      prices.dts_or_own_production_price,
      "Разова позиція",
    );
    rows.push(dtsRow);
    total += dtsRow.total;
  }

  if (project.include_saku) {
    const row = summaryRow("Обладнання", "SACU2000", 1, 1, "компл", prices.saku_price, "Разова позиція");
    rows.push(row);
    total += row.total;
  }

  if (project.include_huawei_services) {
    const row = summaryRow("Обладнання", "Сервіси Huawei", 1, 1, "посл", prices.huawei_services_price, "Разова позиція");
    rows.push(row);
    total += row.total;
  }

  if (project.include_other) {
    const otherName = project.other_description || "Інше";
    const row = summaryRow("Обладнання", otherName, 1, 1, "посл", prices.other_price, "Разова позиція");
    rows.push(row);
    total += row.total;
  }

  return { rows, total };
}

function calculateSection(data, key, multiplier, sectionName) {
  const rows = [];
  let sectionTotal = 0;

  for (const item of data[key] || []) {
    const row = summaryRow(sectionName, item.name || "", item.qty, multiplier, item.unit || "", item.price, item.note || "");
    sectionTotal += row.total;
    rows.push(row);
  }

  return { rows, total: sectionTotal };
}

function calculateConnectionRows(data) {
  const project = data.project;
  const connection = data.connection;
  const rows = [];
  let total = 0;

  if (toNumber(project.power_kw, 0) > 0 && toNumber(connection.connection_price_per_kw, 0) > 0) {
    const row = summaryRow(
      "Приєднання",
      `Приєднання ${project.voltage_class}`,
      project.power_kw,
      1,
      "кВт",
      connection.connection_price_per_kw,
      "Розрахунок за 1 кВт",
    );
    rows.push(row);
    total += row.total;
  }

  const linePrice = toNumber(connection.line_prices_by_voltage?.[project.line_type]?.[project.voltage_class], 0);
  if (toNumber(project.line_length_m, 0) > 0 && linePrice > 0) {
    const row = summaryRow(
      "Приєднання",
      `${project.line_type} (${project.voltage_class})`,
      project.line_length_m,
      1,
      "м.п.",
      linePrice,
      `Потужність приєднання: ${fmtSimple(project.power_kw)} кВт`,
    );
    rows.push(row);
    total += row.total;
  }

  const optionalRows = [
    [project.include_askoe, "Комплекс АСКОЕ", connection.askoe_price],
    [project.include_ems, "Комплекс ЕМС", connection.ems_price],
    [project.include_telemechanics, "Комплекс телемеханіки", connection.telemechanics_price],
    [project.include_rza, "Комплекс РЗА", connection.rza_price],
    [project.include_vop, "ВОП", connection.vop_price],
    [project.include_recloser, "Реклозер", connection.recloser_price],
  ];

  for (const [enabled, name, price] of optionalRows) {
    if (enabled) {
      const row = summaryRow("Приєднання", name, 1, 1, "компл", price, "Разова позиція");
      rows.push(row);
      total += row.total;
    }
  }

  return { rows, total };
}

function calculateSummary(data) {
  const normalized = normalizeData(data);
  const project = normalized.project;

  const equipment = calculateEquipmentRows(normalized);
  const container = calculateSection(normalized, "container_spec", project.container_count, "Контейнер");
  const pcs = calculateSection(normalized, "pcs_spec", project.pcs_count, "PCS");
  const stsMultiplier = project.include_sts ? project.sts_count : 0;
  const sts = calculateSection(normalized, "sts_spec", stsMultiplier, "СТС");
  const common = calculateSection(normalized, "common_spec", 1, "Загальні");
  const connection = calculateConnectionRows(normalized);

  const rows = [
    ...equipment.rows,
    ...container.rows,
    ...pcs.rows,
    ...sts.rows,
    ...common.rows,
    ...connection.rows,
  ];

  const totals = {
    equipment: equipment.total,
    container: container.total,
    pcs: pcs.total,
    sts: sts.total,
    common: common.total,
    connection: connection.total,
    project: equipment.total + container.total + pcs.total + sts.total + common.total + connection.total,
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
  if (isHydrating) return;
  syncVoltageDependentFields();
  collectStateFromForm();
  lastSummary = calculateSummary(state);
  state = lastSummary.data;
  updateSelectedLinePrice();
  renderSummary(lastSummary);
  renderReport(lastSummary);
}

function renderSummary(summary) {
  const c = summary.currency;
  const t = summary.totals;

  getElement("totalProjectTop").textContent = `${fmt(t.project)} ${c}`;
  getElement("totalEquipment").textContent = `${fmt(t.equipment)} ${c}`;
  getElement("totalContainer").textContent = `${fmt(t.container)} ${c}`;
  getElement("totalPcs").textContent = `${fmt(t.pcs)} ${c}`;
  getElement("totalSts").textContent = `${fmt(t.sts)} ${c}`;
  getElement("totalCommon").textContent = `${fmt(t.common)} ${c}`;
  getElement("totalConnection").textContent = `${fmt(t.connection)} ${c}`;
  getElement("totalProjectSummary").textContent = `${fmt(t.project)} ${c}`;

  const body = getElement("summaryBody");
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

function buildReportRows(summary) {
  const data = summary.data;
  const project = data.project;
  const connection = data.connection;
  const rows = [];

  const addItem = (name, qty, price, total, comment = "", highlight = false) => {
    rows.push({
      type: "item",
      name,
      qty: toNumber(qty, 0),
      price: toNumber(price, 0),
      total: toNumber(total, 0),
      comment,
      highlight,
    });
  };

  const addSection = (name, total) => {
    rows.push({
      type: "section",
      name,
      qty: "",
      price: "",
      total: toNumber(total, 0),
      comment: "",
      highlight: false,
    });
  };

  const linePricePerMeter = toNumber(connection.line_prices_by_voltage?.[project.line_type]?.[project.voltage_class], 0);
  const lineLength = toNumber(project.line_length_m, 0);

  addItem(
    "Плата за потужність (за 1 кВт)",
    project.power_kw,
    connection.connection_price_per_kw,
    toNumber(project.power_kw, 0) * toNumber(connection.connection_price_per_kw, 0),
    "Може змінюватись ставка залежно від специфіки приєднання",
  );

  addItem(
    `Лінійна частина (за 100 м) — ${project.line_type} ${project.voltage_class}`,
    lineLength / 100,
    linePricePerMeter * 100,
    lineLength * linePricePerMeter,
    "Може змінюватись ставка залежно від специфіки приєднання",
  );

  const connectionOptions = [
    [project.include_askoe, "Комплекс АСКОЕ", connection.askoe_price],
    [project.include_ems, "Комплекс ЕМС", connection.ems_price],
    [project.include_telemechanics, "Комплекс телемеханіки", connection.telemechanics_price],
    [project.include_rza, "Комплекс РЗА", connection.rza_price],
    [project.include_vop, "ВОП", connection.vop_price],
    [project.include_recloser, "Реклозер", connection.recloser_price],
  ];

  for (const [enabled, name, price] of connectionOptions) {
    if (enabled) {
      addItem(name, 1, price, toNumber(price, 0), "Разова позиція по приєднанню", true);
    }
  }

  const addSummarySection = (title, sourceSection, total) => {
    const sectionRows = summary.rows.filter(row => row.section === sourceSection);
    if (sectionRows.length === 0 && !total) return;
    addSection(title, total);
    for (const row of sectionRows) {
      addItem(
        row.name,
        row.final_qty,
        row.price,
        row.total,
        row.note,
        sourceSection === "Загальні",
      );
    }
  };

  addSummarySection("Основне обладнання", "Обладнання", summary.totals.equipment);
  addSummarySection("Специфікація контейнера ESS", "Контейнер", summary.totals.container);
  addSummarySection("Специфікація PCS", "PCS", summary.totals.pcs);
  addSummarySection("Специфікація силової ТП / СТС", "СТС", summary.totals.sts);
  addSummarySection("Загальні витрати", "Загальні", summary.totals.common);

  rows.push({
    type: "total",
    name: "Загальна вартість без ПДВ",
    qty: "",
    price: "",
    total: summary.totals.project,
    comment: summary.currency,
    highlight: false,
  });

  return rows;
}

function renderReport(summary) {
  const body = getElement("reportBody");
  if (!body) return;

  const rows = buildReportRows(summary);
  body.innerHTML = "";
  let number = 1;

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.classList.toggle("report-section-row", row.type === "section");
    tr.classList.toggle("report-total-row", row.type === "total");
    tr.classList.toggle("report-highlight-row", Boolean(row.highlight));

    if (row.type === "item") {
      tr.innerHTML = `
        <td>${number}</td>
        <td>${escapeHtml(row.name)}</td>
        <td class="num-cell qty-cell">${fmt(row.qty)}</td>
        <td class="num-cell price-cell">${fmt(row.price)}</td>
        <td class="num-cell"><strong>${fmt(row.total)}</strong></td>
        <td>${escapeHtml(row.comment)}</td>
      `;
      number += 1;
    } else {
      tr.innerHTML = `
        <td></td>
        <td>${escapeHtml(row.name)}</td>
        <td></td>
        <td></td>
        <td class="num-cell"><strong>${fmt(row.total)}</strong></td>
        <td>${escapeHtml(row.comment)}</td>
      `;
    }

    body.appendChild(tr);
  }
}

function buildReportExcel(summary) {
  const rows = buildReportRows(summary);
  let number = 1;

  const tableRows = rows.map(row => {
    const rowClass = row.type === "section" ? "section" : row.type === "total" ? "total" : row.highlight ? "highlight" : "";
    const no = row.type === "item" ? number++ : "";
    const qty = row.type === "item" ? fmt(row.qty) : "";
    const price = row.type === "item" ? fmt(row.price) : "";
    const total = fmt(row.total);

    return `
      <tr class="${rowClass}">
        <td>${no}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${qty}</td>
        <td>${price}</td>
        <td>${total}</td>
        <td>${escapeHtml(row.comment)}</td>
      </tr>`;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
    th { font-weight: 700; text-align: center; background: #ffffff; }
    td:nth-child(1) { text-align: center; width: 45px; }
    td:nth-child(2) { width: 420px; text-align: center; }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; width: 130px; }
    td:nth-child(6) { width: 330px; }
    .section td { background: #19aee3; font-weight: 700; }
    .highlight td:nth-child(3), .highlight td:nth-child(4) { background: #ffff00; }
    .total td { font-weight: 700; background: #d9ead3; }
  </style>
</head>
<body>
  <h2>${escapeHtml(summary.data.project.project_name)}</h2>
  <table>
    <thead>
      <tr>
        <th>№</th>
        <th>Найменування</th>
        <th>Кі-сть</th>
        <th>Вартість без ПДВ</th>
        <th>Сума без ПДВ</th>
        <th>Коментарі</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
}

function downloadReportExcel() {
  recalculateAndRender();
  const html = "\ufeff" + buildReportExcel(lastSummary);
  downloadFile(html, "ess_report.xls", "application/vnd.ms-excel;charset=utf-8");
  setStatus("Excel-звіт сформовано.", "ok");
}

function buildCsv(summary) {
  const project = summary.data.project;
  const c = summary.currency;
  const rows = [];

  rows.push(["Назва проєкту", project.project_name]);
  rows.push(["Валюта", project.currency]);
  rows.push(["Контейнер", project.container_model]);
  rows.push(["Кількість контейнерів", project.container_count]);
  rows.push(["PCS", project.pcs_model]);
  rows.push(["Кількість PCS", project.pcs_count]);
  rows.push(["Додати СТС", project.include_sts ? "Так" : "Ні"]);
  rows.push(["СТС", project.sts_model]);
  rows.push(["Напруга СТС", project.sts_voltage]);
  rows.push(["Кількість СТС", project.sts_count]);
  rows.push(["ТП для власних потреб / DTS", project.dts_or_own_production]);
  rows.push(["Потужність приєднання, кВт", project.power_kw]);
  rows.push(["Клас напруги приєднання", project.voltage_class]);
  rows.push(["Тип лінії", project.line_type]);
  rows.push(["Довжина лінії, м.п.", project.line_length_m]);
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
  rows.push(["Додатково по СТС", summary.totals.sts, c]);
  rows.push(["Загальні витрати", summary.totals.common, c]);
  rows.push(["Приєднання", summary.totals.connection, c]);
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
  const box = getElement("statusBox");
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

  const webhookUrl = getElement("n8nWebhookUrl").value.trim();
  const secret = getElement("n8nSecret").value.trim();

  localStorage.setItem(N8N_URL_KEY, webhookUrl);
  localStorage.setItem(N8N_SECRET_KEY, secret);

  if (!webhookUrl) {
    setStatus("Вкажи n8n Webhook URL.", "error");
    return;
  }

  const payload = {
    source: "ess_calculator_js",
    version: "python_v8_logic_port",
    secret: secret || null,
    project: lastSummary.data.project,
    connection: lastSummary.data.connection,
    price_settings: lastSummary.data.price_settings,
    container_spec: lastSummary.data.container_spec,
    pcs_spec: lastSummary.data.pcs_spec,
    sts_spec: lastSummary.data.sts_spec,
    common_spec: lastSummary.data.common_spec,
    rows: lastSummary.rows,
    report_rows: buildReportRows(lastSummary),
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
      getElement(button.dataset.tab).classList.add("active");
    });
  });

  const handleFormChange = event => {
    if (!event.target.matches("input, select, textarea")) return;
    if (event.target.id === "uploadJsonInput") return;
    recalculateAndRender();
  };

  document.body.addEventListener("input", handleFormChange);
  document.body.addEventListener("change", handleFormChange);

  getElement("connection_voltage_class").addEventListener("change", () => {
    syncVoltageDependentFields();
    recalculateAndRender();
  });
  getElement("line_type").addEventListener("change", () => {
    updateSelectedLinePrice();
    recalculateAndRender();
  });

  document.querySelectorAll("[data-add-section]").forEach(button => {
    button.addEventListener("click", () => {
      appendSpecRow(button.dataset.addSection);
    });
  });

  getElement("resetProjectBtn").addEventListener("click", () => {
    const ok = confirm("Скинути всі дані до стартового шаблону?");
    if (!ok) return;
    state = clone(DEFAULT_DATA);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    saveState();
    fillFormFromState();
    setStatus("Дані скинуто до шаблону.", "ok");
  });

  getElement("downloadJsonBtn").addEventListener("click", () => {
    recalculateAndRender();
    downloadFile(JSON.stringify(lastSummary.data, null, 2), "ess_project.json", "application/json;charset=utf-8");
    setStatus("JSON сформовано.", "ok");
  });

  getElement("uploadJsonInput").addEventListener("change", event => {
    handleJsonUpload(event.target.files[0]);
    event.target.value = "";
  });

  getElement("downloadCsvBtn").addEventListener("click", () => {
    recalculateAndRender();
    const csv = "\ufeff" + buildCsv(lastSummary);
    downloadFile(csv, "ess_calculation.csv", "text/csv;charset=utf-8");
    setStatus("CSV сформовано.", "ok");
  });

  getElement("downloadReportBtn").addEventListener("click", downloadReportExcel);
  getElement("downloadReportBtnFiles").addEventListener("click", downloadReportExcel);

  getElement("sendToN8nBtn").addEventListener("click", sendToN8n);

  getElement("printBtn").addEventListener("click", () => {
    recalculateAndRender();
    window.print();
  });
}

initStaticControls();
wireEvents();
fillFormFromState();
