import React from 'react';

export const OrangeLogo: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="orangeOuter" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFB547" />
        <stop offset="1" stopColor="#EA580C" />
      </linearGradient>
      <linearGradient id="orangeInner" x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFBC58" />
        <stop offset="1" stopColor="#F97316" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="29" fill="url(#orangeOuter)" />
    <circle cx="32" cy="32" r="24" fill="#FFF7ED" fillOpacity="0.95" />
    <circle cx="32" cy="32" r="20.5" fill="url(#orangeInner)" />
    <g stroke="#FFF7ED" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.92">
      <line x1="32" y1="11.5" x2="32" y2="52.5" />
      <line x1="11.5" y1="32" x2="52.5" y2="32" />
      <line x1="17.5" y1="17.5" x2="46.5" y2="46.5" />
      <line x1="46.5" y1="17.5" x2="17.5" y2="46.5" />
    </g>
    <circle cx="32" cy="32" r="4.2" fill="#FFF7ED" />
    <ellipse cx="23" cy="19" rx="5" ry="2.6" transform="rotate(-32 23 19)" fill="white" fillOpacity="0.35" />
  </svg>
);
