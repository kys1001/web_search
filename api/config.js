"use strict";

const {
  DEFAULT_API_TYPE,
  DEFAULT_MODEL,
  MATERIAL_TYPES,
  OPENAI_API_TYPES,
  json
} = require("../lib/research");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");
  const defaultApiType = OPENAI_API_TYPES.some((type) => type.id === DEFAULT_API_TYPE)
    ? DEFAULT_API_TYPE
    : OPENAI_API_TYPES[0].id;
  return json(res, 200, {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    defaultModel: DEFAULT_MODEL,
    defaultApiType,
    openAiApiTypes: OPENAI_API_TYPES,
    materialTypes: MATERIAL_TYPES,
    defaultPort: null
  });
};
