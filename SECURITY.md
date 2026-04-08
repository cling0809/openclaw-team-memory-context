# Security

## 仓库边界

这个仓库只接受可公开分发的源码、文档、模板和预编译运行时代码。

请不要通过 issue、discussion 或 pull request 提交以下内容：

- `.openclaw-public/` 目录内容
- `auth-profiles.json`、`*.token.json`、设备配对文件
- 会话日志、任务 transcript、运行时快照
- 任何真实 API key、OAuth token、Webhook secret

## 发现问题时

如果你发现下面这类问题，请不要公开贴出原始内容：

- 仓库里出现了疑似真实密钥
- 文档、截图或配置模板泄露了私人信息
- 运行脚本会把私人状态写回受版本控制目录

优先做法：

1. 最小化描述问题范围，不贴出完整 secret
2. 通过 GitHub 私下渠道或维护者可见方式报告
3. 给出相关文件路径和复现步骤

## 本仓库已有护栏

- `.gitignore` 默认排除本地运行态
- `pnpm public:audit` 会检查常见敏感文件和高风险模式
- GitHub Actions 会在 push / pull request 时自动跑公开仓库审计
