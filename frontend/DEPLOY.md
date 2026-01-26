# Frontend Deployment Guide

## Vercel Deployment (Production)

**idleTrencher 前端部署到 Vercel，通過 GitHub 自動觸發。**

### 部署步驟

1. **提交變更到 Git**
   ```bash
   git add <files>
   git commit -m "your commit message"
   ```

2. **推送到 GitHub**
   ```bash
   git push origin <branch-name>
   ```

3. **Vercel 自動部署**
   - Vercel 監聽 GitHub 倉庫
   - Push 後自動觸發建置與部署
   - 部署狀態可在 Vercel Dashboard 查看

### 分支對應

| Git Branch | Vercel Environment | URL |
|------------|-------------------|-----|
| `master` | Production | https://idletrencher.vercel.app |
| `feature/pwa` | Preview | https://idletrencher-*-sonyschans-projects.vercel.app |

### 重要提醒

- **不要使用** `npx vercel --prod` CLI 直接部署
- Vercel 已連接 GitHub，所有部署通過 Git push 觸發
- Preview 部署（非 master 分支）會產生唯一的預覽 URL

### 環境變數

Vercel 環境變數在 Dashboard 設定：
- `VITE_PRIVY_APP_ID` - Privy 認證 ID
- `VITE_API_BASE_URL` - 後端 API URL（使用 rewrites 時可省略）

### 查看部署狀態

1. Vercel Dashboard: https://vercel.com/sonyschans-projects/idletrencher
2. GitHub Actions（如有設定）
3. 命令行：`git log origin/<branch> --oneline -1` 確認最新 commit

### 本地預覽建置

```bash
npm run build
npm run preview
```
