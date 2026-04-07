# Workspace Skills

这是给小龙虾额外补的本地技能包。

这些 skills 的目标不是替代 bundled skills，而是让它在你的工作流里更像一个会做事的本地助手：

- 中文优先
- 先搜集上下文再动手
- 做完顺手沉淀到文档和记忆
- 避免鲁莽 shell 操作
- 更会整理代码、文档、会议和网页资料
- 写代码更严密，先想清楚再下手
- 后端更稳，前端更有审美和完成度

目录中的每个子目录都对应一个 skill，入口文件都是 `SKILL.md`。

当前包含：

- `repo-dive`
- `bug-hunt`
- `china-research`
- `prompt-polish-zh`
- `doc-curator`
- `commit-craft`
- `release-guard`
- `shell-safe`
- `meeting-brief`
- `memory-keeper`
- `logic-rigour`
- `backend-brain`
- `test-forge`
- `code-review-hard`
- `frontend-taste`
- `ui-critic`
- `feishu-dispatch`
- `evidence-first`
- `team-router`

此外，OpenClaw 也可以通过环境变量 `OPENCLAW_SHARED_SKILLS_DIRS` 额外扫描一批共享 skills。
这些共享技能优先级低于这里的 workspace skills，但能明显补强：

- Playwright / UI 调试
- Figma / 设计到代码
- OpenAI Docs / 官方文档
- 部署（Vercel / Netlify / Render / Cloudflare）
- Notion / Linear / Slack 等外部工作流
