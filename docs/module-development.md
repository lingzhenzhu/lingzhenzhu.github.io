# 模块扩展与边界

模块身份与内容规则以 `packages/content/src/module-contracts.ts` 为唯一入口。每种模块定义自己的 schema、初始值、名称、目录分组、图标、共享内容源和路径限制。模块库、名称、默认值和校验均由这份定义产生，不再分别维护列表。

新增模块需要三个明确的实现位置：

1. 在中立的内容包中添加模块定义。此处不能导入 React、DOM、Tiptap、Cloudflare 绑定或浏览器资源。
2. 在 `apps/studio/editor/BlockFields.tsx` 的编辑适配表中注册专用字段组件。复用 Button、ConfirmDialog、ImageField、RichEditor、SortableList 等控件。
3. 在 `packages/presentation/src/blocks.tsx` 的渲染适配表中注册展示组件。公开构建与后台预览共用该组件。

编辑与渲染适配表通过 `ModuleAdapters` 做穷尽类型检查，缺少任何已定义类型会使 `pnpm check` 失败。三个位置对应内容、编辑、展示三个职责，不能为了减少文件数把浏览器编辑器打包进 Worker。`module-contracts.test.ts` 验证各模块初始值、实例 ID、公共渲染以及危险输入约束；有新交互时再增加相应的行为测试。

普通模块实例存储在所属页面，复制后独立编辑。News、Medium、Contact links 和 Article list 的来源由 `sharedSource` 标明，编辑器共用 SharedSourceNotice 展示受影响页面；模块自己的标题、条数等显示选项只影响当前实例。Request card 的受保护路径限制来源于同一模块定义，并同时用于内容校验和跨页操作。

页面变更使用稳定 ID 和不可变更新，不修改传入的 Content 对象。这样资源差异、撤销引用以及网络等待期间的输入都能保持正确。保存入口统一经过 `useDraft`，模块组件不能直接写数据库或维护自己的保存队列。

后台原生 button 标签只在 Button.tsx 中封装。带文字的动作默认遵守共用的窄屏图标规则；纯图标按钮使用 IconButton，导航和列表行按语义保留图标。删除与恢复使用 ConfirmDialog：等待状态、重复点击、错误提示和焦点返回由同一个组件处理。允许取消的远程读取还必须提供 AbortController，避免关闭对话框后迟到的结果改变草稿。
