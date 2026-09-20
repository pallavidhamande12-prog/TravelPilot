import React from 'react';

export interface CardProps {
  id?: string;
  className?: string;
  children: React.ReactNode;
  variant?: 'surface' | 'subtle' | 'highlight';
}

export const Card: React.FC<CardProps> = ({
  id,
  className = '',
  children,
  variant = 'surface',
}) => {
  const variantStyles = {
    surface: 'bg-[#FFFFFF] border-[#E8E2D9]',
    subtle: 'bg-[#FAF7F2] border-[#E5DFD5]',
    highlight: 'bg-[#F4F8F7] border-[#D3E2E0]',
  };

  return (
    <div
      id={id}
      className={`rounded-2xl border p-6 sm:p-7 shadow-xs transition-all ${variantStyles[variant]} ${className}`}
    >
      {children}
    </div>
  );
};
