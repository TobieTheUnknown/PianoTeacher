import React from 'react';

export function EditorIcon({ size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="6" width="20" height="9" rx="1.5" />
      <path d="M2 11h20" />
      <path d="M7 6v5" />
      <path d="M11 6v5" />
      <path d="M15 6v5" />
      <path d="M19 6v5" />
      <path d="M14.5 17.5l5-5 2 2-5 5h-2v-2z" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}
