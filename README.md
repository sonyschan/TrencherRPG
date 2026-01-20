# TrencherRPG

A gamified cryptocurrency wallet tracking system that transforms portfolio performance into an RPG battle experience.

## Concept

TrencherRPG tracks cryptocurrency wallet addresses and visualizes trading results as RPG combat:

- **Daily wallet value change %** = EXP accumulation (profit = EXP++)
- **Each held token** (above threshold) = an enemy in battle
- **Current P&L status** = win/lose state in combat

## Features

### Backend
- Automated periodic tracking of wallet total value
- Daily value change calculation
- EXP system based on profit/loss
- Multi-wallet support

### Frontend (Three.js)
- 3D battle scene visualization
- Real-time combat status based on token P&L
- Visual win/lose indicators per token position

### Tokenomics ($TRPG)
- Hold 100 $TRPG = display 1 token battle
- Hold 1000 $TRPG = display 10 battles (current max)
- Token gates access to battle visualization tiers

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Three.js for 3D rendering
- **Blockchain**: BSC (Binance Smart Chain)
- **Data**: DexScreener API, Moralis/MegaNode

## Project Structure

```
trencherrpg/
├── mayor/rig/          # Main application
│   ├── backend/        # API server
│   ├── frontend/       # Three.js client
│   └── shared/         # Shared types/utils
└── .beads/             # Issue tracking
```

## License

MIT
