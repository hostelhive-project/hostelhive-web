import type { HTMLAttributes } from 'react';
import { useEffect, useRef } from 'react';

type ResponsivePrimitiveProps = HTMLAttributes<HTMLDivElement>;

export function PageHeader({ children, className = '', ...props }: ResponsivePrimitiveProps) {
  return <div {...props} className={`mobile-page-header ${className}`}>{children}</div>;
}

export function StatGrid({ children, className = '', ...props }: ResponsivePrimitiveProps) {
  return <div {...props} className={`mobile-stat-grid ${className}`}>{children}</div>;
}

export function ScrollableTabs({ children, className = '', ...props }: ResponsivePrimitiveProps) {
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 1023.98px)').matches) return undefined;
    const scroller = tabsRef.current;
    const active = scroller?.querySelector<HTMLElement>(
      '[aria-selected="true"], [aria-current="page"], [aria-current="step"], [aria-pressed="true"]'
    );
    if (!scroller || !active) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.left < scrollerRect.left) {
      scroller.scrollTo({ left: scroller.scrollLeft + activeRect.left - scrollerRect.left, behavior: 'smooth' });
    } else if (activeRect.right > scrollerRect.right) {
      scroller.scrollTo({ left: scroller.scrollLeft + activeRect.right - scrollerRect.right, behavior: 'smooth' });
    }
  }, [children]);

  return <div {...props} ref={tabsRef} className={`mobile-scroll-tabs ${className}`}>{children}</div>;
}

export function FilterBar({ children, className = '', ...props }: ResponsivePrimitiveProps) {
  return <div {...props} className={`mobile-filter-bar ${className}`}>{children}</div>;
}

export function ResponsiveTable({ children, className = '', ...props }: ResponsivePrimitiveProps) {
  return <div {...props} className={`responsive-table-wrap ${className}`}>{children}</div>;
}
