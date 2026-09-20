import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'terracotta' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  id,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-sm px-4.5 py-2 gap-2',
    lg: 'text-base px-6 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#2E5658] text-white hover:bg-[#234547] focus:ring-[#2E5658] shadow-xs',
    secondary:
      'bg-[#FAF7F2] text-[#1F2421] hover:bg-[#EFECE6] border border-[#E8E2D9] focus:ring-[#2E5658]',
    outline:
      'bg-transparent text-[#1F2421] hover:bg-[#FAF7F2] border border-[#E8E2D9] focus:ring-[#2E5658]',
    terracotta:
      'bg-[#CF8A70] text-white hover:bg-[#B86C52] focus:ring-[#CF8A70] shadow-xs',
    ghost:
      'bg-transparent text-[#5C6460] hover:text-[#1F2421] hover:bg-[#FAF7F2] focus:ring-[#2E5658]',
  };

  return (
    <button
      id={id}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
