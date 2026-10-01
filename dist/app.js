const invoke = window.__TAURI__.core.invoke;

const seenRawKeys = new Map();

function el(id) {
  return document.getElementById(id);
}

function fail(e) {
  const err = typeof e === "string" ? { kind: "internal", message: e } : e || {};
  const label = err.kind ? `[${err.kind}] ` : "";
  const detail = err.message || err.path || JSON.stringify(err);
  alert(`${label}${detail}`);
  console.error(e);
  return err;
}

async function call(cmd, args) {
  try {
    return await invoke(cmd, args);
  } catch (e) {
    throw fail(e);
  }
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

/* ---------------- state ---------------- */

const state = {
  dirs: null,
  providers: [],
  currentId: null,
  summaries: [],
  modelRefs: [],
  prompts: [],
};

/* ---------------- header ---------------- */

async function loadDirs() {
  state.dirs = await call("get_dirs");
  el("store-dir").textContent = state.dirs.store;
  el("store-dir").title = state.dirs.store;
  el("agent-dir").textContent = state.dirs.agent;
  el("agent-dir").title = state.dirs.agent;
  el("agent-source").textContent = state.dirs.agentSourceLabel || state.dirs.agentSource;
}

function initOpenStore() {
  el("open-store").addEventListener("click", async () => {
    if (!state.dirs) return;
    await call("open_in_file_manager", { path: state.dirs.store });
  });
}

/* ---------------- tabs ---------------- */

function initTabs() {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      for (const t of document.querySelectorAll(".tab")) t.classList.toggle("active", t === tab);
      for (const p of document.querySelectorAll(".panel"))
        p.classList.toggle("active", p.id === `panel-${tab.dataset.panel}`);
    });
  }
}

/* ---------------- models ---------------- */

const MODEL_COLS = [
  { key: "id", type: "text" },
  { key: "name", type: "text" },
  { key: "api", type: "text" },
  { key: "reasoning", type: "bool" },
  { key: "imageInput", type: "bool" },
  { key: "contextWindow", type: "num" },
  { key: "maxTokens", type: "num" },
];

function setStatus(id, text, cls) {
  const node = el(id);
  node.textContent = text || "";
  node.className = `status${cls ? ` ${cls}` : ""}`;
}

function renderProviderList() {
  const ul = el("provider-list");
  ul.innerHTML = "";
  for (const p of state.providers) {
    const li = document.createElement("li");
    const summary = state.summaries.find((s) => s.id === p.id);
    li.className = p.id === state.currentId ? "active" : "";
    li.innerHTML = `<span>${esc(p.id)}</span><span class="count">${summary ? summary.modelCount : p.models.length}</span>`;
    li.addEventListener("click", () => selectProvider(p.id));
    ul.appendChild(li);
  }
}

function blankModel() {
  return {
    id: "",
    name: null,
    api: null,
    reasoning: false,
    imageInput: false,
    contextWindow: null,
    maxTokens: null,
    raw: {},
  };
}

function blankProvider() {
  return {
    id: "",
    baseUrl: "",
    api: "",
    apiKey: "",
    authNone: false,
    disableStrictTools: false,
    models: [blankModel()],
    raw: {},
  };
}

function currentProvider() {
  return state.providers.find((p) => p.id === state.currentId) || null;
}

