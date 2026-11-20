const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();

export const API_BASE_URL = configuredApiBase.replace(/\/+$/, '');

export function apiUrl(path) {
  const normalisedPath = path.startsWith('/') ? path : \`/\${path}\`;
  return \`\${API_BASE_URL}\${normalisedPath}\`;
}

export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
