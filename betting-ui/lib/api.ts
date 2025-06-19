import axios, { AxiosResponse } from 'axios';
import { ApiResponse, SessionData, BetRequest, Bet } from '../types';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.status, error.message);
    
    // Transform common error cases
    if (error.response?.status === 401) {
      // Session expired or invalid
      window.location.href = '/expired';
    }
    
    return Promise.reject(error);
  }
);

/**
 * Check a session token without consuming it (for page loads)
 */
export async function checkSession(token: string): Promise<ApiResponse<{
  jti: string;
  userId: string;
  marketId: string;
  sessionData: SessionData;
}>> {
  try {
    const response: AxiosResponse<ApiResponse> = await apiClient.get(`/api/session/status/${token}`);
    return response.data;
  } catch (error: any) {
    console.error('Session check error:', error);
    throw new Error(error.response?.data?.error || 'Session check failed');
  }
}

/**
 * Validate a session token (consumes the token)
 */
export async function validateSession(token: string): Promise<ApiResponse<{
  jti: string;
  userId: string;
  marketId: string;
  sessionData: SessionData;
}>> {
  try {
    const response: AxiosResponse<ApiResponse> = await apiClient.get(`/api/session/validate/${token}`);
    return response.data;
  } catch (error: any) {
    console.error('Session validation error:', error);
    throw new Error(error.response?.data?.error || 'Session validation failed');
  }
}

/**
 * Get session status without consuming it
 */
export async function getSessionStatus(token: string): Promise<ApiResponse<{
  jti: string;
  userId: string;
  marketId: string;
  status: string;
  ttl: number;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}>> {
  try {
    const response: AxiosResponse<ApiResponse> = await apiClient.get(`/api/session/status/${token}`);
    return response.data;
  } catch (error: any) {
    console.error('Session status error:', error);
    throw new Error(error.response?.data?.error || 'Failed to get session status');
  }
}

/**
 * Place a bet using authentication token
 */
export async function placeBet(token: string, betRequest: BetRequest): Promise<ApiResponse<{
  bet: Bet;
  webhookSent?: boolean;
  redirect?: string;
}>> {
  try {
    const response: AxiosResponse<ApiResponse> = await apiClient.post('/api/bet/place', betRequest, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Bet placement error:', error);
    throw new Error(error.response?.data?.error || 'Failed to place bet');
  }
}

/**
 * Get betting history for authenticated user
 */
export async function getBetHistory(
  token: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ApiResponse<{
  bets: Bet[];
  total: number;
  limit: number;
  offset: number;
}>> {
  try {
    const { limit = 10, offset = 0 } = options;
    const response: AxiosResponse<ApiResponse> = await apiClient.get('/bet/history', {
      params: { limit, offset },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Bet history error:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch bet history');
  }
}

/**
 * Get specific bet details
 */
export async function getBet(token: string, betId: string): Promise<ApiResponse<{ bet: Bet }>> {
  try {
    const response: AxiosResponse<ApiResponse> = await apiClient.get(`/bet/${betId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Bet fetch error:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch bet');
  }
}

/**
 * Refresh session token (extend expiry)
 */
export async function refreshSession(token: string): Promise<ApiResponse<{
  token: string;
  jti: string;
  userId: string;
  marketId: string;
  expiresAt: string;
  expiresIn: number;
}>> {
  try {
    const response: AxiosResponse<ApiResponse> = await apiClient.post('/api/session/refresh', {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Session refresh error:', error);
    throw new Error(error.response?.data?.error || 'Failed to refresh session');
  }
}

/**
 * Create a new session (used by Discord bot)
 */
export async function createSession(userId: string, marketId: string): Promise<ApiResponse<{
  token: string;
  jti: string;
  userId: string;
  marketId: string;
  expiresAt: string;
  expiresIn: number;
}>> {
  try {
    const response: AxiosResponse<ApiResponse> = await apiClient.post('/api/session/create', {
      userId,
      marketId,
    });
    return response.data;
  } catch (error: any) {
    console.error('Session creation error:', error);
    throw new Error(error.response?.data?.error || 'Failed to create session');
  }
}

/**
 * Health check endpoint
 */
export async function healthCheck(): Promise<ApiResponse<{
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}>> {
  try {
    const response: AxiosResponse<ApiResponse> = await apiClient.get('/health');
    return response.data;
  } catch (error: any) {
    console.error('Health check error:', error);
    throw new Error('API health check failed');
  }
}

/**
 * Error handler for API responses
 */
export function handleApiError(error: any): string {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: any): boolean {
  return !error.response && error.request;
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: any): boolean {
  return error.code === 'ECONNABORTED' || error.message?.includes('timeout');
}

export default apiClient; 