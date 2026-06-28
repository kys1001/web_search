"use strict";

const API_KEY_STORAGE_KEY = "openai_web_research_api_key";

const state = {
  config: null,
  result: null,
  activeTab: "summary"
};

const els = {
  apiStatus: document.querySelector("#apiStatus"),
  form: document.querySelector("#searchForm"),
  keyword: document.querySelector("#keyword"),
  apiKey: document.querySelector("#apiKey"),
  rememberApiKey: document.querySelector("#rememberApiKey"),
  apiType: document.querySelector("#apiType"),
  apiTypeHint: document.querySelector("#apiTypeHint"),
  model: document.querySelector("#model"),
  materialTypes: document.querySelector("#materialTypes"),
  recency: document.querySelector("#recency"),
  externalWebAccess: document.querySelector("#externalWebAccess"),
  includeImages: document.querySelector("#includeImages"),
  returnUnlimited: document.querySelector("#returnUnlimited"),
  useLocation: document.querySelector("#useLocation"),
  contextSize: document.querySelector("#contextSize"),
  reasoningEffort: document.querySelector("#reasoningEffort"),
  maxImageResults: document.querySelector("#maxImageResults"),
  allowedDomains: document.querySelector("#allowedDomains"),
  blockedDomains: document.querySelector("#blockedDomains"),
  country: document.querySelector("#country"),
  city: document.querySelector("#city"),
  region: document.querySelector("#region"),
  timezone: document.querySelector("#timezone"),
  memo: document.querySelector("#memo"),
  resetButton: document.querySelector("#resetButton"),
  notice: document.querySelector("#notice"),
  resultTitle: document.querySelector("#resultTitle"),
  tabs: document.querySelectorAll(".tab"),
  panels: {
    summary: document.querySelector("#summaryTab"),
    materials: document.querySelector("#materialsTab"),
    timeline: document.querySelector("#timelineTab"),
    sources: document.querySelector("#sourcesTab"),
    raw: document.querySelector("#rawTab")
  },
  copyMarkdown: document.querySelector("#copyMarkdown"),
  downloadJson: document.querySelector("#downloadJson")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function linkHtml(url, label) {
  if (!url || url === "unknown") return escapeHtml(label || "unknown");
  const safeUrl = escapeHtml(url);
  return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${escapeHtml(label || url)}</a>`;
}

function setNotice(message, type = "") {
  els.notice.className = `notice ${type}`.trim();
  els.notice.innerHTML = message;
}

function setLoading(isLoading) {
  const button = els.form.querySelector(".primary-action");
  button.disabled = isLoading;
  button.innerHTML = isLoading ? `<span class="spinner"></span>검색 중` : "자료 긁어오기";
}

function renderMaterialTypes() {
  els.materialTypes.innerHTML = state.config.materialTypes
    .map((type) => {
      const checked = type.checked ? "checked" : "";
      return `
        <label class="check-row">
          <input type="checkbox" name="materialType" value="${escapeHtml(type.id)}" ${checked}>
          <span>
            ${escapeHtml(type.label)}
            <small>${escapeHtml(type.description)}</small>
          </span>
        </label>
      `;
    })
    .join("");
}

function renderApiTypes() {
  const apiTypes = state.config.openAiApiTypes || [];
  els.apiType.innerHTML = apiTypes
    .map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>`)
    .join("");
}

function getSelectedApiType() {
  const apiTypes = state.config?.openAiApiTypes || [];
  return apiTypes.find((type) => type.id === els.apiType.value) || apiTypes[0] || null;
}

function setControlDisabled(control, disabled) {
  if (!control) return;
  control.disabled = disabled;
  control.closest("label")?.classList.toggle("is-disabled", disabled);
}

