# TrencherRPG 專案規格書

## 概念

TrencherRPG 是一個將加密貨幣錢包追蹤遊戲化的系統，把投資績效轉化為 RPG 戰鬥體驗。

## 核心機制

### EXP 系統
- **每日錢包價值變動%** = EXP 累積
- 賺錢 = EXP++
- 虧損 = 不扣 EXP（但不增加）

### 戰鬥系統
- **每個持有的代幣**（超過門檻金額）= 一個正在對戰的敵人
- **目前盈虧狀態** = 戰鬥勝負狀態
  - 盈利 → 角色佔上風
  - 虧損 → 敵人佔上風

### 代幣經濟 ($TRPG)
- 持有 100 $TRPG = 顯示 1 個代幣戰鬥
- 持有 1000 $TRPG = 顯示 10 個戰鬥（目前上限）
- 代幣門檻決定可視化層級

---

## 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Three.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  3D Scene   │  │  Battle UI  │  │  Character/Enemy    │  │
│  │  Renderer   │  │  HUD        │  │  Animation System   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ REST API / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Node.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Wallet     │  │  EXP        │  │  Battle State       │  │
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
│  │  BSC RPC    │  │  DexScreener│  │  Moralis/MegaNode   │  │
│  │  (Balance)  │  │  (Prices)   │  │  (Token Data)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 功能模組

### 1. Backend: 錢包追蹤核心
**檔案**: `backend/services/walletTracker.js`

```javascript
// 功能
- getWalletBalance(address)      // 取得錢包餘額
- getTokenHoldings(address)      // 取得持有代幣列表
- calculateTotalValue(holdings)  // 計算總價值
- getHistoricalValue(address, date) // 歷史價值查詢
```

**排程**: 每日自動執行一次（可設定時間）

### 2. Backend: EXP 系統
**檔案**: `backend/services/expCalculator.js`

```javascript
// 公式
dailyChange = (todayValue - yesterdayValue) / yesterdayValue * 100
if (dailyChange > 0) {
  exp += Math.floor(dailyChange * 10)  // 1% = 10 EXP
}

// 等級計算
level = Math.floor(Math.sqrt(totalExp / 100))
```

### 3. Backend: 戰鬥狀態管理
**檔案**: `backend/services/battleManager.js`

```javascript
// 每個代幣的戰鬥狀態
{
  tokenAddress: "0x...",
  tokenSymbol: "TOKEN",
  entryPrice: 0.001,        // 買入價
  currentPrice: 0.0012,     // 現價
  profitPercent: 20,        // 盈虧%
  battleState: "winning",   // winning | losing | neutral
  intensity: 0.8            // 戰鬥激烈程度 (0-1)
}
```

### 4. Frontend: Three.js 場景
**檔案**: `frontend/src/scene/`

```
scene/
├── BattleArena.js      # 戰鬥場地
├── PlayerCharacter.js  # 玩家角色
├── EnemyToken.js       # 敵人（代幣）
├── Effects.js          # 特效（攻擊、防禦）
└── Camera.js           # 攝影機控制
```

**視覺呈現**:
- 盈利時：角色發動攻擊，敵人後退
- 虧損時：敵人攻擊，角色防禦姿態
- 持平：對峙狀態

### 5. TRPG 代幣整合
**檔案**: `backend/services/trpgGate.js`

```javascript
// 存取控制
async function checkAccess(userAddress) {
  const trpgBalance = await getTRPGBalance(userAddress)
  const maxBattles = Math.min(Math.floor(trpgBalance / 100), 10)
  return { canAccess: trpgBalance >= 100, maxBattles }
}
```

---

## API 端點

| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | `/api/wallet/:address` | 取得錢包概覽 |
| GET | `/api/wallet/:address/battles` | 取得戰鬥列表 |
| GET | `/api/wallet/:address/exp` | 取得 EXP 和等級 |
| GET | `/api/wallet/:address/history` | 歷史價值記錄 |
| POST | `/api/wallet/register` | 註冊追蹤錢包 |
| GET | `/api/access/:address` | 檢查 TRPG 持有量 |

---

## 資料模型

### Wallet
```typescript
interface Wallet {
  address: string
  totalValue: number
  lastUpdated: Date
  exp: number
  level: number
}
```

### TokenHolding
```typescript
interface TokenHolding {
  walletAddress: string
  tokenAddress: string
  tokenSymbol: string
  amount: number
  currentValue: number
  entryValue: number
  profitPercent: number
}
```

### DailySnapshot
```typescript
interface DailySnapshot {
  walletAddress: string
  date: Date
  totalValue: number
  expGained: number
}
```

---

## 技術棧

- **Backend**: Node.js + Express
- **Frontend**: Three.js + Vite
- **Blockchain**: ethers.js (BSC)
- **資料儲存**: SQLite / PostgreSQL
- **API**: DexScreener, Moralis

---

## 開發階段

### Phase 1: 核心後端
- [ ] 錢包追蹤模組
- [ ] 代幣價格查詢
- [ ] EXP 計算邏輯

### Phase 2: 前端基礎
- [ ] Three.js 場景設定
- [ ] 角色/敵人基本模型
- [ ] 勝負狀態動畫

### Phase 3: 整合
- [ ] API 連接
- [ ] 即時更新
- [ ] TRPG 代幣門檻

### Phase 4: 部署
- [ ] Cloud Run 部署
- [ ] 定時排程
- [ ] 監控設定
