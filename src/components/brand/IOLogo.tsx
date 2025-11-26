import React from 'react';

type Props = {
  className?: string;
  wordmark?: boolean;
};

const IoLogo: React.FC<Props> = ({ className, wordmark = true }) => (
  <div className={`flex items-center gap-2 ${className ?? ''}`}>
    {/* Mark: stylized IO in warm ring */}
    <svg width="32" height="32" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="ioWarm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--io-primary))"/>
          <stop offset="100%" stopColor="hsl(var(--io-accent))"/>
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="none" stroke="url(#ioWarm)" strokeWidth="4"/>
      <circle cx="18" cy="24" r="5" fill="url(#ioWarm)"/>
      <circle cx="32" cy="24" r="3" fill="hsl(var(--io-highlight))"/>
    </svg>
    {wordmark && (
      <span className="text-xl font-semibold tracking-wide" style={{ color: 'hsl(var(--io-text))' }}>
        IO <span className="text-io-highlight">Education</span>
      </span>
    )}
  </div>
);

export default IoLogo;
