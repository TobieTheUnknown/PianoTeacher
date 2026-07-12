import React from 'react';
import styles from './Layout.module.css';

export function Layout({ children }) {
    return (
        <div className={styles.shell}>
            <div className={styles.ambientLeft} aria-hidden="true" />
            <div className={styles.ambientRight} aria-hidden="true" />
            <div className={styles.inner}>{children}</div>
        </div>
    );
}