function syncApiTypeControls(resetModel = false) {
  const apiType = getSelectedApiType();
  if (!apiType) return;

  const isResponsesApi = apiType.id === "responses_web_search";
  if (resetModel || !els.model.value.trim()) {
    els.model.value = apiType.defaultModel || state.config.defaultModel || "gpt-5.5";
  }

  els.apiTypeHint.textContent = apiType.description || "";
  setControlDisabled(els.externalWebAccess, !isResponsesApi);
  setControlDisabled(els.includeImages, !isResponsesApi);
  setControlDisabled(els.returnUnlimited, !isResponsesApi);
  setControlDisabled(els.contextSize, !isResponsesApi);
  setControlDisabled(els.reasoningEffort, !isResponsesApi);
  setControlDisabled(els.maxImageResults, !isResponsesApi);
  setControlDisabled(els.allowedDomains, !isResponsesApi);
  setControlDisabled(els.blockedDomains, !isResponsesApi);

  if (!isResponsesApi) {
    els.externalWebAccess.checked = true;
    els.includeImages.checked = false;
    els.returnUnlimited.checked = false;
  }
}

function hasUiApiKey() {
  return Boolean(els.apiKey.value.trim());
}

function updateApiStatus() {
  const isReady = Boolean(state.config?.hasApiKey) || hasUiApiKey();
  els.apiStatus.classList.toggle("ready", isReady);
  els.apiStatus.classList.toggle("missing", !isReady);

  if (state.config?.hasApiKey) {
    els.apiStatus.textContent = "환경변수 키 연결됨";
  } else if (hasUiApiKey()) {
    els.apiStatus.textContent = "UI 키 준비됨";
  } else {
    els.apiStatus.textContent = "API 키 필요";
  }
}

function persistApiKeyPreference() {
  if (els.rememberApiKey.checked && hasUiApiKey()) {
    sessionStorage.setItem(API_KEY_STORAGE_KEY, els.apiKey.value.trim());
  } else {
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
  }
}

async function loadConfig() {
  const response = await fetch("/api/config");
  state.config = await response.json();
  renderApiTypes();
  els.apiType.value = state.config.defaultApiType || "responses_web_search";
  syncApiTypeControls(true);
  const savedApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
  if (savedApiKey) {
    els.apiKey.value = savedApiKey;
    els.rememberApiKey.checked = true;
  }
  updateApiStatus();
  renderMaterialTypes();
  syncApiTypeControls();
}

function selectedMaterialTypes() {
  return Array.from(document.querySelectorAll("input[name='materialType']:checked")).map((input) => input.value);
}

function buildRequestBody() {
  return {
    keyword: els.keyword.value,
    apiKey: els.apiKey.value.trim(),
    apiType: els.apiType.value,
    model: els.model.value,
    materialTypes: selectedMaterialTypes(),
    recency: els.recency.value,
    externalWebAccess: els.externalWebAccess.checked,
    includeImages: els.includeImages.checked,
    returnTokenBudget: els.returnUnlimited.checked ? "unlimited" : "default",
    useLocation: els.useLocation.checked,
    contextSize: els.contextSize.value,
    reasoningEffort: els.reasoningEffort.value,
    maxImageResults: els.maxImageResults.value,
    allowedDomains: els.allowedDomains.value,
    blockedDomains: els.blockedDomains.value,
    country: els.country.value,
    city: els.city.value,
    region: els.region.value,
    timezone: els.timezone.value,
    memo: els.memo.value,
    language: "ko"
  };
}

async function runSearch(event) {
  event.preventDefault();

  if (!state.config?.hasApiKey && !hasUiApiKey()) {
    setNotice("API 키를 입력하세요.", "error");
    els.resultTitle.textContent = "대기 중";
    return;
  }

  persistApiKeyPreference();
  setLoading(true);
  setNotice(`<span class="spinner"></span>웹서치 API로 최신 자료를 찾고 있습니다.`, "");
  els.resultTitle.textContent = "검색 중";

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody())
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "검색 실패");
    state.result = data;
    renderResult();
    setNotice("검색과 정리가 완료되었습니다.", "ready");
  } catch (error) {
    setNotice(escapeHtml(error.message), "error");
    els.resultTitle.textContent = "오류";
  } finally {
    setLoading(false);
  }
}

