<div align="center">
  <a href="https://github.com/readest/readest">
    <img src="https://github.com/readest/readest/blob/main/apps/readest-app/src-tauri/icons/icon.png?raw=true" alt="Readest" width="112" />
  </a>
  <h1>Readest 社区分支</h1>
  <p><strong>一个注重局域网分享、阅读交互与跨平台可靠性，并尽量友好跟进上游的 Readest 分支。</strong></p>
  <p><a href="./README.md">English</a> · <a href="./README.zh-CN.md"><strong>简体中文</strong></a></p>
  <p>
    <a href="https://github.com/AndyScarlet233/readest/stargazers"><img src="https://img.shields.io/github/stars/AndyScarlet233/readest?style=flat-square&logo=github" alt="GitHub stars" /></a>
    <a href="https://github.com/AndyScarlet233/readest/releases"><img src="https://img.shields.io/github/v/release/AndyScarlet233/readest?style=flat-square" alt="Fork release" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-teal?style=flat-square" alt="AGPL-3.0" /></a>
  </p>
</div>

> [!IMPORTANT]
> 这是 [readest/readest](https://github.com/readest/readest) 的社区分支，并非 Readest 官方仓库。我们的目标是在尽量贴近上游的同时，长期保留一小组经过选择的分支特性与回归保护。

Readest 是一款基于 Next.js 与 Tauri 的现代开源电子书阅读器，支持 EPUB、PDF、MOBI/KF8、FB2、CBZ、TXT、Markdown、有声书、批注、词典、TTS、OPDS/Calibre、跨设备同步等能力。本分支保留这些上游功能，同时形成了一点自己的性格：更偏向本地优先的便利性、更自然的固定版式与漫画交互，以及更谨慎的上游融合方式。

## 为什么会有这个分支？

### 📡 Nearby BookDrop——直接走局域网传书

Nearby BookDrop 是我们最希望继续打磨的特色之一。你可以在 Readest 中发现附近设备，并通过本地网络发送支持的书籍文件，不必先把书传到云端再从另一台设备下载。

- 可以向附近的 Readest 设备以及兼容的 LocalSend 应用发送书籍。
- 每台设备独立决定是否开启，并可设置自己的可见设备名称。
- 收到传输请求后会先由用户确认，再把书加入书库。
- 非书籍文件会被自动拒绝。
- 设备发现基于本地网络；当组播发现不可用或不可靠时，可退回到 HTTP 子网扫描来寻找设备。

它追求的是一种很朴素的体验：两台设备打开 Readest，开启 Nearby BookDrop，点选附近设备，然后把书送过去。我们还会继续吸收上游在设备发现、移动端恢复、在线状态和传输界面方面的改进，同时避免把这个分支已经形成的 LAN 行为直接覆盖掉。

### 🖱 更自然的固定版式、PDF 与漫画交互

这个分支保留了一组带回归测试的阅读器修复，主要针对那些更像“画布”而不是普通流式文字的内容。尤其是缩放后的固定版式/CBZ：当横纵两个方向都存在溢出时，鼠标拖拽会同时保留 X/Y 增量，因此斜向拖动不会被强制锁到单一方向。对于缩放后的固定版式/PDF，也提供可选的水平平移锁定，适合只想上下滚动、不希望页面左右漂移的场景。

此外，分支也跟进了 XHTML namespace、EPUB CSS namespace selector、分页媒体查询以及脚本 canvas 等兼容性修复，让一些比较“刁钻”的 EPUB 样本更不容易出现样式或绘制异常。

### 📚 跟随 Readest，但不把自己的改动冲掉

我们不会把“同步上游”理解成“用上游文件覆盖分支”。上游改动会尽量拆成可审查的小组，在当前分支代码上解决冲突，并用测试守住已经确认过的分支行为。这一点在阅读器、Nearby BookDrop/LAN、平台桥接、本地化与发布流程上尤其重要。

这个分支大致遵循几条原则：

- **以上游为基础，但保留有意为之的分支行为。** 有价值的上游能力会持续吸收，除非有明确理由，否则不会顺手抹掉分支特性。
- **先有回归，再谈放心。** 阅读手势与高风险集成尽量用针对性测试验证，而不只看“能编译”。
- **PR 快速门禁，Release 完整打包。** 普通 PR 使用 Windows x64 MSVC 快速测试，覆盖 TypeScript、阅读器回归以及 Rust check/test；完整 Windows 安装包与 Android arm64 打包交给 Release 工作流。
- **宁可小步融合，也不做巨型同步包。** 大块上游更新会在有助于降低冲突和审查风险时拆开处理。

## Readest 的核心能力

| 领域 | 主要能力 |
| --- | --- |
| 格式 | EPUB、PDF、MOBI、KF8/AZW3、FB2、CBZ、TXT、Markdown 与有声书 |
| 阅读 | 分页/滚动模式、主题、排版、固定版式、跟读与 TTS |
| 知识工具 | 高亮、笔记、书签、搜索、词典/Wikipedia、自定义词典与翻译 |
| 书库 | 书架、OPDS/Calibre、文件关联与书库搜索 |
| 同步 | Readest 同步以及受支持的第三方阅读/同步集成 |
| 无障碍 | 键盘导航与跨平台屏幕阅读器支持 |
| 本地分享 | Nearby BookDrop 局域网传书与 LocalSend 互通 |

完整产品说明请参考 [Readest 官方文档](https://readest.com/docs)。关于 Readest 的通用功能与平台支持，仍以上游项目为主要信息来源。

## 下载

### 本分支构建

本仓库的正式 Release 工作流目前会产出：

- **Windows x64**——MSVC/NSIS 构建
- **Android arm64**——APK 构建

可在 [AndyScarlet233/readest Releases](https://github.com/AndyScarlet233/readest/releases) 下载本分支版本。

### 官方 Readest

如果需要官方 macOS、Windows、Linux、Android、iOS/iPadOS 或 Web 版本，请访问 [readest.com](https://readest.com) 或 [上游仓库](https://github.com/readest/readest)。

## 与上游的关系

上游仓库：[readest/readest](https://github.com/readest/readest)

本分支会周期性融合上游修复和新功能。引入上游工作时，会尽量在 Git 历史与 PR 描述中保留原作者信息；分支自己的改动则单独维护，以便审查、测试，也方便将来把合适的部分反向提议给上游。

如果你需要 Readest 官方支持、官方发行版、社区入口或产品政策，请以前述上游项目与 [readest.com](https://readest.com) 为准；仅与本分支相关的问题，欢迎直接在这里提交。

## 构建与贡献

项目主要使用 pnpm、Next.js 16、Tauri v2 与 Rust。可以先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)，以及 `apps/readest-app/docs/` 下的开发者文档。

向本分支贡献时，希望尽量保持改动集中，并区分“PR 快速验证”和“Release 完整打包”两条路径。涉及阅读器和 LAN 的改动，在条件允许时应补上有针对性的回归测试。

## ⭐ 如果你喜欢这个分支

如果 Nearby BookDrop、漫画/固定版式交互修复，或者这种谨慎同步上游的方式对你有帮助，可以顺手给仓库一个 Star。它只是一次很小的点击，却能让更多读者知道这个分支的存在，也能帮助我们判断哪些分支特色值得继续投入时间打磨。

## 许可证

Readest 与本分支均依照 [GNU Affero General Public License v3.0](./LICENSE) 发布。本分支建立在 Readest 上游贡献者、Foliate/foliate-js 以及项目所使用的大量开源库的工作之上，并对此表示感谢。

<div align="center">
  <sub>本地阅读，本地传书，让阅读器更顺手。</sub>
</div>
