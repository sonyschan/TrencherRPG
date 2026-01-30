# idleTrencher 專案規格書

## 概念

idleTrencher 是一個將加密貨幣投資遊戲化、視覺化的 idle screen 應用。讓投資者可以用有趣的方式觀看自己的代幣「隊伍」狀態，舒緩投資壓力，同時鼓勵長期持有。

**核心理念**：代幣是你的夥伴，不是敵人。看著它們成長，與你一起經歷市場的起伏。

---

## 開發路線圖

### Phase 1: 夥伴隊伍系統 (當前)
- 代幣作為夥伴顯示
- HP 動畫表示價值變化
- 經驗值/等級系統
- 最多顯示前 10 大價值代幣

### Phase 1.5: 基準價值系統 (計劃中)
- 「基準價值」取代「上次價值」作為漲跌計算基準
- 預設基準值 = 首次抓取代幣時的總價值
- 使用者可手動修改基準價值（買進/賣出/轉帳後調整）
- 3D HP 條優化：10 格分段顯示 + 多條線表示倍數增長
- 代幣詳情頁（打字機效果 UI，參考 BeedogETF）

**代幣詳情頁 UI**：
- 點擊代幣進入詳情頁
- 打字機效果呈現文字（參考 `/Users/sonyschan/gt/beedog/mayor/rig/landing/modules/DialogBox.js`）
- Web Audio API 打字音效（oscillator 800-1000Hz, 50ms 間隔）
- 代幣 Logo 顯示，彷彿代幣在詢問使用者
- 可編輯「基準價值」欄位
- 點擊可跳過打字動畫

### Phase 1.6: 功能選單與探索系統 (實作中)
- 右下角功能選單（像素風格圖標）
- 營火（Home）：預設畫面，自己的錢包村莊
- 放大鏡（Explore）：查看他人錢包村莊（24小時快取）
- 衣服（Wardrobe）：角色造型系統（暫時禁用，需 200K $idle）

**功能選單圖標**：
| 圖標 | 功能 | 狀態 | 說明 |
|------|------|------|------|
| 🔥 營火 | Home | 啟用 | 預設畫面，自己的家 |
| 🔍 放大鏡 | Explore | 啟用 | 查看他人錢包 |
| 👕 衣服 | Wardrobe | 灰階禁用 | 未來功能，需 200K $idle |

**探索模式規則**：
- 打字機效果對話框詢問錢包地址
- 資料來源：24小時快取系統
- 快取更新時機：
  - a) 有人用放大鏡查看該錢包
  - b) 錢包擁有者 refresh 自己的錢包
  - 僅當快取超過 24 小時才更新
- 探索視圖特點：
  - 左上角返回箭頭（回到自己的家）
  - 右下角無功能選單
  - 顯示快取時間戳

**資料庫快取表**：
```sql
CREATE TABLE wallet_cache (
  wallet_address TEXT PRIMARY KEY,
  total_value REAL DEFAULT 0,
  partners_data TEXT,          -- JSON 格式
  last_cached TEXT NOT NULL,   -- ISO timestamp
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 2: 對戰系統 (未來)
- 錢包 vs 錢包 對戰
- 三戰兩勝制
- 多種回合時間選項

---

## 核心機制

### 夥伴系統

每個代幣都是你的夥伴，畫面**最多顯示前 10 大價值的代幣**。

**HP 動畫狀態**（Phase 1 舊版）：
- 價值上升 → HP 增加動畫 (綠色)
- 價值下降 → HP 減少動畫 (紅色)
- 比較基準：與上一次查詢的資產價值比較

**HP 條系統**（Phase 1.5 新版）：

比較基準改為「基準價值」（designatedValue），預設為首次抓取時的代幣總價值。

```
倍數 = currentValue / designatedValue
```

**視覺呈現：10 格分段 + 最多 3 條線**

| 情況 | 第 1 條線 | 第 2 條線 | 第 3 條線 |
|-----|----------|----------|----------|
| 虧損 (倍數 < 1) | 綠格 + 紅格 | - | - |
| 持平/獲利 (1x - 10x) | 10 格全綠 | 1-10 格綠 | - |
| 大幅獲利 (10x - 100x) | 10 格全綠 | 10 格全綠 | 1-10 格綠 |
| 超大獲利 (≥100x) | 10 格全綠 | 10 格全綠 | 10 格全綠 |

**計算公式**：

```javascript
// 虧損時（倍數 < 1）
loss% = (1 - 倍數) * 100
redBlocks = ceil(loss% / 10)    // -1% → 1紅, -18% → 2紅, -91% → 10紅
greenBlocks = 10 - redBlocks

