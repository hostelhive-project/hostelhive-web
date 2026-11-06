import type { ReactNode } from 'react';
import { ArrowUpRight, Building2, CreditCard, Wrench } from 'lucide-react';
import heroImg from '../../assets/hostelhive-auth-hero.png';
import logoImg from '../../assets/hostelhive-logo-auth.png';

interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  panelLabel?: string;
}

const benefits = [
  { icon: Building2, text: 'Allocate rooms and track occupancy' },
  { icon: CreditCard, text: 'Manage rent in one clear ledger' },
  { icon: Wrench, text: 'Route maintenance to the right people' },
];

export default function AuthLayout({ children, footer, panelLabel = 'Admin workspace' }: AuthLayoutProps) {
  return (
    <main className="auth-layout">
      <aside className="auth-brand-panel" aria-label="HostelHive overview">
        <div className="auth-brand-top">
          <img src={logoImg} alt="" className="auth-brand-logo" />
          <span>HostelHive</span>
        </div>

        <div className="auth-brand-content">
          <p className="auth-overline">{panelLabel}</p>
          <h1>Run your hostel<br />with more clarity.</h1>
          <p className="auth-brand-copy">One workspace for the people, rooms, and day-to-day work that keep a hostel running.</p>

          <div className="auth-building-art" aria-hidden="true">
            <img src={heroImg} alt="" className="auth-hero-image" />
          </div>

          <ul className="auth-benefits">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text}><Icon aria-hidden="true" /><span>{text}</span><ArrowUpRight aria-hidden="true" className="auth-benefit-arrow" /></li>
            ))}
          </ul>
        </div>

        <p className="auth-brand-footer">A calmer way to manage student living.</p>
      </aside>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <img src={logoImg} alt="" />
          <span>HostelHive</span>
        </div>
        <div className="auth-form-wrap">{children}</div>
        {footer && <div className="auth-form-footer">{footer}</div>}
      </section>
    </main>
  );
}
