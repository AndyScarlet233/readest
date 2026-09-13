<div align="center">
  <a href="https://readest.com" target="_blank">
    <img src="https://github.com/readest/readest/blob/main/apps/readest-app/src-tauri/icons/icon.png?raw=true" alt="Readest Logo" width="20%" />
  </a>
  <h1>Readest Community Fork</h1>
  <p><strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a></p>
</div>

This repository is a community-maintained fork of [Readest](https://github.com/readest/readest), a modern open-source ebook reader for Windows, macOS, Linux, Android, iOS, and the Web.

The goal of this fork is to stay very close to upstream while keeping a small set of user-controlled Premium features available without requiring an official Readest subscription. The `main` branch is periodically hard-synced with upstream and then carries only a small fork-specific patch layer, which makes future upstream updates much easier to merge.

## Fork releases

### 0.12.8-fork.1 — upstream-tracking build with user-controlled Premium features unlocked

[Download 0.12.8-fork.1](https://github.com/AndyScarlet233/readest/releases/tag/v0.12.8-fork.1)

This is the primary maintained release track. It keeps the modern upstream codebase and unlocks Premium gates for features that run locally or use storage/services supplied by the user:

- WebDAV, Google Drive, S3, OneDrive, and other supported third-party sync providers
- Offline TTS / Read Aloud audio caching and pre-download
- Nearby BookDrop trusted-device pairing and confirmation-free local transfers

Features that consume official Readest server resources are intentionally not forged or bypassed. Readest Cloud storage quota, server-side translation quota, and Send to Readest by email continue to follow the upstream service rules.

### v0.12.6.22 — full LAN book synchronization build / development paused

[Download v0.12.6.22](https://github.com/AndyScarlet233/readest/releases/tag/v0.12.6.22)

This is the final public release of the older 0.12.6 line. It contains a complete LAN book synchronization system for directly transferring and synchronizing books between your own devices.

That implementation required deeper changes to Readest's synchronization subsystem, so keeping it rebased on newer upstream versions became increasingly expensive. Active development of this track is currently paused, but the existing release remains available for users who need that workflow.

## Release packages

Fork releases are intentionally kept simple. The dedicated fork release workflow builds the two packages most useful to this repository's users:

- Windows x64 NSIS installer
- Android arm64 APK

The fork workflow disables the upstream updater signing step because this repository does not possess Readest's official updater private key. It also avoids publishing updater artifacts signed as if they were official Readest builds.

## Upstream relationship

The upstream project is [readest/readest](https://github.com/readest/readest). Full feature documentation, screenshots, development instructions, and platform-specific information are maintained there and at [readest.com](https://readest.com).

This fork intentionally keeps its code differences small. In normal maintenance, upstream `main` can be synchronized first and the fork unlock patch can then be reapplied or resolved only where upstream changed the same access-control code.

## License

Readest is distributed under the GNU Affero General Public License v3.0 or later. See [LICENSE](./LICENSE) for details.
