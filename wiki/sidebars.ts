import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  wikiSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: '🎮 Gameplay',
      items: [
        'gameplay/partners',
        'gameplay/leveling',
        'gameplay/skins',
        'gameplay/leaderboard',
        'gameplay/explore',
      ],
    },
    {
      type: 'category',
      label: '🌐 Social',
      items: [
        'social/og-card',
        'social/trenchbot',
      ],
    },
    'tokenomics',
    'roadmap',
  ],
};

export default sidebars;
