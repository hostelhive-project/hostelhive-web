import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function ActionMenu({ children, className, id, triggerId, onClose }: { children: ReactNode; className?: string; id: string; triggerId: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const element = ref.current;
    const controls = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') || []);
    controls().forEach((item) => item.setAttribute('role', 'menuitem'));
    controls()[0]?.focus();
    const outside = (event: PointerEvent) => { if (!element?.contains(event.target as Node) && !document.getElementById(triggerId)?.contains(event.target as Node)) close.current(); };
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('pointerdown', outside); document.getElementById(triggerId)?.focus(); };
  }, [triggerId]);
  return <div ref={ref} id={id} role="menu" aria-labelledby={triggerId} className={className} onKeyDown={(event) => {
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') || []);
    const current = controls.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); onClose(); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length;
      controls[next]?.focus();
    }
  }}>{children}</div>;
}
