const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "questions.txt");
const explanationsPath = path.join(__dirname, "explanations.json");
const outputPath = path.join(__dirname, "questions.js");
const OFFICIAL_SOURCE_HOSTS = new Set([
  "ww1.microchip.com",
  "assets.nexperia.com",
  "www.ti.com",
  "www.onsemi.com",
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function normalizeAnswer(rawAnswer, options, type, id) {
  const raw = String(rawAnswer || "").trim();
  const compact = raw.replace(/\s+/g, "").toUpperCase();

  if (/^[A-Z]+$/.test(compact)) {
    return compact
      .split("")
      .filter((letter, index, arr) => options[letter] && arr.indexOf(letter) === index)
      .sort()
      .join("");
  }

  if (type === "判断题" || raw === "对" || raw === "错") {
    const target = raw.includes("对") ? "对" : raw.includes("错") ? "错" : "";
    const match = Object.entries(options).find(([, text]) => text.trim() === target);
    if (match) return match[0];
  }

  const byText = Object.entries(options).find(([, text]) => text.trim() === raw);
  if (byText) return byText[0];

  throw new Error(`第 ${id} 题答案无法映射到选项：${raw}`);
}

function parseBlock(block, index) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const header = lines[0];
  const headerMatch = header.match(/^\s*(?:第\s*)?(\d+)(?:\s*题)?[.、．]?\s*(.*)$/);
  if (!headerMatch) {
    throw new Error(`第 ${index + 1} 个题块无法识别题号：${header}`);
  }

  const id = Number(headerMatch[1]);
  let question = headerMatch[2].trim();
  let type = "";
  const typeMatch = question.match(/[（(]\s*(单选题|多选题|判断题)\s*[）)]/);
  if (typeMatch) {
    type = typeMatch[1];
    question = question.replace(typeMatch[0], "").trim();
  }

  const options = {};
  let rawAnswer = "";
  const questionExtraLines = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const optionMatch = line.match(/^([A-Z])\s*[.、．]\s*(.+)$/i);
    const answerMatch = line.match(/^(?:答案|正确答案)\s*[:：]\s*([^\s（(]+).*$/);

    if (optionMatch) {
      options[optionMatch[1].toUpperCase()] = optionMatch[2].trim();
    } else if (answerMatch) {
      rawAnswer = answerMatch[1].trim();
    } else {
      questionExtraLines.push(line);
    }
  }

  if (questionExtraLines.length) {
    question = [question, ...questionExtraLines].filter(Boolean).join("\n");
  }

  const optionCount = Object.keys(options).length;
  if (!question) throw new Error(`第 ${id} 题缺少题干`);
  if (optionCount < 2) throw new Error(`第 ${id} 题选项不足，当前选项数：${optionCount}`);
  if (!rawAnswer) throw new Error(`第 ${id} 题缺少答案行`);

  if (!type) {
    type = optionCount === 2 && Object.values(options).every((item) => ["对", "错"].includes(item))
      ? "判断题"
      : rawAnswer.length > 1
        ? "多选题"
        : "单选题";
  }

  const answer = normalizeAnswer(rawAnswer, options, type, id);
  if (!answer) throw new Error(`第 ${id} 题答案为空或不在选项中：${rawAnswer}`);

  return {
    id,
    type,
    question,
    options,
    answer,
    explanation: "",
    explanationStatus: "",
    explanationConfidence: "",
    sources: [],
  };
}

function parseQuestions(text) {
  const normalized = normalizeText(text);
  const blocks = normalized
    .split(/(?=^\s*(?:\d+[.、．]|第\s*\d+\s*题))/m)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];

  blocks.forEach((block, index) => {
    try {
      const question = parseBlock(block, index);
      if (question) questions.push(question);
    } catch (error) {
      const preview = block.split("\n").slice(0, 4).join(" / ");
      errors.push(`${error.message}\n题块预览：${preview}`);
    }
  });

  const ids = new Set();
  questions.forEach((question) => {
    if (ids.has(question.id)) {
      errors.push(`第 ${question.id} 题题号重复`);
    }
    ids.add(question.id);
  });

  questions.sort((a, b) => a.id - b.id);
  return { questions, errors };
}

function normalizeQuestionAnswer(value) {
  return String(value || "")
    .toUpperCase()
    .split("")
    .filter(Boolean)
    .sort()
    .join("");
}

function getSourceTrust(source, questionId) {
  let url;
  try {
    url = new URL(source.url);
  } catch (error) {
    throw new Error(`第 ${questionId} 题来源 URL 无效：${source.url}`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`第 ${questionId} 题来源必须使用 HTTPS：${source.url}`);
  }
  if (OFFICIAL_SOURCE_HOSTS.has(url.hostname.toLowerCase())) return "official";
  const isPhilipsManualMirror =
    url.hostname.toLowerCase() === "www.pjrc.com" &&
    /80C51_FAM_HARDWARE_1\.pdf$/i.test(url.pathname) &&
    String(source.publisher || "").trim().toLowerCase() === "philips";
  return isPhilipsManualMirror ? "authoritative-mirror" : "untrusted";
}

