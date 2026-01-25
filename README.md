# idleTrencher

Turn your Solana token holdings into RPG partners. Each token you hold becomes a 3D character that levels up the longer you hold it.

## How It Works

- **Connect your Solana wallet** via Privy
- **Your top tokens become Partners** - 3D characters displayed in an idle scene
- **Partners gain EXP** based on days held (not profit/loss)
- **HP bars** show current value vs your designated value (cost basis)
- **Level up** by holding tokens longer (max Lv60 at 1 year)

## Partner Slots

- **Free tier**: 1 partner slot
- **Hold $idle tokens** to unlock more slots
  - 10,000 $idle = 1 additional slot
  - Maximum 10 partners (90,000 $idle for all paid slots)

## Features

- 3D idle scene with animated characters
- HP bars based on value change from your entry point
- Level system (Lv1-60) based on holding time
- Explore mode to view other wallets
- Mobile-friendly responsive design

## Tech Stack

- **Frontend**: React + Vite + Three.js
- **Auth**: Privy (embedded wallet)
- **Blockchain**: Solana
- **Hosting**: Vercel

## Development

```bash
cd frontend
npm install
npm run dev
```

## Future Work

- **Wardrobe** - Customize your partners with different skins (Knight, Mage, Adventurer...)
- **Leaderboard** - Compare partner levels and holdings with other players
- **AI Integration** - Coming soon...

## License

MIT
