import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Route guard (E8-1): non-admin or unauthenticated visitors are sent to /login before any dashboard code runs. */
export default function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
