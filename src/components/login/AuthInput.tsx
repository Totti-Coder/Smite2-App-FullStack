'use client';

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { EyeIcon, EyeOffIcon } from '@/components/icons';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  icon: ReactNode;
  /** Adds the show/hide toggle and starts masked. */
  revealable?: boolean;
};

/**
 * Auth field with the reference design's interaction model - leading icon
 * that lights up on focus, a subtle lift on hover, and (for passwords) a
 * reveal toggle - on this app's existing input chrome (.neu-inset, ss-line
 * border, ss-cyan focus). Colours and shape are unchanged; only the
 * behaviour is new.
 */
export function AuthInput({ icon, revealable = false, className, type, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const resolvedType = revealable ? (revealed ? 'text' : 'password') : type;

  return (
    <motion.div
      className="relative"
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <span
        className={`pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 transition-colors duration-300 ${
          focused ? 'text-ss-cyan' : 'text-ss-text-muted'
        }`}
      >
        {icon}
      </span>

      <input
        {...props}
        type={resolvedType}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        className={`neu-inset w-full rounded-md border bg-ss-bg-raised py-2.5 pl-10 text-sm text-ss-text outline-none transition-colors duration-300 ${
          revealable ? 'pr-10' : 'pr-3'
        } ${focused ? 'border-ss-cyan' : 'border-ss-line'} ${className ?? ''}`}
      />

      {revealable && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-ss-text-muted transition-colors duration-300 hover:text-ss-text"
        >
          {revealed ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
        </button>
      )}
    </motion.div>
  );
}
