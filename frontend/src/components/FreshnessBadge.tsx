import React from 'react';
import type { FreshnessTier } from '../types/index.ts';

interface FreshnessBadgeProps {
  freshness?: FreshnessTier;
  label?: string;
  isStale?: boolean;
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  freshness = 'unknown',
  label = 'Report age unknown',
  isStale = false,
}) => {
  return (
    <span
      className={`freshness-badge ${freshness}`}
      title={isStale ? 'Report is stale (> 60m). Information may be outdated.' : 'Verified report age'}
    >
      {label}
    </span>
  );
};
