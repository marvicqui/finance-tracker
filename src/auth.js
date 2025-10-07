// src/auth.js
export async function getUser() {
  const res = await fetch('/.auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.clientPrincipal || null; // { userId, userDetails, userRoles, identityProvider }
}
export const login  = () => (window.location.href = '/login');
export const logout = () => (window.location.href = '/logout');