function renderModelRows(provider) {
  const tbody = el("model-rows");
  tbody.innerHTML = "";

  provider.models.forEach((model, index) => {
    const tr = document.createElement("tr");
    for (const col of MODEL_COLS) {
      const td = document.createElement("td");
      if (col.type === "bool") {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(model[col.key]);
        input.addEventListener("change", () => {
          model[col.key] = input.checked;
        });
        td.appendChild(input);
      } else {
        const input = document.createElement("input");
        input.type = col.type === "num" ? "number" : "text";
        input.value = model[col.key] ?? "";
        if (col.type === "num") input.min = "1";
        input.addEventListener("input", () => {
          const value = input.value.trim();
          if (col.type === "num") model[col.key] = value === "" ? null : Number(value);
          else model[col.key] = col.key === "id" ? value : value === "" ? null : value;
        });
        td.appendChild(input);
      }
      tr.appendChild(td);
    }
    const td = document.createElement("td");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn small";
    del.textContent = "×";
    del.addEventListener("click", () => {
      provider.models.splice(index, 1);
      renderModelRows(provider);
    });
    td.appendChild(del);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function fillForm(provider) {
  el("p-id").value = provider.id;
  el("p-id").disabled = false;
  el("p-baseurl").value = provider.baseUrl;
  el("p-api").value = provider.api || "";
  el("p-apikey").value = provider.apiKey;
  el("p-authnone").checked = provider.authNone;
  el("p-strict").checked = provider.disableStrictTools;
  setStatus("form-status", provider.id ? "" : "新 provider（尚未保存）");
  renderModelRows(provider);
}

function selectProvider(id) {
  seenRawKeys.clear();
  state.currentId = id;
  const provider = currentProvider();
  renderProviderList();
  if (provider) fillForm(provider);
}

function readForm() {
  const provider = currentProvider() || blankProvider();
  provider.id = el("p-id").value.trim();
  provider.baseUrl = el("p-baseurl").value.trim();
  provider.api = el("p-api").value;
  provider.apiKey = el("p-apikey").value;
  provider.authNone = el("p-authnone").checked;
  provider.disableStrictTools = el("p-strict").checked;
  return provider;
}

async function refreshProviders(keep) {
  state.providers = await call("list_providers");
  state.summaries = await call("list_provider_summaries");
  state.modelRefs = await call("list_model_refs");
  renderProviderList();
  if (keep && state.providers.some((p) => p.id === keep)) selectProvider(keep);
  else if (state.providers.length) selectProvider(state.providers[0].id);
  else selectProvider(null);
}

function initModels() {
  el("new-provider").addEventListener("click", () => {
    state.currentId = null;
    renderProviderList();
    fillForm(blankProvider());
    el("p-id").focus();
  });

  el("add-model").addEventListener("click", () => {
    const provider = currentProvider() || blankProvider();
    provider.models.push(blankModel());
    renderModelRows(provider);
  });

  el("probe").addEventListener("click", async () => {
    const provider = readForm();
    setStatus("form-status", "探测中…");
    try {
      const ids = await call("probe_models", {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        authNone: provider.authNone,
      });
      setStatus("form-status", `探测到 ${ids.length} 个模型`, "ok");
      const box = el("probe-result");
      box.innerHTML = "";
      for (const id of ids) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = id;
        chip.title = "点击添加";
        chip.addEventListener("click", () => {
          provider.models.push({ ...blankModel(), id });
          renderModelRows(provider);
        });
        box.appendChild(chip);
      }
    } catch {
      setStatus("form-status", "探测失败", "err");
    }
  });

  el("provider-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const provider = readForm();
    try {
      await call("upsert_provider", { provider });
      setStatus("form-status", "已保存", "ok");
      await refreshProviders(provider.id);
    } catch {
      setStatus("form-status", "保存失败", "err");
    }
  });

  el("delete-provider").addEventListener("click", async () => {
    const provider = currentProvider();
    if (!provider) return;
    if (!confirm(`删除 provider \`${provider.id}\`？`)) return;
    await call("delete_provider", { id: provider.id });
    await refreshProviders(null);
  });

  el("set-default").addEventListener("click", async () => {
    const provider = readForm();
    const first = provider.models.find((m) => m.id.trim());
    if (!first) {
      setStatus("form-status", "没有可用模型", "err");
      return;
    }
    await call("set_default_model", { selector: `${provider.id}/${first.id.trim()}` });
    setStatus("form-status", `默认模型 → ${provider.id}/${first.id.trim()}`, "ok");
  });
}

/* ---------------- prompts ---------------- */

function renderPrompts() {
  const box = el("prompt-cards");
  box.innerHTML = "";
  for (const p of state.prompts) {
    const card = document.createElement("div");
    card.className = "card";

    const switchWrap = document.createElement("label");
    switchWrap.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = p.enabled;
    input.addEventListener("change", async () => {
      input.disabled = true;
      try {
        if (input.checked && p.link === "unmanaged") {
          const ok = await askConfirm(
            `${p.agentPath} 当前已有内容，将把它收编进 ${p.storePath}，` +
              `原文件移动到 ~/.omp-ctl/backup/ 并改为符号链接。是否继续？`,
          );
          if (!ok) {
            input.checked = false;
            input.disabled = false;
            return;
          }
        }
        await call("set_prompt_enabled", { key: p.key, enabled: input.checked });
        await refreshPrompts();
      } catch {
        input.checked = p.enabled;
        input.disabled = false;
      }
    });
    const track = document.createElement("span");
    track.className = "track";
    switchWrap.append(input, track);

    const title = document.createElement("div");
    title.className = "title";
    title.innerHTML = `<strong>${esc(p.label)}</strong>
      <code>${esc(p.name)}</code>
      <span class="badge risk-${esc(p.risk)}">${esc(p.risk)}</span>
      <span class="badge">${esc(p.link)}</span>`;

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = p.description;

    const paths = document.createElement("div");
    paths.className = "paths";
    paths.innerHTML = `<code title="${esc(p.agentPath)}">agent: ${esc(p.agentPath)}</code>
      <code title="${esc(p.storePath)}">store: ${esc(p.storePath)}${p.storeExists ? "" : " (不存在)"}</code>`;

    const side = document.createElement("div");
    side.className = "side";
    const edit = document.createElement("button");
    edit.className = "btn small";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => openEditor(p));
    side.appendChild(edit);
    const restore = document.createElement("button");
    restore.className = "btn small";
    restore.textContent = "还原备份";
    restore.disabled = !p.hasBackup;
    restore.addEventListener("click", async () => {
      try {
        await call("restore_prompt_backup", { key: p.key });
        await refreshPrompts();
      } catch {}
    });
    side.appendChild(restore);

    card.append(switchWrap, title, desc, paths, side);
    box.appendChild(card);
  }
}