function applyExplanations(questions, data) {
  if (!data || typeof data !== "object" || data.schemaVersion !== 1) {
    throw new Error("explanations.json 缺失或 schemaVersion 不是 1");
  }
  if (!data.generatedAt || Number.isNaN(Date.parse(data.generatedAt))) {
    throw new Error("explanations.json generatedAt 不是有效时间");
  }

  const entries = data.explanations && typeof data.explanations === "object" ? data.explanations : {};
  const questionMap = new Map(questions.map((question) => [String(question.id), question]));
  const entryIds = Object.keys(entries);
  const missingIds = [...questionMap.keys()].filter((id) => !entries[id]);
  const extraIds = entryIds.filter((id) => !questionMap.has(id));
  if (missingIds.length || extraIds.length) {
    throw new Error(`解析题号覆盖异常；缺少：${missingIds.join(",") || "无"}；多余：${extraIds.join(",") || "无"}`);
  }

  const needsReviewIds = new Set();
  entryIds.forEach((id) => {
    const item = entries[id];
    const question = questionMap.get(id);
    if (!item || typeof item !== "object") throw new Error(`第 ${id} 题解析结构无效`);
    const status = String(item.status || "").trim();
    const confidence = String(item.confidence || "").trim();
    const explanation = String(item.explanation || "").trim();
    if (normalizeQuestionAnswer(item.answer) !== normalizeQuestionAnswer(question.answer)) {
      throw new Error(`第 ${id} 题解析答案 ${item.answer} 与题库答案 ${question.answer} 不一致`);
    }
    if (!["verified", "needs_review"].includes(status)) throw new Error(`第 ${id} 题解析状态无效：${status}`);
    if (!["high", "medium", "low"].includes(confidence)) throw new Error(`第 ${id} 题置信度无效：${confidence}`);
    if (!explanation) throw new Error(`第 ${id} 题解析正文为空`);

    const rawSources = Array.isArray(item.sources) ? item.sources : [];
    const seenSources = new Set();
    const sources = rawSources.map((source) => {
      const title = String(source.title || "").trim();
      const publisher = String(source.publisher || "").trim();
      const locator = String(source.locator || "").trim();
      const documentId = String(source.documentId || "").trim();
      if (!title || !publisher || !locator) throw new Error(`第 ${id} 题来源缺少标题、发布方或定位信息`);
      const trust = getSourceTrust(source, id);
      if (status === "verified" && trust === "untrusted") {
        throw new Error(`第 ${id} 题 verified 来源不在受信任范围：${source.url}`);
      }
      return { title, publisher, url: source.url, documentId, locator, trust };
    }).filter((source) => {
      const key = `${source.url}|${source.locator}`;
      if (seenSources.has(key)) return false;
      seenSources.add(key);
      return true;
    });

    if (status === "verified" && !sources.length) throw new Error(`第 ${id} 题 verified 但没有来源`);
    if (status === "verified" && confidence === "high" && sources.some((source) => source.trust !== "official")) {
      throw new Error(`第 ${id} 题 high confidence 必须全部使用官方来源`);
    }
    if (status === "needs_review") needsReviewIds.add(id);

    question.explanation = explanation;
    question.explanationStatus = status;
    question.explanationConfidence = confidence;
    question.sources = sources;
  });

  const reviewQueue = Array.isArray(data.reviewQueue) ? data.reviewQueue : [];
  const reviewIds = reviewQueue.map((item) => String(item.questionId));
  const uniqueReviewIds = new Set(reviewIds);
  if (uniqueReviewIds.size !== reviewIds.length) throw new Error("reviewQueue 存在重复题号");
  const missingReviews = [...needsReviewIds].filter((id) => !uniqueReviewIds.has(id));
  const staleReviews = [...uniqueReviewIds].filter((id) => !needsReviewIds.has(id));
  if (missingReviews.length || staleReviews.length) {
    throw new Error(`reviewQueue 与 needs_review 不一致；缺少：${missingReviews.join(",") || "无"}；多余：${staleReviews.join(",") || "无"}`);
  }

  return {
    verified: entryIds.length - needsReviewIds.size,
    needsReview: needsReviewIds.size,
  };
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`找不到题库源文件：${sourcePath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(sourcePath, "utf8");
  const { questions, errors } = parseQuestions(source);

  if (errors.length) {
    console.error("题库解析失败，请根据以下信息修正 questions.txt：");
    errors.forEach((error, index) => console.error(`\n[${index + 1}] ${error}`));
    process.exit(1);
  }

  let explanationCounts = { verified: 0, needsReview: 0 };
  try {
    if (!fs.existsSync(explanationsPath)) throw new Error(`找不到解析文件：${explanationsPath}`);
    const explanationData = JSON.parse(fs.readFileSync(explanationsPath, "utf8"));
    explanationCounts = applyExplanations(questions, explanationData);
  } catch (error) {
    console.error(`解析数据校验失败：${error.message}`);
    process.exit(1);
  }

  const typeCounts = questions.reduce((acc, question) => {
    acc[question.type] = (acc[question.type] || 0) + 1;
    return acc;
  }, {});

  const content = [
    "/* Auto-generated by parser.js. Do not edit manually; update questions.txt or explanations.json and rerun `node parser.js`. */",
    `window.QUESTION_BANK = ${JSON.stringify(questions, null, 2)};`,
    "",
  ].join("\n");

  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`解析完成：${questions.length} 题`);
  console.log(`题型统计：${Object.entries(typeCounts).map(([type, count]) => `${type} ${count}`).join("，")}`);
  console.log(`解析统计：已核验 ${explanationCounts.verified}，待复核 ${explanationCounts.needsReview}`);
  console.log(`已生成：${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { applyExplanations, parseQuestions };
