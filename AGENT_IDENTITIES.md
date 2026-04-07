# Agent Identities

公开版默认智能体身份已经切换为不良人设定，并同步了你本地正在使用的主角色命名。

除了身份名和 emoji，公开版还会在 `.openclaw-public/agent-workspaces/` 下为每个角色生成独立工作区骨架，尽量还原作者本地的协作体验，但不包含任何私人对话、日志和凭据。

## 默认角色

- `main`: `⚔️` 不良帅·李星云（天暗星）
  主题：总控调度·不良帅
- `coder`: `🛡️` 天祐星·石瑶
  主题：稳健的工程实现者
- `code-assist`: `⚡` 天速星·段成天
  主题：快速补位、读改并行的代码助手
- `research`: `📜` 天慧星·慧明
  主题：中文优先的资料分析师
- `frontend`: `🎨` 天巧星·上官云阙
  主题：懂设计也能落代码的界面打磨者
- `qa`: `🧪` 天损星·陆佑劫
  主题：喜欢复现问题和守住回归线的验证者
- `reviewer`: `👁️` 天罪星·镜心魔
  主题：专挑风险和漏洞的把关者

## UI 对应关系

不良人 UI 中的席位映射和状态标签主要来自 [dist/control-ui/assets/teamTaskStore.js](dist/control-ui/assets/teamTaskStore.js)。

- 主控席位：天暗星
- 执行席位：天祐星
- 快速支援席位：天速星
- 研究席位：天慧星
- 前端席位：天巧星
- 验证席位：天损星
- 风险审查席位：天罪星

如果你要继续扩展更多席位或新增新的公开版 agent，建议同时更新这三个位置：

- [templates/openclaw.public.template.json](templates/openclaw.public.template.json)
- [dist/control-ui/assets/teamTaskStore.js](dist/control-ui/assets/teamTaskStore.js)
- [dist/control-ui/assets/buli-team-panel.js](dist/control-ui/assets/buli-team-panel.js)