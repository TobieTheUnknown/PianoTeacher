import React from 'react';

export function PartitionIcon({ size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h18" />
      <path d="M3 10h18" />
      <path d="M3 14h18" />
      <path d="M3 18h18" />
      <ellipse cx="8" cy="16" rx="2.4" ry="1.8" transform="rotate(-18 8 16)" fill="currentColor" />
      <path d="M10.1 15v-7.5" />
      <ellipse cx="16" cy="13" rx="2.4" ry="1.8" transform="rotate(-18 16 13)" fill="currentColor" />
      <path d="M18.1 12v-7.5" />
      <path d="M10.1 7.5q3.5 0.5 8 -3" stroke="currentColor" fill="none" />
    </svg>
  );
}
