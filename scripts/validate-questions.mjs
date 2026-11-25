import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteDirectory = resolve(scriptDirectory, "..");
const dataPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(siteDirectory, "data/questions.json");
const expectedCount = Number(process.env.EXPECTED_COUNT || 100);
const allowedDifficulties = ["基础", "中等", "进阶", "挑战"];
const difficultyRank = new Map(allowedDifficulties.map((value, index) => [value, index]));
const errors = [];

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${label} 必须是非空字符串。`);
}

function normalizedStem(value) {
  return String(value || "").replace(/[\s，。！？；：,.!?;:]/g, "").toLowerCase();
}

function validateQuestion(question, index) {
  const label = question?.id || `第 ${index + 1} 条`;
  if (!question || typeof question !== "object" || Array.isArray(question)) {
    errors.push(`第 ${index + 1} 条不是题目对象。`);
    return;
  }

  requiredText(question.id, `${label}.id`);
  if (!/^R\d{3}$/.test(question.id || "")) errors.push(`${label}.id 必须符合 R001 格式。`);
  if (!["single", "multiple"].includes(question.type)) errors.push(`${label}.type 必须是 single 或 multiple。`);
  requiredText(question.stem, `${label}.stem`);
  requiredText(question.explanation, `${label}.explanation`);

  if (!Array.isArray(question.tags) || question.tags.length === 0 || question.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
    errors.push(`${label}.tags 必须是至少包含一个非空字符串的数组。`);
  }
  if (!allowedDifficulties.includes(question.difficulty)) {
    errors.push(`${label}.difficulty 必须是 ${allowedDifficulties.join("、")} 之一。`);
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    errors.push(`${label}.options 至少需要两个选项。`);
    return;
  }
  const optionKeys = question.options.map((option) => option?.key);
  if (new Set(optionKeys).size !== optionKeys.length) errors.push(`${label}.options 存在重复 key。`);
  question.options.forEach((option, optionIndex) => {
    requiredText(option?.key, `${label}.options[${optionIndex}].key`);
    requiredText(option?.text, `${label}.options[${optionIndex}].text`);
  });

  const answers = Array.isArray(question.answer) ? question.answer : [question.answer];
  if (question.type === "single" && answers.length !== 1) errors.push(`${label} 是单选题，但 answer 不是单个答案。`);
  if (question.type === "multiple" && answers.length < 2) errors.push(`${label} 是多选题，但 answer 少于两个答案。`);
  if (answers.some((answer) => !optionKeys.includes(answer))) errors.push(`${label}.answer 引用了不存在的选项键。`);

  if (question.image != null) {
    if (typeof question.image !== "object" || Array.isArray(question.image)) {
      errors.push(`${label}.image 必须是对象。`);
    } else {
      requiredText(question.image.src, `${label}.image.src`);
      requiredText(question.image.alt, `${label}.image.alt`);
      for (const optionalField of ["credit", "license", "sourceUrl"]) {
        if (question.image[optionalField] != null && typeof question.image[optionalField] !== "string") {
          errors.push(`${label}.image.${optionalField} 必须是字符串。`);
        }
      }
    }
  }
}

let payload;
try {
  payload = JSON.parse(await readFile(dataPath, "utf8"));
} catch (error) {
  console.error(`无法读取题库：${dataPath}`);
  console.error(error.message);
  process.exit(1);
}

const questions = Array.isArray(payload) ? payload : payload.questions;
if (!Array.isArray(questions)) {
  console.error("questions.json 必须是数组，或包含 questions 数组。");
  process.exit(1);
}

if (questions.length !== expectedCount) {
  errors.push(`题目数量应为 ${expectedCount}，当前为 ${questions.length}。`);
}

questions.forEach(validateQuestion);

const ids = questions.map((question) => question?.id).filter(Boolean);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) errors.push(`存在重复 ID：${[...new Set(duplicateIds)].join("、")}。`);

const expectedIds = Array.from({ length: expectedCount }, (_, index) => `R${String(index + 1).padStart(3, "0")}`);
const missingIds = expectedIds.filter((id) => !ids.includes(id));
if (missingIds.length) errors.push(`缺少 ID：${missingIds.join("、")}。`);

const stems = questions.map((question) => normalizedStem(question?.stem));
const duplicateStems = questions
  .filter((question, index) => stems[index] && stems.indexOf(stems[index]) !== index)
  .map((question) => question.id);
if (duplicateStems.length) errors.push(`存在完全重复的题干：${duplicateStems.join("、")}。`);

const sorted = [...questions].sort((a, b) => String(a.id).localeCompare(String(b.id), "zh-CN", { numeric: true }));
let highestDifficulty = -1;
for (const question of sorted) {
  const rank = difficultyRank.get(question.difficulty);
  if (rank == null) continue;
  if (rank < highestDifficulty) {
    errors.push(`${question.id} 的难度“${question.difficulty}”低于前面题目的难度，未按题号递进。`);
  }
  highestDifficulty = Math.max(highestDifficulty, rank);
}
for (const difficulty of allowedDifficulties) {
  if (!questions.some((question) => question.difficulty === difficulty)) {
    errors.push(`题库缺少“${difficulty}”难度题目。`);
  }
}

if (errors.length) {
  console.error(`题库校验失败，共 ${errors.length} 个问题：`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const distribution = Object.fromEntries(
  allowedDifficulties.map((difficulty) => [difficulty, questions.filter((question) => question.difficulty === difficulty).length]),
);
console.log(`题库校验通过：${questions.length} 题，ID 唯一且字段完整。`);
console.log(`难度分布：${allowedDifficulties.map((difficulty) => `${difficulty} ${distribution[difficulty]} 题`).join("，")}。`);