// 獲利時（倍數 >= 1）
bar1 = 10  // 第一條線永遠全綠
bar2 = min(10, floor(倍數))      // x1.5→1格, x2→2格, x10→10格
bar3 = min(10, floor(倍數 / 10)) // x13→1格, x50→5格, x100→10格
```

**範例**：
- x0.82 (跌18%) → 第1條: 8綠2紅
- x1.5 (漲50%) → 第1條: 10綠, 第2條: 1綠
- x5 (漲5倍) → 第1條: 10綠, 第2條: 5綠
- x25 (漲25倍) → 第1條: 10綠, 第2條: 10綠, 第3條: 2綠
- x150 (漲150倍) → 3條線全滿 (30格綠)

**代幣替換規則**：
- 當代幣被買賣導致排名變化時，新進入前 10 的代幣從 Lv1、Exp 0 開始
- 被擠出前 10 的代幣經驗值歸 0

### 經驗值與等級系統

**設計理念**：鼓勵長期持有，待在錢包越久的代幣等級越高。

**經驗值累積**：
- 每天 +1 Exp（以代幣持續在前 10 名為準）
- 被擠出前 10 名則經驗值歸 0

**等級計算公式**：
```
Level = min(60, floor(sqrt(Exp × 10)))
```

**等級里程碑表**：

| 等級 | 所需天數 | 說明 |
|-----|---------|------|
| Lv1 | 1 天 | 新手夥伴 |
| Lv10 | 10 天 | 初級夥伴 |
| Lv20 | 40 天 | 中級夥伴 |
| Lv30 | 90 天 (~3個月) | 資深夥伴 |
| Lv40 | 160 天 (~5個月) | 老練夥伴 |
| Lv50 | 250 天 (~8個月) | 精英夥伴 |
| Lv60 | 360 天 (~1年) | 傳奇夥伴 (上限) |

**前端顯示**：
- 每個代幣右下角顯示等級標籤：`Lv1`, `Lv2`, ... `Lv60`
- 等級越高，視覺效果越華麗（光環、特效等）

### 代幣經濟 ($idle)
- 持有 10000 $idle = 顯示 1 個代幣夥伴
- 持有 100000 $idle = 顯示 10 個夥伴（目前上限）
- 代幣門檻決定可視化層級

**正式 $IDLE CA**：`9jwHJHSD7geYvTy6WUtoDVuuvuoJiWH2XHWMggPUpump`（已配置於 GCP 環境變數）

---

## 對戰系統 (Phase 2 路線圖)

### 對戰模式
1. **自定義錢包地址**：指定特定錢包進行 PK
2. **時間匹配**：隨機配對同時段想對戰的玩家

### 對戰規則

**三戰兩勝制**：
- 開戰時鎖定雙方錢包前 5 大價值代幣及當下價格
- 每回合結束時，計算各代幣價值變化百分比
- 價值增加%較多的一方贏得該回合
- 先贏 2 回合者獲勝（即使最終總價值增加%較少也可能贏）

**回合時間選項**：
| 選項 | 適合場景 |
|-----|---------|
| 1 分鐘 | 快速刺激 |
| 5 分鐘 | 短線對決 |
| 15 分鐘 | 中短線 |
| 1 小時 | 標準對戰 |
| 8 小時 | 日間對戰 |
| 24 小時 | 長線對決 |

### 對戰流程
```
1. 選擇對戰模式（指定錢包 / 隨機匹配）
2. 選擇回合時間
3. 系統鎖定雙方前 5 大代幣 + 當前價格
4. 等待回合結束
5. 計算各代幣價值變化%
6. 判定回合勝負
7. 重複 3 回合
8. 宣布最終勝負
```

---

## 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Three.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  3D Scene   │  │  Partner UI │  │  Partner Animation  │  │
│  │  Renderer   │  │  HUD/Level  │  │  System (HP/Effects)│  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Solana Wallet Adapter (Phantom, Solflare, etc.)        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              │ REST API / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Node.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Wallet     │  │  EXP/Level  │  │  Partner State      │  │
│  │  Tracker    │  │  Calculator │  │  Manager            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Price      │  │  TRPG Gate  │  │  History            │  │
│  │  Service    │  │  (Access)   │  │  Storage            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Solana RPC  │  │ DexScreener │  │  Solscan API        │  │
│  │ (Helius)    │  │ (Prices/    │  │  (Portfolio)        │  │
│  │             │  │  Logos)     │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 區塊鏈整合 (Solana)

### 測試錢包
```
52VCnQPmGCYudemRr9m7geyuKd1pRjcAhpVUkhpPwz5G
```

### 資料來源

| 用途 | 服務 | 備註 |
|-----|------|-----|
| 錢包總價值 | Solscan API | 或 Helius getAssetsByOwner |
| 代幣價格 | DexScreener API | `https://api.dexscreener.com/latest/dex/tokens/{address}` |
| 代幣 Logo | DexScreener API | `pair.info.imageUrl` |
| 錢包連接 | Solana Wallet Adapter | 支援 Phantom, Solflare 等 |

