# qingzuo-plugin-labeledit Agent 指南

本文件适用于整个仓库。插件发布与宿主兼容规则沿用 qingzuo 插件约定。

## 构建缓存清理

- 先用 `npm run clean:cache -- --dry-run` 确认范围，再执行 `npm run clean:cache`；默认清理 `__pycache__`、`.pytest_cache`、`.ruff_cache`、`.mypy_cache`。
- 历史插件包用 `npm run clean:releases` 清理：每个平台/架构只保留最近 2 个 `.ecplugin` 版本；`catalog-*.json` 必须保留。
- `npm run clean:cache:deep` 会删除 `build`、`dist` 和 `release/plugin` 打包暂存目录；深度清理只在磁盘紧张时手动执行，不得接入打包、CI 或发布流程。
- 始终保留 `.venv`、`.venv-packaging`、`.models`、`node_modules`、最新 2 个插件包和当前 catalog 文件，避免重新安装依赖或丢失发布入口。
- 清理前确认没有 `npm run pack`、后端打包或宿主编排在运行；删除旧版本前确认新版本已完成构建与宿主验收。

## 验证

- 前端与类型：`npm run build`
- 前端测试：`npm test`
- 后端测试：`npm run test:backend`
- 发布打包：确认最新版本后再执行 `npm run pack`
