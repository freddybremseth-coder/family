
import React from 'react';

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
}

export const CyberButton: React.FC<Props> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '',
  disabled = false
}) => {
  const variants = {
    primary: 'border-[#00f3ff] text-[#00f3ff] hover:bg-[#00f3ff] hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.4)]',
    secondary: 'border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff] hover:text-black shadow-[0_0_15px_rgba(255,0,255,0.4)]',
    danger: 'border-[#ff0033] text-[#ff0033] hover:bg-[#ff0033] hover:text-white',
    ghost: 'border-transparent text-slate-400 hover:text-white hover:bg-white/10'
  };

  return (
    <button 
      disabled={disabled}
      onClick={onClick}
      className={`px-6 py-2 border uppercase tracking-widest font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      style={{ fontFamily: 'Space Mono' }}
    >
      {children}
    </button>
  );
};
