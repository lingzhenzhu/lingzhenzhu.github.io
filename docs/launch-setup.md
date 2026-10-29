# 网站上线配置步骤

更新于 2026-10-30。本文件说明网站后台、页面和文章内容、上传图片、Medium 与 GitHub 发布。旧申请卡的新增配置步骤见 [Firebase 申请卡接入](firebase-card-setup.md)。尚未代为创建线上资源、修改 DNS、设置线上密钥或执行部署。

可以先完成资源与身份配置，再接入代码联调。生产预检已拆开两种申请卡配置，Cloudflare 卡参数可一起留空；不要填假值。首次公开发布须完成旧 Firebase 卡的新接口、规则和旧代理的协调切换。

## 0 先准备普通 PowerShell 中的命令工具

项目要求 Node.js 至少 `24.12.0`，包管理器固定为 `pnpm 11.25.0`，版本以仓库 `package.json` 为准。不能因为开发工具内部可以运行 pnpm，就假定自己打开的 PowerShell 也已经安装。

在普通 PowerShell 中检查：

```powershell
node --version
pnpm.cmd --version
```

2026-10-30 已检查本机 Node.js 为 `24.22.0`，并将 pnpm `11.25.0` 安装到 `C:\Users\lzzhu\AppData\Roaming\npm`。该目录已经在用户 PATH 中；用仅包含系统和用户 PATH 的环境验证了版本及 `backend:check`，均通过。当前电脑不需要重复安装，重新打开 PowerShell 后继续即可。

