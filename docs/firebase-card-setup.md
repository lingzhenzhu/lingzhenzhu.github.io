# 旧申请卡：Firebase 接入步骤

更新：2026-10-30。当前已准备代码、规则文件和自动化测试；尚未部署，也没有修改线上 Firebase 规则或数据。

## 已确定的行为

- 继续使用现有 Realtime Database，不迁移到 Firestore。余额及记录结构保持 `remainingCount`、`requests`，服务端增加 `revision` 防止并发覆盖。
- 任何拿到页面网址的人都能查看、提交。管理员在原卡片内输入密码，才能修改次数或清空记录。
- Firebase 卡在整个网站中有且只有一个；Admin 可以移动、隐藏、恢复显示，不能新增、复制或删除。隐藏不会删除余额和记录，也不是访问权限控制。
- 网站 `/admin/` 仍由 Cloudflare Access 保护。Cloudflare 申请卡的实现和权限保留，与 Firebase 卡分开。

RTDB 适合这张卡的简单数据结构。Firestore 的复杂查询与文档组织能力对当前需求没有明显收益。两者的安全都取决于权限配置，切换数据库不会自动修复公开写入。[Firebase 官方比较](https://firebase.google.com/docs/database/rtdb-vs-firestore)

## 1. 创建管理员登录账号

1. 打开 [Firebase 控制台](https://console.firebase.google.com/)，选择 **card-84e16**。
2. 左侧选择 **Build → Authentication**，首次使用时点击 **Get started**。
3. 打开 **Sign-in method**，选择 **Email/Password**，开启 **Email/Password** 并保存。无需开启邮箱链接登录。
4. 打开 **Users → Add user**，填写管理员邮箱和一个新密码。邮箱可以选 `admin@lzzhu.net`。
5. 在用户列表中复制该用户的 **UID**。它与邮箱不是同一个值。

密码只在 Firebase 控制台设置；不要写入代码、RTDB 或聊天。页面仍只要求输入密码，服务器使用配置好的管理员邮箱登录，并同时核对 UID。用户无法通过注册另一个账号取得管理员权限。[Firebase 密码登录](https://firebase.google.com/docs/auth/web/password-auth)

## 2. 填写普通配置

打开 `apps/studio/wrangler.jsonc` 的 `vars`。项目 ID 和数据库地址已经填好，只需填写：

| Name | Value |
| --- | --- |
| `FIREBASE_ADMIN_EMAIL` | 第一步创建的管理员邮箱 |
| `FIREBASE_ADMIN_UID` | 第一步复制的 UID |
| `FIREBASE_CARD_ENABLED` | 接入检查阶段先保持 `0`；准备好新接口后改成 `1` |

这三个值不是管理员密码。`0` 表示接口关闭，访问时返回“尚未完成连接”；不会伪造 0 次余额。生产发布包含可见 Firebase 卡时，后台会要求它先完成配置。

## 3. 获取 Firebase Web API Key

如果 Cloudflare 列表还没有 `lzzhu-website-studio`，先按[网站上线指南第 6.0 节](launch-setup.md#60-先在控制台创建-worker)创建它，再添加下面的 Secrets。

1. Firebase 控制台左上角齿轮 → **Project settings → General**。
2. 找到 **Web API Key**。若项目尚未注册 Web 应用，可在 **Your apps** 点击网页图标 `</>` 注册一个应用，再查看配置中的 `apiKey`。
3. Cloudflare → **Workers & Pages → lzzhu-website-studio → Settings → Variables and Secrets → Add**。
4. 类型选择 **Secret**；Name 填 `FIREBASE_WEB_API_KEY`；Value 填 API Key。

API Key 用于识别 Firebase 项目，不是管理员密码。不要把它误填为私钥、UID 或整个配置对象。该 Key 必须允许 Identity Toolkit API；服务器调用不能使用仅允许网页 Referer 的 Key 限制。[Firebase Auth REST 接口](https://firebase.google.com/docs/reference/rest/auth)

## 4. 给服务器创建独立访问凭据

1. 打开 [Google Cloud 控制台](https://console.cloud.google.com/)，顶部项目选择同一个 **card-84e16**。
2. 进入 **IAM & Admin → Service Accounts → Create service account**。
3. 名字填 `website-card`，继续。
4. 为它选择 **Firebase Realtime Database Admin**（`roles/firebasedatabase.admin`）。不需要授予整个项目的 Owner、Editor 或 Firebase Admin。
5. 创建后打开该服务账号 → **Keys → Add key → Create new key → JSON**，下载文件。
6. Cloudflare Worker 的 **Variables and Secrets → Add → Secret**：Name 填 `FIREBASE_SERVICE_ACCOUNT`，Value 粘贴整个 JSON 文件内容（包括外层花括号）。

这个 JSON 是服务器凭据；只存本机私有目录和 Worker Secret，不放代码仓库、不发聊天。里面的 PEM 不需要按之前 GitHub App 私钥的步骤再次转换。服务器使用短期 OAuth 令牌访问 RTDB，浏览器拿不到此凭据。[Firebase 服务端认证](https://firebase.google.com/docs/database/rest/auth)、[RTDB 专用 IAM 角色](https://firebase.google.com/docs/projects/iam/roles-predefined-product#realtime-database)

## 5. 备份并协调切换

当前规则 `{"rules":{".read":true,".write":true}}` 允许任意人直接修改整个数据库。页面上的密码按钮不能限制这种直接访问。

2026-10-30 已只读备份现有库到本机 `.artifacts/private-migration/`；该目录被 Git 忽略。正式切换前再导出一份最新数据，核对余额及记录数量。不要用测试数据覆盖现有库。

同日用户提供了一份旧 Worker 代码：它使用 `env.FIREBASE_KV` 的 `state` 键保存余额与记录，没有请求 Firebase。`FIREBASE_KV` 只是绑定名称，不能据此判断使用了 Firebase；这可能是此前尝试的 KV 替代版本。还须核对线上页面实际调用地址、Worker 当前部署版本和所绑定的 KV 命名空间，不能假定它与 RTDB 自动同步。

2026-10-30 实际只读检查：线上旧卡 HTML 仍引用 `firebase-proxy.lzzhu718.workers.dev`，未发现 Firebase SDK 或数据库配置；该 Worker 的 `/get-state` 返回 HTTP 500。本次 `pnpm migration:export` 因此失败，没有导出新的余额或历史，也没有写入远端。不能把 500 当作空数据或认定 Worker 已无人使用。需要在 Cloudflare 中核对该 Worker 的 Bindings 和关联 KV 的 `state`，先保全数据再停用；仅凭当前接口错误无法判定是绑定缺失、数据解析错误或其他运行时问题。

停用前分别备份 KV 的 `state` 与 RTDB，比较余额、记录及实际使用情况，再确定迁移采用哪份数据。现有 RTDB 备份不包含 KV 数据，不可直接覆盖其中一份或盲目合并扣次记录。所提供旧代码的 `/admin` 写接口没有服务端身份验证；页面有密码框或设置 CORS 都不能替代鉴权。关闭 RTDB 的公开规则也不会阻止这份 KV Worker 写入自己的 KV。

若确认旧页面不再调用、数据已经保全，可以先停用旧 Worker 的访问入口，再在验收后删除 Worker。保留关联的 KV 命名空间，直到确认历史已迁移且其他 Worker 未使用它。新实现的 `/api/firebase-card` 由 `lzzhu-website-studio` 提供，不依赖这个旧 Worker。

按以下顺序安排同一次切换：

1. 先在隔离测试环境验证新接口的公开提交和管理员登录；测试用例使用模拟数据，不消耗真实次数。
2. 应用网站 D1 的 `0004_firebase_card.sql` 迁移。它只调整页面模块类型及历史版本，不联系 Firebase，也不改任何余额或申请记录。先备份网站 D1。
3. 部署配置完整的 Worker，把 `FIREBASE_CARD_ENABLED` 改为 `1`。通过 `/api/firebase-card` 只读核对返回的余额和历史。
4. 完成上述两份数据核对，清查旧 `firebase-proxy.lzzhu718.workers.dev` 及实际使用的旧 Worker 入口，停止旧公开写入。KV 版本不受 RTDB 规则影响；若另有使用服务端 Firebase 凭据的代理，仅关闭 RTDB 规则也不能阻止它继续写入。
5. 在 Firebase **Realtime Database → Rules**，替换为下方规则，点击 **Publish**。此时旧网页可能暂时不可提交，因此要与新版页面发布安排在同一次切换窗口中。
6. 发布新版页面。确认申请卡页面和 `/api/firebase-card*` 未被 Cloudflare Access 要求访客登录；网站 `/admin/` 继续保持 Access 保护。
7. 验证匿名数据库直连被拒绝，新页面仍可查看；再经确认进行真实提交、管理员改次数和清空记录的线上测试，避免删除正式历史。

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

同一内容已保存为 `apps/studio/firebase/database.rules.json`。规则关闭的是浏览器直接访问数据库；获得 IAM 授权的 Worker 服务账号仍可访问。普通访客通过受限接口提交，不能指定余额、改历史或清空记录。[Realtime Database 安全规则](https://firebase.google.com/docs/database/security)

## 6. 验收要点

- 公共提交有内容校验、请求限速和重复请求去重；余额与记录使用 ETag 条件写入，避免并发多扣或丢记录。
- 管理员登录有单独限速，身份令牌只存 HttpOnly、Secure、SameSite Cookie，约一小时后重新登录。注销清除浏览器会话；Firebase 禁用账号或撤销令牌后，服务器拒绝后续管理操作。
- 修改余额、清空记录均检查数据版本；操作前如果有人提交了新申请，会提示刷新，不覆盖新数据。
- 隐藏和恢复显示只修改网站模块的可见性；服务端也禁止增删或复制 Firebase 实例。
- 本地模拟测试不等于线上验收。真实服务账号权限、密码登录、关闭公开规则和旧代理下线必须在接入时逐项确认。

未来新增独立卡使用 Cloudflare 模块。现有 Cloudflare 实现目前仍是一套受保护的余额和历史；若需要同时运行多张互相独立的 Cloudflare 卡，应先实现按卡分区存储，不能把复制展示模块当成创建独立账本。
