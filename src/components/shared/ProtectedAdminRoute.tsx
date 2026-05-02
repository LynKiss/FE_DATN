import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminSession } from '../../hooks/useAdminSession';
import { useSuperAdminSession } from '../../hooks/useSuperAdminSession';

export default function ProtectedAdminRoute() {
  const { session } = useAdminSession();
  const { session: superSession } = useSuperAdminSession();
  const location = useLocation();

  if (!session && !superSession) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
