'use client';

import { logout } from '@/lib/logout';

export function LogoutButton({ className, label = 'Sair' }: { className?: string; label?: string }) {
  return (
    <button onClick={() => logout()} className={className}>
      {label}
    </button>
  );
}
