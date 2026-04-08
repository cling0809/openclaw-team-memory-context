# Contributing

感谢你愿意改进这份公开版 OpenClaw 仓库。

## 先看边界

这个仓库是可公开分发的工作树，不是作者本机运行态快照。

不要提交这些内容：

- `.openclaw-public/` 下的任何文件
- `auth-profiles.json`、`*.token.json`、设备配对文件
- 会话 transcript、日志、运行时 state、临时测试产物
- 含有真实 API key、OAuth token、绝对本机路径的文本或截图

## 提交前最少检查

```bash
pnpm public:audit
```

如果你修改了 `dist/control-ui/` 下的脚本，建议额外做两步：

```bash
node --check dist/control-ui/assets/buli-team-panel.js
node --check dist/control-ui/assets/teamTaskStore.js
```

## 文档与截图

- 截图请确认没有 token、绝对路径、账号信息、会话内容泄露
- 文档里的密钥示例请只用占位符，不要放真实值
- 如果新增“本地状态目录”相关说明，默认写 `.openclaw-public/`，不要写作者私人运行目录

## Pull Request 建议

- 说明这次改动是否影响运行时公开边界
- 如果动了初始化脚本或模板，请写清迁移方式
- 如果动了 UI 资源，请说明是否需要强刷缓存
