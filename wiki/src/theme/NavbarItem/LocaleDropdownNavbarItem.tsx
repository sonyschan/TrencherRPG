/**
 * Swizzled LocaleDropdownNavbarItem to remove trailing slashes from locale URLs
 * This fixes 404 errors when Vercel is configured with trailingSlash: false
 */

import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useAlternatePageUtils} from '@docusaurus/theme-common/internal';
import {useLocation} from '@docusaurus/router';
import DropdownNavbarItem from '@theme/NavbarItem/DropdownNavbarItem';
import type {LinkLikeNavbarItemProps} from '@theme/NavbarItem';
import type {Props} from '@theme/NavbarItem/LocaleDropdownNavbarItem';

export default function LocaleDropdownNavbarItem({
  mobile,
  dropdownItemsBefore,
  dropdownItemsAfter,
  queryString = '',
  ...props
}: Props): JSX.Element {
  const {
    i18n: {currentLocale, locales, localeConfigs},
  } = useDocusaurusContext();
  const alternatePageUtils = useAlternatePageUtils();
  const {search, hash} = useLocation();

  const localeItems = locales.map((locale): LinkLikeNavbarItemProps => {
    let to = `pathname://${alternatePageUtils.createUrl({
      locale,
      fullyQualified: false,
    })}`;

    // Remove trailing slash if present (except for root path)
    if (to.endsWith('/') && to !== 'pathname:///' && to !== 'pathname:///wiki/') {
      to = to.slice(0, -1);
    }

    return {
      label: localeConfigs[locale]!.label,
      lang: localeConfigs[locale]!.htmlLang,
      to: `${to}${search}${hash}${queryString}`,
      target: '_self',
      autoAddBaseUrl: false,
      className:
        locale === currentLocale
          ? mobile
            ? 'menu__link--active'
            : 'dropdown__link--active'
          : '',
    };
  });

  const items = [...dropdownItemsBefore, ...localeItems, ...dropdownItemsAfter];

  // Mobile: use a simple list
  if (mobile) {
    return (
      <DropdownNavbarItem
        {...props}
        mobile={mobile}
        label={localeConfigs[currentLocale]!.label}
        items={items}
      />
    );
  }

  return (
    <DropdownNavbarItem
      {...props}
      label={
        <>
          <span className="navbar__link-icon">🌐</span>
          {localeConfigs[currentLocale]!.label}
        </>
      }
      items={items}
    />
  );
}