若在另一台已经有兼容 Node.js 的 Windows 电脑准备环境，可使用 npm 安装项目固定版本；不要直接安装 latest 改变项目工具版本：[pnpm 官方安装说明](https://pnpm.io/installation)。

```powershell
npm.cmd install --global pnpm@11.25.0
```

安装后重新打开终端，核对 `pnpm.cmd --version` 为 `11.25.0`。Windows PowerShell 中，下文所有 `pnpm ...` 都可以写成 `pnpm.cmd ...`，两者执行同一工具；使用 `.cmd` 无需调整 PowerShell 脚本执行策略。命令工具安装成功不代表网站已经部署。

## 1 先认清每项服务的用途

| 服务                 | 在这个网站里做什么                            | 建议资源名                      |
| -------------------- | --------------------------------------------- | ------------------------------- |
| GitHub Pages         | 展示访客看到的网页                            | 现有 lingzhenzhu.github.io 仓库 |
| Cloudflare Worker    | 运行后台、保存接口、上传接口、Medium RSS 接口 | lzzhu-website-studio            |
| Cloudflare Access    | 检查谁可以进入网站后台                        | Website admin                   |
| D1                   | 保存页面、文章、草稿和版本记录                | website-content                 |
| R2                   | 保存原始图片和发布归档                        | lzzhu-website-private           |
| Images binding       | 检查上传图片能否正确解码                      | IMAGES                          |
| GitHub App           | 让后台发起网站构建和发布                      | LZZhu Website Publisher         |
| Access Service Token | 让 GitHub 构建程序读取待发布内容              | github-pages-publisher          |

这些名称对应当前仓库配置。已有同名资源时先核对用途，不重复创建，也不初始化一个已经有内容的库。

## 2 配置网站后台的登录

在 [Cloudflare 控制台](https://dash.cloudflare.com/) 选择持有 lzzhu.net 的账户，进入 **Zero Trust**（有些入口显示为 Cloudflare One）。

### 2.1 确认团队地址和登录方式

1. 初次使用时，完成组织设置。选择一个可用的团队名称；它会形成 `你的团队.cloudflareaccess.com`，这是登录服务地址，不是新的网页入口。
2. 记下完整的 `https://你的团队.cloudflareaccess.com`，不带末尾斜杠，后面填入 `ACCESS_ISSUER`。
3. 打开 **Integrations → Identity providers**，检查已有登录方式。
4. 为便于第一次联调，可添加 **One-time PIN**，即用邮箱收验证码。已有 Google、GitHub 或 Cloudflare 身份提供方也可以继续使用，不必重复添加。
5. 网站后台的放行范围由下一步的邮箱白名单决定。邮箱验证码并不等于“所有拿到验证码的人都能进后台”。

这里的验证码仅用于网站 `/admin/`，不决定申请卡的登录方式。[Cloudflare 邮箱验证码配置](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)

### 2.2 创建 Access 应用

1. 进入 **Access controls → Applications → Create new application**。
2. 选择 **Self-hosted and private**；如果界面写作 **Self-hosted**，选择对应的公开网站应用。
3. 应用名称填 `Website admin`，会话时长先选 8 小时。
4. 使用 **Add public hostname** 添加两条地址。域名部分都选 `lzzhu.net`，子域名都填 `www`；Path 分别填 `admin`、`admin/*`。组合结果必须是下表中的地址。

| 公开地址              | 用途                     |
| --------------------- | ------------------------ |
| www.lzzhu.net/admin   | 无末尾斜杠的入口         |
| www.lzzhu.net/admin/* | 后台页面、资源和内部接口 |

5. 添加策略 `Website administrators`，Action 选 **Allow**。
6. 在 **Include** 中选择 **Emails**，填写允许管理网站的完整邮箱地址。不要填 Everyone 或整个公共邮箱域名。
7. 在登录方式中选中上一步准备好的身份提供方。
8. 保存应用，在应用详情中找到 **Application Audience (AUD) Tag**，复制到自己的配置笔记，后面填入 `ACCESS_AUD`。

这里不添加 `admin.lzzhu.net`、裸域名、整个 www 或申请卡路径。后续为构建程序添加第二条策略，但仍属于同一个 Website admin 应用。[Access 应用配置](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)

## 3 创建内容数据库和图片仓库

### 3.1 D1 数据库

1. 回到 Cloudflare 账户控制台，打开 **Storage & databases → D1 SQL database**。若菜单不同，用控制台搜索 D1。
2. 点击 **Create Database**。
3. 名称填 `website-content`，位置选自动即可。
4. 创建后进入数据库详情，找到 **Database ID**，保存这串 UUID。
5. 这时数据库还没有网站表和内容。先保持为空，后续由仓库迁移命令创建表、导入经核对的当前草稿。

Worker 里的绑定名称是 `DB`。数据库名称、Database ID、绑定名称是三个不同的字段，不要互相替代。[D1 创建与绑定](https://developers.cloudflare.com/d1/get-started/)

### 3.2 R2 私有存储桶

1. 打开 **Storage & databases → R2 Object Storage**。
2. 如果账户尚未启用 R2，按控制台提示查看并完成开通；是否需要付款方式以账户页面为准。
3. 点击 **Create bucket**，名称填 `lzzhu-website-private`。
4. 存储类别选 **Standard**，位置选自动。
5. 创建后打开 **Settings**，确认 **Public Development URL / r2.dev** 未启用，**Custom Domains** 为空。
6. 不需要给浏览器配置 R2 的 S3 密钥或 CORS。网站通过经过认证的 Worker 上传；公开图片由发布流程输出到 GitHub Pages。

Worker 里的绑定名称是 `PRIVATE`。图片原件与发布归档保存在同一个私有桶的不同路径。[R2 存储桶](https://developers.cloudflare.com/r2/buckets/create-buckets/)

### 3.3 Images binding

仓库已声明 `images.binding = IMAGES`。部署后在 Worker 的 **Bindings** 中核对是否存在 Images 绑定，并在后台上传一张 JPEG 和一张 PNG 验证实际解码。若账户提示未开通对应功能，进入 **Images → Transformations** 按提示开通。这里使用的是 Worker 图像处理能力，不需要把原图另存一份到 Images Hosted Images。[Images binding](https://developers.cloudflare.com/images/optimization/binding/)

## 4 给 GitHub 构建程序准备通行证

### 4.1 创建 Access Service Token

1. 回到 Zero Trust，进入 **Access controls → Service credentials → Service Tokens**。
2. 点击 **Create Service Token**。
3. 名称填 `github-pages-publisher`，有效期可先选 1 年。
4. 点击 **Generate token**。
5. 将 **Client ID** 和 **Client Secret** 存入密码管理器。Secret 只展示一次，不发到聊天或截图中。
6. 返回 **Applications → Website admin → Policies**，添加策略 `GitHub publication`。
7. Action 选 **Service Auth**；Include 选 **Service Token**，值选择 `github-pages-publisher`。不要选 Allow 或 Bypass。
8. 保存。保留前面的管理员邮箱 Allow 策略。

Worker 还会限制构建身份只能使用发布相关接口；这张通行证不能编辑网站草稿。[Service Token 设置](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)

### 4.2 存入 GitHub Environment

1. 打开网站 [GitHub 仓库](https://github.com/lingzhenzhu/lingzhenzhu.github.io)。
2. 进入仓库的 **Settings → Environments**，不是个人账户 Settings。
3. 打开 `github-pages`；若没有，点击 **New environment** 创建这个名称。
4. 在 **Environment secrets** 中点击 **Add environment secret**，创建以下两项。

| 名称                 | 填入的值                              |
| -------------------- | ------------------------------------- |
| ACCESS_CLIENT_ID     | Cloudflare Service Token 的 Client ID |
| ACCESS_CLIENT_SECRET | 同一 Service Token 的 Client Secret   |

5. 保存后应只能看见名称，不能再次查看 Secret 原值。

目前工作流使用 `github-pages` 环境读取它们，拼写必须一致。有部署分支限制时，确认实际默认分支被允许；无需为此关闭仓库的分支保护。

## 5 让网站后台能够通知 GitHub 发布

这一步创建 **GitHub App**。它负责后台到 GitHub 的请求；上一步的 Service Token 负责 GitHub 到后台的请求。

1. 在 GitHub 右上角点头像，进入个人 **Settings → Developer settings → GitHub Apps**。
2. 点击 **New GitHub App**。
3. Name 填 `LZZhu Website Publisher`；如果名称被占用，加一个容易识别的后缀。
4. Homepage URL 填 `https://www.lzzhu.net`。
5. Callback URL、Setup URL 留空。不勾选用户 OAuth 授权或 Device Flow。
6. 在 **Webhook** 区域取消 **Active**；当前流程不接收 GitHub webhook。
7. 在 **Repository permissions** 设置下表权限。

| 权限     | 值             | 当前代码用途              |
| -------- | -------------- | ------------------------- |
| Contents | Read and write | 发起 repository_dispatch  |
| Actions  | Read and write | 发布工作流管理            |
| Metadata | Read-only      | GitHub 自动提供的基础权限 |

8. 安装范围选择 **Only on this account**，创建 App。
9. 记录 App 详情页的 **App ID**。它不是 Client ID。
10. 在 **Private keys** 点击 **Generate a private key**，把下载的 `.pem` 文件保存在本机私有位置，不放入公开仓库。
11. 左侧点击 **Install App**，选择自己的账户，再选 **Only select repositories**，只选择 `lingzhenzhu.github.io`。
12. 安装后打开该安装的配置页，从页面 URL 的 `/installations/数字` 记录 Installation ID；后续也可通过 GitHub API 核对。

当前服务端要求 PKCS#8 格式的 RSA 私钥。下载文件如果是 `BEGIN RSA PRIVATE KEY`，接入时在本机转换后再存入 Worker Secret，不直接上传原文件到代码仓库。[GitHub App 注册说明](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)

## 6 接入 Worker 配置

账户资源齐备后再执行本节。申请卡预检已与网站配置分开；线上 Secret 和必要身份配置齐全后再运行生产 deploy。

### 6.0 先在控制台创建 Worker

`lzzhu-website-studio` 是我们为网站后端指定的 Worker 名称。写进本地配置文件不会自动创建线上资源。若准备先在控制台填写 Secrets，先完成下面这些点击操作；若列表已有同名 Worker，直接打开它，不重复创建。

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入持有 `lzzhu.net` 的那个账户。
2. 回到账户层级，在左侧找到 **Workers & Pages**。它可能位于 **Compute** 分类下；不是域名 DNS 页面，也不是 Zero Trust。
3. 点击 **Create application**（创建应用）。
4. 选择 **Start with Hello World!**，若出现 **Get started**，点击它。此处创建一个基础 Worker，不连接 GitHub 仓库、不创建 Pages 项目。
5. 在 **Worker name** 中填写 `lzzhu-website-studio`。它是资源名称，不是网址，前面不加 `https://`，后面不加 `.net`。
6. 保留示例代码，点击 **Deploy**。这一步只部署默认示例，不会上线我们的整套后台。
7. 看到部署成功后，点击 **Continue to project**（若显示），或者回到 Workers & Pages 列表并打开 `lzzhu-website-studio`。
8. 点击该 Worker 的 **Settings → Variables and Secrets**，此时才有后续填 Secret 的入口。

创建成功的判断：Workers & Pages 列表出现名称完全一致的 Worker，并且可以进入它的 Settings。若访问 Cloudflare 提供的地址显示 `Hello World!`，属于此阶段的正常结果。[Cloudflare 官方控制台创建步骤](https://developers.cloudflare.com/kv/get-started/)

此时保持域名路由为空，避免默认示例接管现有网页；正式部署会按项目配置连接 `www.lzzhu.net/admin*` 和 `www.lzzhu.net/api/*`。不添加 `admin.lzzhu.net`。我们的 TypeScript 后端和 Admin 构建产物由项目部署命令上传，不在控制台的 Edit code 中逐文件粘贴。

### 6.1 普通配置

将下面参数填入 `apps/studio/wrangler.jsonc`，以仓库配置为准，避免仅修改控制台后被下次部署覆盖。

| 字段                        | 填什么                                      |
| --------------------------- | ------------------------------------------- |
| d1_databases[0].database_id | 第 3 步的 Database ID                       |
| ACCESS_ISSUER               | 第 2 步的 https://团队.cloudflareaccess.com |
| ACCESS_AUD                  | Website admin 的 AUD                        |
| ADMIN_EMAILS                | 第 2 步允许管理网站的邮箱，多人用逗号分隔   |
| BUILD_SERVICE_ID            | 第 4 步的 Service Token Client ID           |

`SOURCE_COMMIT` 不需要填写。部署命令会读取 Git 当前提交，与 GitHub 默认分支的实际版本核对后自动注入；未提交、未合并或无法联网核对时停止。账户配置可保留在本地 wrangler.jsonc，应用源码必须已经提交。只在 Admin 修改文字、图片和 News 不属于代码变更，不需要更新这个编号或重新部署 Worker。

保留 `ENVIRONMENT=production`、`PUBLIC_ORIGIN=https://www.lzzhu.net`、正确的 GitHub 仓库名，以及 `DB`、`PRIVATE`、`IMAGES` 绑定。`BUILD_SERVICE_ID` 对应服务 JWT 的 common_name，即 Client ID，不是通行证名称或另一串 UUID。[Cloudflare 服务身份字段](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)

### 6.2 密钥

以下四项存入 Worker **Secrets**，不放入普通 vars 或 GitHub 仓库。

| Secret 名称            | 内容                                          |
| ---------------------- | --------------------------------------------- |
| CSRF_SECRET            | 本机随机生成的高强度密钥，至少 32 字符        |
| GITHUB_APP_ID          | 第 5 步的 App ID                              |
| GITHUB_INSTALLATION_ID | 第 5 步的 Installation ID                     |
| GITHUB_PRIVATE_KEY     | 转换为 PKCS#8 后的完整私钥，包括 BEGIN/END 行 |

完成 6.0 后，可以在 **Workers & Pages → lzzhu-website-studio → Settings → Variables and Secrets → Add** 添加：类型选 **Secret**，Name 填下表对应名称，Value 填实际值，再点击 **Deploy** 生效。也可以在首次正式部署时使用本机私有 Secret 文件统一录入，已经配置好的 Secret 不必重复添加。App ID 和 Installation ID 本身不是密码，但当前项目统一从 Secret 配置读取。

**已经在 Worker 控制台添加并 Deploy 生效，就不需要再创建 `worker-secrets.json`。两种录入方式任选一种，当前按控制台方式继续。** 后续正式部署运行 `pnpm deploy:studio`，不加 `--secrets-file`；已有 Worker Secrets 会保留。

`GITHUB_INSTALLATION_ID` 的查找方法：打开 GitHub 个人 **Settings → Applications → Installed GitHub Apps**，找到发布用 App，点击 **Configure**。浏览器地址如 `https://github.com/settings/installations/12345678`，最后的数字就是 Installation ID（示例数字不能照填）。它与 App ID、Client ID 不同。若没有安装记录，回到 **Developer settings → GitHub Apps → 你的 App → Install App**，安装到自己的账户，并仅选择网站仓库。

`CSRF_SECRET` 是网站自己使用的随机密钥，不在 GitHub 或 Firebase 查找。已在本机 `.artifacts/private-deploy/csrf-secret.txt` 生成 32 字节随机值，以 64 个十六进制字符保存；复制文件中的整行到 Worker 的同名 Secret 即可。此文件被 Git 忽略，只用于本机转存，不发送到聊天中。

可选的批量录入方式才使用 `.artifacts/private-deploy/worker-secrets.json`：由本机程序写入 Secret 字段并保留私钥换行，再以 `--secrets-file` 随代码上传。无需两种方式都做。`secret put` 会立即生成并部署 Worker 版本，不当作不会生效的草稿操作。[Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

### 6.3 数据库、图片桶和代码如何连接

到这一步，控制台里是一个已经保存 Secrets 的示例 Worker。它还没有网站后台程序；本地配置也尚未同步到线上。后续按 **6.4 核对资源 → 7 域名 → 8 源代码与发布准备 → 9 初始化和部署 → 10 验收** 顺序执行，不在这里直接部署。

Worker 通过 **Bindings（绑定）** 使用数据库和图片桶。绑定相当于给程序一个指向指定资源的连接；不需要另外填写数据库密码、连接字符串或 R2 的 S3 密钥。[Cloudflare Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)

| 能力 | 程序使用的绑定名 | 实际资源或来源 | 怎样接通 |
| --- | --- | --- | --- |
| 内容数据库 | `DB` | D1：`website-content` | 部署读取配置中的 Database ID，绑定已有数据库 |
| 图片与发布归档 | `PRIVATE` | R2：`lzzhu-website-private` | 部署按 bucket_name 绑定已有私有桶 |
| 图片检查与解码 | `IMAGES` | Cloudflare Images binding | 部署启用声明的绑定；实际能力还要上传图片验证 |
| Admin 页面文件 | `ASSETS` | 本机构建目录 `apps/studio/dist` | 部署上传 HTML、CSS、JS 等构建产物，自动建立静态资源绑定 |

`ASSETS` 不是另一个 R2 bucket，不需要手动创建。`IMAGES` 也不是图片仓库；原始上传图片仍在 `PRIVATE` 桶中。

上述配置已经写在 `apps/studio/wrangler.jsonc`：`d1_databases`、`r2_buckets`、`images`、`assets`。本项目以这个文件为准，由第 9 节的部署命令统一应用，**不需要在控制台再手动绑一遍**。资源本身仍须按第 3 节提前创建，且与 Worker 属于同一账户。

实际上传的程序也已经在仓库中：

- `apps/studio/server/index.tsx`：Worker 后端入口，部署工具会连同它引用的服务端模块一起打包。
- `apps/studio/editor/`：Admin 界面源码，构建后输出到 `apps/studio/dist`。
- `apps/studio/wrangler.jsonc`：告诉 Cloudflare 上传哪个程序、使用哪些资源和接管哪些路径。

**不要在控制台 Edit code 粘贴这些源码。** 单独粘贴入口文件不包含依赖、其他模块和 Admin 构建产物。第 9 节的 `pnpm deploy:studio` 才是完整上传入口，会替换 Hello World 示例，同时应用绑定、普通配置和路径路由，保留已经设置的 Secrets。

部署程序不会自动创建 D1/R2、执行数据库建表、迁移本地内容和图片，也不会发布 GitHub Pages；这些是后续独立步骤。

### 6.4 登录并核对已经创建的资源

以下命令在仓库根目录的 PowerShell 中逐条执行。此节只安装本地依赖、登录、读取资源信息和检查配置，不写入线上网站内容。

```powershell
Set-Location 'C:\Users\lzzhu\Documents\GitHub\lingzhenzhu.github.io'
pnpm install --frozen-lockfile
node scripts/tool.mjs wrangler login
node scripts/tool.mjs wrangler whoami
```

`login` 会打开浏览器授权。`whoami` 应显示持有 `lzzhu.net`、D1 和 R2 的账户；有多个账户时要核对实际部署账户，不能只看登录邮箱。

```powershell
node scripts/tool.mjs wrangler d1 info website-content --config apps/studio/wrangler.jsonc
node scripts/tool.mjs wrangler r2 bucket list --config apps/studio/wrangler.jsonc
node scripts/tool.mjs wrangler secret list --config apps/studio/wrangler.jsonc
pnpm backend:check
```

应看到：D1 的 ID 与本地配置一致；R2 列表包含 `lzzhu-website-private`；Secret 列表包含第 6.2 节四个名称。Secret 列表不返回原值，也不能证明私钥内容正确。`backend:check` 成功只代表本地配置检查通过，不证明线上资源、登录或图片上传可用。

如提示未找到数据库或 bucket，回到第 3 节核对创建账户和名称，不通过新建同名的另一套资源绕过。此时继续完成第 7、8 节，不直接跳到部署命令。

## 7 让 www 的指定路径进入后台

### 7.1 只调整 www 的 DNS

1. Cloudflare → `lzzhu.net` → **DNS → Records**。
2. 找到主机名 `www`，核对它的目标仍为现有 GitHub Pages 地址。通常为 `lingzhenzhu.github.io`；已有可用设置先保留。
3. 确认代理状态是橙色云朵 **Proxied**。路径级 Worker Routes 要求该主机经过 Cloudflare。
4. 核对网站仍通过 HTTPS 正常打开。已有重定向规则若会将 www 整体重定向到另一主机，应先缩小或修正该条规则，否则请求不会进入预期路径。
5. 不改 `@`、`admin` 或其他子域名，不修改影响其他网站的全域规则。

### 7.2 核对 Worker Routes

第 9 节部署会依据 wrangler.jsonc 创建路由。现在只核对配置，不把路由指向 Hello World 示例。部署后进入 **Workers & Pages → lzzhu-website-studio → Settings → Domains & Routes**，应只出现：

```text
www.lzzhu.net/admin*
www.lzzhu.net/api/*
```

它们属于 **Route**，不是整个 www 的 **Custom Domain**。首页、Research、Teaching 等普通页面仍由 GitHub Pages 提供。保持 workers.dev 和预览 URL 关闭。[Worker 路径路由](https://developers.cloudflare.com/workers/configuration/routing/routes/)

### 7.3 后台绕过缓存

1. 域名控制台进入 **Caching → Cache Rules → Create rule**。
2. 名称填 `Website private routes`。
3. 选自定义表达式，输入：

```text
(http.host eq "www.lzzhu.net" and (
  starts_with(http.request.uri.path, "/admin") or
  starts_with(http.request.uri.path, "/api/") or
  http.request.uri.path eq "/_release.json"
))
```

4. **Cache eligibility** 选择 **Bypass cache**，保存。
5. 检查是否有其他匹配规则把它覆盖为缓存；以最终响应和规则执行结果为准。

该规则只影响 www 的指定路径。普通页面保持现有缓存；不要把全部 HTML 设置成一年缓存。[缓存规则配置](https://developers.cloudflare.com/cache/how-to/cache-rules/create-dashboard/)

## 8 部署前准备源代码和 GitHub 发布

先准备好完整发布产物和恢复方式，再改变发布来源。此步骤尚未执行。

1. 进入网站仓库 **Settings → Pages**。
2. 记下现在的发布来源和线上部署版本。
3. 在 **Build and deployment → Source** 选择 **GitHub Actions**，避免把重构源码当作旧版根目录 HTML 直接发布。
4. 保留 **Custom domain = www.lzzhu.net**，确认 HTTPS 状态正常。不填写 `admin.lzzhu.net`。
5. 选好 GitHub Actions 后，这个 Pages 设置页面无需再选工作流文件，也无需上传 YAML。如果下面显示 **GitHub Pages Jekyll / Static HTML** 等模板卡片，不点它们的 **Configure**。仓库已有 `.github/workflows/publish.yml`，随下一步合并源代码进入默认分支后，由 GitHub 识别。
6. 将通过检查的重构分支合并到默认分支，然后把本地代码更新到合并后的版本。2026-10-30 核对时，开发分支是 `codex/modular-rebuild`，GitHub 默认分支是 `gh-pages`。后台通过 repository_dispatch 发起任务，发布工作流必须存在于默认分支；仅把代码推送到开发分支还不能完成发布接入。
7. 核对 GitHub Actions 获准运行仓库已固定版本的 actions。工作流自身已经声明 Pages 写入和 OIDC 权限，不需要把整个仓库默认 Workflow permissions 改成全局读写。
8. 确认本地代码已更新为默认分支上的同一提交，且应用源码没有未提交改动。`SOURCE_COMMIT` 由部署命令自动取得，不需要自己复制或维护。

“使用已有工作流”的核对方式：在仓库 **Code** 页面选择默认分支，依次打开 `.github → workflows → publish.yml`，文件顶部应为 `name: Publish reviewed content`。若默认分支尚无此文件，说明下一步的源码合并尚未完成，不要另建模板或仅复制这一份 YAML，因为构建还需要同一版本的项目代码与脚本。[GitHub Pages 已有工作流设置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow)

这份工作流由网站后台发送的 `repository_dispatch`（`publish-site`）触发；没有配置 `workflow_dispatch` 或 push 发布，所以没有 **Run workflow** 按钮、合并后没有立即发布都属于正常现象。第 9、10 节完成后，在网站 `/admin/` 保存内容，点击 **Review & publish → Publish website**，后台才通知 GitHub。随后到仓库 **Actions** 查看 **Publish reviewed content** 的运行进度和日志。`repository_dispatch` 要求工作流位于默认分支，GitHub App 安装权限和第 4 节的构建 Secret 也须已经配置。[GitHub 触发规则](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#repository_dispatch)

这些是 Worker 部署的前置步骤，必须在第 9.3 节之前完成；第 9.1 节对新建空库的准备可以提前做。源码是否已提交、合并及同步，以实际 Git 状态与 PR 检查结果为准。提交、审核、合并和本地更新由代码维护者完成，不要求配置账户的人自行猜测 Git 命令。若部署提示源码未提交或不等于默认分支版本，是这一条件未满足，不是 Secret 填错。

以上步骤不会执行新站发布工作流；公开站切换仍需第 10 节的验收与明确发布操作。改变 Pages 设置前保留现有部署记录和恢复方式。[GitHub Pages 发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 9 初始化数据并上传真正的后台程序

这一节分为四件事：**给数据库建表 → 搬入现有内容和图片 → 上传后台程序 → 打开后台检查**。数据库、图片桶和 Worker 是第 3、6 节创建的同一套资源，不重新创建一套。

| 小节 | 通俗解释 | 现在能不能做 |
| --- | --- | --- |
| 9.1 建表 | 给空数据库准备存放内容的位置 | 新建、未被其他服务使用的空库可以先做，不必等 PR 合并 |
| 9.2 搬数据和图片 | 把本地已经编辑好的网站搬进去 | 由代码维护者准备并核对迁移包，不能直接导入旧测试文件 |
| 9.3 上传后台 | 把 Hello World 换成真正的 Website admin | 等 PR 检查通过、合并、本地代码同步及前面准备完成后再做 |
| 9.4 检查 | 确认登录、数据库、图片桶都能工作 | 部署成功后做 |

第 9.1 节是可以提前进行的空库准备；第 9.3 节仍严格要求第 2—8 节全部完成。若数据库已经有网站内容，按备份和升级流程处理，不采用下面的空库初始化流程。本节命令是操作说明，不表示已经替你执行线上操作。

### 9.1 先给新建的空数据库建表

**在哪里操作：你电脑上的 PowerShell。** 不在 Cloudflare 的 Edit code 页面输入，也不在 GitHub 中输入。

**第一步：进入项目文件夹。** 复制这一行，按回车：

```powershell
Set-Location 'C:\Users\lzzhu\Documents\GitHub\lingzhenzhu.github.io'
```

**第二步：确认命令工具登录了正确的 Cloudflare 账户。**

```powershell
node scripts/tool.mjs wrangler whoami
```

它应显示持有 `lzzhu.net` 和新数据库的账户。如果提示未登录或登录已过期，再运行下面一条，在弹出的浏览器里登录并授权，然后重新执行 whoami：

```powershell
node scripts/tool.mjs wrangler login
```

**第三步：确认要操作的是刚创建的 `website-content`。**

```powershell
node scripts/tool.mjs wrangler d1 info website-content --config apps/studio/wrangler.jsonc
```

这条命令只查看数据库信息。打开 Cloudflare 控制台 → **Storage & databases → D1 SQL database → website-content**，核对 Database ID 与命令输出一致，并确认这是第 3 节刚建、还没有网站数据的库。如果已经出现 `content_resources`、`workspace`、`assets` 等网站表，先核对是否已经完成初始化，不要删库或删表重做。

**第四步：让程序自动建表。** 仅在上述新建空库确认无误后执行：

```powershell
node scripts/tool.mjs wrangler d1 migrations apply website-content --remote --config apps/studio/wrangler.jsonc
```

`--remote` 的意思是“修改 Cloudflare 上的数据库”。程序会按顺序执行仓库里的建表文件，你不用打开 SQL 文件逐行复制。如果出现确认提示，先核对目标确实是 `website-content`，再按提示输入 `y` 并回车。

**怎样算成功：** 当前仓库有 `0001_initial.sql`、`0002_rewards.sql`、`0003_resource_storage.sql`、`0004_firebase_card.sql` 四个文件；命令应显示迁移应用成功且没有失败项。刷新 Cloudflare 的数据库页面，应能看到 `workspace`、`content_resources`、`assets`、`releases` 等表。它们由程序管理，无需你手动填写。Wrangler 会记录已经执行的迁移文件。[Cloudflare 数据库迁移说明](https://developers.cloudflare.com/d1/reference/migrations/)

到这里就完成了 9.1。**数据库已经有表，但还没有搬入现有网站内容；网页没有发布，Firebase 和旧 KV 卡的数据也没有改变。** 如果出现报错，先保留错误信息，不继续后面的导入或部署。

2026-10-30 用户提供的实际终端日志已确认：目标为 `website-content`，建表前 `num_tables = 0`，上述四个迁移最终全部显示成功。当前这套数据库的 9.1 已完成，无需从头再做；下一步是准备 9.2 的内容及图片迁移。

### 9.2 搬入现有网站内容和图片——由代码维护者处理

这一步的目标是：线上后台打开后，能看到本地已经编辑好的页面、文章、News、头像及照片，而不是一个空白网站。

**当前迁移包还需要整理，尚未完成远端导入。这是代码接入工作，不是你漏填了哪个 Cloudflare 选项。** 先停在 9.1 完成的位置，不执行旧指南里的 `backend-seed.sql` 导入命令，也不自行把测试文件上传到数据库。

代码维护者需要完成：

1. 找到实际使用的本地草稿库并备份，导出最新页面、文章和设置，核对没有丢掉后续编辑。
2. 找齐后台上传的原始图片及其素材库记录，保留文件原来的标识。
3. 把文字、页面结构和素材记录放进 D1，把上传的原图放进 R2。
4. 核对页面及模块数量、图片文件校验值和图片引用，确认完整后再进入 9.3。

只导入文字会漏掉图片，只把图片拖进 bucket 又会漏掉素材记录。仓库自带的图片会随构建处理；后台后来上传的照片需要单独迁移。**旧卡的余额、记录另按 Firebase 接入指南核对，不混在网站内容搬迁里。**

<details>
<summary>供代码维护者使用的迁移细节；账户配置时不用执行</summary>

数据库 ID 改变后，本地模拟器可能打开另一份空库，不能看到空库就重新播种覆盖原草稿。核对当前内容结构及 Firebase 模块转换后，将最新内容快照保存到被 Git 忽略的 `.artifacts/private-deploy/current-content.json`。`content/site.json` 是开发种子，旧 `.artifacts/scenario-audit/backend-seed.sql` 可能早于后续编辑，两者都不能代替最新草稿。

清点所有 `/assets/uploads/` 引用、D1 `assets` 元数据和本地 R2 原图，保存原对象键及哈希。只有新快照确实生成、核对完成，目标库已经建表且尚未初始化时，才运行：

```powershell
pnpm.cmd exec tsx scripts/seed-local.ts --snapshot .artifacts/private-deploy/current-content.json --output .artifacts/private-deploy/initial-content.sql
node scripts/tool.mjs wrangler d1 execute website-content --remote --config apps/studio/wrangler.jsonc --file .artifacts/private-deploy/initial-content.sql
```

第一条生成本地 SQL，第二条才写入远端。初始化脚本不用于日后编辑内容。素材导出、上传和元数据迁移尚未实现为可直接运行的一键命令；须保持对象键、元数据与引用一致，并验证远端文件哈希。仓库 `assets/source` 的内置素材随构建输出，不另传 R2。

</details>

### 9.3 上传后台程序——等 PR 合并和数据搬迁完成后

这一步会把控制台里的 **Hello World 示例换成真正的 Website admin**，同时连接数据库、图片桶和后台网址。

开始前确认：PR 检查全部通过并已合并；本地代码已同步到默认分支最新提交；未提交的修改已经整理；第 2—8 节账户配置和 9.2 数据搬迁均完成。源码同步由代码维护者核对，不需要你手动填写 `SOURCE_COMMIT`。如果 PR 尚未合并或迁移包还没准备好，现在不运行下面的部署命令。

准备完成后，在项目根目录的 PowerShell 中执行：

```powershell
pnpm.cmd deploy:studio
```

等待命令结束。它会先检查和构建代码，再上传到 Cloudflare；中间不要关闭窗口。它自动完成以下事情：

1. 检查代码版本和测试结果，生成后台需要的文件。
2. 把服务端代码及 Admin 界面上传到 `lzzhu-website-studio`。
3. 按本地配置连接 D1、R2、Images 和 Admin 静态文件。
4. 应用 `/admin*`、`/api/*` 的 www 路由，自动填写源码版本，保留已经录入的 Secrets。

**怎样算成功：** 终端完成 Worker 上传并报告部署成功，没有后续错误。仅看到“构建成功”还不够，之后还需要上传成功。若报错，保留错误信息，不在控制台粘贴源码绕过。

`pnpm.cmd deploy:studio --dry-run` 仅检查和打包，不上传；它同样要求代码已经合并并同步。本项目不需要另开 Cloudflare 的 GitHub 自动构建。已经在控制台填好 Secrets，也不需要再准备 `worker-secrets.json`。

这一步部署的是后台和接口。访客看到的新版主页，仍要在后续验收完成后，从 Admin 单独发布。

### 9.4 打开后台，检查是否接通

**第一步：查看 Cloudflare。** 打开 **Workers & Pages → lzzhu-website-studio**，核对下表：

| 点击位置 | 应该看到什么 |
| --- | --- |
| Deployments | 刚刚部署的新版本及时间，不再只有 Hello World 示例 |
| Bindings | `DB → website-content`，`PRIVATE → lzzhu-website-private`，以及 `IMAGES`、`ASSETS` |
| Settings → Variables and Secrets | 之前的 Secret 名称仍在，`SOURCE_COMMIT` 已自动填写 |
| Settings → Domains & Routes | `www.lzzhu.net/admin*`、`www.lzzhu.net/api/*` 两条路由，workers.dev 和预览 URL 关闭 |

**第二步：打开 `https://www.lzzhu.net/admin/`。** 应先出现 Cloudflare Access 登录，使用允许的管理员邮箱完成登录后，应看到 Website admin 和搬入的内容。不要使用以前的 workers.dev 示例地址。

**第三步：登录后打开 `https://www.lzzhu.net/admin/api/health`。** 它会显示一页文字，这是检查结果，属于正常现象：`database`、`privateStorage`、`imageDecoder` 应为 `true`，`content` 后面应有内容信息，而不是 `null`。

**第四步：实际试一次保存和上传。** 在后台修改一小段文字并 Save，刷新后检查还在；上传一张 JPEG 和一张 PNG，检查预览正常。测试内容验完再恢复。此时不点发布，公开站内容不会因此改变。继续第 10 节完成其余验收。

如果 Cloudflare 绑定错误，应修正本地 wrangler.jsonc 后重新部署；不要只改控制台，避免下一次部署又被本地配置覆盖。

## 10 后台联调与验收

后台部署后，先用 `https://www.lzzhu.net/admin/` 联调；当前线上公开站保持原部署，直到显式发布新的 Pages 产物。

| 操作                                | 预期结果                                                     |
| ----------------------------------- | ------------------------------------------------------------ |
| 无痕窗口打开 /admin/                | 出现 Cloudflare Access 登录                                  |
| 使用未授权邮箱                      | 无法进入后台                                                 |
| 使用管理员邮箱                      | 进入 Website admin                                           |
| 打开 /admin/api/health              | database、privateStorage、imageDecoder 为 true，content 非空 |
| 修改一段文字并 Save，再刷新         | 草稿保留，线上公开内容不变                                   |
| 上传 JPEG、PNG，再预览              | 上传与解码成功，原图不公开                                   |
| 切换页面、长文编辑、手机窄屏        | 控件、预览和焦点行为正常                                     |
| GitHub 构建身份访问普通内容编辑接口 | 被拒绝                                                       |
| 首次公开发布后访问含 Medium 的页面  | 自动获取文章；缺图与请求失败有兜底                           |
| 发布后核对 /_release.json           | 与后台活动发布版本一致                                       |
| 回滚一个经核验的发布版本            | 公开站恢复对应版本，历史保留                                 |

健康检查里的 `database` 表示数据库查询成功，`privateStorage` 表示桶列表读取成功，`imageDecoder` 只表示 Images 接口已绑定。它们不能代替实际保存和上传测试。`content` 为 null 表示没有初始化工作区；表尚未创建时健康检查也可能直接报错。必须完成 Save 后刷新、JPEG/PNG 上传与预览，才能确认读写和实际解码都可用。

在正式首次公开发布前，按 [Firebase 接入指南](firebase-card-setup.md) 完成旧卡新接口、规则和旧代理的协调切换。整站 Pages 产物会整体替换；前端密码判断代码不会恢复，管理员密码由 Firebase Authentication 验证。随后从 Admin 的发布入口审阅并发布，等待 GitHub Actions 和 Pages 部署完成，再核对 `/_release.json` 与全部公开页面。Worker 部署成功本身不会把新的公开首页发布出去。

`/api/medium` 在首次正式发布前可能返回“没有活动发布”，这是当前实现的内容隔离，不通过读取未发布草稿来绕过。新闻、无障碍工具、移动导航及全部公开页面仍需纳入发布验收。

`backend:probe` 已按两种申请卡区分公开与受保护接口。Firefox 的 Windows 运行环境问题仍需在可用环境完成复验。后台接通不等于这些验收项目已经通过。

## 11 配置完成后需要核对的信息

可在自己的配置笔记中记录以下内容；密码和私钥不发到聊天中。

| 普通配置                       | 用途                            |
| ------------------------------ | ------------------------------- |
| Cloudflare 账户及团队地址      | 避免接到错误账户                |
| Website admin 的 AUD           | 后台验证登录凭据                |
| 管理员邮箱                     | Access 与 Worker 使用相同白名单 |
| D1 Database ID                 | 绑定内容数据库                  |
| R2 桶名                        | 绑定私有图片存储                |
| GitHub App ID、Installation ID | 后台通知 GitHub                 |
| Service Token Client ID        | 构建程序身份                    |

Service Token Secret 和 GitHub App 私钥直接存入上述 Secret 位置。CSRF_SECRET 在本机生成并录入。普通配置齐备后，先完成代码接入和后台联调，再按独立的 Firebase 指南安排公开站与旧申请卡的切换。
