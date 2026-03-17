import React from 'react';
import styles from './TopNavBar.module.css';

const NAV_ITEMS = [
  { id: 'library', label: 'Bibliothèque' },
  { id: 'edit', label: 'Éditeur' },
  { id: 'learn', label: 'Apprentissage' },
  { id: 'synthesia', label: 'Synthesia' },
  { id: 'settings', label: 'Réglages' },
];

export function TopNavBar({ activeMode, onChangeMode, showSettings, onOpenSettings }) {
  return (
    <nav className={styles.navBar}>
      <div className={styles.navBarInner}>
        {NAV_ITEMS.map(({ id, label }) => {
          const isActive = id === 'settings' ? showSettings : activeMode === id;

          const handleClick = () => {
            if (id === 'settings') {
              onOpenSettings();
            } else {
              onChangeMode(id);
            }
          };

          return (
            <button
              key={id}
              className={`${styles.navButton} ${isActive ? styles.navButtonActive : ''}`}
              onClick={handleClick}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
