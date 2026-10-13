# AGENTS.md

本仓库是轻作独立 `official.labeledit` 插件，负责 PDF 标签编辑、离线 OCR 和导出。桌面底座、市场目录和业务发布审核在其他仓库完成。

## 项目边界

- `src/` 是插件 UI 和编辑器；`backend/` 是通过底座沙箱 RPC 调用的 PDF/OCR backend；`scripts/pack-plugin.mjs` 生成平台制品和目录片段。
- `tests/` 包含前端、Python backend、固定底座 host 和公开市场验收；`docs/` 记录 OCR、PDF 和第三方资源约束。
- 插件 manifest 位于根 `package.json`：ID 为 `official.labeledit`，API 兼容范围为 `^1.1.0`，SDK 使用固定的 1.1.1 Release tarball。

## 开发环境与命令

使用 Node 24、Python 3.12；macOS backend 打包使用 framework-free CPython 3.12.11（由 uv 管理）。常用流程：

```sh
npm ci --ignore-scripts
npm test
python -m pytest -q
npm run build
python -m backend.ocr_service       # 需要本地模型时准备/检查 OCR 资源
npm run build:backend
npm run pack
```

`npm run build:backend` 生成 `release/plugin/backend`，`npm run pack` 生成当前平台的 `.ecplugin` 和 `release/catalog-*.json`。这些目录是生成物，不要提交。

固定底座验收需要明确的已验证制品路径：

```sh
QINGZUO_HOST_EXECUTABLE=/path/to/Qingzuo npm run test:host
```

完整 CI 顺序和跨平台制品要求以 `.github/workflows/release.yml` 为准；需要旧 API 兼容性时使用 `tests/legacy-host.mjs`。

## 实现与安全约定

- OCR 和 PDF 处理必须保持离线，通过 SDK 文件令牌、宿主授权和沙箱 RPC 传递数据；backend 不得自行联网、读取插件目录外文件或启动其他程序。
- 继续使用 `backend/paths.py`、资源校验和逐行 JSON RPC。构建时拒绝外部符号链接、循环链接、断链和目录穿越；不要通过复制整个外部目录绕过校验。
- 用户凭据、文件路径、文件字节和其他插件数据不能暴露给 UI 或日志。导出使用 SDK 文件保存通道，不依赖浏览器下载事件。
- 修改 PDF/OCR 生命周期时，同时验证取消、资源释放、失败恢复、临时文件清理和重复打开；不要只验证正常识别。
- 不要把 OCR 模型、字体、Python 虚拟环境、`node_modules` 或开发密钥放进源码提交。依赖版本和许可证分别维护在 requirements 文件、lockfile 和 `docs/third-party-notices.md`。

## 发布与市场边界

- 发布 tag 必须与 `package.json` 版本一致，且 macOS arm64 / Windows x64 制品和 catalog 片段都由固定 host 验收生成。
- CI 通过 `QINGZUO_HOST_RUN_ID` 下载成功的底座验证制品，不得 checkout 底座源码来替代固定安装包验收。
- `npm run test:host` 可测试本地打包制品；`QINGZUO_PUBLIC_MARKET=1` 用于安装已发布的签名市场制品。模拟 OCR 或 CI 结果不能声称为最低系统验收。
- 市场 Ed25519 签名和目录 PR 属于 `qingzuo-market`。本仓库不保存市场私钥，不直接修改市场目录，不把真实用户凭据或付费服务放进测试。

## 变更流程

1. 先阅读受影响的 UI/backend 模块、对应 Python/TypeScript 测试和 `docs/ocr-engine.md`、`docs/pdf-engine.md`。
2. 保持插件 manifest、SDK 类型、运行时调用和打包脚本同步；不要顺手改动无关 UI。
3. 运行针对性测试，再运行 `npm test`、`python -m pytest -q`、`npm run build`，涉及制品时补充 `npm run pack` 和固定 host 测试。
4. 检查 `git diff --check`、`git status` 和 `release/` 生成物，最终说明实际验证平台与尚未完成的真实验收。
