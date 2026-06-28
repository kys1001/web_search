"use strict";

const {
  buildOpenAiPayload,
  callOpenAi,
  json,
  normalizeOpenAiResponse,
  readJsonBody
} = require("../lib/research");

async function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
  return readJsonBody(req);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await getBody(req);
    const { endpointPath, payload, requestInfo } = buildOpenAiPayload(body);
    const response = await callOpenAi(payload, body.apiKey, endpointPath);
    return json(res, 200, normalizeOpenAiResponse(response, requestInfo));
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: error.message || "검색 중 오류가 발생했습니다.",
      details: error.details || null
    });
  }
};
