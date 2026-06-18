(function () {
  "use strict";

  const STORAGE_KEY = "mcu_exam_practice_records_v1";
  const THEME_STORAGE_KEY = "mcu_exam_practice_theme_v1";
  const questions = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];

  const state = {
    records: loadRecords(),
    roundQuestions: [],
    currentIndex: 0,
    judgeMode: "instant",
    currentSubmitted: false,
    currentSelection: [],
    batchAnswers: {},
    batchSubmitted: false,
    activeView: "practice",
  };

  const el = {
    practiceView: document.getElementById("practiceView"),
    settingsView: document.getElementById("settingsView"),
    viewPracticeBtn: document.getElementById("viewPracticeBtn"),
    viewSettingsBtn: document.getElementById("viewSettingsBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    themeLabel: document.getElementById("themeLabel"),
    totalCount: document.getElementById("totalCount"),
    doneCount: document.getElementById("doneCount"),
    wrongCount: document.getElementById("wrongCount"),
    accuracyRate: document.getElementById("accuracyRate"),
    masteredCount: document.getElementById("masteredCount"),
    scopeSelect: document.getElementById("scopeSelect"),
    excludeMasteredWrong: document.getElementById("excludeMasteredWrong"),
    roundSizeSelect: document.getElementById("roundSizeSelect"),
    orderSelect: document.getElementById("orderSelect"),
    judgeModeSelect: document.getElementById("judgeModeSelect"),
    startBtn: document.getElementById("startBtn"),
    resetRoundBtn: document.getElementById("resetRoundBtn"),
    exportRecordsBtn: document.getElementById("exportRecordsBtn"),
    importRecordsInput: document.getElementById("importRecordsInput"),
    exportWrongBtn: document.getElementById("exportWrongBtn"),
    clearRecordsBtn: document.getElementById("clearRecordsBtn"),
    questionPosition: document.getElementById("questionPosition"),
    questionType: document.getElementById("questionType"),
    starBtn: document.getElementById("starBtn"),
    masteredBtn: document.getElementById("masteredBtn"),
    questionTitle: document.getElementById("questionTitle"),
    optionsBox: document.getElementById("optionsBox"),
    resultBox: document.getElementById("resultBox"),
    explanationBox: document.getElementById("explanationBox"),
    quickStartBtn: document.getElementById("quickStartBtn"),
    submitAnswerBtn: document.getElementById("submitAnswerBtn"),
    nextBtn: document.getElementById("nextBtn"),
    submitRoundBtn: document.getElementById("submitRoundBtn"),
    currentAttempts: document.getElementById("currentAttempts"),
    currentCorrect: document.getElementById("currentCorrect"),
    currentWrong: document.getElementById("currentWrong"),
    currentWrongRate: document.getElementById("currentWrongRate"),
    currentStreak: document.getElementById("currentStreak"),
    currentMastered: document.getElementById("currentMastered"),
    currentStarred: document.getElementById("currentStarred"),
    roundStats: document.getElementById("roundStats"),
  };

  function createDefaultRecord(questionId) {
    return {
      questionId,
      attempts: 0,
      correctCount: 0,
      wrongCount: 0,
      lastAnswer: "",
      lastCorrect: null,
      lastTime: "",
      consecutiveCorrect: 0,
      mastered: false,
      starred: false,
    };
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeRecords(JSON.parse(raw)) : {};
    } catch (error) {
      console.error("学习记录读取失败，将使用空记录：", error);
      return {};
    }
  }

  function normalizeRecords(input) {
    const output = {};
    const source = Array.isArray(input) ? input : Object.values(input || {});
    source.forEach((item) => {
      const id = Number(item.questionId || item.id);
      if (!id) return;
      output[id] = {
        ...createDefaultRecord(id),
        ...item,
        questionId: id,
        attempts: Number(item.attempts || 0),
        correctCount: Number(item.correctCount || 0),
        wrongCount: Number(item.wrongCount || 0),
        consecutiveCorrect: Number(item.consecutiveCorrect || 0),
        mastered: Boolean(item.mastered),
        starred: Boolean(item.starred),
        lastCorrect: item.lastCorrect === null || typeof item.lastCorrect === "boolean" ? item.lastCorrect : null,
      };
    });
    return output;
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === "github-dark" ? "github-dark" : "lab-light";
    } catch (error) {
      return "lab-light";
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error("主题设置保存失败：", error);
    }
  }

  function applyTheme(theme) {
    const normalizedTheme = theme === "github-dark" ? "github-dark" : "lab-light";
    document.documentElement.dataset.theme = normalizedTheme;
    if (el.themeLabel) {
      el.themeLabel.textContent = normalizedTheme === "github-dark" ? "浅色实验室" : "GitHub Dark";
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme === "github-dark" ? "github-dark" : "lab-light";
    const nextTheme = currentTheme === "github-dark" ? "lab-light" : "github-dark";
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  }

  function setView(viewName) {
    const targetView = viewName === "settings" ? "settings" : "practice";
    state.activeView = targetView;
    el.practiceView.hidden = targetView !== "practice";
    el.settingsView.hidden = targetView !== "settings";
    el.viewPracticeBtn.classList.toggle("is-active", targetView === "practice");
    el.viewSettingsBtn.classList.toggle("is-active", targetView === "settings");
  }

  function getRecord(questionId) {
    if (!state.records[questionId]) {
      state.records[questionId] = createDefaultRecord(questionId);
    }
    return state.records[questionId];
  }

  function percent(value) {
    if (!Number.isFinite(value)) return "0%";
    return `${Math.round(value * 100)}%`;
  }

  function getWrongRate(record) {
    // 错误率只在已作答时计算，避免未做题出现除以 0。
    return record.attempts > 0 ? record.wrongCount / record.attempts : 0;
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .toUpperCase()
      .split("")
      .filter(Boolean)
      .sort()
      .join("");
  }

  function getAnswerText(question, answer) {
    return normalizeAnswer(answer)
      .split("")
      .map((letter) => `${letter}. ${question.options[letter] || ""}`)
      .join("；");
  }

  function isMistakeScope(scope) {
    return ["wrongHistory", "wrong1", "wrong2", "wrong3", "errorRate50", "lastWrong"].includes(scope);
  }

  function getFilteredQuestions() {
    const scope = el.scopeSelect.value;
    const excludeMastered = el.excludeMasteredWrong.checked && isMistakeScope(scope);
    return questions.filter((question) => {
      const record = getRecord(question.id);
      if (excludeMastered && record.mastered) return false;

      switch (scope) {
        case "unattempted":
          return record.attempts === 0;
        case "wrongHistory":
          return record.wrongCount > 0;
        case "wrong1":
          return record.wrongCount >= 1;
        case "wrong2":
          return record.wrongCount >= 2;
        case "wrong3":
          return record.wrongCount >= 3;
        case "errorRate50":
          return record.attempts > 0 && getWrongRate(record) >= 0.5;
        case "lastWrong":
          return record.lastCorrect === false;
        case "starred":
          return record.starred;
        case "unmastered":
          return !record.mastered;
        default:
          return true;
      }
    });
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startRound() {
    let pool = getFilteredQuestions();
    if (el.orderSelect.value === "random") {
      pool = shuffle(pool);
    } else {
      pool = pool.slice().sort((a, b) => a.id - b.id);
    }

    const size = el.roundSizeSelect.value;
    state.roundQuestions = size === "all" ? pool : pool.slice(0, Number(size));
    state.currentIndex = 0;
    state.judgeMode = el.judgeModeSelect.value;
    state.currentSubmitted = false;
    state.currentSelection = [];
    state.batchAnswers = {};
    state.batchSubmitted = false;

    if (!state.roundQuestions.length) {
      renderEmptyRound("当前筛选条件下没有可练习的题目。");
      setView("practice");
      return;
    }

    renderQuestion();
    renderRoundStats();
    setView("practice");
  }

  function resetRound() {
    state.roundQuestions = [];
    state.currentIndex = 0;
    state.currentSubmitted = false;
    state.currentSelection = [];
    state.batchAnswers = {};
    state.batchSubmitted = false;
    renderEmptyRound("当前练习已重置。");
    setView("practice");
  }

  function getCurrentQuestion() {
    return state.roundQuestions[state.currentIndex] || null;
  }

  function renderQuestion() {
    const question = getCurrentQuestion();
    if (!question) {
      renderEmptyRound("点击“开始练习”后开始刷题。");
      return;
    }

    state.currentSubmitted = false;
    state.currentSelection = state.batchAnswers[question.id] ? state.batchAnswers[question.id].split("") : [];

    el.questionPosition.textContent = `第 ${state.currentIndex + 1} / ${state.roundQuestions.length} 题 · 题库 ${question.id} 号`;
    el.questionType.textContent = question.type || "题目";
    el.questionTitle.textContent = question.question;
    el.resultBox.className = "result-box muted";
    el.resultBox.textContent = state.judgeMode === "batch" ? "批量提交模式：本题作答后不会立即显示答案。" : "请选择答案。";
    el.explanationBox.style.display = "none";
    el.explanationBox.textContent = "";

    renderOptions(question);
    renderQuestionStats(question);
    updateQuestionButtons(question);
  }

  function renderOptions(question) {
    const isMulti = question.type === "多选题" || question.answer.length > 1;
    const inputType = isMulti ? "checkbox" : "radio";
    el.optionsBox.innerHTML = "";

    Object.entries(question.options).forEach(([letter, text]) => {
      const label = document.createElement("label");
      label.className = "option-item";

      const input = document.createElement("input");
      input.type = inputType;
      input.name = `question-${question.id}`;
      input.value = letter;
      input.checked = state.currentSelection.includes(letter);

      const content = document.createElement("span");
      content.innerHTML = `<span class="option-letter">${letter}.</span>${escapeHtml(text)}`;

      input.addEventListener("change", () => {
        updateSelectionFromInputs();
        renderSelectedOptions();
        if (state.judgeMode === "instant" && !isMulti) {
          submitCurrentAnswer();
        }
      });

      label.append(input, content);
      el.optionsBox.appendChild(label);
    });

    renderSelectedOptions();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateSelectionFromInputs() {
    state.currentSelection = Array.from(el.optionsBox.querySelectorAll("input:checked"))
      .map((input) => input.value)
      .sort();
  }

  function renderSelectedOptions() {
    const selected = new Set(state.currentSelection);
    el.optionsBox.querySelectorAll(".option-item").forEach((item) => {
      const input = item.querySelector("input");
      item.classList.toggle("selected", selected.has(input.value));
    });
  }

  function updateQuestionButtons(question) {
    const isMulti = question && (question.type === "多选题" || question.answer.length > 1);
    const isBatch = state.judgeMode === "batch";
    const hasQuestion = Boolean(question);

    el.quickStartBtn.style.display = "none";
    el.submitAnswerBtn.style.display = hasQuestion && (isBatch || isMulti) ? "" : "none";
    el.submitAnswerBtn.textContent = isBatch ? "保存本题答案" : "提交本题";
    el.submitAnswerBtn.disabled = !hasQuestion || state.batchSubmitted;
    el.nextBtn.style.display = hasQuestion ? "" : "none";
    el.nextBtn.textContent = state.currentIndex >= state.roundQuestions.length - 1 ? "已到最后一题" : "下一题";
    el.nextBtn.disabled = !hasQuestion || state.currentIndex >= state.roundQuestions.length - 1;
    el.submitRoundBtn.style.display = hasQuestion && isBatch ? "" : "none";
    el.submitRoundBtn.disabled = !hasQuestion || state.batchSubmitted;
    el.starBtn.disabled = !hasQuestion;
    el.masteredBtn.disabled = !hasQuestion;
  }

  function submitCurrentAnswer() {
    const question = getCurrentQuestion();
    if (!question) return;

    updateSelectionFromInputs();
    const answer = normalizeAnswer(state.currentSelection.join(""));
    if (!answer) {
      alert("请先选择答案。");
      return;
    }

    if (state.judgeMode === "batch") {
      state.batchAnswers[question.id] = answer;
      el.resultBox.className = "result-box";
      el.resultBox.textContent = "本题答案已保存，批量提交前不会显示正确答案。";
      renderRoundStats();
      return;
    }

    if (state.currentSubmitted) return;
    const correct = answer === normalizeAnswer(question.answer);
    updateLearningRecord(question, answer, correct);
    state.currentSubmitted = true;
    renderAnswerResult(question, answer, correct);
    renderQuestionStats(question);
    renderSummary();
  }

  function updateLearningRecord(question, answer, correct) {
    const record = getRecord(question.id);
    record.attempts += 1;
    record.lastAnswer = answer;
    record.lastCorrect = correct;
    record.lastTime = new Date().toISOString();

    if (correct) {
      record.correctCount += 1;
      record.consecutiveCorrect += 1;
    } else {
      record.wrongCount += 1;
      record.consecutiveCorrect = 0;
    }

    // 连续答对 3 次自动掌握；手动取消后，后续再次连续 3 次仍会自动恢复掌握。
    if (record.consecutiveCorrect >= 3) {
      record.mastered = true;
    }

    saveRecords();
  }

  function renderAnswerResult(question, answer, correct) {
    markOptionResult(question, answer);
    if (correct) {
      el.resultBox.className = "result-box success";
      el.resultBox.textContent = "回答正确。";
    } else {
      el.resultBox.className = "result-box error";
      el.resultBox.innerHTML = [
        "回答错误。",
        `你的答案：${answer || "未作答"}`,
        `正确答案：${question.answer}`,
        `正确选项内容：${escapeHtml(getAnswerText(question, question.answer))}`,
      ].join("<br>");
    }

    if (question.explanation) {
      el.explanationBox.style.display = "block";
      el.explanationBox.textContent = `解析：${question.explanation}`;
    }
  }

  function markOptionResult(question, answer) {
    const selected = new Set(normalizeAnswer(answer).split(""));
    const correct = new Set(normalizeAnswer(question.answer).split(""));
    el.optionsBox.querySelectorAll(".option-item").forEach((item) => {
      const input = item.querySelector("input");
      const letter = input.value;
      item.classList.toggle("correct", correct.has(letter));
      item.classList.toggle("wrong", selected.has(letter) && !correct.has(letter));
      input.disabled = true;
    });
  }

  function nextQuestion() {
    if (state.currentIndex < state.roundQuestions.length - 1) {
      state.currentIndex += 1;
      renderQuestion();
    }
  }

  function submitRound() {
    if (state.judgeMode !== "batch" || !state.roundQuestions.length) return;
    if (state.batchSubmitted) {
      alert("本轮答案已经提交，请重新开始一轮练习。");
      return;
    }

    const current = getCurrentQuestion();
    if (current) {
      updateSelectionFromInputs();
      if (state.currentSelection.length) {
        state.batchAnswers[current.id] = normalizeAnswer(state.currentSelection.join(""));
      }
    }

    const missing = state.roundQuestions.filter((question) => !state.batchAnswers[question.id]);
    if (missing.length) {
      alert(`还有 ${missing.length} 道题未作答，请完成后再提交。`);
      return;
    }

    const wrongItems = [];
    let correctCount = 0;

    state.roundQuestions.forEach((question) => {
      const answer = normalizeAnswer(state.batchAnswers[question.id]);
      const correct = answer === normalizeAnswer(question.answer);
      updateLearningRecord(question, answer, correct);
      if (correct) {
        correctCount += 1;
      } else {
        wrongItems.push({ question, answer });
      }
    });

    state.batchSubmitted = true;
    renderBatchResult(correctCount, wrongItems);
    renderQuestionStats(getCurrentQuestion());
    renderSummary();
    updateQuestionButtons(getCurrentQuestion());
  }

  function renderBatchResult(correctCount, wrongItems) {
    const total = state.roundQuestions.length;
    const wrongCount = wrongItems.length;
    const list = wrongItems.length
      ? `<ol class="wrong-list">${wrongItems
          .map(({ question, answer }) => `<li>第 ${question.id} 题：你的答案 ${escapeHtml(answer)}，正确答案 ${escapeHtml(question.answer)}</li>`)
          .join("")}</ol>`
      : "<p>本轮没有错题。</p>";

    el.roundStats.className = "round-stats";
    el.roundStats.innerHTML = [
      `<strong>本轮题数：</strong>${total}`,
      `<strong>答对数量：</strong>${correctCount}`,
      `<strong>答错数量：</strong>${wrongCount}`,
      `<strong>正确率：</strong>${percent(correctCount / total)}`,
      "<strong>错题列表：</strong>",
      list,
    ].join("<br>");

    const question = getCurrentQuestion();
    if (question) {
      const answer = state.batchAnswers[question.id];
      renderAnswerResult(question, answer, answer === question.answer);
    }
  }

  function renderQuestionStats(question) {
    if (!question) {
      el.currentAttempts.textContent = "0";
      el.currentCorrect.textContent = "0";
      el.currentWrong.textContent = "0";
      el.currentWrongRate.textContent = "0%";
      el.currentStreak.textContent = "0";
      el.currentMastered.textContent = "否";
      el.currentStarred.textContent = "否";
      el.starBtn.textContent = "收藏";
      el.masteredBtn.textContent = "标记掌握";
      return;
    }

    const record = getRecord(question.id);
    el.currentAttempts.textContent = record.attempts;
    el.currentCorrect.textContent = record.correctCount;
    el.currentWrong.textContent = record.wrongCount;
    el.currentWrongRate.textContent = percent(getWrongRate(record));
    el.currentStreak.textContent = record.consecutiveCorrect;
    el.currentMastered.textContent = record.mastered ? "是" : "否";
    el.currentStarred.textContent = record.starred ? "是" : "否";
    el.starBtn.textContent = record.starred ? "取消收藏" : "收藏";
    el.masteredBtn.textContent = record.mastered ? "取消掌握" : "标记掌握";
  }

  function renderSummary() {
    let attempts = 0;
    let correct = 0;
    const doneIds = new Set();
    let wrongQuestions = 0;
    let mastered = 0;

    questions.forEach((question) => {
      const record = getRecord(question.id);
      attempts += record.attempts;
      correct += record.correctCount;
      if (record.attempts > 0) doneIds.add(question.id);
      if (record.wrongCount > 0) wrongQuestions += 1;
      if (record.mastered) mastered += 1;
    });

    el.totalCount.textContent = questions.length;
    el.doneCount.textContent = doneIds.size;
    el.wrongCount.textContent = wrongQuestions;
    el.accuracyRate.textContent = percent(attempts ? correct / attempts : 0);
    el.masteredCount.textContent = mastered;
  }

  function renderRoundStats() {
    if (!state.roundQuestions.length) {
      el.roundStats.className = "round-stats muted";
      el.roundStats.textContent = "尚未开始本轮练习。";
      return;
    }

    const answered = Object.keys(state.batchAnswers).length;
    el.roundStats.className = "round-stats";
    el.roundStats.innerHTML = [
      `<strong>本轮题数：</strong>${state.roundQuestions.length}`,
      `<strong>当前进度：</strong>${state.currentIndex + 1} / ${state.roundQuestions.length}`,
      state.judgeMode === "batch" ? `<strong>已保存答案：</strong>${answered}` : "<strong>模式：</strong>立即判题",
    ].join("<br>");
  }

  function renderEmptyRound(message) {
    el.questionPosition.textContent = "未开始";
    el.questionType.textContent = "";
    el.questionTitle.textContent = message;
    el.optionsBox.innerHTML = "";
    el.resultBox.className = "result-box muted";
    el.resultBox.textContent = message;
    el.explanationBox.style.display = "none";
    el.quickStartBtn.style.display = questions.length ? "" : "none";
    el.submitAnswerBtn.style.display = "none";
    el.nextBtn.style.display = "none";
    el.submitRoundBtn.style.display = "none";
    renderQuestionStats(null);
    renderRoundStats();
  }

  function toggleStarred() {
    const question = getCurrentQuestion();
    if (!question) return;
    const record = getRecord(question.id);
    record.starred = !record.starred;
    saveRecords();
    renderQuestionStats(question);
    renderSummary();
  }

  function toggleMastered() {
    const question = getCurrentQuestion();
    if (!question) return;
    const record = getRecord(question.id);
    record.mastered = !record.mastered;
    if (!record.mastered && record.consecutiveCorrect >= 3) {
      record.consecutiveCorrect = 0;
    }
    saveRecords();
    renderQuestionStats(question);
    renderSummary();
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportRecords() {
    downloadJson(`learning-records-${new Date().toISOString().slice(0, 10)}.json`, {
      exportedAt: new Date().toISOString(),
      records: state.records,
    });
  }

  function importRecords(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        state.records = normalizeRecords(data.records || data);
        saveRecords();
        renderSummary();
        renderQuestionStats(getCurrentQuestion());
        alert("学习记录导入完成。");
      } catch (error) {
        console.error("学习记录导入失败：", error);
        alert("导入失败，请确认选择的是有效 JSON 文件。");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function clearRecords() {
    const confirmed = confirm("此操作会删除所有做题记录，无法恢复，是否继续？");
    if (!confirmed) return;
    state.records = {};
    saveRecords();
    renderSummary();
    renderQuestionStats(getCurrentQuestion());
    renderRoundStats();
  }

  function exportWrongList() {
    const wrongList = questions
      .map((question) => ({ question, record: getRecord(question.id) }))
      .filter(({ record }) => record.wrongCount > 0)
      .map(({ question, record }) => ({
        id: question.id,
        type: question.type,
        question: question.question,
        options: question.options,
        answer: question.answer,
        answerText: getAnswerText(question, question.answer),
        wrongCount: record.wrongCount,
        wrongRate: getWrongRate(record),
        lastWrongAnswer: record.lastCorrect === false ? record.lastAnswer : "",
      }));

    downloadJson(`wrong-questions-${new Date().toISOString().slice(0, 10)}.json`, wrongList);
  }

  function bindEvents() {
    el.viewPracticeBtn.addEventListener("click", () => setView("practice"));
    el.viewSettingsBtn.addEventListener("click", () => setView("settings"));
    el.themeToggleBtn.addEventListener("click", toggleTheme);
    el.quickStartBtn.addEventListener("click", () => el.startBtn.click());
    el.startBtn.addEventListener("click", startRound);
    el.resetRoundBtn.addEventListener("click", resetRound);
    el.submitAnswerBtn.addEventListener("click", submitCurrentAnswer);
    el.nextBtn.addEventListener("click", nextQuestion);
    el.submitRoundBtn.addEventListener("click", submitRound);
    el.starBtn.addEventListener("click", toggleStarred);
    el.masteredBtn.addEventListener("click", toggleMastered);
    el.exportRecordsBtn.addEventListener("click", exportRecords);
    el.importRecordsInput.addEventListener("change", importRecords);
    el.exportWrongBtn.addEventListener("click", exportWrongList);
    el.clearRecordsBtn.addEventListener("click", clearRecords);
  }

  function init() {
    applyTheme(getStoredTheme());
    bindEvents();
    renderSummary();
    setView("practice");
    renderEmptyRound(questions.length ? "点击“开始练习”后开始刷题。" : "没有加载到题库，请先运行 node parser.js 生成 questions.js。");
  }

  init();
})();
