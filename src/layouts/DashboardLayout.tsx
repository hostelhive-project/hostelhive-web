import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BedDouble, Bell, Building2, CalendarCheck, ChevronLeft, ChevronRight,
  CreditCard, LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal, Search,
  Settings2, ShieldAlert, Users, X,
} from 'lucide-react';
import logoImg from '../assets/hostelhive-logo-ui.png';
import { AdminNotificationInbox } from '../components/AdminNotificationInbox';
import { ActionMenu } from '../components/ActionMenu';
import Modal from '../components/Modal';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logOut } from '../features/auth/authSlice';
import { useLogoutMutation } from '../features/api/authApi';
import { baseApi } from '../features/api/baseApi';

const groups = [
  { label: 'Overview', links: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }] },
  { label: 'Property', links: [{ name: 'Hostel Configuration', href: '/hostel-reg', icon: Building2 }] },
  { label: 'Operations', links: [
    { name: 'Rooms', href: '/rooms', icon: BedDouble },
    { name: 'Residents', href: '/residents', icon: Users },
    { name: 'Complaints', href: '/complaints', icon: AlertTriangle },
    { name: 'Staff', href: '/staff', icon: Users },
    { name: 'Cleaning Schedule', href: '/cleaning', icon: CalendarCheck },
  ] },
  { label: 'Finance', links: [{ name: 'Rent Ledger', href: '/payments', icon: CreditCard }] },
  { label: 'Account', links: [{ name: 'Profile Settings', href: '/profile', icon: Settings2 }] },
];

