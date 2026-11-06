import type { ReactNode } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

interface RequireAuthProps {
  children?: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const user = useAppSelector((state) => state.auth.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== 'Admin') {
    return <Navigate to="/login" replace state={{ accessDenied: true }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}
