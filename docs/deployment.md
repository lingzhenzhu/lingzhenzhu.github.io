# 首次上线与运维

本地代码已经具备构建和集成测试能力；下面涉及实际账户的配置不能由占位值代替。**当前未部署线上**。2026-10-24 检查时，本机 Cloudflare 登录令牌已经过期。

## 1. 固定边界

| 地址                                      | 处理方                                         |
| ----------------------------------------- | ---------------------------------------------- |
| www.lzzhu.net 普通页面与 /assets/         | GitHub Pages，经 Cloudflare 代理               |
| www.lzzhu.net/admin 与 /admin/ 下全部路径 | Cloudflare Access → Worker → 私有后台          |
| www.lzzhu.net/api/*                       | 同一个 Worker；Medium 公开，申请卡需收件人认证 |
| lzzhu.net 及其他子域名                    | 本项目不管理                                   |

www 的 DNS 保持指向现有 GitHub Pages，启用代理。Worker 的路径路由要求该主机经过 Cloudflare。不要增加整个域名的 Worker Custom Domain，也不要把裸域名或其他子域名接入本应用。现有 /admin* 路由会截获 /admin 以及其后缀；未定义路径返回 404。

Cloudflare Access 创建 self-hosted application，包含 www.lzzhu.net/admin 与 www.lzzhu.net/admin/*，白名单只允许管理者身份，并启用登录提供方的 MFA。构建服务使用单独的 Service Auth policy，不设置 Bypass。

申请卡采用第二个独立 Access application，覆盖 `www.lzzhu.net/woaidumuyibeizi`、`www.lzzhu.net/woaidumuyibeizi/*`、`www.lzzhu.net/api/rewards`。只允许收件人及管理者邮箱；不允许构建服务。Worker 对余额与历史 GET、提交 POST 都验证此应用的独立 audience 和邮箱白名单。静态页面只包含界面模板，余额与历史始终来自受保护接口；GitHub Pages 源站上的模板不是秘密数据存储。

## 2. 资源与参数

恢复 Cloudflare 登录后，创建 D1 数据库 website-content、私有 R2 bucket lzzhu-website-private。R2 不启用公共域名。

在 apps/studio/wrangler.jsonc 填入：

- database_id：实际 D1 UUID。
- ACCESS_ISSUER：形如 https://你的团队.cloudflareaccess.com，不含末尾斜杠。
- ACCESS_AUD：此 Access application 的 audience。
- ADMIN_EMAILS：管理者邮箱，逗号分隔。
- BUILD_SERVICE_ID：构建服务 Access JWT 的 common_name，须与实际服务令牌身份一致。
- SOURCE_COMMIT：已经审查、已经推送到 GitHub 的完整 40 位源码提交 SHA。
- REWARDS_ACCESS_AUD：申请卡应用独立 audience，不能与管理员应用相同。
- REWARDS_EMAILS：被授权收件人邮箱；管理者邮箱同时由 ADMIN_EMAILS 管理。

保留 `images.binding = IMAGES`，启用 Cloudflare Images binding 供上传时读取尺寸并实际解码。它不负责公开站图片分发；完整原图仍存私有 R2，公开响应式图片由发布构建生成。先在测试账户确认 Images 权限、额度和实际 JPEG/PNG/WebP 解码行为。[Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/binding/)

使用 Wrangler secret 设置 CSRF_SECRET、GITHUB_APP_ID、GITHUB_INSTALLATION_ID、GITHUB_PRIVATE_KEY。CSRF_SECRET 至少 32 个字符随机值。GitHub App 私钥采用 PKCS#8 RSA；不要把 PEM、token 或 cookie 写入仓库、截图或聊天。

GitHub App 只安装到这个仓库，权限 Contents: write（repository_dispatch）与 Actions: write。Worker 使用短期 installation token，不在浏览器暴露 GitHub 凭据。

GitHub Actions 的 github-pages environment 设置 ACCESS_CLIENT_ID 和 ACCESS_CLIENT_SECRET。它们对应 Access Service Token，只有发布端点权限；Worker 验证 JWT 后还会检查角色。

workers.dev 与 preview URLs 已禁用，静态后台资源也必须先经过 Worker 的认证。其他来源和不完整认证配置均拒绝访问。

## 3. 切换顺序

1. 保留当前线上部署。先把 GitHub Pages 的发布来源改为 GitHub Actions，避免源码分支中的旧根目录 HTML 删除时自动发布空站。
2. 将审查后的重构源码推送并合入默认分支，让 repository_dispatch 能找到 publish.yml。不要使用旧的“根目录生成 HTML 就立即发布”工作流。
3. 执行 pnpm install --frozen-lockfile、pnpm verify、pnpm audit:output 和浏览器测试。填好 SOURCE_COMMIT。
4. 对新建的远端 D1 执行 migrations apply。初始内容采用经核对的当前本地草稿快照；`content/site.json` 只用于空白开发与测试库。首次初始化完成后，不再通过种子文件更新编辑内容。
5. 构建后台，再部署 Worker。确认 /admin/ 会进入 Access 登录，未认证的 API 返回 401，缓存规则不会缓存 /admin* 或 /api/*。
6. 管理后台打开页面、预览、上传测试头像、保存草稿。检查全部导航和无障碍功能后，点击发布。
7. GitHub Pages 部署成功后，检查 /_release.json 与后台 active 版本一致；核对所有原有公开页面。

命令示例（所有远端操作都必须先确认实际账户与资源）：

```sh
node scripts/tool.mjs wrangler login
node scripts/tool.mjs wrangler whoami
node scripts/tool.mjs wrangler d1 migrations apply website-content --remote --config apps/studio/wrangler.jsonc
pnpm --filter @lzzhu/studio build
pnpm --filter @lzzhu/studio deploy
```

先从日常预览 `/admin/api/content` 只读导出当前草稿到被 Git 忽略的私有目录，再执行 `pnpm exec tsx scripts/seed-local.ts --snapshot .artifacts/scenario-audit/current.json --output .artifacts/scenario-audit/backend-seed.sql`，生成待核对的初始化 SQL。这个命令不会连接数据库。文件内每条 SQL 均分段限制长度；同一导入文件可在中断后重试，完成后关闭初始化入口，另一份种子不能覆盖或补写现有工作区。核对页面、私有内容、目标资源后，才在空白测试 D1 执行。不要上传本地测试数据库。

已有旧结构数据库升级时，先做一致性备份，再执行 `0003_resource_storage.sql`。该迁移保留当前草稿及旧修订记录，拆为页面/共享内容行后删除旧整站表；运行时没有两套读写逻辑。本地日常草稿已完成演练、迁移及逐项比较；远端测试库仍需独立验证。迁移失败时恢复备份，不手工拼接两套表。

申请卡的旧状态必须单独处理：用户已经授权只读导出并准备迁移，但 2026-10-24 原服务 /get-state 返回 HTTP 500，尚未取得有效数据。不要把新数据库的初始 0 次当作原余额。切换该功能前恢复旧服务读取或取得可靠备份，再导入余额和记录；无法取得数据时先保持该功能的上线切换待办。完成迁移后，旧服务的管理接口是否停用，需要在它所属的账户中处理，本项目不会擅自修改其他服务。

## 4. 验收与缓存

- 全站导航在相同视口和字体加载状态下坐标一致。Research、Teaching、Media、Blog 的 A 型标题坐标一致；首页使用已选定的 D 型首屏，不与紧凑标题比较高度。
- 桌面和手机实机检验无障碍按钮、深色模式、字体放大、高对比度、朗读、焦点顺序以及减少动态效果。
- 头像上传后先保持为草稿，公开站不得变化；发布后图片通过 GitHub Pages 的内容哈希路径加载。
- 外部图片使用最终 HTTPS 直链；后台预览只允许内容中显式使用的来源，不自动放行跨域重定向。需要稳定预览和长期展示的个人素材优先上传至私有素材库，随发布生成公开图片。
- `/api/medium` 在访问含 Medium 模块的页面时自动请求，五分钟内共用 RSS 检查。仅合并已发布的隐藏/封面控制数据，其他草稿必须保持私有；无活动发布时生产接口拒绝读取草稿，页面继续使用静态文章兜底。定时任务继续更新静态已发布文章列表。确认官方 RSS 返回成功并测试断网、缺图和错误图片。
- 保留 HTML 的短缓存或默认缓存。对 /_release.json 使用绕过缓存规则，避免版本核对受旧响应影响；/admin* 与 /api/* 均绕过缓存。
- 按输出字节生成哈希的资源（Astro JS/CSS、字体子集、`/assets/derived/`）可使用长期缓存。`/assets/uploads/` 使用的是原图身份，公开文件是去元数据后的表示，应保持短缓存或重新验证；不要把整个 `/assets/*` 一律设为 immutable。根目录 HTML 不设置一年 immutable。
- 可在仅匹配 www 的响应头规则设置 X-Content-Type-Options 与 Referrer-Policy。公开构建已由 Astro 生成 CSP meta，包含偏好初始化脚本和 speculation rules 数据的 SHA-256；frame-src 允许 embed.podcasts.apple.com。若额外设置 img-src，需允许本站素材及 Medium 图片来源。
- 不要另加一个缺失这些哈希的更严格 script-src 响应头，否则两份策略取交集，会阻止初始化或预渲染。可以独立配置 `frame-ancestors`、`X-Content-Type-Options` 和 `Referrer-Policy` 响应头。管理后台沿用 Worker 自己的 CSP。无需 unsafe-eval，也不依赖部分引擎不识别的 inline-speculation-rules 关键字。
- 最后测 Lighthouse 和真实页面加载。工具中的 4K 视口测试不等于每种真实屏幕、系统字体和辅助技术都已验收。

## 5. 失败恢复与备份

ready 表示快照已冻结但构建尚未认领；building 表示构建中；deploying/deployed 表示部署开始或等待线上标记；active 表示已通过线上核对。

构建前可取消待处理发布。构建失败会释放锁，旧线上版本继续可用。部署开始后发生网络超时，系统保留锁，避免旧构建迟到覆盖新版本；先核对 GitHub Actions 与 Pages 的 deployment 状态，再触发 reconcile。确认没有在运行或可迟到的部署，且线上 /_release.json 仍是之前版本后，运维人员才可在 D1 将对应发布置为 failed 并释放同一 publishing_id。不要在部署状态不明时直接清空锁。

回滚只接受有校验和产物的 active / superseded 发布，创建新的发布记录，保留历史。它不是运行旧版网站代码的兼容层。

回滚归档存放在 `releases/<id>/artifacts/<sha256>.tar.gz`，数据库指向已冻结的哈希；重复上传只接受同一文件。部署已开始后，迟到的失败回调不能释放发布锁。发布构建使用 `.artifacts/release/uploads` 保存下载并核验的完整原图（由 `SITE_UPLOADS` 指定），公开目录只存处理后的输出；不要把上一次公开输出当作下一次构建的原图。后台内容、版本记录与保存审计在同一事务中提交。

D1 编辑历史与业务状态、R2 发布快照/上传图片/产物都属于备份范围。启用并验证 D1 Time Travel；另以私有方式导出 D1 并备份 R2，定期演练恢复。保留周期由账户方案和实际容量确定，当前代码不会自动删除历史版本或素材。

本地可运行 `pnpm backup:rehearse`：把 `.artifacts/e2e-state` 的一致性快照导出 SQL，恢复到新的隔离目录，核对表行数、文档大小、申请卡余额及全部业务表内容哈希；不读取或覆盖日常预览数据库。它不是远端 D1 / R2 恢复演练的替代品。正式联调先备份空白测试目标，完成上传、发布、回滚和 R2 文件校验，再允许切换。

接入检查入口：`pnpm backend:check` 校验生产参数；管理员登录后访问 `/admin/api/health` 检查绑定与内容容量；`pnpm backend:probe` 只读检查 www 的匿名访问边界。旧申请卡使用 `pnpm migration:export` 只读导出并校验，结果仅写入被 Git 忽略的私有目录；旧服务返回错误时不会创建假余额或导入数据。

## 6. 容量与后续扩展

当前按页面、站点设置、News、Medium 和页面顺序分行保存。编辑器使用 PATCH，只传改变的资源及其预期版本；不同页面的并行编辑可以合并，同一资源冲突会保留本地编辑并暂停保存。跨页移动等多资源操作在同一事务中提交，资源、历史和审计不会只写入一半。每次保存有唯一请求编号，网络丢失回执后重试不会重复创建修订。整站快照只用于初始化、明确的快照替换、导出和发布。

应用限制为每个资源 1,800,000 字节、工作区总计 8,000,000 字节、最多 2,000 个页面，每页最多 300 个模块；图片和构建产物存 R2。这个边界给 D1 的 2,000,000 字节单值/行限制留出余量，同时约束浏览器解析和发布快照的成本。平台还限制每条 SQL 文本为 100 KB，种子导入已按此分段。上线前需使用真实账户验证 D1 批量事务、CPU 时间及 R2 读取，不能用本机测试耗时替代。[Cloudflare D1 限制](https://developers.cloudflare.com/d1/platform/limits/)

撤销记录保留被修改资源的不可变引用，最多 50 步、约 8 MB 的序列化内容预算；单次整站恢复允许保留一个较大步骤以便撤销。该数值是内容预算，不是浏览器堆内存上限。Articles、News、Medium、图片库、图片选择器和跨页选择器分页；当前初始读取仍加载工作区完整内容，超出上述规模应另做按需加载和服务端检索，不简单提高容量常量。

Tiptap Markdown 仍属于需要管理的上游 Beta 风险。版本固定为 3.32.0，扩展创建集中在 `editor-extensions.ts`，转换集中在 `markdown-document.ts`；保存的是受验证的结构化正文。升级前必须运行长文和反复转换测试，检查标题锚点、链接、图片、清单、居中、列表序号及受支持的行内格式。当前不承诺任意第三方 Markdown 扩展能无损互转。

OG 图片目前使用 Satori + resvg 在发布阶段生成，跟随不可变发布一起部署，避免每次访问产生 Worker 运算。动态按请求生成 OG 的独立 Worker 不是当前必需依赖。

Oracle 服务器、Electron、原生 App 包装、通用 CMS 服务、Tailwind 和旧版本运行时均不在当前运行链路中。
