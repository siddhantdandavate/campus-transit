import React from 'react';

interface OfflineBannerProps {
  isOffline: boolean;
  onRetry?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline, onRetry }) => {
  if (!isOffline) return null;

  return (
    <div className="offline-banner" role="alert">
      <span>
        ⚠️ Connection to local server lost. Displaying cached schedule and statuses. Retrying automatically…
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          Retry now
        </button>
      )}
    </div>
  );
};
