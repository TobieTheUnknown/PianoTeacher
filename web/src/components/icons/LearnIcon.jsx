import React from 'react';

export function LearnIcon({ size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="14" width="4" height="8" rx="0.5" />
      <rect x="7" y="10" width="3" height="12" rx="0.5" />
      <rect x="11" y="14" width="4" height="8" rx="0.5" />
      <rect x="16" y="10" width="3" height="12" rx="0.5" />
      <rect x="20" y="14" width="4" height="8" rx="0.5" />
      <circle cx="12" cy="5" r="2" />
      <path d="M10 5l-3 3" />
      <path d="M14 5l3 3" />
    </svg>
  );
}
