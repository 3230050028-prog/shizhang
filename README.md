# 拾账

一个面向手机和电脑浏览器的在线个人记账应用。每位注册用户拥有独立账本，支持收支记录、分类统计、搜索以及 CSV 导出。

## 当前功能

- 邮箱注册与登录
- 用户账目完全隔离（Supabase RLS）
- 新增、编辑和安全删除收入与支出
- 默认分类、自定义分类及分类自动复用
- 月度收入、支出和结余
- 可编辑并云端同步的月度预算
- 预算使用进度和超支提醒
- 网络失败保留表单并支持重新加载
- 忘记密码和安全的密码重置流程
- 防止电子表格公式注入的 CSV 导出
- 支出分类图表
- 按分类或备注搜索
- 按月筛选和 CSV 导出
- 响应式手机界面
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