function renderEmpty() {
  Object.values(els.panels).forEach((panel) => {
    panel.innerHTML = `<div class="empty-state">아직 결과가 없습니다.</div>`;
  });
}

function normalizedSourceDossiers(data, result) {
  if (data?.sourceDossiers?.length) return data.sourceDossiers;

  const materialSources = (data?.materials || [])
    .filter((item) => item.url)
    .map((item, index) => ({
      referenceId: `[${index + 1}]`,
      sourceType: item.type || "source",
      title: item.title || item.url,
      authors: "unknown",
      publisher: item.publisher || "unknown",
      publishedAt: item.publishedAt || "unknown",
      url: item.url,
      originalExcerpt: "검색 결과에서 직접 인용 가능한 짧은 원문 발췌가 없습니다.",
      sourceSummary: item.summary || "",
      evidenceNotes: item.keyPoints || [],
      usedFor: [item.whyUseful || "자료 근거"],
      accessNote: "웹서치 결과와 URL citation 기준으로 정리했습니다."
    }));

  if (materialSources.length) return materialSources;

  return (result?.citations || []).map((source, index) => ({
    referenceId: `[${index + 1}]`,
    sourceType: source.source || "citation",
    title: source.title || source.url,
    authors: "unknown",
    publisher: "unknown",
    publishedAt: "unknown",
    url: source.url,
    originalExcerpt: "검색 결과에서 직접 인용 가능한 짧은 원문 발췌가 없습니다.",
    sourceSummary: "모델 응답에 구조화된 원문 정리가 없어 URL citation 기준으로 보강했습니다.",
    evidenceNotes: ["URL citation으로 확인된 출처입니다."],
    usedFor: ["출처 확인"],
    accessNote: "URL citation 기준으로 표시했습니다."
  }));
}

function normalizedReferences(data, result, dossiers) {
  if (data?.references?.length) return data.references;

  return (dossiers?.length ? dossiers : normalizedSourceDossiers(data, result)).map((source, index) => ({
    referenceId: source.referenceId || `[${index + 1}]`,
    citation: `${source.authors || "Unknown"}. ${source.publishedAt || "unknown"}. ${source.title || "Untitled"}. ${source.publisher || "unknown"}.`,
    url: source.url || ""
  }));
}

function renderSourceDossierCards(dossiers) {
  return (dossiers || [])
    .map((source) => `
      <article class="material-item">
        <h3>${escapeHtml(source.referenceId)} ${linkHtml(source.url, source.title)}</h3>
        <div class="meta-line">
          <span class="tag">${escapeHtml(source.sourceType)}</span>
          <span>${escapeHtml(source.authors || "authors unknown")}</span>
          <span>${escapeHtml(source.publisher)}</span>
          <span>${escapeHtml(source.publishedAt)}</span>
        </div>
        <p><strong>원문 발췌:</strong> ${escapeHtml(source.originalExcerpt || "검색 결과에서 직접 인용 가능한 짧은 원문 발췌가 없습니다.")}</p>
        <p><strong>출처별 정리:</strong> ${escapeHtml(source.sourceSummary)}</p>
        <ul class="bullet-list">
          ${(source.evidenceNotes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
        </ul>
        <p><strong>활용 지점:</strong> ${(source.usedFor || []).map((item) => escapeHtml(item)).join(", ") || "표시 없음"}</p>
        <p><strong>접근/제한:</strong> ${escapeHtml(source.accessNote)}</p>
      </article>
    `)
    .join("");
}

function renderReferenceItems(references) {
  return (references || [])
    .map((reference) => `
      <li>
        <strong>${escapeHtml(reference.referenceId)}</strong>
        ${escapeHtml(reference.citation)}
        <div class="source-meta">${linkHtml(reference.url, reference.url)}</div>
      </li>
    `)
    .join("");
}

