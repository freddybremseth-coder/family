
import React from 'react';

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const CyberButton: React.FC<Props> = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  type = 'button',
}) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-2.5 font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:   'bg-indigo-600 text-white shadow-[0_2px_8px_rgba(79,70,229,0.35)] hover:bg-indigo-700 hover:shadow-[0_4px_16px_rgba(79,70,229,0.45)] active:scale-[0.98]',
    secondary: 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-[0.98]',
    danger:    'bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white active:scale-[0.98]',
    ghost:     'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98]',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
