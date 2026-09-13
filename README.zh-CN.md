<div align="center">
  <a href="https://readest.com" target="_blank">
    <img src="https://github.com/readest/readest/blob/main/apps/readest-app/src-tauri/icons/icon.png?raw=true" alt="Readest Logo" width="20%" />
  </a>
  <h1>Readest 社区分支</h1>
  <p><a href="./README.md">English</a> | <strong>简体中文</strong></p>
</div>

本仓库是 [Readest](https://github.com/readest/readest) 的社区维护分支。Readest 是一款现代开源电子书阅读器，支持 Windows、macOS、Linux、Android、iOS 与 Web。

这个分支的目标是尽可能贴近上游，同时保留一小层由用户自己掌控的功能修改。`main` 会定期与上游硬同步，然后只重新叠加少量 fork 专用补丁，这样以后跟进上游更新时，不再需要背着几百个历史提交解决冲突。

## 本分支版本下载

### 0.12.8-fork.1 — 跟进上游 / 开放用户自有资源相关 Premium 功能

[下载 0.12.8-fork.1](https://github.com/AndyScarlet233/readest/releases/tag/v0.12.8-fork.1)

这是目前主要维护的发布路线。它保留新版上游代码，同时解除那些在本地运行，或使用用户自己提供的存储与服务资源的 Premium 限制，包括：

- WebDAV、Google Drive、S3、OneDrive 等受支持的第三方同步服务
- TTS / 朗读音频的离线缓存与预下载
- Nearby BookDrop 的可信设备配对与免确认局域网传输

依赖 Readest 官方服务器资源的功能不会伪造或绕过。Readest Cloud 官方云存储额度、服务器侧翻译额度、Send to Readest 邮件等能力仍按照上游服务规则工作。

### v0.12.6.22 — 完整局域网书籍同步版 / 暂停开发

[下载 v0.12.6.22](https://github.com/AndyScarlet233/readest/releases/tag/v0.12.6.22)

这是旧 0.12.6 路线最后一个公开版本，其中包含一套完整的局域网书籍同步机制，适合希望在自己的设备之间直接传输并同步书籍的用户。

由于这套实现对 Readest 底层同步系统改动较深，继续跟随新版上游时需要长期处理大量适配工作，因此目前暂停继续开发。不过已有 Release 会继续保留，仍然可以正常下载使用。

## 发布包

本分支的正式 Release 会尽量保持简单，只构建最常用的两个安装包：

- Windows x64 NSIS 安装程序
- Android arm64 APK

fork 专用发布流程会关闭上游的自动更新器签名产物，因为本仓库并不拥有 Readest 官方 updater 私钥，也不会把社区构建伪装成官方签名版本。

## 与上游的关系

上游项目为 [readest/readest](https://github.com/readest/readest)。完整功能介绍、截图、开发文档与各平台说明由上游持续维护，也可以访问 [readest.com](https://readest.com)。

这个 fork 会刻意把代码差异控制得很小。正常维护流程是先同步上游 `main`，再重新应用本分支的解锁补丁；只有在上游也修改了同一段访问控制代码时，才需要手工处理冲突。

## 许可证

Readest 使用 GNU Affero General Public License v3.0 或更高版本发布。具体条款请查看 [LICENSE](./LICENSE)。
