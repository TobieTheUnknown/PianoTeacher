import React from 'react';
import { LibraryIcon } from './icons/LibraryIcon';
import { EditorIcon } from './icons/EditorIcon';
import { LearnIcon } from './icons/LearnIcon';
import { PartitionIcon } from './icons/PartitionIcon';
import { LivePlayIcon } from './icons/LivePlayIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import styles from './BottomTabBar.module.css';

const TABS = [
  { id: 'library', label: 'Bibliothèque', Icon: LibraryIcon },
  { id: 'editor', label: 'Éditeur', Icon: EditorIcon },
  { id: 'learn', label: 'Apprentissage', Icon: LearnIcon },
  { id: 'sheet', label: 'Partition', Icon: PartitionIcon },
  { id: 'liveplay', label: 'LivePlay', Icon: LivePlayIcon },
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
