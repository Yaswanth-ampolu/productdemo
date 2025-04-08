import axios from 'axios';

const api = axios.create({
  // Use relative URLs instead of absolute URLs with baseURL
  baseURL: '',
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    // Don't redirect on 401 from auth endpoints
    if (error.response?.status === 401 && 
        !error.config.url?.includes('/auth/')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 