const routeNames: Record<string, string> = {
  '/dashboard': 'Dashboard', '/hostel-reg': 'Hostel Configuration', '/rooms': 'Rooms',
  '/residents': 'Residents', '/complaints': 'Complaints', '/payments': 'Rent Ledger',
  '/staff': 'Staff', '/cleaning': 'Cleaning Schedule', '/profile': 'Profile Settings',
};

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [navIsScrolling, setNavIsScrolling] = useState(false);
  const [navHasScrolled, setNavHasScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const navScrollTimeoutRef = useRef<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [setupNoticeVisible, setSetupNoticeVisible] = useState(() => localStorage.getItem('hh-setup-notice-dismissed') !== 'true');
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const hasHostel = Boolean(user?.hostelId);
  const [logoutMutation, { isLoading: isLoggingOut }] = useLogoutMutation();
  const currentName = routeNames[location.pathname] || 'Workspace';

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  useEffect(() => () => {
    if (navScrollTimeoutRef.current !== null) window.clearTimeout(navScrollTimeoutRef.current);
  }, []);

  const handleNavScroll = (nav: HTMLElement) => {
    setNavHasScrolled(nav.scrollTop > 0);
    setNavIsScrolling(true);
    if (navScrollTimeoutRef.current !== null) window.clearTimeout(navScrollTimeoutRef.current);
    navScrollTimeoutRef.current = window.setTimeout(() => {
      setNavIsScrolling(false);
      navScrollTimeoutRef.current = null;
    }, 700);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const aside = document.querySelector<HTMLElement>('.workspace-sidebar');
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(aside?.querySelectorAll<HTMLElement>(focusableSelector) || []).filter((element) => element.getClientRects().length > 0);
    window.requestAnimationFrame(() => focusables()[0]?.focus());
    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        mobileMenuTriggerRef.current?.focus();
      } else if (event.key === 'Tab') {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleDrawerKeyDown);
    return () => {
      window.removeEventListener('keydown', handleDrawerKeyDown);
      if (previouslyFocused?.isConnected) window.requestAnimationFrame(() => previouslyFocused.focus());
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileMenuOpen]);

  const filteredGroups = useMemo(() => groups.map((group) => ({
    ...group,
    links: group.links.filter((link) => link.name.toLowerCase().includes(searchText.trim().toLowerCase())),
  })).filter((group) => group.links.length > 0), [searchText]);

  const handleLogout = async () => {
    try { await logoutMutation().unwrap(); } catch { /* Continue local logout if the network is unavailable. */ }
    finally {
      dispatch(logOut());
      dispatch(baseApi.util.resetApiState());
      setShowLogoutModal(false);
      navigate('/login');
    }
  };

  const dismissSetupNotice = () => {
    localStorage.setItem('hh-setup-notice-dismissed', 'true');
    setSetupNoticeVisible(false);
  };

  const openNotifications = () => setNotificationsOpen(true);

  return (
    <div className={`workspace-shell min-h-screen flex ${isCollapsed ? 'is-collapsed' : ''}`}>
      <header className="workspace-mobile-header md:hidden">
        <button ref={mobileMenuTriggerRef} type="button" className="mobile-menu-trigger" onClick={() => { setIsCollapsed(false); setMobileMenuOpen((open) => !open); }} aria-expanded={mobileMenuOpen} aria-controls="workspace-navigation" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
        <div className="mobile-brand"><img src={logoImg} alt="" /><span className="mobile-page-title">{currentName}</span></div>
        <div className="mobile-header-actions">
          <button type="button" className="mobile-header-action" onClick={() => setSearchOpen(true)} aria-label="Search workspace pages"><Search aria-hidden="true" /></button>
          <button type="button" className="mobile-header-action" onClick={openNotifications} aria-label="Open notifications"><Bell aria-hidden="true" /></button>
          <NavLink to="/profile" className="mobile-profile-avatar" aria-label="Open profile settings">{user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : (user?.name || 'AD').slice(0, 2).toUpperCase()}</NavLink>
        </div>
        <nav className="mobile-bottom-nav" aria-label="Primary navigation">
          <NavLink to="/dashboard" end className={({ isActive }) => `mobile-bottom-tab${isActive ? ' is-active' : ''}`}><LayoutDashboard aria-hidden="true" /><span>Dashboard</span></NavLink>
          <NavLink to={hasHostel ? '/rooms' : '/hostel-reg'} aria-label={hasHostel ? 'Rooms' : 'Rooms: complete hostel setup first'} className={({ isActive }) => `mobile-bottom-tab${hasHostel && isActive ? ' is-active' : ''}`}><BedDouble aria-hidden="true" /><span>Rooms</span></NavLink>
          <NavLink to={hasHostel ? '/residents' : '/hostel-reg'} aria-label={hasHostel ? 'Residents' : 'Residents: complete hostel setup first'} className={({ isActive }) => `mobile-bottom-tab${hasHostel && isActive ? ' is-active' : ''}`}><Users aria-hidden="true" /><span>Residents</span></NavLink>
          <NavLink to={hasHostel ? '/complaints' : '/hostel-reg'} aria-label={hasHostel ? 'Complaints' : 'Complaints: complete hostel setup first'} className={({ isActive }) => `mobile-bottom-tab${hasHostel && isActive ? ' is-active' : ''}`}><AlertTriangle aria-hidden="true" /><span>Complaints</span></NavLink>
          <button type="button" className={`mobile-bottom-tab${mobileMenuOpen ? ' is-active' : ''}`} onClick={() => { setIsCollapsed(false); setMobileMenuOpen(true); }} aria-expanded={mobileMenuOpen} aria-controls="workspace-navigation"><MoreHorizontal aria-hidden="true" /><span>More</span></button>
        </nav>
      </header>

      {mobileMenuOpen && <button type="button" aria-label="Close navigation" className="workspace-backdrop md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <aside id="workspace-navigation" role={mobileMenuOpen ? 'dialog' : undefined} aria-modal={mobileMenuOpen ? true : undefined} aria-label="Admin navigation" className={`workspace-sidebar fixed inset-y-0 left-0 z-50 flex flex-col ${isCollapsed ? 'is-collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <button type="button" className="sidebar-collapse hidden md:grid" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!isCollapsed} title={isCollapsed ? 'Expand' : 'Collapse'}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="sidebar-inner">
          <div className="sidebar-brand flex items-center">
            <div className="flex min-w-0 items-center gap-3">
              <img src={logoImg} alt="" width={38} height={38} className="h-[38px] w-[38px] shrink-0 object-contain" />
              {!isCollapsed && <div className="min-w-0"><h1 className="m-0 text-[16px] font-bold tracking-tight text-[#0b1220]">HostelHive</h1><p className="m-0 mt-0.5 text-[11px] text-slate-500">Admin workspace</p></div>}
            </div>
            <button type="button" className="sidebar-mobile-close md:hidden" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"><X /></button>
          </div>

          <nav aria-label="Main navigation" onScroll={(event) => handleNavScroll(event.currentTarget)} className={`sidebar-navigation scroll-thin${navIsScrolling ? ' is-scrolling' : ''}${navHasScrolled ? ' has-scrolled' : ''}`}>
            {groups.map((group) => (
              <section key={group.label} className="sidebar-group" aria-label={group.label}>
                {!isCollapsed && <p className="sidebar-section-label">{group.label}</p>}
                {group.links.map((item) => {
                  const Icon = item.icon;
                  const locked = !hasHostel && !['/dashboard', '/hostel-reg', '/profile'].includes(item.href);
                  if (locked) return (
                    <div key={item.href} className="locked-nav-link workspace-nav-item" title="Complete hostel setup first" aria-label={`${item.name}. Complete hostel setup first`} aria-disabled="true">
                      <Icon aria-hidden="true" /><span className="nav-item-label">{item.name}</span><LockKeyhole className="nav-lock" aria-hidden="true" />
                    </div>
                  );
                  return (
                    <NavLink key={item.href} to={item.href} title={isCollapsed ? item.name : undefined} onClick={() => setMobileMenuOpen(false)} className="workspace-nav-item">
                      <Icon aria-hidden="true" /><span className="nav-item-label">{item.name}</span>
                    </NavLink>
                  );
                })}
              </section>
            ))}
          </nav>
        <div className="sidebar-account">
          <div className="account-menu-wrap" onKeyDown={(event) => { if (event.key === 'Escape') setAccountMenuOpen(false); }}>
            <button id="account-menu-trigger" aria-controls="account-menu-items" type="button" onClick={() => setAccountMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={accountMenuOpen} title={isCollapsed ? `${user?.name || 'Administrator'} · Account menu` : undefined} className="account-profile">
              <span className="account-avatar">{user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : (user?.name || 'AD').slice(0, 2).toUpperCase()}</span>
              {!isCollapsed && <span className="account-copy"><strong>{user?.name || 'Administrator'}</strong><small>{user?.email || 'Admin account'}</small></span>}
              {!isCollapsed && <ChevronRight className="account-menu-chevron" aria-hidden="true" />}
            </button>
            {accountMenuOpen && <ActionMenu className="account-menu" id="account-menu-items" triggerId="account-menu-trigger" onClose={() => setAccountMenuOpen(false)}>
              <NavLink to="/profile" role="menuitem" onClick={() => { setMobileMenuOpen(false); setAccountMenuOpen(false); }}><Settings2 aria-hidden="true" />Profile settings</NavLink>
              <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); setShowLogoutModal(true); }}><LogOut aria-hidden="true" />Log out</button>
            </ActionMenu>}
          </div>
        </div>
        </div>
      </aside>

      <div className="workspace-main min-h-screen min-w-0 flex-1 flex flex-col">
        <div className="workspace-topbar">
          <div className="topbar-crumb"><span>Workspace</span><span aria-hidden="true" className="breadcrumb-separator">/</span><strong>{currentName}</strong></div>
          <button type="button" className="workspace-search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search workspace pages">
            <Search aria-hidden="true" width={15} height={15} /><span>Search pages and tools</span><kbd>Ctrl K</kbd>
          </button>
        </div>
        <main className="workspace-content flex-1">
          {!hasHostel && setupNoticeVisible && location.pathname !== '/hostel-reg' && (
            <div className="setup-notice" role="status">
              <span><strong>Finish setting up your hostel</strong> to unlock room, resident, complaint, cleaning, and rent tools.</span>
              <button type="button" onClick={() => navigate('/hostel-reg')} className="setup-notice-action">Continue setup</button>
              <button type="button" onClick={dismissSetupNotice} aria-label="Dismiss setup reminder" className="setup-notice-dismiss"><X aria-hidden="true" /></button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <Modal isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications" description="Updates sent to your administrator account."><AdminNotificationInbox onClose={() => setNotificationsOpen(false)} /></Modal>
      <Modal isOpen={searchOpen} onClose={() => { setSearchOpen(false); setSearchText(''); }} title="Go to a page" description="Search the workspace. Use Ctrl K to open this menu from anywhere.">
        <div className="command-search"><Search aria-hidden="true" /><input autoFocus value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search pages..." aria-label="Search pages" /></div>
        <div className="command-results scroll-thin">
          {filteredGroups.flatMap((group) => group.links.map((item) => {
            const Icon = item.icon;
            const locked = !hasHostel && !['/dashboard', '/hostel-reg', '/profile'].includes(item.href);
            return <button type="button" key={item.href} disabled={locked} onClick={() => { setSearchOpen(false); setSearchText(''); navigate(item.href); }}><Icon aria-hidden="true" /><span>{item.name}</span>{locked && <small>Setup required</small>}</button>;
          }))}
          {filteredGroups.length === 0 && <p className="command-empty">No matching pages.</p>}
        </div>
      </Modal>

      <Modal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="Log out of HostelHive?" description="You can sign back in at any time.">
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3"><ShieldAlert className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" /><p className="text-sm text-slate-600 leading-relaxed">Any unsaved changes on this page will be lost.</p></div>
          <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setShowLogoutModal(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="button" onClick={handleLogout} disabled={isLoggingOut} className="rounded-md bg-[#0b1220] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b2a40] disabled:opacity-60">{isLoggingOut ? 'Logging out…' : 'Log out'}</button></div>
        </div>
      </Modal>
    </div>
  );
}
