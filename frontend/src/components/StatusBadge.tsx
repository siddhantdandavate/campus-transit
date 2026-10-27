import React from 'react';
import type { ServiceStatus } from '../types/index.ts';

interface StatusBadgeProps {
  status: ServiceStatus;
  customLabel?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, customLabel }) => {
  const normalizedClass = status.toLowerCase().replace(/\s+/g, '-');
  const displayLabel = customLabel || (status === 'Route change' ? 'Route Changed' : status);

  return (
    <span className={`status-badge ${normalizedClass}`}>
      {displayLabel}
    </span>
  );
};