function renderResult() {
  const result = state.result;
  const data = result.structured;
  const title = data?.meta?.keyword || result.request?.keyword || "검색 결과";
  els.resultTitle.textContent = title;
  els.copyMarkdown.disabled = false;
  els.downloadJson.disabled = false;

  if (!data) {
    renderRawOnly(result);
    return;
  }

  renderSummary(data, result);
  renderMaterials(data, result);
  renderTimeline(data);
  renderSources(data, result);
  renderRaw(result);
}

function renderSummary(data, result) {
  const dossiers = normalizedSourceDossiers(data, result);
  const references = normalizedReferences(data, result, dossiers);
  const sourceDossierCards = renderSourceDossierCards(dossiers);
  const referenceItems = renderReferenceItems(references);
  const findings = (data.keyFindings || [])
    .map((item) => `
      <li>
        <strong>${escapeHtml(item.finding)}</strong>
        <p>${escapeHtml(item.evidence)}</p>
        <div class="source-meta">${linkHtml(item.sourceUrl, "출처")}</div>
      </li>
    `)
    .join("");

  const sections = (data.sections || [])
    .map((section) => `
      <div class="result-section">
        <h3>${escapeHtml(section.title)}</h3>
        <ul class="bullet-list">
          ${(section.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
        </ul>
      </div>
    `)
    .join("");

  els.panels.summary.innerHTML = `
    <div class="summary-grid">
      <div>
        <section class="result-section">
          <h3>핵심 요약</h3>
          <p>${escapeHtml(data.executiveSummary)}</p>
          <div class="meta-line">
            ${result.request?.apiTypeLabel ? `<span class="tag amber">${escapeHtml(result.request.apiTypeLabel)}</span>` : ""}
            ${(result.request?.selectedMaterialTypes || []).map((label) => `<span class="tag teal">${escapeHtml(label)}</span>`).join("")}
          </div>
        </section>
        ${sections}
      </div>
      <div>
        <section class="result-section">
          <h3>주요 발견</h3>
          <ul class="bullet-list">${findings || "<li>정리된 발견이 없습니다.</li>"}</ul>
        </section>
        <section class="result-section">
          <h3>빈틈</h3>
          <ul class="bullet-list">
            ${(data.gaps || []).map((gap) => `<li>${escapeHtml(gap)}</li>`).join("") || "<li>표시할 빈틈이 없습니다.</li>"}
          </ul>
        </section>
        <section class="result-section">
          <h3>다음 확인</h3>
          <ul class="bullet-list">
            ${(data.nextSteps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("") || "<li>추가 확인 항목이 없습니다.</li>"}
          </ul>
        </section>
      </div>
    </div>
    <section class="result-section">
      <h3>마지막: 출처별 원문 정리</h3>
      <div class="material-list">${sourceDossierCards || `<div class="empty-state">출처별 원문 정리가 없습니다.</div>`}</div>
    </section>
    <section class="result-section">
      <h3>References</h3>
      <ul class="source-list">${referenceItems || "<li>레퍼런스가 없습니다.</li>"}</ul>
    </section>
  `;
}

