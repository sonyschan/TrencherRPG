---
sidebar_position: 1
title: 🖼️ 可分享 OG 卡片
---

# 可分享 OG 卡片

用精美的方式分享你的 IdleTrencher 投资组合！当你在社交媒体上分享钱包链接时，会自动生成漂亮的预览卡片。

## 什么是 OG 卡片？

OG（Open Graph）卡片是当你在 Twitter/X、Discord、Telegram 等社交媒体平台分享链接时出现的预览图片。IdleTrencher 会为你的钱包生成独特且吸睛的卡片。

## 如何使用

1. **获取你的分享链接** - 使用你的钱包地址
2. **分享到任何地方** - Twitter、Discord、Telegram 等
3. **见证魔法** - 漂亮的预览卡片会自动出现

### 分享链接（用于社交媒体）

在 Twitter/X、Discord、Telegram 上分享时使用此链接：
```
https://idletrencher.xyz/api/share/你的钱包地址
```

例如：
```
https://idletrencher.xyz/api/share/9jwHJHSD7geYvTy6WUtoDVuuvuoJiWH2XHWMggPUpump
```

:::info 为什么使用 /api/share/？
Twitter 等社交平台需要带有特殊 meta 标签的网页才能显示预览卡片。分享链接提供这些标签，然后将访问者重定向到你的投资组合页面。
:::

### 直接图片链接

如果你需要原始图片（用于嵌入网站或 markdown）：
```
https://idletrencher.xyz/api/og/你的钱包地址
```

## 卡片特色

OG 卡片包含：

- **IdleTrencher 品牌设计** - 带有 GM/GN 主题的艺术风格
- **动态钱包预览** - 一目了然地展示你的投资组合
- **优化尺寸** - 适配所有主流平台（1200x630）
- **自动生成** - 无需手动截图

## 主题

| 主题 | 说明 |
|------|------|
| **GM（早安）** | 明亮、活力的设计，适合白天分享 |
| **GN（晚安）** | 平静、放松的设计，适合夜晚氛围 |

## 社交平台兼容性

| 平台 | 支持 |
|------|------|
| Twitter/X | ✅ 完整支持 |
| Discord | ✅ 完整支持 |
| Telegram | ✅ 完整支持 |
| Facebook | ✅ 完整支持 |
| LINE | ✅ 完整支持 |

## 分享技巧

1. **添加说明** - 告诉大家你在分享什么："来看看我的 IdleTrencher 伙伴们！"
2. **标记我们** - 提及 [@idleTrencher](https://x.com/idleTrencher) 有机会被精选展示
3. **使用标签** - #IdleTrencher #Solana #CryptoGaming

## 示例

当你在 Twitter 分享链接时，效果如下：

> "我的伙伴们正在升级！来参观我的村庄吧 🏘️
> https://idletrencher.xyz/api/share/你的钱包..."
>
> *[漂亮的 OG 卡片预览会在这里显示]*

---

:::tip 小技巧
OG 卡片会缓存 1 小时以确保快速加载。投资组合发生重大变化后，卡片会在下次缓存刷新时自动更新。
:::
