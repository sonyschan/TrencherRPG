import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'IdleTrencher',
  tagline: 'Watch your crypto come to life ✨',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://idletrencher.xyz',
  baseUrl: '/wiki/',  // Served under /wiki/ path on main domain

  organizationName: 'h2crypto',
  projectName: 'idletrencher',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hant', 'zh-Hans', 'ja', 'ko'],
    localeConfigs: {
      en: { label: 'English', htmlLang: 'en-US' },
      'zh-Hant': { label: '繁體中文', htmlLang: 'zh-TW' },
      'zh-Hans': { label: '简体中文', htmlLang: 'zh-CN' },
      ja: { label: '日本語', htmlLang: 'ja-JP' },
      ko: { label: '한국어', htmlLang: 'ko-KR' },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/', // Docs at root of wiki
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'IdleTrencher',
      logo: {
        alt: 'IdleTrencher Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'wikiSidebar',
          position: 'left',
          label: '📖 Wiki',
        },
        {
          href: 'https://idletrencher.xyz',
          label: '🎮 Play',
          position: 'left',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://x.com/idleTrencher',
          label: '𝕏',
          position: 'right',
        },
        {
          href: 'https://github.com/sonyschan/TrencherRPG',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {
              label: 'Introduction',
              to: '/',
            },
            {
              label: 'Gameplay',
              to: '/gameplay/partners',
            },
            {
              label: 'Tokenomics',
              to: '/tokenomics',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Creator: H2Crypto',
              href: 'https://x.com/idleTrencher',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/sonyschan/TrencherRPG',
            },
          ],
        },
        {
          title: 'Contribute',
          items: [
            {
              label: '3D Character Artists',
              to: '/gameplay/skins#for-artists-create-your-own-skin',
            },
            {
              label: 'Report Issues',
              href: 'https://github.com/sonyschan/TrencherRPG/issues',
            },
          ],
        },
      ],
      copyright: `Made with 💜 by H2Crypto · ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
