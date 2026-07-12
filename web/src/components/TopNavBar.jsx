import React from 'react';
import { LibraryIcon } from './icons/LibraryIcon';
import { LearnIcon } from './icons/LearnIcon';
import { LivePlayIcon } from './icons/LivePlayIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import styles from './TopNavBar.module.css';

const NAV_ITEMS = [
  { id: 'library', label: 'Bibliothèque', icon: LibraryIcon },
  { id: 'learn', label: 'Apprendre', icon: LearnIcon },
  { id: 'liveplay', label: 'Live', icon: LivePlayIcon },
];

export function TopNavBar({ activeMode, onChangeMode, showSettings, onOpenSettings }) {
  return (
    <nav className={styles.navBar} aria-label="Navigation principale">
      <button className={styles.brand} onClick={() => onChangeMode('library')} aria-label="Piano Teacher — Bibliothèque">
        <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /><i /></span>
        <span className={styles.brandName}><strong>Piano</strong> Teacher</span>
        <span className={styles.localBadge}>STUDIO</span>
      </button>

      <div className={styles.navBarInner}>
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const isActive = !showSettings && activeMode === id;
          const NavIcon = icon;
          return (
            <button key={id} className={`${styles.navButton} ${isActive ? styles.navButtonActive : ''}`} onClick={() => onChangeMode(id)} aria-current={isActive ? 'page' : undefined}>
              <NavIcon size={17} strokeWidth={isActive ? 2 : 1.6} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <button className={`${styles.settingsButton} ${showSettings ? styles.settingsButtonActive : ''}`} onClick={onOpenSettings} aria-label="Ouvrir les réglages" aria-pressed={showSettings}>
        <SettingsIcon size={19} strokeWidth={1.7} />
        <span>Réglages</span>
      </button>
    </nav>
  );
}