function renderMaterials(data, result) {
  const materials = (data.materials || [])
    .map((item) => `
      <article class="material-item">
        <h3>${linkHtml(item.url, item.title)}</h3>
        <div class="meta-line">
          <span class="tag">${escapeHtml(item.type)}</span>
          <span>${escapeHtml(item.publisher)}</span>
          <span>${escapeHtml(item.publishedAt)}</span>
          <span>${escapeHtml(item.credibility)}</span>
        </div>
        <p>${escapeHtml(item.summary)}</p>
        <ul class="bullet-list">
          ${(item.keyPoints || []).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
        </ul>
        <p><strong>활용:</strong> ${escapeHtml(item.whyUseful)}</p>
      </article>
    `)
    .join("");

  const images = (result.images || [])
    .map((image) => `
      <article class="image-item">
        <img src="${escapeHtml(image.thumbnailUrl || image.imageUrl)}" alt="${escapeHtml(image.caption || "검색 이미지")}" loading="lazy">
        <h3>${escapeHtml(image.caption || "이미지 결과")}</h3>
        <div class="source-meta">${linkHtml(image.sourceWebsiteUrl, "원문 페이지")}</div>
      </article>
    `)
    .join("");

  els.panels.materials.innerHTML = `
    <div class="material-list">${materials || `<div class="empty-state">자료 목록이 비어 있습니다.</div>`}</div>
    ${images ? `<section class="result-section"><h3>이미지</h3><div class="image-grid">${images}</div></section>` : ""}
  `;
}

function renderTimeline(data) {
  const timeline = (data.timeline || [])
    .map((item) => `
      <li>
        <strong>${escapeHtml(item.date)}</strong>
        <p>${escapeHtml(item.event)}</p>
        <div class="source-meta">${linkHtml(item.sourceUrl, "출처")}</div>
      </li>
    `)
    .join("");

  els.panels.timeline.innerHTML = `<ul class="timeline-list">${timeline || `<li>타임라인 자료가 없습니다.</li>`}</ul>`;
}

function renderSources(data, result) {
  const actions = (result.searchActions || [])
    .map((action) => {
      const query = action.query || (Array.isArray(action.queries) ? action.queries.join(", ") : "");
      return `<span class="tag amber">${escapeHtml(action.type || "search")}${query ? `: ${escapeHtml(query)}` : ""}</span>`;
    })
    .join("");

  const sources = (result.citations || [])
    .map((source) => `
      <li>
        ${linkHtml(source.url, source.title)}
        <div class="source-meta"><span>${escapeHtml(source.source)}</span></div>
      </li>
    `)
    .join("");

  const dossiers = normalizedSourceDossiers(data, result);
  const references = normalizedReferences(data, result, dossiers);
  const sourceDossiers = renderSourceDossierCards(dossiers);
  const referenceItems = renderReferenceItems(references);

  els.panels.sources.innerHTML = `
    <section class="result-section">
      <h3>검색 액션</h3>
      <div class="meta-line">${actions || "<span class=\"tag amber\">검색 액션 없음</span>"}</div>
    </section>
    <section class="result-section">
      <h3>URL 소스</h3>
      <ul class="source-list">${sources || "<li>표시할 URL이 없습니다.</li>"}</ul>
    </section>
    <section class="result-section">
      <h3>출처별 원문 정리</h3>
      <div class="material-list">${sourceDossiers || `<div class="empty-state">출처별 원문 정리가 없습니다.</div>`}</div>
    </section>
    <section class="result-section">
      <h3>References</h3>
      <ul class="source-list">${referenceItems || "<li>레퍼런스가 없습니다.</li>"}</ul>
    </section>
  `;
}

