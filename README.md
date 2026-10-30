# Qingzuo LabelEdit plugin

Independent PDF label editing and offline OCR plugin. Source extracted from ZhiPenTu/LabelEdit commit 6042881; the original history and published desktop releases remain in that repository.

Plugin ID: official.labeledit. Version: 0.1.4. Requires plugin API ^1.1.0.

SDK 1.1.1 is pinned to the platform's immutable sdk-v1.1.1 Release tarball, including its lockfile integrity. It contains the corrected packaged-host testing helper; the runtime API remains 1.1.0.

Run npm ci, npm test, python -m pytest -q, npm run build. Prepare OCR models with python -m backend.ocr_service, then npm run build:backend and npm run pack.

macOS packaging uses framework-free CPython 3.12.11 from uv. Python, RapidOCR models and fonts are included in the plugin artifact; users need no developer runtimes.

Host acceptance uses QINGZUO_HOST_EXECUTABLE and npm run test:host. CI downloads an explicit successful platform validation run; it never checks out platform source. Releases contain platform-specific .ecplugin files and unsigned catalog fragments. Market verification and signing belong to qingzuo-market.
