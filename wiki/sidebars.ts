import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  wikiSidebar: [
    'intro',
    {
      type: 'category',
      label: '🎮 Gameplay',
      items: [
        'gameplay/home',
        'gameplay/explore',
        'gameplay/skins',
        'gameplay/leaderboard',
      ],
    },
    'tokenomics',
    'community',
  ],
};

export default sidebars;
