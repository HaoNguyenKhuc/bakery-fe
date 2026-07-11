import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Route guard that redirects unauthenticated users to /login.
 * Passes the attempted URL in location state so the login page
 * can redirect back after successful login.
 *
 * Usage:
 *   <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
 *     ...protected routes...
 *   </Route>
 */
const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  // User is considered authenticated if they have both the flag AND a token
  const isLoggedIn = isAuthenticated && !!accessToken;

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
