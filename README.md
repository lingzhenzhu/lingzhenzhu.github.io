# Lingzhen Zhu · Website

最新验证记录：[2026-10-25 独立审计与修复](docs/independent-audit-2026-10-25.md)。

全新 TypeScript 源码仓库。公开站使用 Astro 静态生成，共用 React 展示组件与原生 CSS；可视化后台使用 React + Tiptap；Cloudflare Worker 提供经过 Access 验证的内容服务，D1 保存编辑版本，私有 R2 保存上传素材和发布产物。

公开站仍由 **GitHub Pages** 托管。后台入口固定为 **https://www.lzzhu.net/admin/**。只接管 www.lzzhu.net 的指定路径，不涉及裸域名或其他子域名。

## 本地运行

需要 Node.js 24 LTS 与 pnpm 11。依赖版本记录在锁文件中。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm db:local
pnpm seed:local
pnpm dev
```

另开终端运行 `pnpm dev:admin`，访问 `http://127.0.0.1:8787/admin/`。本地身份仅在环境为 local、显式开启本地认证、请求主机为回环地址时生效。生产环境缺少 Access 配置会拒绝访问。

需要从同一个地址验收前台与后台时，构建后保持本地 Worker 运行，再执行 `pnpm preview`，访问 `http://127.0.0.1:4323/`；它与浏览器测试使用同一套路由。Astro 开发服务器仅用于公开页面开发。

`content/site.json` 是初始化数据库和本地构建的内容种子。线上编辑以 D1 为准；不会通过回写 Git 文件保存草稿。重复运行本地种子命令不会覆盖已有编辑。

## 模块与数据流

```text
apps/site              Astro 路由、SEO、静态页面
apps/studio/editor     页面/区块/News/Medium/素材/版本可视化管理
apps/studio/server     Access、内容服务、RSS 同步、发布、业务 API
packages/content      Zod 内容模型、公开快照边界、导航与 RSS 合并规则
packages/presentation 页面外壳、区块、无障碍、News、共享 CSS
assets/source         原始素材与矢量图，不包含用户上传的私有文件
scripts               素材构建、发布校验、产物审计、隔离测试环境
tests                 内容/安全单元测试与真实浏览器集成测试
```

编辑器与公开站调用同一套 SiteShell / PageTitle / RenderBlock。宽度、标题、导航、页脚和无障碍工具只有一个实现。首页采用 D 的墨色首屏与 Libre Caslon Display，子页采用 A 的内嵌暖棕标题与 Lora；导航采用 N1 的 Jost，桌面、手机 Menu 和展开链接使用同一组样式。区块有明确类型与版本，富文本保存为结构化 JSON，通过白名单渲染，不执行任意 HTML/JavaScript。

后台使用英文操作界面。Site structure 管理全站导航的名称、顺序与显示；Pages 管理各页内容。独立的 Writing 工作区收纳 Articles 与 Archive views；Blog 页面也可进入同一集合，删除展示页不会隐藏文章管理入口。首页头像位于 Pages → Home → Content → Portrait，正文在 Text & headings 中编辑，News 位于 Home → News，支持搜索、筛选、列表进入详情、多选删除、确认与撤销。

Home → Opening 编辑英文姓名与辅助中文名，并可选择无图、把现有头像移到首屏、或上传独立艺术照。默认无图，移动头像不会重复显示；入口文案为 Explore more。useDraft 集中处理自动保存、版本冲突、串行保存队列和撤销；PageEditor、NewsPanel、ArticlesPanel 与 SiteStructure 分别负责各自工作区。预览共享公开站渲染器，支持内容定位及保存后恢复滚动位置。

HomeOpening、PageSettings、ImagePicker 和富文本锚点扩展分别处理首屏、页面属性、素材复用和稳定链接。文章时间、版权及许可均为内容字段；页面语言同时用于公开站、预览与朗读。图片经过格式结构、尺寸和像素解码验证后才进入私有素材库；完整原图保留，发布构建另生成展示尺寸。

全局工具栏负责保存与撤销；Review & publish 是独立发布工作区，包含发布前摘要、Publications 和 Draft revisions。恢复草稿不等于发布；发布状态自动检查。

公开页面无需 React 浏览器运行时。必要交互使用小型 TypeScript 模块。原生跨文档 View Transitions 和 Speculation Rules 提供渐进增强；不支持这些特性的当前浏览器仍使用相同页面和功能。后台预览禁用页面转场，避免频繁保存刷新时产生转场冲突。

## 行为约定

