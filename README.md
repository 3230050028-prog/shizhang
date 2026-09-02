# 拾账

一个面向手机和电脑浏览器的在线个人记账应用。每位注册用户拥有独立账本，支持收支记录、分类统计、搜索以及 CSV 导出。

## 当前功能

- 邮箱注册与登录
- 用户账目完全隔离（Supabase RLS）
- 新增、编辑和安全删除收入与支出
- 默认分类、自定义分类及分类自动复用
- 微信、支付宝、现金、银行卡及自定义支付账户
- 常用支付账户自动保存和复用
- 月度收入、支出和结余
- 可编辑并云端同步的月度预算
- 预算使用进度和超支提醒
- 网络失败保留表单并支持重新加载
- 忘记密码和安全的密码重置流程
- 防止电子表格公式注入的 CSV 导出
- 支出分类图表
- 按分类、支付账户或备注搜索
- 按月、收支类型、分类和支付账户组合筛选
- 导出的 CSV 包含支付账户
- 截图批量记账支持疑似重复检测、默认跳过和保存结果报告
- 响应式手机界面
- 可安装到 iPhone、Android 和电脑桌面的 PWA
- 独立全屏启动、离线页面和安全的版本更新提示
- 未配置数据库时自动进入演示模式

## 本地启动

```bash
npm install
npm run dev
```

浏览器打开终端显示的网址，通常是 `http://localhost:5173`。

## 连接 Supabase

1. 在 Supabase 创建一个新项目。
2. 打开 SQL Editor，运行 `supabase/schema.sql` 中的全部内容。
3. 在项目根目录复制 `.env.example`，命名为 `.env.local`。
4. 在 Supabase 项目设置的 API 页面找到 Project URL 和 Publishable key，填入 `.env.local`。
5. 重新运行 `npm run dev`。

如果项目已经运行过早期版本的 `schema.sql`，请再在 SQL Editor 中运行 `supabase/migrations/002_reliability.sql`。它会增加分类持久化和账目更新时间，不会删除已有数据。

升级到 v0.3 时，请继续运行 `supabase/migrations/003_accounts.sql`。运行前确认 SQL Editor 顶部选择的是 **Database**，而不是 Logs。已有账目会自动归入“未分类”账户，不会被删除。

## 安装到手机桌面

拾账部署到 HTTPS 网址后可以像普通 App 一样安装，不需要经过应用商店。

- iPhone：使用 Safari 打开拾账，点击“分享”，选择“添加到主屏幕”，并开启“作为网页 App 打开”。
- Android：使用 Chrome 打开拾账，点击右上角菜单，选择“安装应用”。

安装后可以从桌面图标独立全屏启动。基础页面可离线打开，但登录和云端账目同步仍需要网络。

不要把 `.env.local`、Secret key 或 Service role key 上传到 GitHub。前端只能使用 Publishable key。

## 检查项目

```bash
npm run lint
npm run build
```

## 后续计划

- 周期账单
- Excel 导入
- AI 消费总结
- PWA 手机桌面安装
