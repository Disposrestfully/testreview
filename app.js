const DATA_URL = "./data/questions.json";
const STORAGE_KEY = "respiratoryQuizStateV1";

const elements = {
  loading: document.querySelector("#loading-state"),
  error: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  empty: document.querySelector("#empty-state"),
  sheet: document.querySelector("#question-sheet"),
  navigation: document.querySelector("#question-navigation"),
  retry: document.querySelector("#retry-button"),
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  jumpForm: document.querySelector("#jump-form"),
  jumpInput: document.querySelector("#question-id"),
  jumpMessage: document.querySelector("#jump-message"),
  progress: document.querySelector("#question-progress"),
  progressFill: document.querySelector("#progress-fill"),
  positionCurrent: document.querySelector("#position-current"),
  positionTotal: document.querySelector("#position-total"),
  questionType: document.querySelector("#question-type"),
  stableId: document.querySelector("#stable-id"),
  difficulty: document.querySelector("#difficulty"),
  tagList: document.querySelector("#tag-list"),
  title: document.querySelector("#question-title"),
  media: document.querySelector("#question-media"),
  imageButton: document.querySelector("#image-button"),
  image: document.querySelector("#question-image"),
  imageCaption: document.querySelector("#image-caption"),
  optionList: document.querySelector("#option-list"),
  reveal: document.querySelector("#reveal-button"),
  answerStatus: document.querySelector("#answer-status"),
  explanation: document.querySelector("#explanation"),
  correctAnswer: document.querySelector("#correct-answer"),
  selectionFeedback: document.querySelector("#selection-feedback"),
  explanationCopy: document.querySelector("#explanation-copy"),
  previous: document.querySelector("#previous-button"),
  next: document.querySelector("#next-button"),
  navPosition: document.querySelector("#nav-position"),
  dialog: document.querySelector("#image-dialog"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogCredit: document.querySelector("#dialog-credit"),
  dialogClose: document.querySelector("#dialog-close"),
};

const state = {
  questions: [],
  questionById: new Map(),
  order: [],
  randomOrder: [],
  currentIndex: 0,
  mode: "sequential",
  selections: {},
  revealed: false,
};

function text(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeOptions(rawOptions, questionIndex) {
  if (Array.isArray(rawOptions)) {
    return rawOptions.map((option, index) => {
      const fallbackKey = String.fromCharCode(65 + index);
      if (typeof option === "string") {
        return { key: fallbackKey, text: option.trim() };
      }
      return {
        key: text(option.key || option.id || option.label || fallbackKey).toUpperCase(),
        text: text(option.text || option.content || option.value),
      };
    });
  }

  if (rawOptions && typeof rawOptions === "object") {
    return Object.entries(rawOptions).map(([key, value]) => ({
      key: key.toUpperCase(),
      text: text(value),
    }));
  }

  throw new Error(`第 ${questionIndex + 1} 条题目缺少 options。`);
}

function normalizeAnswers(rawAnswer, isMultiple) {
  if (Array.isArray(rawAnswer)) {
    return rawAnswer.map((answer) => text(answer).toUpperCase()).filter(Boolean);
  }

  const answer = text(rawAnswer).toUpperCase();
  if (!answer) return [];
  if (/[,，、/\s]/.test(answer)) {
    return answer.split(/[,，、/\s]+/).filter(Boolean);
  }
  if (isMultiple && /^[A-Z]{2,}$/.test(answer)) return [...answer];
  return [answer];
}

function normalizeDifficulty(rawDifficulty) {
  const value = text(rawDifficulty).toLowerCase();
  if (["挑战", "专家", "expert", "comprehensive"].includes(value)) return "挑战";
  if (["进阶", "困难", "hard", "difficult", "advanced"].includes(value)) return "进阶";
  if (["中等", "medium", "intermediate"].includes(value)) return "中等";
  return "基础";
}

function normalizeExplanation(rawExplanation) {
  if (typeof rawExplanation === "string") return rawExplanation.trim();
  if (Array.isArray(rawExplanation)) return rawExplanation.map(text).filter(Boolean).join("\n");
  if (!rawExplanation || typeof rawExplanation !== "object") return "";

  const preferredKeys = ["overview", "analysis", "reasoning", "keyPoint", "takeaway"];
  const used = new Set();
  const lines = [];
  for (const key of preferredKeys) {
    if (rawExplanation[key]) {
      lines.push(text(rawExplanation[key]));
      used.add(key);
    }
  }
  for (const [key, value] of Object.entries(rawExplanation)) {
    if (used.has(key) || value == null) continue;
    if (typeof value === "string") lines.push(`${key}：${value.trim()}`);
    if (Array.isArray(value)) lines.push(...value.map(text).filter(Boolean));
  }
  return lines.filter(Boolean).join("\n");
}

function normalizeQuestion(raw, index) {
  const id = text(raw.id || raw.questionId || raw.number).toUpperCase();
  const stem = text(raw.stem || raw.question || raw.prompt || raw.title);
  const options = normalizeOptions(raw.options || raw.choices, index);
  const rawType = text(raw.type || raw.questionType || raw.format).toLowerCase();
  const multipleByType = /multiple|multi|多选|x型|^x$/.test(rawType);
  const provisionalAnswers = normalizeAnswers(
    raw.answer ?? raw.correctAnswer ?? raw.correct_answer,
    multipleByType,
  );
  const isMultiple = multipleByType || provisionalAnswers.length > 1;
  const answers = normalizeAnswers(
    raw.answer ?? raw.correctAnswer ?? raw.correct_answer,
    isMultiple,
  );
  const explanation = normalizeExplanation(raw.explanation || raw.analysis || raw.rationale);
  const tagsValue = raw.tags || raw.topics || raw.knowledgePoints || raw.topic || [];
  const tags = (Array.isArray(tagsValue) ? tagsValue : [tagsValue]).map(text).filter(Boolean);
  const image = raw.image && typeof raw.image === "object"
    ? {
        src: text(raw.image.src),
        alt: text(raw.image.alt),
        credit: text(raw.image.credit),
        license: text(raw.image.license),
        sourceUrl: text(raw.image.sourceUrl),
      }
    : null;

  const optionKeys = new Set(options.map((option) => option.key));
  if (!id) throw new Error(`第 ${index + 1} 条题目缺少 id。`);
  if (!stem) throw new Error(`${id} 缺少题干 stem。`);
  if (options.length < 2 || options.some((option) => !option.key || !option.text)) {
    throw new Error(`${id} 的 options 不完整。`);
  }
  if (!answers.length || answers.some((answer) => !optionKeys.has(answer))) {
    throw new Error(`${id} 的 answer 与选项键不一致。`);
  }
  if (!explanation) throw new Error(`${id} 缺少 explanation。`);
  if (image?.src && !image.alt) throw new Error(`${id} 的 image.src 存在，但缺少 image.alt。`);

  return {
    id,
    stem,
    options,
    answers,
    explanation,
    tags,
    difficulty: normalizeDifficulty(raw.difficulty || raw.level),
    type: isMultiple ? "multiple" : "single",
    typeLabel: text(raw.typeLabel) || (isMultiple ? "多选题" : "单选题"),
    image: image?.src ? image : null,
  };
}

function getNumericId(id) {
  const match = id.match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortSequential(questions) {
  return [...questions].sort((a, b) => {
    const numericDifference = getNumericId(a.id) - getNumericId(b.id);
    return numericDifference || a.id.localeCompare(b.id, "zh-CN", { numeric: true });
  });
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.mode = saved.mode === "random" ? "random" : "sequential";
    state.randomOrder = Array.isArray(saved.randomOrder) ? saved.randomOrder : [];
    state.selections = saved.selections && typeof saved.selections === "object" ? saved.selections : {};
    return text(saved.currentId).toUpperCase();
  } catch {
    return "";
  }
}

function saveState() {
  const currentQuestion = state.order[state.currentIndex];
  const payload = {
    mode: state.mode,
    currentId: currentQuestion?.id || "",
    randomOrder: state.randomOrder,
    selections: state.selections,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Persistence is optional; keep the quiz usable when storage is blocked.
  }
}

function validRandomOrder(ids) {
  const available = new Set(state.questions.map((question) => question.id));
  const unique = new Set(ids);
  return ids.length === available.size && unique.size === available.size && ids.every((id) => available.has(id));
}

function rebuildOrder(preferredId = "") {
  const sequential = sortSequential(state.questions);
  if (state.mode === "random") {
    if (!validRandomOrder(state.randomOrder)) {
      state.randomOrder = shuffle(sequential.map((question) => question.id));
    }
    state.order = state.randomOrder.map((id) => state.questionById.get(id));
  } else {
    state.order = sequential;
  }
  const preferredIndex = state.order.findIndex((question) => question.id === preferredId);
  state.currentIndex = preferredIndex >= 0 ? preferredIndex : 0;
}

function showOnly(panel) {
  for (const element of [elements.loading, elements.error, elements.empty, elements.sheet]) {
    element.hidden = element !== panel;
  }
  elements.navigation.hidden = panel !== elements.sheet;
}

function currentQuestion() {
  return state.order[state.currentIndex];
}

function selectedAnswers(question) {
  const saved = state.selections[question.id];
  return Array.isArray(saved) ? saved : [];
}

function setSelection(question, key, checked) {
  const current = new Set(selectedAnswers(question));
  if (question.type === "single") current.clear();
  if (checked) current.add(key);
  else current.delete(key);
  state.selections[question.id] = [...current].sort();
  updateAnswerStatus(question);
  saveState();
}

function createOption(question, option) {
  const label = document.createElement("label");
  label.className = "option-row";
  label.dataset.key = option.key;

  const input = document.createElement("input");
  input.type = question.type === "multiple" ? "checkbox" : "radio";
  input.name = `answer-${question.id}`;
  input.value = option.key;
  input.checked = selectedAnswers(question).includes(option.key);
  input.addEventListener("change", () => setSelection(question, option.key, input.checked));

  const key = document.createElement("span");
  key.className = "option-key";
  key.textContent = option.key;

  const optionText = document.createElement("span");
  optionText.className = "option-text";
  optionText.textContent = option.text;

  label.append(input, key, optionText);
  return label;
}

function renderTags(tags) {
  elements.tagList.replaceChildren();
  elements.tagList.hidden = tags.length === 0;
  for (const tag of tags) {
    const item = document.createElement("li");
    item.textContent = tag;
    elements.tagList.append(item);
  }
}

function makeSourceCaption(image) {
  elements.imageCaption.replaceChildren();
  const details = [image.credit, image.license].filter(Boolean).join(" · ");
  if (details) elements.imageCaption.append(document.createTextNode(details));
  if (image.sourceUrl) {
    if (details) elements.imageCaption.append(document.createTextNode(" · "));
    const link = document.createElement("a");
    link.href = image.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "图片来源";
    elements.imageCaption.append(link);
  }
  elements.imageCaption.hidden = !details && !image.sourceUrl;
}

function renderImage(question) {
  const image = question.image;
  elements.media.hidden = !image;
  if (!image) {
    elements.image.removeAttribute("src");
    return;
  }

  elements.image.src = image.src;
  elements.image.alt = image.alt;
  elements.imageButton.setAttribute("aria-label", `查看完整图片：${image.alt}`);
  elements.image.onerror = () => {
    elements.imageCaption.hidden = false;
    elements.imageCaption.textContent = "图片加载失败，请检查 image.src 路径。";
  };
  makeSourceCaption(image);
}

function renderExplanationCopy(explanation) {
  elements.explanationCopy.replaceChildren();
  const paragraphs = explanation.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    const node = document.createElement("p");
    node.textContent = paragraph;
    elements.explanationCopy.append(node);
  }
}

function updateModeButtons() {
  for (const button of elements.modeButtons) {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function updateAnswerStatus(question) {
  const selected = selectedAnswers(question);
  if (state.revealed) return;
  elements.answerStatus.textContent = selected.length
    ? `已选择 ${selected.join("、")}`
    : question.type === "multiple"
      ? "本题为多选题，可选择多个选项"
      : "选择答案后也可以直接查看解析";
}

function clearRevealState(question) {
  state.revealed = false;
  elements.explanation.hidden = true;
  elements.reveal.textContent = "查看答案与解析";
  elements.reveal.setAttribute("aria-expanded", "false");
  for (const row of elements.optionList.querySelectorAll(".option-row")) {
    row.classList.remove("is-correct", "is-wrong");
    row.querySelector("input").disabled = false;
  }
  updateAnswerStatus(question);
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) return;
  const position = state.currentIndex + 1;
  const total = state.order.length;

  document.title = `${question.id} · 呼吸系统题库`;
  elements.positionCurrent.textContent = String(position);
  elements.positionTotal.textContent = String(total);
  elements.questionType.textContent = question.typeLabel;
  elements.progress.setAttribute("aria-valuenow", String(position));
  elements.progress.setAttribute("aria-valuemax", String(total));
  elements.progressFill.style.width = `${(position / total) * 100}%`;
  elements.stableId.textContent = question.id;
  elements.difficulty.textContent = question.difficulty;
  elements.difficulty.dataset.level = question.difficulty;
  elements.title.textContent = question.stem;
  elements.optionList.replaceChildren();
  for (const option of question.options) elements.optionList.append(createOption(question, option));
  renderTags(question.tags);
  renderImage(question);
  renderExplanationCopy(question.explanation);
  elements.correctAnswer.textContent = question.answers.join("、");
  elements.navPosition.textContent = question.id;
  elements.previous.disabled = state.currentIndex === 0;
  elements.next.disabled = state.currentIndex === total - 1;
  elements.previous.setAttribute("aria-label", position === 1 ? "已经是第一题" : `上一题，第 ${position - 1} 题`);
  elements.next.setAttribute("aria-label", position === total ? "已经是最后一题" : `下一题，第 ${position + 1} 题`);
  clearRevealState(question);
  updateModeButtons();
  saveState();
}

function compareAnswers(selected, correct) {
  if (selected.length !== correct.length) return false;
  const correctSet = new Set(correct);
  return selected.every((answer) => correctSet.has(answer));
}

function revealAnswer() {
  const question = currentQuestion();
  if (!question) return;

  if (state.revealed) {
    clearRevealState(question);
    return;
  }

  state.revealed = true;
  const selected = selectedAnswers(question);
  const isCorrect = compareAnswers(selected, question.answers);
  for (const row of elements.optionList.querySelectorAll(".option-row")) {
    const key = row.dataset.key;
    const input = row.querySelector("input");
    input.disabled = true;
    row.classList.toggle("is-correct", question.answers.includes(key));
    row.classList.toggle("is-wrong", selected.includes(key) && !question.answers.includes(key));
  }

  if (!selected.length) {
    elements.selectionFeedback.textContent = "你尚未选择答案，下面直接显示正确答案与解析。";
    elements.selectionFeedback.dataset.result = "empty";
  } else if (isCorrect) {
    elements.selectionFeedback.textContent = `你的选择：${selected.join("、")}。判断正确。`;
    elements.selectionFeedback.dataset.result = "correct";
  } else {
    elements.selectionFeedback.textContent = `你的选择：${selected.join("、")}。请结合解析检查判断步骤。`;
    elements.selectionFeedback.dataset.result = "wrong";
  }

  elements.explanation.hidden = false;
  elements.reveal.textContent = "收起答案与解析";
  elements.reveal.setAttribute("aria-expanded", "true");
  elements.answerStatus.textContent = "绿色为正确选项，棕红色为已选错项";
}

function goToIndex(index) {
  if (index < 0 || index >= state.order.length || index === state.currentIndex) return;
  state.currentIndex = index;
  renderQuestion();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}

function switchMode(mode) {
  if (mode === "random" && state.mode === "random") {
    const currentId = currentQuestion()?.id;
    const otherIds = state.questions.map((question) => question.id).filter((id) => id !== currentId);
    state.randomOrder = currentId ? [currentId, ...shuffle(otherIds)] : shuffle(otherIds);
    rebuildOrder(currentId);
    elements.jumpMessage.textContent = "已重新随机排列，当前题保持不变。";
    renderQuestion();
    return;
  }

  if (mode === state.mode) return;
  const currentId = currentQuestion()?.id || "";
  state.mode = mode;
  if (mode === "random" && !validRandomOrder(state.randomOrder)) {
    const otherIds = state.questions.map((question) => question.id).filter((id) => id !== currentId);
    state.randomOrder = currentId ? [currentId, ...shuffle(otherIds)] : shuffle(otherIds);
  }
  rebuildOrder(currentId);
  elements.jumpMessage.textContent = mode === "random" ? "已切换为随机顺序。再次点击“随机”可重新排列。" : "已切换为题号顺序。";
  renderQuestion();
}

function normalizeJumpId(value) {
  const input = text(value).toUpperCase();
  if (/^\d{1,3}$/.test(input)) return `R${input.padStart(3, "0")}`;
  return input;
}

function jumpToQuestion(value) {
  const id = normalizeJumpId(value);
  const index = state.order.findIndex((question) => question.id === id);
  if (index < 0) {
    elements.jumpMessage.textContent = `没有找到“${value}”。可输入 R001-R100 或数字 1-100。`;
    elements.jumpInput.setAttribute("aria-invalid", "true");
    return;
  }
  elements.jumpInput.removeAttribute("aria-invalid");
  elements.jumpInput.value = id;
  elements.jumpMessage.textContent = `已跳到 ${id}。`;
  if (index === state.currentIndex) renderQuestion();
  else goToIndex(index);
}

function openImageDialog() {
  const question = currentQuestion();
  if (!question?.image) return;
  const image = question.image;
  elements.dialogTitle.textContent = `${question.id} 题目图片`;
  elements.dialogImage.src = image.src;
  elements.dialogImage.alt = image.alt;
  elements.dialogCredit.replaceChildren();
  const details = [image.credit, image.license].filter(Boolean).join(" · ");
  if (details) elements.dialogCredit.append(document.createTextNode(details));
  if (image.sourceUrl) {
    if (details) elements.dialogCredit.append(document.createTextNode(" · "));
    const link = document.createElement("a");
    link.href = image.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "打开图片来源";
    elements.dialogCredit.append(link);
  }
  if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
  else window.open(image.src, "_blank", "noopener,noreferrer");
}

async function loadQuestions() {
  showOnly(elements.loading);
  elements.jumpMessage.textContent = "";
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`读取题库失败（HTTP ${response.status}）。`);
    const payload = await response.json();
    const rawQuestions = Array.isArray(payload) ? payload : payload.questions;
    if (!Array.isArray(rawQuestions)) throw new Error("questions.json 必须是数组，或包含 questions 数组。 ");
    if (rawQuestions.length === 0) {
      showOnly(elements.empty);
      return;
    }

    const questions = rawQuestions.map(normalizeQuestion);
    const ids = questions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) throw new Error("题库中存在重复 id。 ");

    state.questions = questions;
    state.questionById = new Map(questions.map((question) => [question.id, question]));
    const preferredId = loadSavedState();
    rebuildOrder(preferredId);
    showOnly(elements.sheet);
    renderQuestion();
  } catch (error) {
    const fileHint = window.location.protocol === "file:"
      ? "浏览器不允许直接从本地文件读取 JSON。请使用 README 中的本地服务器命令打开。"
      : "请确认 data/questions.json 存在并符合 README 中的字段说明。";
    elements.errorMessage.textContent = `${error.message} ${fileHint}`;
    showOnly(elements.error);
  }
}

elements.retry.addEventListener("click", loadQuestions);
elements.reveal.addEventListener("click", revealAnswer);
elements.previous.addEventListener("click", () => goToIndex(state.currentIndex - 1));
elements.next.addEventListener("click", () => goToIndex(state.currentIndex + 1));
elements.modeButtons.forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.mode)));
elements.jumpForm.addEventListener("submit", (event) => {
  event.preventDefault();
  jumpToQuestion(elements.jumpInput.value);
});
elements.imageButton.addEventListener("click", openImageDialog);
elements.dialogClose.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

loadQuestions();