- News 有多条且内容超过显示区域时自动滚动；当前只有一条消息时无需移动。点击 News 标题可暂停/恢复；悬停、键盘焦点、手动滚动、页面隐藏、朗读和减少动态效果设置都有独立控制。
- 无障碍按钮固定在屏幕右下角，桌面距离边缘 24px，手机 16px。深色模式、放大字体、高对比度、朗读、重置均保留，偏好跨页面保存。没有读取旧存储键的兼容层。
- Media 每次访问请求 `/api/medium`，Worker 直接读取官方 RSS，提取标题、日期和有效封面。D1 原子刷新标记使五分钟内的并发访问共用一次上游检查，失败保留最后成功结果；页面本身有已发布文章兜底。预渲染页面待用户真正进入后再请求。隐藏与封面覆盖取自已发布控制数据，不读取草稿。缺图和图片加载失败使用自绘矢量默认封面；Medium 使用官方 2024 黑白 SVG 字标。
- 所有已发布路径由统一模板生成。原有文章路径本身保留；没有另外引入旧路由别名、旧脚本或旧页面容器。
- 页面可单独设置搜索引擎收录。申请卡默认 noindex、不进入站点地图；真正的访问控制使用独立 Cloudflare Access 应用及收件人白名单，与搜索引擎设置无关。
- 图片提供响应式分辨率，上传素材在发布时去除元数据并生成 WebP 尺寸。研究示意图由原论文 PDF 导出矢量版本；Logo 字形转为路径，避免系统字体改变外观。中文字体按当前内容的字形拆为 WOFF2 子集，通过 unicode-range 按需加载；后台保留受 Access 保护的完整字体，以便预览新字。
- `/woaidumuyibeizi/` 的申请卡有独立事务计数、幂等提交和请求频率限制。余额、历史和提交接口要求收件人应用的 JWT 与邮箱白名单；管理操作进入 `/admin/`。该页面路径固定，防止编辑地址绕开待配置的 Access 页面策略。旧远端服务仍返回 HTTP 500，余额/申请记录尚未导入；新数据库初始 0 不能视为迁移结果。

## 发布

```mermaid
flowchart LR
  A[Admin 草稿] --> B[D1 版本校验]
  B --> C[私有 R2 冻结公开快照]
  C --> D[GitHub Actions 校验源码和快照]
  D --> E[Astro 构建 / 素材处理]
  E --> F[保存带校验和的回滚产物]
  F --> G[GitHub Pages]
  G --> H[Worker 核对线上版本标记]
```

数据库中的发布锁阻止并行发布覆盖。Workflow concurrency 提供第二道串行控制。构建身份只可访问发布 API，不能读编辑草稿。回滚取回已经验证的产物，使用原发布源码版本，不把旧内容交给未经验证的新模板重新构建。取消仅限构建尚未认领的发布；部署结果不明确时保留锁，先核对线上版本。

Medium 定时更新从「上次已发布快照」派生，不读取正在编辑的页面草稿。隐藏记录保存在私有发布控制数据中，避免被后续自动同步重新公开。

首次线上配置、账户参数和异常处理见 [部署说明](docs/deployment.md)。目前仓库配置中的 D1 ID 和 Access 参数是待配置项，不能直接用于生产部署。

## 验证

```sh
pnpm verify
pnpm audit:output
pnpm test:e2e
pnpm audit:performance
pnpm backup:rehearse
pnpm backend:check
```

Windows 本机默认使用 Edge。设置 `CROSS_BROWSER=1` 可同时运行 Firefox、WebKit；CI 安装 Chromium、Firefox、WebKit。测试使用 `.artifacts/e2e-state` 独立数据库，不修改正常本地数据库。

测试覆盖统一布局、移动和 4K 视口、无障碍偏好、固定按钮位置、News 滚动/暂停及列表/批量删除/撤销、文章层级、头像上传和首屏位置、Medium 访问更新与失败封面、CSRF、并发编辑冲突、发布快照/校验和/锁，以及业务请求原子扣减。

修复后的结果与证据统一记录在 [修复与接入准备报告](docs/remediation-2026-10-24.md)。原 [全面审计](docs/audit-2026-10-24.md) 和 [Bug 报告](docs/bugs-2026-10-24.md) 保留为修复前基线。异常操作回归已纳入默认测试；CI 增加四种主题的 axe 检查、HTML/JS/CSS 预算与 Lighthouse 门禁。Media 的 Apple Podcasts Cookie 问题单独记录，保留 Lighthouse 原始分数，不将外部问题隐藏为 100 分。设置 `STRICT_EXTERNAL_AUDIT=1` 可要求外部嵌入同样完全通过。

Windows 上 Firefox 的可执行程序此前因系统运行库配置错误无法启动，因此不计为通过；CI 已配置三种浏览器，等待推送后执行。生产依赖无已知漏洞不等于没有未知漏洞；上线前还需验证真实 Access、GitHub 发布和私有存储。

浏览器引擎测试不等同于真实 iPhone、Android 或 Windows 辅助技术验收；上线前仍需实际设备检查 VoiceOver / TalkBack / NVDA。Lighthouse 与真实用户指标须在最终 Cloudflare + GitHub Pages 配置完成后测量。

## 来源与素材

- [Medium 官方 RSS 文档](https://help.medium.com/hc/en-us/articles/214874118-Using-RSS-feeds-of-profiles-publications-and-topics)
- [Medium 官方字标规范](https://medium.design/logos-and-brand-guidelines-f1a01a733592)，原始素材来源见 assets/source/MEDIUM-BRAND.txt。
- 后台交互参考 Apple HIG 的 [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)、[Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)、[Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)：浅层导航、列表进入详情、明确选择反馈、导航与操作分组。采用浏览器原生表单和对话框。
- [Cloudflare Access JWT 验证](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- 研究示意图来自作者论文 [arXiv:2502.11378](https://arxiv.org/abs/2502.11378)，原始文件 figures/framework.pdf 保存在 assets/source/hsp-original.pdf，保留公式与绘图内容。
- Inter / Cormorant Garamond / Lora / Libre Caslon Display / Jost 自托管字体许可证随构建产物复制。公开站选定的标题和导航字体按拉丁字符与实际发布内容生成哈希子集，保留原字形；后台预览使用完整字体。兰亭字体使用原站素材，按字形分组并通过 unicode-range 按需加载，没有另换中文字体。当前选定的字体文件为静态字重，不声称已采用可变字体。
