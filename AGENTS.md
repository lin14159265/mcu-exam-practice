# AGENTS.md

## 项目目标

本项目是一个本地运行的单片机课程期末复习刷题网页。题库来自 `questions.txt`，通过 `parser.js` 生成 `questions.js`，网页直接读取本地脚本数据并用 `localStorage` 保存学习记录。

## 目录结构

- `index.html`：页面入口和主要区域结构。
- `style.css`：布局、组件样式、响应式适配。
- `app.js`：练习模式、判题、学习记录、错题筛选、导入导出。
- `questions.txt`：老师题库原文，是题库源文件。
- `explanations.json`：题目解析 sidecar，包含答案快照、知识点、核验状态、来源和人工复核队列。
- `parser.js`：题库解析脚本。
- `questions.js`：自动生成的数据文件，不建议手动编辑。
- `README.md`：使用和题库解析说明。
- `HANDOFF.md`：当前完成度、已验证状态、已知风险和后续优先级；新对话应优先阅读。
- `start-local.bat`：Windows 本地静态服务启动脚本，用于访问 `http://127.0.0.1:8765/index.html`。

## 技术栈

- 纯前端：HTML + CSS + JavaScript。
- 无后端、无数据库、无构建工具。
- 数据持久化使用浏览器 `localStorage`。
- 学习记录 key 为 `mcu_exam_practice_records_v1`；主题 key 为 `mcu_exam_practice_theme_v1`；当前轮次 key 为 `mcu_exam_practice_session_v1`；练习偏好 key 为 `mcu_exam_practice_preferences_v1`。
- 题库生成依赖本机 Node.js 运行 `parser.js`。

## 关键入口

- 改题库或解析：先看 `parser.js`、`questions.txt` 和 `explanations.json`。
- 改刷题流程或记录规则：先看 `app.js`。
- 改界面布局、视图切换或主题：先看 `index.html`、`style.css` 和 `app.js`。
- 改使用说明：同步更新 `README.md`。
- 接手工程或规划下一轮优化：先看 `HANDOFF.md`，再用 Git 状态核对是否已过期。

## 常用命令

```bash
node parser.js
```

用于从 `questions.txt` 重新生成 `questions.js`。网页本身可直接打开 `index.html`，不需要启动开发服务器。

```text
start-local.bat
```

用于在 Windows 上启动本地静态服务。若用户说 `127.0.0.1:8765` 打不开，优先检查该脚本窗口是否仍在运行、8765 端口是否被占用。

## 代码风格与边界

- 默认最小改动，不做无关重构或大面积格式化。
- 保持纯静态文件结构，不引入后端、数据库或前端框架，除非需求明确升级。
- `questions.js` 是生成文件；题库内容应优先改 `questions.txt` 后重新生成。
- 不直接修改 `questions.js` 中的解析；修改 `explanations.json` 后必须运行 `node parser.js`。
- `verified` 解析必须使用受信任来源；失效、占位或普通教程来源应降为 `needs_review`。
- 新增学习记录字段时，要兼容旧 `localStorage` 数据。
- 导入学习数据时要兼容旧版仅包含 `records` 或直接记录对象的 JSON。
- 修改当前轮次恢复逻辑时，要验证旧浏览器中不存在 session key、session 损坏和题库更新后三种情况均可正常降级。

## 关键风险点

- 直接双击本地 HTML 时，部分浏览器限制 `fetch` 本地 JSON，所以当前采用 `questions.js` 全局变量加载题库。
- 清空学习记录会删除浏览器本地数据，操作前应提醒用户导出备份。
- 题库文本格式不统一时，解析器需要输出清晰错误，方便手动修正。
- 题库答案与解析答案不一致时，解析器会拒绝生成，不能绕过该校验。

## 改动验证方式

- 修改题库解析后，运行 `node parser.js`，确认题数和题型统计正确。
- 修改解析后，确认 200 题知识点非空、已核验/待复核数量、来源链接和 reviewQueue 一致，并运行知识点缺失及答案冲突负向测试。
- 修改刷题逻辑后，至少手测单选、多选、判断题各一题。
- 修改学习记录后，验证刷新页面记录不丢失，并测试导入导出。
- 修改练习导航后，验证上一题/下一题、批量答案自动保存和刷新恢复当前题。
- 修改本轮结果逻辑后，验证立即判题与批量提交都能进入结果页，错题复查、重练错题和再练本轮均不重复累计旧答案。
- 修改题目导航后，验证当前/未答/已答/答对/答错状态、随机题库原题号、完成态复查和 200 题手机滚动均正常。
- 修改练习偏好或快捷键后，验证刷新恢复设置、设置页不误触、题目弹窗不误触及立即/批量两种模式。
- 修改布局后，检查做题视图和设置与数据视图能正常切换，桌面和手机窄屏下题干、选项、按钮不重叠。
- 修改主题后，检查浅色实验室和 GitHub Dark 两套配色下选中、正确、错误、禁用状态都清晰可读。