### 錢包連接流程
```
用戶 → 點擊「連接錢包」
     → Phantom/Solflare 彈窗授權
     → 取得公鑰 (publicKey)
     → 查詢代幣餘額與價值
     → 檢查 $TRPG 持有量決定可視化層級
     → 顯示前 10 大代幣作為夥伴
```

---

## 功能模組

### 1. Backend: 錢包追蹤核心
**檔案**: `backend/services/walletTracker.js`

```javascript
// 功能
- getWalletPortfolio(address)    // 取得錢包所有代幣與價值
- getTopTokens(address, limit)   // 取得前 N 大價值代幣
- getTokenBalance(address, mint) // 取得特定代幣餘額
- calculateTotalValue(portfolio) // 計算總價值 (USD)
- getHistoricalValue(address, date) // 歷史價值查詢
```

**更新頻率**: 手動觸發或定時輪詢（免費 API 限制，非即時）

### 2. Backend: 價格服務
**檔案**: `backend/services/priceService.js`

```javascript
// 參考 BeedogETF 的 DexScreener 整合
async function getTokenPriceFromDexScreener(tokenAddress) {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  const response = await fetch(url);
  const data = await response.json();

  // 取得最佳交易對
  const pairs = data.pairs || [];
  const bestPair = pairs.sort((a, b) => b.liquidity?.usd - a.liquidity?.usd)[0];

  return {
    price: parseFloat(bestPair?.priceUsd || 0),
    logoUrl: bestPair?.info?.imageUrl || null,
    symbol: bestPair?.baseToken?.symbol
  };
}
```

### 3. Backend: EXP/等級系統
**檔案**: `backend/services/expCalculator.js`

```javascript
// 經驗值計算
function calculateExp(holdingDays) {
  return holdingDays; // 每天 +1 Exp
}

// 等級計算公式
function calculateLevel(exp) {
  const level = Math.floor(Math.sqrt(exp * 10));
  return Math.min(60, level); // 上限 Lv60
}

// 反向計算：達到特定等級需要的天數
function daysRequiredForLevel(level) {
  return Math.ceil((level * level) / 10);
}

// 範例：
// Lv10 需要 10 天
// Lv20 需要 40 天
// Lv30 需要 90 天
// Lv40 需要 160 天
// Lv50 需要 250 天
// Lv60 需要 360 天
```

### 4. Backend: 夥伴狀態管理
**檔案**: `backend/services/partnerManager.js`

```javascript
// 每個代幣夥伴的狀態
{
  tokenAddress: "8AinLTh...",
  tokenSymbol: "TOKEN",
  logoUrl: "https://...",      // DexScreener 取得
  previousValue: 1000,         // 上次記錄價值
  currentValue: 1200,          // 現價值
  valueChangePercent: 20,      // 價值變化%
  hpState: "increasing",       // increasing | decreasing | stable
  exp: 45,                     // 經驗值（持有天數）
  level: 21,                   // 等級
  rank: 1                      // 在前 10 中的排名
}
```

