import React from 'react';
import { LibraryIcon } from './icons/LibraryIcon';
import { LearnIcon } from './icons/LearnIcon';
import { SynthesiaIcon } from './icons/SynthesiaIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import styles from './BottomTabBar.module.css';

const TABS = [
  { id: 'library', label: 'Bibliothèque', Icon: LibraryIcon },
  { id: 'learn', label: 'Apprentissage', Icon: LearnIcon },
  { id: 'synthesia', label: 'Synthesia', Icon: SynthesiaIcon },
  { id: 'settings', label: 'Réglages', Icon: SettingsIcon },
];

export function BottomTabBar({ activeMode, onChangeMode, visible = true, onOpenSettings }) {
  if (!visible) return null;

  return (
    <nav className={styles.tabBar}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === 'settings'
          ? false // Settings is never "active" as a mode
          : activeMode === id;

        const handleClick = () => {
          if (id === 'settings') {
            onOpenSettings?.();
          } else {
            onChangeMode(id);
          }
        };

        return (
          <button
            key={id}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={handleClick}
            aria-label={label}
          >
            <span className={styles.tabIcon}>
              <Icon size={22} />
            </span>
            <span className={styles.tabLabel}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
