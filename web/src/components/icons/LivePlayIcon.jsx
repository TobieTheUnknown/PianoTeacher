import React from 'react';

export function LivePlayIcon({ size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M8 3v12" />
      <path d="M16 3v12" />
      <rect x="2" y="15" width="20" height="6" rx="0" />
      <path d="M6 15v6" />
      <path d="M10 15v6" />
      <path d="M14 15v6" />
      <path d="M18 15v6" />
      <rect x="5" y="6" width="2" height="4" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="11" y="4" width="2" height="6" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="17" y="7" width="2" height="3" rx="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