### 5. Frontend: Three.js 場景
**檔案**: `frontend/src/scene/`

```
scene/
├── IdleArena.js       # 閒置場地
├── PartnerToken.js    # 夥伴（代幣 Logo 作為外觀）
├── HPEffects.js       # HP 變化特效（紅/綠）
├── LevelBadge.js      # 等級標籤 (Lv1-60)
└── Camera.js          # 攝影機控制
```

**夥伴視覺設計**:
- 代幣 Logo 作為夥伴外觀
- 價值上升：綠色 HP 上升動畫 + 正向特效
- 價值下降：紅色 HP 下降動畫 + 負向特效
- 等級越高：光環越華麗
- 右下角顯示等級標籤

### 6. Frontend: 錢包連接
**檔案**: `frontend/src/wallet/`

```javascript
// 使用 @solana/wallet-adapter
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { useWallet } from '@solana/wallet-adapter-react';

// 連接後取得公鑰
const { publicKey, connected } = useWallet();
```

### 7. TRPG 代幣整合
**檔案**: `backend/services/trpgGate.js`

```javascript
// 開發階段測試代幣
const TEST_TRPG_TOKEN = '8AinLThG8AHdcqQ5FhDTR7TZgxJhucBvTTxEQT6ppump';

// 存取控制
async function checkAccess(userAddress) {
  const trpgBalance = await getTokenBalance(userAddress, TEST_TRPG_TOKEN);
  const maxPartners = Math.min(Math.floor(trpgBalance / 100), 10);
  return { canAccess: trpgBalance >= 100, maxPartners };
}
```

---

## API 端點

| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | `/api/wallet/:address` | 取得錢包概覽 |
| GET | `/api/wallet/:address/partners` | 取得前 10 大代幣夥伴 |
| GET | `/api/wallet/:address/partner/:tokenAddress` | 取得單一夥伴詳情 |
| PUT | `/api/wallet/:address/partner/:tokenAddress/designated-value` | 更新基準價值 |
| GET | `/api/wallet/:address/history` | 歷史價值記錄 |
| POST | `/api/wallet/register` | 註冊追蹤錢包 |
| GET | `/api/access/:address` | 檢查 TRPG 持有量 |
| POST | `/api/wallet/:address/refresh` | 手動觸發更新 |
| GET | `/api/explore/:address` | 取得快取的錢包資料（探索模式，24hr快取） |

---

## 資料模型

### Wallet
```typescript
interface Wallet {
  address: string          // Solana 公鑰
  totalValue: number       // USD 總價值
  lastUpdated: Date
  previousValue: number    // 前次記錄值
}
```

### TokenPartner
```typescript
interface TokenPartner {
  walletAddress: string
  tokenAddress: string     // Solana mint address
  tokenSymbol: string
  logoUrl: string | null   // DexScreener 取得
  amount: number
  currentValue: number
  previousValue: number
  valueChangePercent: number
  exp: number              // 經驗值（持有天數）
  level: number            // 等級 (1-60)
  rank: number             // 排名 (1-10)
  firstSeenDate: Date      // 首次進入前 10 的日期
}
```

### DailySnapshot
```typescript
interface DailySnapshot {
  walletAddress: string
  date: Date
  totalValue: number
  topTokens: {
    tokenAddress: string
    value: number
    exp: number
    level: number
  }[]
}
```

---

## 技術棧

- **Backend**: Node.js + Express
- **Frontend**: Three.js + Vite + React
- **Blockchain**: Solana (@solana/web3.js)
- **錢包連接**: @solana/wallet-adapter
- **資料儲存**: SQLite (開發) / PostgreSQL (生產)
- **API**: DexScreener, Solscan, Helius

---

## 開發階段

### Phase 1: 夥伴隊伍系統 (當前)

#### Phase 1-A: 本地開發 (Development) ← 當前進度

**環境設定**
- [ ] 本地開發環境建置 (Node.js, npm)
- [ ] Backend 專案初始化 (Express)
- [ ] Frontend 專案初始化 (Vite + React + Three.js)
- [ ] SQLite 本地資料庫設定
- [ ] 環境變數設定 (.env.development)

