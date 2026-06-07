import * as React from 'react';
import { cn } from '../lib/cn';

function initials(name?: string | null): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '—';
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
};

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

/** Foto de perfil com fallback elegante em iniciais. */
export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted font-medium text-muted-foreground',
        sizes[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? 'Foto de perfil'} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
