import React from 'react';
import { LibraryIcon } from './icons/LibraryIcon';
import { PartitionIcon } from './icons/PartitionIcon';
import { LearnIcon } from './icons/LearnIcon';
import { LivePlayIcon } from './icons/LivePlayIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import styles from './BottomTabBar.module.css';

const TABS = [
  { id: 'library', label: 'Biblio', Icon: LibraryIcon },
  { id: 'sheet', label: 'Partition', Icon: PartitionIcon },
  { id: 'learn', label: 'Coach', Icon: LearnIcon },
  { id: 'liveplay', label: 'Live', Icon: LivePlayIcon },
  { id: 'settings', label: 'Réglages', Icon: SettingsIcon },
];

export function BottomTabBar({ activeMode, onChangeMode, visible = true, onOpenSettings, showSettings = false }) {
  if (!visible) return null;

  return (
    <nav className={styles.tabBar} aria-label="Navigation principale">
      {TABS.map((tab) => {
        const { id, label, Icon } = tab;
        const isActive = id === 'settings'
          ? showSettings
          : !showSettings && activeMode === id;

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
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={styles.tabIcon}>
              <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
            </span>
            <span className={styles.tabLabel}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
