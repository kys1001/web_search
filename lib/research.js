"use strict";

const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const PORT_FILE = path.join(ROOT_DIR, ".server-port");
const DEFAULT_PORT = Number.parseInt(process.env.PORT || "5173", 10);
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const MAX_BODY_BYTES = 1024 * 1024;

const MATERIAL_TYPES = [
  {
    id: "news",
    label: "뉴스/보도자료",
    description: "최근 기사, 보도자료, 속보성 업데이트",
    instruction: "recent news articles, official press releases, and dated updates",
    checked: true
  },
  {
    id: "official",
    label: "공식 기관",
    description: "정부, 규제기관, 국제기구, 공공기관",
    instruction: "government, regulator, international organization, and public-agency pages",
    checked: true
  },
  {
    id: "academic",
    label: "논문/학술",
    description: "논문, 프리프린트, 학술 데이터베이스",
    instruction: "peer-reviewed papers, preprints, technical reports, and academic databases",
    checked: false
  },
  {
    id: "company",
    label: "기업/IR/공시",
    description: "기업 블로그, IR, 실적자료, 공시",
    instruction: "company blogs, investor relations, earnings materials, filings, and official product announcements",
    checked: false
  },
  {
    id: "market",
    label: "시장/산업 리포트",
    description: "시장 분석, 산업 보고서, 컨설팅 리포트",
    instruction: "market reports, analyst summaries, industry research, and consulting publications",
    checked: false
  },
  {
    id: "data",
    label: "통계/데이터셋",
    description: "통계표, 공개 데이터, 대시보드",
    instruction: "statistics, open datasets, dashboards, and measurable indicators",
    checked: false
  },
  {
    id: "legal",
    label: "법/정책/규제",
    description: "법령, 정책 문서, 규제 변경",
    instruction: "laws, policies, regulatory changes, consultation papers, and compliance guidance",
    checked: false
  },
  {
    id: "product",
    label: "제품/가격/출시",
    description: "제품 페이지, 출시 소식, 가격 변화",
    instruction: "product pages, launch notes, pricing pages, release notes, and comparison pages",
    checked: false
  },
  {
    id: "social",
    label: "커뮤니티/소셜",
    description: "포럼, 커뮤니티 반응, 소셜 신호",
    instruction: "community discussions, forum posts, social signals, and user feedback",
    checked: false
  },
  {
    id: "events",
    label: "행사/일정",
    description: "컨퍼런스, 웨비나, 공모, 일정",
    instruction: "events, conferences, webinars, calls for proposals, and schedule pages",
    checked: false
  },
  {
    id: "images",
    label: "이미지/시각자료",
    description: "최근 이미지, 제품 사진, 현장 자료",
    instruction: "current image results, product photos, event visuals, diagrams, and visual references",
    checked: false
  }
];

const RESEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "meta",
    "executiveSummary",
    "keyFindings",
    "sections",
    "materials",
    "timeline",
    "gaps",
    "nextSteps"
  ],
  properties: {
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["keyword", "generatedAt", "selectedMaterialTypes", "coverageNote"],
      properties: {
        keyword: { type: "string" },
        generatedAt: { type: "string" },
        selectedMaterialTypes: { type: "array", items: { type: "string" } },
        coverageNote: { type: "string" }
      }
    },
    executiveSummary: { type: "string" },
    keyFindings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["finding", "evidence", "sourceUrl"],
        properties: {
          finding: { type: "string" },
          evidence: { type: "string" },
          sourceUrl: { type: "string" }
        }
      }
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "bullets"],
        properties: {
          title: { type: "string" },
          bullets: { type: "array", items: { type: "string" } }
        }
      }
    },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "title",
          "publisher",
          "publishedAt",
          "url",
          "summary",
          "keyPoints",
          "credibility",
          "whyUseful"
        ],
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          publisher: { type: "string" },
          publishedAt: { type: "string" },
          url: { type: "string" },
          summary: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          credibility: { type: "string" },
          whyUseful: { type: "string" }
        }
      }
    },
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "event", "sourceUrl"],
        properties: {
          date: { type: "string" },
          event: { type: "string" },
          sourceUrl: { type: "string" }
        }
      }
    },
    gaps: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } }
  }
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function text(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJsonBody(req) {
  let total = 0;
  const chunks = [];

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw);
}

