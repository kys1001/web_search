"use strict";

const { DEFAULT_MODEL, MATERIAL_TYPES, json } = require("../server");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    defaultModel: DEFAULT_MODEL,
    materialTypes: MATERIAL_TYPES,
    defaultPort: null
  });
};
