import axios from 'axios';
import { config } from '../config';

const api = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on 401 from auth endpoints
    if (error.response?.status === 401 && 
        !error.config.url?.includes('/auth/')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 