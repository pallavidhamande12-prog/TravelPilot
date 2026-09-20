import React from 'react';

export interface BadgeProps {
  id?: string;
  variant?: 'teal' | 'terracotta' | 'neutral';
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  id,
  variant = 'teal',
  children,
  icon,
  className = '',
}) => {
  const variantStyles = {
    teal: 'bg-[#EEF4F3] text-[#2E5658] border border-[#D3E2E0]',
    terracotta: 'bg-[#FAF2EF] text-[#CF8A70] border border-[#F2DDD5]',
    neutral: 'bg-[#FAF7F2] text-[#5C6460] border border-[#E8E2D9]',
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap tracking-normal ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
