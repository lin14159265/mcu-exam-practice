(function () {
  "use strict";

  const STORAGE_KEY = "mcu_exam_practice_records_v1";
  const THEME_STORAGE_KEY = "mcu_exam_practice_theme_v1";
  const SESSION_STORAGE_KEY = "mcu_exam_practice_session_v1";
  const PREFERENCES_STORAGE_KEY = "mcu_exam_practice_preferences_v1";
  const DEFAULT_PREFERENCES = Object.freeze({
    scope: "all",
    excludeMasteredWrong: true,
    roundSize: "10",
    order: "sequential",
    judgeMode: "instant",
  });
  const PREFERENCE_VALUES = {
    scope: new Set(["all", "unattempted", "wrongHistory", "wrong1", "wrong2", "wrong3", "errorRate50", "lastWrong", "starred", "unmastered"]),
    roundSize: new Set(["10", "20", "50", "all"]),
    order: new Set(["sequential", "random"]),
    judgeMode: new Set(["instant", "batch"]),
  };
  const questions = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];

  const state = {
    records: loadRecords(),
    roundQuestions: [],
    currentIndex: 0,
    judgeMode: "instant",
    currentSubmitted: false,
    currentSelection: [],
    draftAnswers: {},
    instantAnswers: {},
    batchAnswers: {},
    batchSubmitted: false,
    roundCompleted: false,
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
    questionActions: document.getElementById("questionActions"),
    practiceProgress: document.getElementById("practiceProgress"),
    practiceProgressBar: document.getElementById("practiceProgressBar"),
    practiceProgressText: document.getElementById("practiceProgressText"),
    questionNavigatorBtn: document.getElementById("questionNavigatorBtn"),
    questionNavigatorDialog: document.getElementById("questionNavigatorDialog"),
    questionNavigatorSummary: document.getElementById("questionNavigatorSummary"),
    questionNavigatorGrid: document.getElementById("questionNavigatorGrid"),
    closeNavigatorBtn: document.getElementById("closeNavigatorBtn"),
    starBtn: document.getElementById("starBtn"),
    masteredBtn: document.getElementById("masteredBtn"),
    questionCard: document.getElementById("questionCard"),
    questionTitle: document.getElementById("questionTitle"),
    optionsBox: document.getElementById("optionsBox"),
    resultBox: document.getElementById("resultBox"),
    explanationBox: document.getElementById("explanationBox"),
    quickStartBtn: document.getElementById("quickStartBtn"),
    submitAnswerBtn: document.getElementById("submitAnswerBtn"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    finishRoundBtn: document.getElementById("finishRoundBtn"),
    submitRoundBtn: document.getElementById("submitRoundBtn"),
    viewRoundResultBtn: document.getElementById("viewRoundResultBtn"),
    roundCompletePanel: document.getElementById("roundCompletePanel"),
    roundResultMessage: document.getElementById("roundResultMessage"),
    roundResultTotal: document.getElementById("roundResultTotal"),
    roundResultCorrect: document.getElementById("roundResultCorrect"),
    roundResultWrong: document.getElementById("roundResultWrong"),
    roundResultAccuracy: document.getElementById("roundResultAccuracy"),
    roundWrongReview: document.getElementById("roundWrongReview"),
    retryWrongBtn: document.getElementById("retryWrongBtn"),
    restartRoundBtn: document.getElementById("restartRoundBtn"),
    completeSettingsBtn: document.getElementById("completeSettingsBtn"),
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

  function normalizePracticePreferences(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      scope: PREFERENCE_VALUES.scope.has(source.scope) ? source.scope : DEFAULT_PREFERENCES.scope,
      excludeMasteredWrong:
        typeof source.excludeMasteredWrong === "boolean"
          ? source.excludeMasteredWrong
          : DEFAULT_PREFERENCES.excludeMasteredWrong,
      roundSize: PREFERENCE_VALUES.roundSize.has(String(source.roundSize))
        ? String(source.roundSize)
        : DEFAULT_PREFERENCES.roundSize,
      order: PREFERENCE_VALUES.order.has(source.order) ? source.order : DEFAULT_PREFERENCES.order,
      judgeMode: PREFERENCE_VALUES.judgeMode.has(source.judgeMode) ? source.judgeMode : DEFAULT_PREFERENCES.judgeMode,
    };
  }

  function loadPracticePreferences() {
    try {
      const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      return normalizePracticePreferences(raw ? JSON.parse(raw) : DEFAULT_PREFERENCES);
    } catch (error) {
      console.error("练习偏好读取失败，将使用默认设置：", error);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  function getPracticePreferences() {
    return normalizePracticePreferences({
      scope: el.scopeSelect.value,
      excludeMasteredWrong: el.excludeMasteredWrong.checked,
      roundSize: el.roundSizeSelect.value,
      order: el.orderSelect.value,
      judgeMode: el.judgeModeSelect.value,
    });
  }

  function applyPracticePreferences(preferences) {
    const normalized = normalizePracticePreferences(preferences);
    el.scopeSelect.value = normalized.scope;
    el.excludeMasteredWrong.checked = normalized.excludeMasteredWrong;
    el.roundSizeSelect.value = normalized.roundSize;
    el.orderSelect.value = normalized.order;
    el.judgeModeSelect.value = normalized.judgeMode;
  }

  function savePracticePreferences() {
    const preferences = getPracticePreferences();
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("练习偏好保存失败：", error);
    }
    updateQuickStartPresentation();
    return preferences;
  }

  function getSelectedOptionText(select) {
    return select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent.trim() : "";
  }

  function getPracticeConfigSummary() {
    const parts = [
      getSelectedOptionText(el.scopeSelect),
      getSelectedOptionText(el.roundSizeSelect),
      getSelectedOptionText(el.orderSelect),
      getSelectedOptionText(el.judgeModeSelect),
    ];
    if (el.excludeMasteredWrong.checked && isMistakeScope(el.scopeSelect.value)) {
      parts.push("排除已掌握");
    }
    return parts.filter(Boolean).join(" · ");
  }

  function updateQuickStartPresentation() {
    const preferences = getPracticePreferences();
    const isDefault = Object.keys(DEFAULT_PREFERENCES).every(
      (key) => preferences[key] === DEFAULT_PREFERENCES[key],
    );
    el.quickStartBtn.textContent = isDefault ? "开始默认练习" : "按当前设置开始";
    if (!state.roundQuestions.length && questions.length) {
      el.resultBox.textContent = `当前设置：${getPracticeConfigSummary()}。更多选项可在“设置与数据”中调整。`;
    }
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

  function clearPracticeSession() {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error("当前练习清理失败：", error);
    }
  }

  function savePracticeSession() {
    if (!state.roundQuestions.length) {
      clearPracticeSession();
      return;
    }

    try {
      // 当前轮次与历史学习记录分开保存，恢复页面时不会重复累计答题次数。
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          roundQuestionIds: state.roundQuestions.map((question) => question.id),
          currentIndex: state.currentIndex,
          judgeMode: state.judgeMode,
          draftAnswers: state.draftAnswers,
          instantAnswers: state.instantAnswers,
          batchAnswers: state.batchAnswers,
          batchSubmitted: state.batchSubmitted,
          roundCompleted: state.roundCompleted,
        })
      );
    } catch (error) {
      console.error("当前练习保存失败：", error);
    }
  }

  function restorePracticeSession() {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return false;

      const saved = JSON.parse(raw);
      const questionMap = new Map(questions.map((question) => [question.id, question]));
      // 题库更新后只恢复仍然存在的题目，并把当前位置限制在有效范围内。
      const roundQuestions = Array.isArray(saved.roundQuestionIds)
        ? saved.roundQuestionIds.map((id) => questionMap.get(Number(id))).filter(Boolean)
        : [];
      if (!roundQuestions.length) {
        clearPracticeSession();
        return false;
      }

      const validIds = new Set(roundQuestions.map((question) => String(question.id)));
      const normalizeAnswerMap = (input) =>
        Object.fromEntries(
          Object.entries(input || {})
            .filter(([id, answer]) => validIds.has(String(id)) && normalizeAnswer(answer))
            .map(([id, answer]) => [id, normalizeAnswer(answer)]),
        );

      state.roundQuestions = roundQuestions;
      state.currentIndex = Math.min(Math.max(Number(saved.currentIndex) || 0, 0), roundQuestions.length - 1);
      state.judgeMode = saved.judgeMode === "batch" ? "batch" : "instant";
      state.draftAnswers = normalizeAnswerMap(saved.draftAnswers);
      state.instantAnswers = normalizeAnswerMap(saved.instantAnswers);
      state.batchAnswers = normalizeAnswerMap(saved.batchAnswers);
      state.batchSubmitted =
        state.judgeMode === "batch" &&
        Boolean(saved.batchSubmitted) &&
        roundQuestions.every((question) => state.batchAnswers[question.id]);
      state.roundCompleted =
        state.judgeMode === "batch"
          ? state.batchSubmitted
          : Boolean(saved.roundCompleted) && roundQuestions.every((question) => state.instantAnswers[question.id]);
      return true;
    } catch (error) {
      console.error("当前练习恢复失败，已清除损坏的会话：", error);
      clearPracticeSession();
      return false;
    }
  }

  function applyTheme(theme) {
    const normalizedTheme = theme === "github-dark" ? "github-dark" : "lab-light";
    const themeAction = normalizedTheme === "github-dark" ? "切换到浅色主题" : "切换到 GitHub Dark";
    document.documentElement.dataset.theme = normalizedTheme;
    if (el.themeLabel) {
      el.themeLabel.textContent = normalizedTheme === "github-dark" ? "浅色实验室" : "GitHub Dark";
    }
    el.themeToggleBtn.setAttribute("aria-label", themeAction);
    el.themeToggleBtn.title = themeAction;
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
    if (targetView === "practice") focusPracticeSurface();
  }

  function focusPracticeSurface() {
    requestAnimationFrame(() => {
      const target = state.roundCompleted ? el.roundCompletePanel : el.questionCard;
      if (target && !target.hidden) target.focus({ preventScroll: true });
    });
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

  function beginRound(roundQuestions, judgeMode, emptyMessage = "当前筛选条件下没有可练习的题目。") {
    state.roundQuestions = roundQuestions.slice();
    state.currentIndex = 0;
    state.judgeMode = judgeMode === "batch" ? "batch" : "instant";
    state.currentSubmitted = false;
    state.currentSelection = [];
    state.draftAnswers = {};
    state.instantAnswers = {};
    state.batchAnswers = {};
    state.batchSubmitted = false;
    state.roundCompleted = false;

    if (!state.roundQuestions.length) {
      renderEmptyRound(emptyMessage);
      setView("practice");
      return false;
    }

    renderQuestion();
    savePracticeSession();
    setView("practice");
    return true;
  }

  function startRound() {
    savePracticePreferences();
    let pool = getFilteredQuestions();
    if (el.orderSelect.value === "random") {
      pool = shuffle(pool);
    } else {
      pool = pool.slice().sort((a, b) => a.id - b.id);
    }

    const size = el.roundSizeSelect.value;
    const roundQuestions = size === "all" ? pool : pool.slice(0, Number(size));
    beginRound(roundQuestions, el.judgeModeSelect.value);
  }

  function resetRound() {
    state.roundQuestions = [];
    state.currentIndex = 0;
    state.currentSubmitted = false;
    state.currentSelection = [];
    state.draftAnswers = {};
    state.instantAnswers = {};
    state.batchAnswers = {};
    state.batchSubmitted = false;
    state.roundCompleted = false;
    clearPracticeSession();
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

    el.questionCard.hidden = false;
    el.roundCompletePanel.hidden = true;
    el.questionActions.hidden = false;

    const instantAnswer = state.instantAnswers[question.id] || "";
    const batchAnswer = state.batchAnswers[question.id] || "";
    const draftAnswer = state.draftAnswers[question.id] || "";
    state.currentSubmitted = state.judgeMode === "instant" && Boolean(instantAnswer);
    state.currentSelection = (state.judgeMode === "batch" ? batchAnswer : instantAnswer || draftAnswer).split("");

    el.questionPosition.textContent = `第 ${state.currentIndex + 1} / ${state.roundQuestions.length} 题 · 题库 ${question.id} 号`;
    el.questionType.textContent = question.type || "题目";
    el.questionTitle.textContent = question.question;
    el.resultBox.className = "result-box muted";
    el.resultBox.textContent =
      state.judgeMode === "batch"
        ? batchAnswer
          ? "本题答案已自动保存，提交本轮前不会显示正确答案。"
          : "批量提交模式：选择答案后自动保存，提交本轮前不会显示正确答案。"
        : "请选择答案。";
    el.explanationBox.style.display = "none";
    el.explanationBox.textContent = "";

    renderOptions(question);
    if (state.judgeMode === "instant" && instantAnswer) {
      renderAnswerResult(question, instantAnswer, instantAnswer === normalizeAnswer(question.answer));
    } else if (state.judgeMode === "batch" && state.batchSubmitted && batchAnswer) {
      renderAnswerResult(question, batchAnswer, batchAnswer === normalizeAnswer(question.answer));
    }
    renderQuestionStats(question);
    renderPracticeProgress();
    renderRoundStats();
    updateQuestionButtons(question);
  }

  function renderOptions(question) {
    const isMulti = question.type === "多选题" || question.answer.length > 1;
    const inputType = isMulti ? "checkbox" : "radio";
    el.optionsBox.innerHTML = "";

    Object.entries(question.options).forEach(([letter, text], index) => {
      const label = document.createElement("label");
      label.className = "option-item";

      const input = document.createElement("input");
      input.type = inputType;
      input.name = `question-${question.id}`;
      input.value = letter;
      input.checked = state.currentSelection.includes(letter);
      input.setAttribute("aria-keyshortcuts", `${letter} ${index + 1}`);

      const content = document.createElement("span");
      content.innerHTML = `<span class="option-letter">${letter}.</span>${escapeHtml(text)}`;

      input.addEventListener("change", () => {
        updateSelectionFromInputs();
        persistCurrentSelection();
        renderSelectedOptions();
        if (state.judgeMode === "batch") {
          el.resultBox.className = "result-box";
          el.resultBox.textContent = state.currentSelection.length
            ? "本题答案已自动保存，提交本轮前不会显示正确答案。"
            : "本题尚未作答。";
          renderPracticeProgress();
          renderRoundStats();
        }
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

  function persistCurrentSelection() {
    const question = getCurrentQuestion();
    if (!question || state.batchSubmitted) return;

    const answer = normalizeAnswer(state.currentSelection.join(""));
    if (state.judgeMode === "batch") {
      // 批量模式选择即保存，用户前后切题或刷新页面都不会丢失草稿。
      if (answer) {
        state.batchAnswers[question.id] = answer;
      } else {
        delete state.batchAnswers[question.id];
      }
      delete state.draftAnswers[question.id];
    } else if (!state.currentSubmitted) {
      if (answer) {
        state.draftAnswers[question.id] = answer;
      } else {
        delete state.draftAnswers[question.id];
      }
    }
    savePracticeSession();
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
    const isLastQuestion = hasQuestion && state.currentIndex >= state.roundQuestions.length - 1;

    el.quickStartBtn.style.display = "none";
    el.submitAnswerBtn.style.display = hasQuestion && !isBatch && isMulti ? "" : "none";
    el.submitAnswerBtn.textContent = "提交本题";
    el.submitAnswerBtn.disabled = !hasQuestion || state.currentSubmitted;
    el.prevBtn.style.display = hasQuestion ? "" : "none";
    el.prevBtn.disabled = !hasQuestion || state.currentIndex <= 0;
    el.nextBtn.style.display = hasQuestion ? "" : "none";
    el.nextBtn.textContent = isLastQuestion ? "已到最后一题" : "下一题";
    el.nextBtn.disabled = !hasQuestion || isLastQuestion;
    el.finishRoundBtn.style.display = hasQuestion && !isBatch && isLastQuestion && !state.roundCompleted ? "" : "none";
    el.submitRoundBtn.style.display = hasQuestion && isBatch && !state.batchSubmitted ? "" : "none";
    el.submitRoundBtn.disabled = !hasQuestion || state.batchSubmitted;
    el.viewRoundResultBtn.style.display = hasQuestion && state.roundCompleted ? "" : "none";
    el.starBtn.disabled = !hasQuestion;
    el.masteredBtn.disabled = !hasQuestion;
  }

  function submitCurrentAnswer() {
    const question = getCurrentQuestion();
    if (!question) return;

    updateSelectionFromInputs();
    persistCurrentSelection();
    const answer = normalizeAnswer(state.currentSelection.join(""));
    if (!answer) {
      alert("请先选择答案。");
      return;
    }

    if (state.judgeMode === "batch") {
      state.batchAnswers[question.id] = answer;
      el.resultBox.className = "result-box";
      el.resultBox.textContent = "本题答案已保存，批量提交前不会显示正确答案。";
      savePracticeSession();
      renderPracticeProgress();
      renderRoundStats();
      return;
    }

    if (state.currentSubmitted) return;
    const correct = answer === normalizeAnswer(question.answer);
    updateLearningRecord(question, answer, correct);
    state.currentSubmitted = true;
    state.instantAnswers[question.id] = answer;
    delete state.draftAnswers[question.id];
    savePracticeSession();
    renderAnswerResult(question, answer, correct);
    renderQuestionStats(question);
    renderPracticeProgress();
    renderRoundStats();
    renderSummary();
    updateQuestionButtons(question);
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

  function goToQuestion(index) {
    if (index < 0 || index >= state.roundQuestions.length || index === state.currentIndex) return;
    updateSelectionFromInputs();
    persistCurrentSelection();
    state.currentIndex = index;
    renderQuestion();
    savePracticeSession();
  }

  function previousQuestion() {
    goToQuestion(state.currentIndex - 1);
  }

  function nextQuestion() {
    goToQuestion(state.currentIndex + 1);
  }

  function getRoundResult() {
    const answers = state.judgeMode === "batch" ? state.batchAnswers : state.instantAnswers;
    const result = { total: state.roundQuestions.length, correct: [], wrong: [], unanswered: [] };

    state.roundQuestions.forEach((question, index) => {
      const answer = normalizeAnswer(answers[question.id]);
      const item = { question, answer, index };
      if (!answer) {
        result.unanswered.push(item);
      } else if (answer === normalizeAnswer(question.answer)) {
        result.correct.push(item);
      } else {
        result.wrong.push(item);
      }
    });

    return result;
  }

  function finishRound() {
    if (state.judgeMode !== "instant" || !state.roundQuestions.length) return;
    const result = getRoundResult();
    if (result.unanswered.length) {
      goToQuestion(result.unanswered[0].index);
      alert(`还有 ${result.unanswered.length} 道题未作答，已跳转到第一道未答题。`);
      return;
    }

    state.roundCompleted = true;
    savePracticeSession();
    renderRoundComplete();
  }

  function submitRound() {
    if (state.judgeMode !== "batch" || !state.roundQuestions.length) return;
    if (state.batchSubmitted) {
      renderRoundComplete();
      return;
    }

    const current = getCurrentQuestion();
    if (current) {
      updateSelectionFromInputs();
      persistCurrentSelection();
    }

    const result = getRoundResult();
    if (result.unanswered.length) {
      goToQuestion(result.unanswered[0].index);
      alert(`还有 ${result.unanswered.length} 道题未作答，已跳转到第一道未答题。`);
      return;
    }

    state.roundQuestions.forEach((question) => {
      const answer = normalizeAnswer(state.batchAnswers[question.id]);
      updateLearningRecord(question, answer, answer === normalizeAnswer(question.answer));
    });

    state.batchSubmitted = true;
    state.roundCompleted = true;
    savePracticeSession();
    renderSummary();
    renderRoundComplete();
  }

  function renderRoundComplete() {
    const result = getRoundResult();
    if (!state.roundCompleted || result.unanswered.length) return;

    const accuracy = result.total ? result.correct.length / result.total : 0;
    el.questionCard.hidden = true;
    el.roundCompletePanel.hidden = false;
    el.questionActions.hidden = true;
    el.questionPosition.textContent = "本轮完成";
    el.questionType.textContent = state.judgeMode === "batch" ? "批量提交" : "立即判题";
    el.roundResultTotal.textContent = result.total;
    el.roundResultCorrect.textContent = result.correct.length;
    el.roundResultWrong.textContent = result.wrong.length;
    el.roundResultAccuracy.textContent = percent(accuracy);
    el.roundResultMessage.textContent = result.wrong.length
      ? `本轮有 ${result.wrong.length} 道错题，可点击复查或立即重练。`
      : "本轮全部答对，可以再练本轮巩固。";
    el.retryWrongBtn.disabled = result.wrong.length === 0;
    el.roundWrongReview.innerHTML = result.wrong.length
      ? result.wrong
          .map(
            ({ question, answer, index }) => `
              <button class="wrong-review-item" type="button" data-question-index="${index}">
                <span class="wrong-review-number">题库 ${question.id} 号</span>
                <strong>${escapeHtml(question.question)}</strong>
                <span class="wrong-review-answer">你的答案：${escapeHtml(answer)} · 正确答案：${escapeHtml(
                  question.answer,
                )}（${escapeHtml(getAnswerText(question, question.answer))}）</span>
              </button>`,
          )
          .join("")
      : '<p class="round-perfect">本轮没有错题。</p>';

    renderPracticeProgress();
    renderRoundStats();
    setView("practice");
  }

  function reviewRoundQuestion(index) {
    if (!state.roundCompleted || index < 0 || index >= state.roundQuestions.length) return;
    state.currentIndex = index;
    renderQuestion();
    savePracticeSession();
  }

  function retryWrongRound() {
    const wrongQuestions = getRoundResult().wrong.map(({ question }) => question);
    if (!wrongQuestions.length) return;
    beginRound(wrongQuestions, "instant", "本轮没有错题需要重练。");
  }

  function restartRound() {
    beginRound(state.roundQuestions, state.judgeMode);
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

  function getAnsweredCount() {
    const answers = state.judgeMode === "batch" ? state.batchAnswers : state.instantAnswers;
    return state.roundQuestions.reduce((count, question) => count + (answers[question.id] ? 1 : 0), 0);
  }

  function getQuestionRoundStatus(question) {
    const answers = state.judgeMode === "batch" ? state.batchAnswers : state.instantAnswers;
    const answer = normalizeAnswer(answers[question.id]);
    if (!answer) return "unanswered";
    if (state.judgeMode === "batch" && !state.batchSubmitted) return "answered";
    return answer === normalizeAnswer(question.answer) ? "correct" : "wrong";
  }

  function getQuestionStatusLabel(status) {
    return {
      unanswered: "未答",
      answered: "已答",
      correct: "答对",
      wrong: "答错",
    }[status];
  }

  function renderQuestionNavigator() {
    const total = state.roundQuestions.length;
    if (!total) {
      el.questionNavigatorBtn.hidden = true;
      el.questionNavigatorSummary.textContent = "本轮尚未开始。";
      el.questionNavigatorGrid.innerHTML = "";
      if (el.questionNavigatorDialog.open) el.questionNavigatorDialog.close();
      return;
    }

    const answered = getAnsweredCount();
    el.questionNavigatorBtn.hidden = false;
    el.questionNavigatorSummary.textContent = state.roundCompleted
      ? `本轮已完成，共 ${total} 题。点击题号可复查答案。`
      : `已完成 ${answered} / ${total}，当前第 ${state.currentIndex + 1} 题。`;
    el.questionNavigatorGrid.innerHTML = state.roundQuestions
      .map((question, index) => {
        const status = getQuestionRoundStatus(question);
        const isCurrent = index === state.currentIndex;
        const statusLabel = getQuestionStatusLabel(status);
        const currentLabel = isCurrent ? "，当前题" : "";
        return `
          <button
            class="navigator-index ${status}${isCurrent ? " current" : ""}"
            type="button"
            data-round-index="${index}"
            aria-label="第 ${index + 1} 题，题库 ${question.id} 号，${statusLabel}${currentLabel}"
            ${isCurrent ? 'aria-current="step"' : ""}
          >
            <span>${index + 1}</span>
            <small>#${question.id}</small>
          </button>`;
      })
      .join("");
  }

  function openQuestionNavigator() {
    if (!state.roundQuestions.length) return;
    renderQuestionNavigator();
    if (!el.questionNavigatorDialog.open) {
      if (typeof el.questionNavigatorDialog.showModal === "function") {
        el.questionNavigatorDialog.showModal();
      } else {
        el.questionNavigatorDialog.setAttribute("open", "");
      }
    }
    requestAnimationFrame(() => {
      const current = el.questionNavigatorGrid.querySelector("[aria-current='step']");
      if (current) {
        current.focus({ preventScroll: true });
        current.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function closeQuestionNavigator() {
    if (el.questionNavigatorDialog.open) el.questionNavigatorDialog.close();
  }

  function navigateFromQuestionNavigator(index) {
    closeQuestionNavigator();
    if (state.roundCompleted) {
      reviewRoundQuestion(index);
    } else if (index !== state.currentIndex) {
      goToQuestion(index);
    }
  }

  function renderPracticeProgress() {
    const total = state.roundQuestions.length;
    if (!total) {
      el.practiceProgress.hidden = true;
      el.practiceProgressBar.style.width = "0%";
      el.practiceProgressText.textContent = "已完成 0 / 0";
      renderQuestionNavigator();
      return;
    }

    const answered = getAnsweredCount();
    const progress = Math.round((answered / total) * 100);
    el.practiceProgress.hidden = false;
    el.practiceProgress.setAttribute("role", "progressbar");
    el.practiceProgress.setAttribute("aria-valuemin", "0");
    el.practiceProgress.setAttribute("aria-valuemax", String(total));
    el.practiceProgress.setAttribute("aria-valuenow", String(answered));
    el.practiceProgressBar.style.width = `${progress}%`;
    el.practiceProgressText.textContent = `已完成 ${answered} / ${total}`;
    renderQuestionNavigator();
  }

  function renderRoundStats() {
    if (!state.roundQuestions.length) {
      el.roundStats.className = "round-stats muted";
      el.roundStats.textContent = "尚未开始本轮练习。";
      return;
    }

    if (state.roundCompleted) {
      const result = getRoundResult();
      el.roundStats.className = "round-stats";
      el.roundStats.innerHTML = [
        `<strong>本轮题数：</strong>${result.total}`,
        `<strong>答对数量：</strong>${result.correct.length}`,
        `<strong>答错数量：</strong>${result.wrong.length}`,
        `<strong>正确率：</strong>${percent(result.total ? result.correct.length / result.total : 0)}`,
      ].join("<br>");
      return;
    }

    const answered = getAnsweredCount();
    el.roundStats.className = "round-stats";
    el.roundStats.innerHTML = [
      `<strong>本轮题数：</strong>${state.roundQuestions.length}`,
      `<strong>当前进度：</strong>${state.currentIndex + 1} / ${state.roundQuestions.length}`,
      state.judgeMode === "batch"
        ? `<strong>已保存答案：</strong>${answered}`
        : `<strong>已完成题目：</strong>${answered}`,
      `<strong>模式：</strong>${state.judgeMode === "batch" ? "批量提交" : "立即判题"}`,
    ].join("<br>");
  }

  function renderEmptyRound(message) {
    if (!state.roundQuestions.length) {
      clearPracticeSession();
    }
    el.questionCard.hidden = false;
    el.roundCompletePanel.hidden = true;
    el.questionActions.hidden = false;
    el.questionPosition.textContent = "未开始";
    el.questionType.textContent = "";
    el.questionTitle.textContent = message;
    el.optionsBox.innerHTML = "";
    el.resultBox.className = "result-box muted";
    el.resultBox.textContent = questions.length
      ? `当前设置：${getPracticeConfigSummary()}。更多选项可在“设置与数据”中调整。`
      : message;
    el.explanationBox.style.display = "none";
    el.quickStartBtn.style.display = questions.length ? "" : "none";
    el.submitAnswerBtn.style.display = "none";
    el.prevBtn.style.display = "none";
    el.nextBtn.style.display = "none";
    el.finishRoundBtn.style.display = "none";
    el.submitRoundBtn.style.display = "none";
    el.viewRoundResultBtn.style.display = "none";
    el.starBtn.disabled = true;
    el.masteredBtn.disabled = true;
    renderPracticeProgress();
    renderQuestionStats(null);
    renderRoundStats();
    updateQuickStartPresentation();
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
      version: 2,
      exportedAt: new Date().toISOString(),
      records: state.records,
      preferences: getPracticePreferences(),
      theme: getStoredTheme(),
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
        if (data.preferences) {
          const preferences = normalizePracticePreferences(data.preferences);
          applyPracticePreferences(preferences);
          savePracticePreferences();
        }
        if (data.theme) {
          const theme = data.theme === "github-dark" ? "github-dark" : "lab-light";
          applyTheme(theme);
          saveTheme(theme);
        }
        resetRound();
        renderSummary();
        setView("settings");
        alert("学习数据导入完成。");
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
    resetRound();
    renderSummary();
    setView("settings");
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

  function isTypingTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.matches("input[type='radio'], input[type='checkbox']")) return false;
    return Boolean(target.closest("input, select, textarea, button, [contenteditable='true']"));
  }

  function handlePracticeKeyboard(event) {
    if (event.repeat || state.activeView !== "practice" || el.questionNavigatorDialog.open) return;
    if (event.altKey || event.metaKey || isTypingTarget(event.target)) return;

    const question = getCurrentQuestion();
    if (!question || state.roundCompleted) return;

    if (!event.ctrlKey && event.key.toLowerCase() === "g") {
      event.preventDefault();
      openQuestionNavigator();
      return;
    }

    if (!event.ctrlKey && /^[a-d1-4]$/i.test(event.key)) {
      const index = /^[1-4]$/.test(event.key) ? Number(event.key) - 1 : event.key.toUpperCase().charCodeAt(0) - 65;
      const input = el.optionsBox.querySelectorAll("input")[index];
      if (input && !input.disabled) {
        event.preventDefault();
        input.click();
      }
      return;
    }

    if (event.key === "ArrowLeft" || (event.key === "Enter" && event.shiftKey)) {
      if (!el.prevBtn.disabled) {
        event.preventDefault();
        previousQuestion();
      }
      return;
    }

    if (event.key === "ArrowRight") {
      if (!el.nextBtn.disabled) {
        event.preventDefault();
        nextQuestion();
      }
      return;
    }

    if (event.key !== "Enter") return;

    if (event.ctrlKey && state.judgeMode === "batch") {
      event.preventDefault();
      submitRound();
      return;
    }
    if (event.ctrlKey || event.shiftKey) return;

    const isMulti = question.type === "多选题" || question.answer.length > 1;
    if (state.judgeMode === "instant" && isMulti && !state.currentSubmitted) {
      event.preventDefault();
      submitCurrentAnswer();
    } else if (state.judgeMode === "instant" && state.currentSubmitted) {
      event.preventDefault();
      if (state.currentIndex >= state.roundQuestions.length - 1) finishRound();
      else nextQuestion();
    } else if (state.judgeMode === "batch" && !el.nextBtn.disabled) {
      event.preventDefault();
      nextQuestion();
    }
  }

  function bindEvents() {
    el.viewPracticeBtn.addEventListener("click", () => setView("practice"));
    el.viewSettingsBtn.addEventListener("click", () => setView("settings"));
    el.themeToggleBtn.addEventListener("click", toggleTheme);
    el.questionNavigatorBtn.addEventListener("click", openQuestionNavigator);
    el.closeNavigatorBtn.addEventListener("click", closeQuestionNavigator);
    el.questionNavigatorGrid.addEventListener("click", (event) => {
      const item = event.target.closest && event.target.closest("[data-round-index]");
      if (item) navigateFromQuestionNavigator(Number(item.dataset.roundIndex));
    });
    el.questionNavigatorDialog.addEventListener("click", (event) => {
      if (event.target !== el.questionNavigatorDialog) return;
      const rect = el.questionNavigatorDialog.getBoundingClientRect();
      const outside =
        event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) closeQuestionNavigator();
    });
    el.questionNavigatorDialog.addEventListener("close", focusPracticeSurface);
    el.quickStartBtn.addEventListener("click", () => el.startBtn.click());
    el.startBtn.addEventListener("click", startRound);
    el.resetRoundBtn.addEventListener("click", resetRound);
    el.submitAnswerBtn.addEventListener("click", submitCurrentAnswer);
    el.prevBtn.addEventListener("click", previousQuestion);
    el.nextBtn.addEventListener("click", nextQuestion);
    el.finishRoundBtn.addEventListener("click", finishRound);
    el.submitRoundBtn.addEventListener("click", submitRound);
    el.viewRoundResultBtn.addEventListener("click", renderRoundComplete);
    el.retryWrongBtn.addEventListener("click", retryWrongRound);
    el.restartRoundBtn.addEventListener("click", restartRound);
    el.completeSettingsBtn.addEventListener("click", () => setView("settings"));
    el.roundWrongReview.addEventListener("click", (event) => {
      const item = event.target.closest && event.target.closest("[data-question-index]");
      if (item) reviewRoundQuestion(Number(item.dataset.questionIndex));
    });
    el.starBtn.addEventListener("click", toggleStarred);
    el.masteredBtn.addEventListener("click", toggleMastered);
    el.exportRecordsBtn.addEventListener("click", exportRecords);
    el.importRecordsInput.addEventListener("change", importRecords);
    el.exportWrongBtn.addEventListener("click", exportWrongList);
    el.clearRecordsBtn.addEventListener("click", clearRecords);
    [el.scopeSelect, el.excludeMasteredWrong, el.roundSizeSelect, el.orderSelect, el.judgeModeSelect].forEach(
      (control) => control.addEventListener("change", savePracticePreferences),
    );
    document.addEventListener("keydown", handlePracticeKeyboard);
  }

  function init() {
    applyTheme(getStoredTheme());
    applyPracticePreferences(loadPracticePreferences());
    bindEvents();
    renderSummary();
    setView("practice");
    if (restorePracticeSession()) {
      if (state.roundCompleted) renderRoundComplete();
      else renderQuestion();
      return;
    }
    renderEmptyRound(questions.length ? "点击“开始练习”后开始刷题。" : "没有加载到题库，请先运行 node parser.js 生成 questions.js。");
  }

  init();
})();
