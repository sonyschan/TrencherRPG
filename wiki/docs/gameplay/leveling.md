---
sidebar_position: 2
title: 📊 Leveling & EXP
---

# Leveling & EXP System

Your partners gain **experience points (EXP)** just by being in your portfolio. The longer you hold, the stronger they become!

![EXP and Levels](/img/partners-exp-level.jpg)

## The Math

IdleTrencher uses a transparent, deterministic leveling formula:

### EXP Calculation

```
Effective EXP = Hours Held + Bonus Hours
```

- **Hours Held**: Time since first wallet connection (1 hour = 1 EXP)
- **Bonus Hours**: Extra EXP from price increases (rewarding active market participation)

### Level Formula

```
Level = floor(sqrt(Hours / 2.433))
```

This creates a **square-root progression** — early levels come quickly, while higher levels require exponentially more time.

### Hours Required per Level

| Level | Hours Required | Approximate Time |
|-------|----------------|------------------|
| 1 | 0 | Instant |
| 2 | 10 | ~10 hours |
| 5 | 61 | ~2.5 days |
| 10 | 243 | ~10 days |
| 20 | 973 | ~40 days |
| 30 | 2,189 | ~3 months |
| 40 | 3,893 | ~5.5 months |
| 50 | 6,083 | ~8.5 months |
| 60 | 8,759 | ~1 year (max) |

### Inverse Formula (Hours from Level)

```
Hours = Level² × 2.433
```

## Level Milestones

| Level | Time Required |
|-------|---------------|
| Lv2 | ~10 hours |
| Lv10 | ~10 days |
| Lv20 | ~40 days |
| Lv30 | ~3 months |
| Lv60 | ~1 year (max) |

## Bonus EXP System

Price increases grant **bonus hours**, rewarding holders who experience positive market movements:

- Bonus EXP accumulates when your token's price rises
- This creates a balanced strategy: steady holding for base growth, seizing price pumps for accelerated progress

:::warning EXP Reset
If a partner drops out of your top holdings, their EXP resets. This design encourages maintaining a balanced portfolio and consistent holding strategy.
:::

## Why This Design?

The square-root formula ensures:

1. **New players feel progress** — Lv2 in just 10 hours
2. **Long-term holders are rewarded** — Higher levels show true commitment
3. **Max level is achievable** — Lv60 in ~1 year is realistic
4. **Transparent & verifiable** — Anyone can calculate expected levels

> The journey of a thousand miles begins with a single hour of holding. 🧘
