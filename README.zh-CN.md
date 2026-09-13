<div align="center">
  <a href="https://readest.com" target="_blank">
    <img src="https://github.com/readest/readest/blob/main/apps/readest-app/src-tauri/icons/icon.png?raw=true" alt="Readest Logo" width="20%" />
  </a>
  <h1>Readest 社区分支</h1>
  <p><a href="./README.md">English</a> | <strong>简体中文</strong></p>
</div>

Readest 是一款开源电子书阅读器，支持 Windows、macOS、Linux、Android、iOS 与 Web。本仓库是 Readest 的社区维护分支，默认 README 使用英文，这个页面提供简体中文说明。

## 关于这个分支

当前主线基于官方 Readest 0.12.8，并尽量保持后续跟进上游的能力。这个分支不会把账号整体伪装成 Premium，而是只解除那些不需要消耗 Readest 官方服务器资源的功能限制。

已经开放的功能包括 WebDAV、Google Drive、S3、OneDrive 等由用户自己提供存储空间的第三方同步，TTS 离线缓存与预下载，以及 Nearby BookDrop 的可信设备配对。Readest Cloud 官方云存储、服务器侧翻译额度、Send to Readest 邮件等依赖官方服务器资源的功能仍然按照官方规则工作。

## 版本下载

### 0.12.8-fork.1 — 跟进上游 / 开放本地与自有资源功能

[下载 0.12.8-fork.1](https://github.com/AndyScarlet233/readest/releases/tag/v0.12.8-fork.1)

这是目前主要维护的版本。它以官方 0.12.8 为基础，保留新版功能与后续同步上游的空间，同时开放第三方同步、TTS 离线缓存和 Nearby BookDrop 配对等不依赖官方云资源的功能。

### v0.12.6.22 — 完整局域网书籍同步版 / 暂停开发

[下载 v0.12.6.22](https://github.com/AndyScarlet233/readest/releases/tag/v0.12.6.22)

这是 0.12.6 系列最后一个公开版本，包含一套完整的局域网书籍同步机制，适合希望在自己的设备之间直接同步书籍的用户。由于这套机制涉及较多底层同步改动，持续跟进上游的维护成本较高，所以目前暂停继续开发，但已有版本会继续保留。

## Readest 的主要能力

Readest 支持 EPUB、PDF、MOBI、AZW3、FB2、CBZ、TXT、Markdown 等格式，提供分页与滚动阅读、全文搜索、标注与书签、词典与 Wikipedia 查询、并排阅读、字体与主题自定义、OPDS 与 Calibre、网页剪藏、翻译、TTS、有声书、跨平台同步、KOReader 同步以及多种无障碍功能。

完整的功能表、截图、故障排查与上游项目说明请查看默认英文 README： [README.md](./README.md)。

## 下载与使用

本分支自己的构建请优先从本仓库的 [Releases](https://github.com/AndyScarlet233/readest/releases) 下载。官方 App Store、Google Play、Flathub、Readest Web 与官方文档仍由上游 Readest 项目维护。

Windows 安装版依赖 Microsoft Edge WebView2 Runtime。若双击后没有窗口，请先确认系统已经安装并更新 WebView2 Runtime。

## 从源码构建

构建方式与上游基本一致，可参考仓库中的 [CONTRIBUTING.md](./CONTRIBUTING.md)。主分支用于跟进新版与维护当前 fork，develop 分支保留较早的深度定制历史与实验内容。

## 上游项目

上游仓库： [readest/readest](https://github.com/readest/readest)

官方网站： [readest.com](https://readest.com)

官方文档： [readest.com/docs](https://readest.com/docs)

## 许可证

Readest 使用 GNU Affero General Public License v3.0 或更高版本发布。具体条款与第三方组件许可证请查看 [LICENSE](./LICENSE) 以及默认英文 README 中的 License 部分。
