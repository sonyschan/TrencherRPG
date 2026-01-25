# API Calls Architecture

## 外部 API 調用策略

### 設計原則
1. **批次處理優先** - 盡可能用單一 API call 取得多筆資料
2. **僅在必要時調用** - 使用快取避免重複呼叫
3. **Top 10 限制** - 只為排名前 10 的代幣取得額外資料

---

## 目前使用的外部 API

### 1. Helius DAS API
- **用途**: 取得錢包所有代幣餘額與價格
- **端點**: `https://mainnet.helius-rpc.com/?api-key={KEY}`
- **方法**: `getAssetsByOwner`
- **回傳資料**:
  - 所有 fungible tokens
  - 代幣餘額、價格、總值
  - 代幣 metadata (symbol, name, logo)
  - Native SOL 餘額
- **呼叫時機**:
  - 用戶點擊 Refresh 按鈕 (`?refresh=true`)
  - 首次載入無快取時
- **每次 Refresh**: 1 call

### 2. DexScreener API
- **用途**: 取得 24 小時價格變化
- **端點**: `https://api.dexscreener.com/tokens/v1/solana/{addresses}`
- **方法**: GET (comma-separated addresses)
- **限制**: 最多 30 個地址/次
- **回傳資料**:
  - `priceChange.h24` - 24 小時漲跌 %
  - `priceChange.h1` - 1 小時漲跌 %
  - `liquidity`, `volume`, `marketCap`
- **呼叫時機**:
  - 與 Helius 一起，在 Refresh 時呼叫
  - 僅查詢 Top 10 代幣
- **每次 Refresh**: 1 call (批次)

---

## API 呼叫流程

```
User clicks Refresh
       │
       ▼
┌──────────────────┐
│  Helius API      │ ─── 1 call: 取得所有代幣餘額與價格
│  getAssetsByOwner│
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  DexScreener API │ ─── 1 call: 取得 Top 10 代幣的 24h 漲跌
│  /tokens/v1/...  │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Save to SQLite  │ ─── 快取結果
└──────────────────┘
```

## 每次 Refresh 的 API 成本

| API | Calls | 資料 |
|-----|-------|------|
| Helius | 1 | 全部代幣餘額 + 價格 |
| DexScreener | 1 | Top 10 代幣 24h 變化 |
| **Total** | **2** | |

---

## 快取行為

### 無 Refresh 時
- 直接從 SQLite 讀取
- `priceChange24h` 為 `null` (快取中不儲存)
- `state` 根據 `hpBars.multiplier` 計算

### 有 Refresh 時
- 呼叫 Helius + DexScreener
- 更新 SQLite
- 回傳完整資料包含 `priceChange24h`

---

## 未來考量

### 如需更多 API
1. **Jupiter Price API** - 備用價格來源
2. **Birdeye API** - 更詳細的交易資料 (需 API key)

### 優化空間
1. 可在 DB 儲存 `priceChange24h` 與 timestamp
2. 設定 TTL (例如 5 分鐘內不重複呼叫 DexScreener)
3. WebSocket 訂閱即時價格 (進階功能)
