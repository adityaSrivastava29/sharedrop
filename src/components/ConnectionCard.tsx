import React from 'react';
import { ChevronRight } from 'lucide-react';

interface ConnectionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'send' | 'receive';
}

export function ConnectionCard({
  title,
  description,
  icon,
  onClick,
  variant = 'send',
}: ConnectionCardProps) {
  const gradients = {
    send: 'from-primary-500/20 to-secondary-500/20',
    receive: 'from-success-500/20 to-primary-500/20',
  };
  
  const iconBg = {
    send: 'from-primary-500 to-secondary-500',
    receive: 'from-success-500 to-primary-500',
  };
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-6 rounded-2xl
        glass card-hover
        bg-gradient-to-br ${gradients[variant]}
        text-left
        group
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-900
      `}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`
            w-14 h-14 rounded-xl
            bg-gradient-to-br ${iconBg[variant]}
            flex items-center justify-center
            shadow-lg
            group-hover:scale-110 transition-transform duration-300
          `}
        >
          {icon}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-surface-50 mb-1 flex items-center gap-2">
            {title}
            <ChevronRight className="w-5 h-5 text-surface-400 group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-surface-400">{description}</p>
        </div>
      </div>
    </button>
  );
}
