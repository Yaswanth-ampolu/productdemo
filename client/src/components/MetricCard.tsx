import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface MetricDetail {
  label: string;
  value: number | string;
  highlight?: boolean;
}

interface MetricCardProps {
  title: string;
  primaryMetric: number | string;
  primaryLabel: string;
  details: MetricDetail[];
  link?: {
    to: string;
    label: string;
  };
  progress?: number;
  badge?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  primaryMetric,
  primaryLabel,
  details,
  link,
  progress,
  badge
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="p-6 rounded-xl backdrop-blur-sm"
      style={{
        background: 'linear-gradient(to-r, var(--color-surface), var(--color-surface-dark))',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h3>
        {badge && (
          <span className="px-2 py-1 text-xs rounded-full" style={{
            backgroundColor: 'var(--color-primary)20',
            color: 'var(--color-primary)',
          }}>
            {badge}
          </span>
        )}
      </div>

      <div className="mb-6">
        <div className="text-3xl font-bold mb-1" style={{ color: 'var(--color-primary)' }}>
          {primaryMetric}
        </div>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {primaryLabel}
        </div>
      </div>

      {progress !== undefined && (
        <div className="mb-4">
          <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-light)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(to right, var(--color-primary), var(--color-primary-dark))'
              }}
            />
          </div>
          <div className="text-xs mt-1 text-right" style={{ color: 'var(--color-text-secondary)' }}>
            {progress}% used
          </div>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {details.map((detail, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {detail.label}
            </span>
            <span
              className="font-medium"
              style={{
                color: detail.highlight ? 'var(--color-primary)' : 'var(--color-text)'
              }}
            >
              {detail.value}
            </span>
          </div>
        ))}
      </div>

      {link && (
        <Link
          to={link.to}
          className="text-sm flex items-center justify-center w-full py-2 rounded-lg transition-all hover:scale-105"
          style={{
            background: 'var(--color-surface-light)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          {link.label}
        </Link>
      )}
    </motion.div>
  );
};

export default MetricCard;