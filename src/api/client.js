import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Surface the backend's actual error message (e.g. a MySQL error) instead of
// a generic "Request failed with status code 500" so problems are visible
// directly in the UI without having to check the server terminal. The status
// code itself is left off the message shown to users — it's noise for anyone
// but a developer; check the Network tab or server logs for that.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const backendMessage = error.response.data?.error || error.response.data?.message;
      if (backendMessage) {
        return Promise.reject(new Error(backendMessage));
      }
    } else if (error.request) {
      return Promise.reject(new Error('No response from backend — is it running on http://localhost:5000?'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
