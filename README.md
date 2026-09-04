<div align="center">
  <a href="https://github.com/readest/readest">
    <img src="https://github.com/readest/readest/blob/main/apps/readest-app/src-tauri/icons/icon.png?raw=true" alt="Readest" width="112" />
  </a>
  <h1>Readest Community Fork</h1>
  <p><strong>A practical, upstream-friendly Readest branch focused on local sharing, reader interaction, and cross-platform reliability.</strong></p>
  <p><a href="./README.md"><strong>English</strong></a> · <a href="./README.zh-CN.md">简体中文</a></p>
  <p>
    <a href="https://github.com/AndyScarlet233/readest/stargazers"><img src="https://img.shields.io/github/stars/AndyScarlet233/readest?style=flat-square&logo=github" alt="GitHub stars" /></a>
    <a href="https://github.com/AndyScarlet233/readest/releases"><img src="https://img.shields.io/github/v/release/AndyScarlet233/readest?style=flat-square" alt="Fork release" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-teal?style=flat-square" alt="AGPL-3.0" /></a>
  </p>
</div>

> [!IMPORTANT]
> This is a community fork of [readest/readest](https://github.com/readest/readest), not the official Readest repository. The goal is to stay close to upstream while keeping a small set of deliberate fork features and regressions protected.

Readest is a modern open-source ebook reader built with Next.js and Tauri. It supports EPUB, PDF, MOBI/KF8, FB2, CBZ, TXT, Markdown, audiobooks, annotations, dictionaries, TTS, OPDS/Calibre, cross-device sync, and much more. This fork keeps those upstream capabilities and adds a branch with a slightly different personality: local-first convenience, stronger fixed-layout/comic interaction, and cautious upstream integration.

## Why this fork?

### 📡 Nearby BookDrop — books over your LAN

Nearby BookDrop is the feature we expect many people to notice first. From Readest you can discover nearby peers and send supported book files over your local network, without routing the transfer through a cloud storage service.

- Send books to nearby Readest devices and compatible LocalSend apps.
- Each device opts in separately and can choose its own visible device name.
- Incoming transfers are confirmed before books are added to the library.
- Non-book file types are declined automatically.
- Discovery uses the local network and can fall back to an HTTP subnet scan when multicast discovery is unavailable or unreliable.

It is intentionally simple: open Readest on the devices, enable Nearby BookDrop, pick a nearby device, and send the book. We are continuing to sync upstream improvements to discovery, mobile resume behavior, presence handling, and the transfer UI without throwing away fork-specific LAN behavior.

### 🖱 Better fixed-layout, PDF, and comic interaction

This branch carries regression-tested reader fixes for content that behaves more like a canvas than a reflowable book. In particular, zoomed fixed-layout/CBZ content can preserve both X and Y mouse-drag deltas when both axes overflow, so diagonal panning feels natural instead of being forced onto one axis. An optional horizontal-pan lock is also available for zoomed fixed-layout/PDF reading when you want vertical movement without sideways drift.

The fork also tracks rendering compatibility fixes around XHTML namespaces, EPUB CSS namespace selectors, paginated media-query behavior, and scripted canvases so unusual EPUB samples are less likely to render incorrectly.

### 📚 Readest, plus a fork that protects its own behavior

We do not treat upstream sync as “replace the fork with upstream.” Changes are integrated in reviewable groups, conflicts are resolved against the current fork, and fork regressions are kept as tests. This matters most in the reader, Nearby BookDrop/LAN code, platform bridges, localization, and release workflows.

A few branch principles:

- **Upstream-first, fork-preserving.** We absorb useful upstream work while keeping intentional fork behavior unless there is a clear reason to retire it.
- **Regression before confidence.** Reader gestures and risky integrations get focused tests instead of relying only on successful compilation.
- **Fast PR gate, full Release build.** Pull requests use a Windows x64 MSVC fast gate for TypeScript, reader regressions, and Rust checks/tests. Full Windows installer and Android arm64 packaging belong to the Release workflow.
- **Small integrations beat giant sync dumps.** Large upstream changes are split into understandable groups when that reduces conflict and review risk.

## Core Readest features

| Area | Highlights |
| --- | --- |
| Formats | EPUB, PDF, MOBI, KF8/AZW3, FB2, CBZ, TXT, Markdown and audiobooks |
| Reading | Paginated/scroll modes, themes, typography, fixed-layout support, read-along and TTS |
| Knowledge tools | Highlights, notes, bookmarks, search, dictionary/Wikipedia lookup, custom dictionaries and translation |
| Library | Bookshelves, OPDS/Calibre integration, file association and library search |
| Sync | Readest sync plus supported third-party reading/sync integrations |
| Accessibility | Keyboard navigation and screen-reader support across supported platforms |
| Local sharing | Nearby BookDrop for local-network book transfer and LocalSend interoperability |

For the complete product documentation, see the [official Readest documentation](https://readest.com/docs). Upstream remains the primary source for general Readest features and platform support.

## Downloads

### Fork builds

This repository's formal Release workflow currently produces:

- **Windows x64** — MSVC/NSIS build
- **Android arm64** — APK build

Download fork builds from [AndyScarlet233/readest Releases](https://github.com/AndyScarlet233/readest/releases).

### Official Readest

For official macOS, Windows, Linux, Android, iOS/iPadOS and Web distribution, visit [readest.com](https://readest.com) or the [upstream repository](https://github.com/readest/readest).

## Upstream relationship

Upstream: [readest/readest](https://github.com/readest/readest)

This fork periodically integrates upstream fixes and features. Upstream authors retain credit in the Git history and pull-request descriptions whenever their work is brought across. Fork-specific changes are maintained separately so they can be reviewed, tested, and—where useful—proposed upstream later.

If you are looking for official Readest support, releases, community links, or product policy, please use the upstream project and [readest.com](https://readest.com). Issues specific to this fork are welcome in this repository.

## Building and contributing

The project uses pnpm, Next.js 16, Tauri v2, and Rust. Start with [CONTRIBUTING.md](./CONTRIBUTING.md) and the app's contributor references under `apps/readest-app/docs/`.

When contributing to this fork, please keep changes narrow and preserve the distinction between the quick PR validation path and the full Release packaging path. Reader and LAN changes should include focused regression coverage when practical.

## ⭐ Like this branch?

If Nearby BookDrop, the comic/fixed-layout fixes, or the fork's upstream-integration work is useful to you, consider starring the repository. A star is a tiny click, but it helps more readers discover that this branch exists—and it gives us a useful signal about which fork-specific ideas are worth polishing next.

## License

Readest and this fork are free software distributed under the [GNU Affero General Public License v3.0](./LICENSE). This fork is based on and remains deeply indebted to the work of the upstream Readest contributors, Foliate/foliate-js, and the many open-source libraries used by the project.

<div align="center">
  <sub>Read locally. Share locally. Keep the reader comfortable.</sub>
</div>