function sanitizeKeyword(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function parseDomainList(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((domain) => domain.trim().toLowerCase())
    .map((domain) => domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean)
    .filter((domain, index, all) => all.indexOf(domain) === index)
    .slice(0, 25);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function getSelectedTypes(ids) {
  const requested = Array.isArray(ids) ? ids : [];
  const selected = MATERIAL_TYPES.filter((type) => requested.includes(type.id));
  return selected.length > 0 ? selected : MATERIAL_TYPES.filter((type) => type.checked);
}

function buildPrompt({ keyword, selectedTypes, recency, language, memo }) {
  const typeLines = selectedTypes.map((type) => `- ${type.label}: ${type.instruction}`).join("\n");
  const now = new Date().toISOString();

  return [
    "You are a meticulous Korean research analyst using live web search.",
    `Current timestamp: ${now}`,
    `Keyword: ${keyword}`,
    `Requested language: ${language}`,
    `Freshness window: ${recency}`,
    "Only collect and summarize material types selected by the user.",
    "",
    "Selected material types:",
    typeLines,
    "",
    memo ? `User memo: ${memo}` : "User memo: none",
    "",
    "Research requirements:",
    "- Use web search before answering.",
    "- Prefer the most recent, primary, and dated sources.",
    "- Separate facts from interpretation.",
    "- Include source URLs only when they came from searched/cited material.",
    "- If a publication date is unknown, write \"unknown\".",
    "- If evidence is thin or sources conflict, state that in gaps.",
    "- Write concise Korean unless the requested language says otherwise.",
    "- Return only the requested JSON object."
  ].join("\n");
}

function buildOpenAiPayload(body) {
  const keyword = sanitizeKeyword(body.keyword);
  if (!keyword) {
    throw Object.assign(new Error("키워드를 입력하세요."), { statusCode: 400 });
  }

  const selectedTypes = getSelectedTypes(body.materialTypes);
  const includeImages = selectedTypes.some((type) => type.id === "images") || Boolean(body.includeImages);
  const contextSize = ["low", "medium", "high"].includes(body.contextSize) ? body.contextSize : "medium";
  const recency = body.recency || "최근 30일 우선, 단 핵심 맥락은 더 오래된 자료도 허용";
  const language = body.language || "ko";
  const allowedDomains = parseDomainList(body.allowedDomains);
  const blockedDomains = parseDomainList(body.blockedDomains);

  const webSearchTool = {
    type: "web_search",
    search_context_size: contextSize,
    external_web_access: body.externalWebAccess !== false
  };

  if (body.returnTokenBudget === "unlimited") {
    webSearchTool.return_token_budget = "unlimited";
  }

  if (includeImages) {
    webSearchTool.search_content_types = ["image", "text"];
    webSearchTool.image_settings = {
      max_results: clampNumber(body.maxImageResults, 1, 10, 4),
      caption: true
    };
  }

  const filters = {};
  if (allowedDomains.length > 0) filters.allowed_domains = allowedDomains;
  if (blockedDomains.length > 0) filters.blocked_domains = blockedDomains;
  if (Object.keys(filters).length > 0) webSearchTool.filters = filters;

  if (body.useLocation) {
    const location = {
      type: "approximate"
    };
    if (body.country) location.country = String(body.country).trim().toUpperCase().slice(0, 2);
    if (body.city) location.city = String(body.city).trim().slice(0, 80);
    if (body.region) location.region = String(body.region).trim().slice(0, 80);
    if (body.timezone) location.timezone = String(body.timezone).trim().slice(0, 80);
    webSearchTool.user_location = location;
  }

  const include = ["web_search_call.action.sources"];
  if (includeImages) include.push("web_search_call.results");

  const model = sanitizeKeyword(body.model) || DEFAULT_MODEL;
  const payload = {
    model,
    tools: [webSearchTool],
    tool_choice: "required",
    include,
    text: {
      format: {
        type: "json_schema",
        name: "research_bundle",
        strict: true,
        schema: RESEARCH_SCHEMA
      }
    },
    input: buildPrompt({
      keyword,
      selectedTypes,
      recency,
      language,
      memo: String(body.memo || "").trim().slice(0, 1200)
    })
  };

  if (["low", "medium", "high", "xhigh"].includes(body.reasoningEffort)) {
    payload.reasoning = { effort: body.reasoningEffort };
  }

  return {
    payload,
    requestInfo: {
      keyword,
      model,
      selectedMaterialTypes: selectedTypes.map((type) => type.label),
      contextSize,
      recency,
      includeImages,
      allowedDomains,
      blockedDomains,
      externalWebAccess: webSearchTool.external_web_access,
      returnTokenBudget: webSearchTool.return_token_budget || "default"
    }
  };
}

async function callOpenAi(payload, requestApiKey) {
  const apiKey = String(requestApiKey || process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw Object.assign(new Error("API 키를 입력하거나 OPENAI_API_KEY 환경변수를 설정하세요."), { statusCode: 400 });
  }

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000)
    });
  } catch (error) {
    const causeCode = error.cause?.code || "";
    const causeMessage = error.cause?.message || error.message || "";
    const blockedBySandbox = causeCode === "EACCES" || /forbidden|denied|permission|socket/i.test(causeMessage);
    const message = blockedBySandbox
      ? "OpenAI API로 나가는 HTTPS 연결이 현재 실행 환경에서 차단되었습니다. 일반 PowerShell에서 `npm.cmd start`로 서버를 다시 실행해 주세요."
      : `OpenAI API 연결에 실패했습니다: ${causeMessage || "fetch failed"}`;

    throw Object.assign(new Error(message), {
      statusCode: 502,
      details: {
        causeCode,
        causeMessage,
        hint: "브라우저에 API 키를 넣는 것은 정상입니다. 이 오류는 서버 프로세스가 api.openai.com:443에 연결하지 못할 때 발생합니다."
      }
    });
  }

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const message = data?.error?.message || raw || `OpenAI API error: ${response.status}`;
    throw Object.assign(new Error(message), {
      statusCode: response.status,
      details: data
    });
  }

  return data;
}

function collectOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts = [];
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function tryParseJson(textValue) {
  const trimmed = String(textValue || "").trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!match) return null;
    try {
      return JSON.parse(match[1].trim());
    } catch {
      return null;
    }
  }
}

function pushUniqueUrl(collection, item) {
  if (!item?.url) return;
  const url = String(item.url).trim();
  if (!url || collection.some((entry) => entry.url === url)) return;
  collection.push({
    title: item.title || url,
    url,
    source: item.source || "citation"
  });
}

function extractArtifacts(response) {
  const citations = [];
  const searchActions = [];
  const images = [];

  for (const outputItem of response.output || []) {
    if (outputItem.type === "web_search_call") {
      if (outputItem.action) {
        searchActions.push(outputItem.action);
        for (const source of outputItem.action.sources || []) {
          pushUniqueUrl(citations, {
            title: source.title,
            url: source.url,
            source: "source-list"
          });
        }
      }

      for (const result of outputItem.results || []) {
        if (result.type === "image_result") {
          images.push({
            imageUrl: result.image_url || "",
            thumbnailUrl: result.thumbnail_url || result.image_url || "",
            sourceWebsiteUrl: result.source_website_url || "",
            caption: result.caption || ""
          });
        }
      }
    }

    if (outputItem.type === "message") {
      for (const content of outputItem.content || []) {
        for (const annotation of content.annotations || []) {
          const citation = annotation.url_citation || annotation;
          pushUniqueUrl(citations, {
            title: citation.title,
            url: citation.url,
            source: "inline-citation"
          });
        }
      }
    }
  }

  return { citations, searchActions, images };
}

function normalizeOpenAiResponse(response, requestInfo) {
  const outputText = collectOutputText(response);
  const structured = tryParseJson(outputText);
  const artifacts = extractArtifacts(response);

  return {
    id: response.id,
    model: response.model,
    status: response.status,
    createdAt: response.created_at,
    usage: response.usage || null,
    request: requestInfo,
    structured,
    outputText,
    ...artifacts,
    raw: response
  };
}

async function handleApiConfig(res) {
  json(res, 200, {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    defaultModel: DEFAULT_MODEL,
    materialTypes: MATERIAL_TYPES,
    defaultPort: DEFAULT_PORT
  });
}

async function handleApiSearch(req, res) {
  try {
    const body = await readJsonBody(req);
    const { payload, requestInfo } = buildOpenAiPayload(body);
    const response = await callOpenAi(payload, body.apiKey);
    json(res, 200, normalizeOpenAiResponse(response, requestInfo));
  } catch (error) {
    const statusCode = error.statusCode || 500;
    json(res, statusCode, {
      error: error.message || "검색 중 오류가 발생했습니다.",
      details: error.details || null
    });
  }
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return text(res, 403, "Forbidden");
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Length": content.length,
      "Cache-Control": "no-store"
    });
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return text(res, 404, "Not found");
    }
    throw error;
  }
}

async function router(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && parsedUrl.pathname === "/api/config") {
    return handleApiConfig(res);
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/search") {
    return handleApiSearch(req, res);
  }

  if (req.method === "GET") {
    return serveStatic(req, res, decodeURIComponent(parsedUrl.pathname));
  }

  text(res, 405, "Method not allowed");
}

function createServer() {
  return http.createServer((req, res) => {
    router(req, res).catch((error) => {
      console.error(error);
      json(res, 500, { error: "서버 오류가 발생했습니다." });
    });
  });
}

function listenWithFallback(port, attempt = 0) {
  const server = createServer();

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && !process.env.PORT && attempt < 10) {
      listenWithFallback(port + 1, attempt + 1);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });

  server.listen(port, "127.0.0.1", async () => {
    await fs.writeFile(PORT_FILE, String(port), "utf8");
    console.log(`OpenAI Web Research Desk running at http://127.0.0.1:${port}`);
  });
}

if (require.main === module) {
  listenWithFallback(Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 5173);
}

module.exports = {
  DEFAULT_MODEL,
  MATERIAL_TYPES,
  buildOpenAiPayload,
  callOpenAi,
  handleApiConfig,
  handleApiSearch,
  json,
  normalizeOpenAiResponse,
  readJsonBody
};