function renderRaw(result) {
  els.panels.raw.innerHTML = `<pre class="raw-block">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
}

function renderRawOnly(result) {
  els.panels.summary.innerHTML = `
    <section class="result-section">
      <h3>원문 응답</h3>
      <p>${escapeHtml(result.outputText || "정리 가능한 텍스트가 없습니다.")}</p>
    </section>
  `;
  els.panels.materials.innerHTML = `<div class="empty-state">구조화된 자료 목록을 만들지 못했습니다.</div>`;
  els.panels.timeline.innerHTML = `<div class="empty-state">구조화된 타임라인을 만들지 못했습니다.</div>`;
  renderSources(null, result);
  renderRaw(result);
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  Object.entries(els.panels).forEach(([name, panel]) => panel.classList.toggle("active", name === tabName));
}

function toMarkdown(result) {
  const data = result.structured;
  if (!data) return result.outputText || "";

  const dossiers = normalizedSourceDossiers(data, result);
  const references = normalizedReferences(data, result, dossiers);
  const lines = [
    `# ${data.meta.keyword}`,
    "",
    `API: ${result.request?.apiTypeLabel || result.request?.apiType || "unknown"}`,
    "",
    `생성: ${data.meta.generatedAt}`,
    "",
    "## 핵심 요약",
    data.executiveSummary,
    "",
    "## 주요 발견",
    ...(data.keyFindings || []).map((item) => `- ${item.finding} (${item.sourceUrl})`),
    "",
    "## 자료",
    ...(data.materials || []).flatMap((item) => [
      `### ${item.title}`,
      `- 유형: ${item.type}`,
      `- 발행처: ${item.publisher}`,
      `- 날짜: ${item.publishedAt}`,
      `- URL: ${item.url}`,
      `- 요약: ${item.summary}`,
      ""
    ]),
    "## 빈틈",
    ...(data.gaps || []).map((gap) => `- ${gap}`),
    "",
    "## 출처별 원문 정리",
    ...dossiers.flatMap((source) => [
      `### ${source.referenceId} ${source.title}`,
      `- 유형: ${source.sourceType}`,
      `- 저자/기관: ${source.authors}`,
      `- 발행처: ${source.publisher}`,
      `- 날짜: ${source.publishedAt}`,
      `- URL: ${source.url}`,
      `- 원문 발췌: ${source.originalExcerpt}`,
      `- 출처별 정리: ${source.sourceSummary}`,
      `- 근거: ${(source.evidenceNotes || []).join("; ")}`,
      `- 활용 지점: ${(source.usedFor || []).join("; ")}`,
      `- 접근/제한: ${source.accessNote}`,
      ""
    ]),
    "## References",
    ...references.map((reference) => `- ${reference.referenceId} ${reference.citation} ${reference.url}`)
  ];

  return lines.join("\n");
}

async function copyMarkdown() {
  if (!state.result) return;
  const markdown = toMarkdown(state.result);
  await navigator.clipboard.writeText(markdown);
  setNotice("Markdown이 클립보드에 복사되었습니다.", "ready");
}

function downloadJson() {
  if (!state.result) return;
  const blob = new Blob([JSON.stringify(state.result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `web-research-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function resetForm() {
  const currentApiKey = els.apiKey.value;
  const rememberApiKey = els.rememberApiKey.checked;
  els.form.reset();
  els.apiKey.value = rememberApiKey ? currentApiKey : "";
  els.rememberApiKey.checked = rememberApiKey;
  if (state.config) {
    els.apiType.value = state.config.defaultApiType || "responses_web_search";
    renderMaterialTypes();
    syncApiTypeControls(true);
  }
  persistApiKeyPreference();
  updateApiStatus();
  state.result = null;
  els.resultTitle.textContent = "대기 중";
  els.copyMarkdown.disabled = true;
  els.downloadJson.disabled = true;
  setNotice("키워드와 자료 유형을 고르면 결과가 이곳에 정리됩니다.");
  renderEmpty();
}

function bindEvents() {
  els.form.addEventListener("submit", runSearch);
  els.apiKey.addEventListener("input", () => {
    persistApiKeyPreference();
    updateApiStatus();
  });
  els.rememberApiKey.addEventListener("change", persistApiKeyPreference);
  els.apiType.addEventListener("change", () => syncApiTypeControls(true));
  els.resetButton.addEventListener("click", resetForm);
  els.copyMarkdown.addEventListener("click", copyMarkdown);
  els.downloadJson.addEventListener("click", downloadJson);
  els.tabs.forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));
}

async function init() {
  bindEvents();
  renderEmpty();
  try {
    await loadConfig();
  } catch (error) {
    els.apiStatus.classList.add("missing");
    els.apiStatus.textContent = "설정 실패";
    setNotice(escapeHtml(error.message), "error");
  }
}

init();