function openEditor(p) {
  el("editor-title").textContent = `${p.label} (${p.name})`;
  el("editor-path").textContent = p.storePath;
  setStatus("editor-status", "");
  el("editor").classList.remove("hidden");
  call("read_prompt", { key: p.key })
    .then((text) => {
      el("editor-text").value = text;
      el("editor-text").focus();
    })
    .catch(() => {
      el("editor-text").value = "";
    });
  el("editor-save").onclick = async () => {
    try {
      await call("write_prompt", { key: p.key, content: el("editor-text").value });
      setStatus("editor-status", "已保存", "ok");
      el("editor").classList.add("hidden");
      await refreshPrompts();
    } catch {
      setStatus("editor-status", "保存失败", "err");
    }
  };
  el("editor-cancel").onclick = () => el("editor").classList.add("hidden");
}

async function refreshPrompts() {
  state.prompts = await call("list_prompts");
  renderPrompts();
}

function askConfirm(text) {
  return new Promise((resolve) => {
    el("confirm-text").textContent = text;
    el("confirm").classList.remove("hidden");
    const done = (value) => {
      el("confirm").classList.add("hidden");
      el("confirm-ok").onclick = null;
      el("confirm-cancel").onclick = null;
      resolve(value);
    };
    el("confirm-ok").onclick = () => done(true);
    el("confirm-cancel").onclick = () => done(false);
  });
}

/* ---------------- boot ---------------- */

window.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initModels();
  initOpenStore();
  try {
    await loadDirs();
    await refreshProviders(null);
    await refreshPrompts();
  } catch (e) {
    console.error(e);
  }
});