**Backend 開發**
- [ ] DexScreener API 整合（代幣價格/Logo）
- [ ] Helius/Solscan API 整合（錢包資產查詢）
- [ ] 經驗值/等級計算邏輯
- [ ] 夥伴狀態管理 API
- [ ] 測試用假資料 (mock data) 準備

**Frontend 開發**
- [ ] Three.js 基礎場景設定
- [ ] 夥伴模型渲染（代幣 Logo 作為外觀）
- [ ] HP 動畫系統（綠色上升/紅色下降）
- [ ] 等級標籤 UI (Lv1-60)
- [ ] Solana 錢包連接 (Phantom) - 本地測試
- [ ] API 串接與狀態管理

**本地測試**
- [ ] 使用測試錢包驗證資料流
- [ ] HP 動畫視覺效果調整
- [ ] 等級顯示正確性驗證
- [ ] 前後端整合測試
- [ ] 效能優化（輪詢間隔調整）

#### Phase 1-B: 上線部署 (Production)

**部署準備**
- [ ] 環境變數設定 (.env.production)
- [ ] PostgreSQL 資料庫設定
- [ ] API Rate Limiting 設定
- [ ] 錯誤監控設定 (Sentry 或類似服務)

**Backend 部署**
- [ ] GCP Cloud Run 或 Railway 部署
- [ ] 資料庫遷移腳本
- [ ] 健康檢查端點

**Frontend 部署**
- [ ] Vercel 或 Cloudflare Pages 部署
- [ ] CDN 設定
- [ ] 域名設定

**上線驗證**
- [ ] 真實錢包連接測試
- [ ] $idle 代幣門檻驗證
- [ ] 效能監控確認
- [ ] 使用者回饋收集機制

---

### Phase 2: 對戰系統 (未來)
- [ ] 對戰匹配系統
- [ ] 三戰兩勝判定邏輯
- [ ] 回合計時器
- [ ] 對戰結果記錄
- [ ] 排行榜

---

## 備註

1. **開發優先順序**：先完成 Phase 1-A 本地開發，確認功能正常後再進行 Phase 1-B 上線部署
2. **即時更新**：因免費 API 限制，優先實作輪詢/手動更新，即時推送為後續優化項目
3. **$IDLE 代幣**：正式 CA `9jwHJHSD7geYvTy6WUtoDVuuvuoJiWH2XHWMggPUpump`（2026/1/30 上線）
4. **代幣替換**：被擠出前 10 名的代幣經驗值歸 0，鼓勵維持高價值持倉
5. **本地測試錢包**：`52VCnQPmGCYudemRr9m7geyuKd1pRjcAhpVUkhpPwz5G`

---

## 未來架構遷移計劃

### GCP Cloud Storage 資料持久化

**背景**：目前代幣資料與計算結果依賴 browser localStorage，瀏覽器快取清除後資料會重置。為了支援多使用者使用，需要將狀態儲存在雲端。

**遷移方案**：部署至 GCP 時，使用 Cloud Storage 儲存各錢包地址的狀態資料。

**儲存結構**：
```
gs://idletrencher-data/
├── wallets/
│   ├── {wallet_address_1}/
│   │   ├── state.json          # 錢包整體狀態
│   │   ├── partners.json       # 夥伴列表與經驗值
│   │   └── history/            # 歷史快照
│   │       ├── 2026-01-23.json
│   │       └── ...
│   └── {wallet_address_2}/
│       └── ...
└── metadata/
    └── token_logos.json        # 代幣 Logo 快取
```

**state.json 結構**：
```json
{
  "walletAddress": "52VCnQ...",
  "lastRefreshTime": 1737612345678,
  "totalValue": 12345.67,
  "partners": [
    {
      "tokenAddress": "8AinLTh...",
      "tokenSymbol": "TOKEN",
      "designatedValue": 1000,
      "currentValue": 1200,
      "exp": 45,
      "rank": 1,
      "firstSeenDate": "2026-01-01"
    }
  ]
}
```

**注意事項**：
- 遷移時需處理 localStorage → Cloud Storage 的資料轉換
- 考慮使用 Cloud Functions 做定時快照
- API 需加入認證機制防止未授權存取
