// Read the backend URL from environment or use a default
const backendUrl = import.meta.env.VITE_BACKEND_URL;

export const config = {
  apiBaseUrl: backendUrl
}; 