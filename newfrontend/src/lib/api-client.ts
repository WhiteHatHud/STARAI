import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

// ============================================
// Type Definitions
// ============================================

export interface Dataset {
  id: string;
  filename: string;
  uploaded_at: string;
  status?: string;
  analysis_status?: "pending" | "processing" | "completed" | "failed";
  analyzed_at?: string;
  anomaly_count?: number;
  file_size?: number;
}

export interface AnalysisSession {
  dataset_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "error";
  progress: number; // 0-100
  message?: string;
  anomalies_detected?: number;
  created_at?: string;
  completed_at?: string;
}

export interface AnalysisResult {
  dataset_id: string;
  anomalies_detected: number;
  status: string;
  analysis_completed_at: string;
}

export interface Report {
  id: string;
  dataset_id: string;
  title: string;
  created_at: string;
  status: "complete" | "processing" | "error";
  anomaly_count: number;
  severity_distribution?: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface Statistics {
  total_datasets: number;
  total_anomalies: number;
  by_severity: Array<{
    severity: string;
    count: number;
  }>;
  recent_activity: Array<{
    date: string;
    anomaly_count: number;
  }>;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// ============================================
// API Client Class
// ============================================

export class StarAIClient {
  private axios: AxiosInstance;

  constructor(config: {
    baseURL: string;
    getToken: () => string | null;
  }) {
    this.axios = axios.create({
      baseURL: config.baseURL,
    });

    // Request interceptor - add auth token
    this.axios.interceptors.request.use(
      (requestConfig) => {
        const token = config.getToken();
        if (token) {
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }
        return requestConfig;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          console.warn("API error:", {
            status: error.response.status,
            url: error.config?.url,
          });
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // Authentication
  // ============================================

  auth = {
    login: async (username: string, password: string): Promise<LoginResponse> => {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const response = await this.axios.post<LoginResponse>("/auth/token", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return response.data;
    },

    me: async (): Promise<User> => {
      const response = await this.axios.get<User>("/auth/users/me");
      return response.data;
    },
  };

  // ============================================
  // Datasets
  // ============================================

  datasets = {
    list: async (): Promise<Dataset[]> => {
      const response = await this.axios.get<Dataset[]>("/anomaly/datasets");
      return response.data;
    },

    upload: async (file: File): Promise<Dataset> => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await this.axios.post<Dataset>("/anomaly/datasets/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },

    get: async (id: string): Promise<Dataset> => {
      const response = await this.axios.get<Dataset>(`/anomaly/datasets/${id}`);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await this.axios.delete(`/anomaly/datasets/${id}`);
    },

    deleteAll: async (): Promise<void> => {
      await this.axios.delete("/anomaly/datasets/delete-all");
    },

    // Analysis operations
    analyze: async (id: string): Promise<AnalysisResult> => {
      const response = await this.axios.post<AnalysisResult>(
        `/anomaly/datasets/${id}/analyze-test`,
        {}
      );
      return response.data;
    },

    // Get analysis session/progress
    session: async (id: string): Promise<AnalysisSession> => {
      const response = await this.axios.get<AnalysisSession>(
        `/anomaly/datasets/${id}/session`
      );
      return response.data;
    },
  };

  // ============================================
  // Reports
  // ============================================

  reports = {
    list: async (): Promise<Report[]> => {
      const response = await this.axios.get<Report[]>("/anomaly/anomaly-reports");
      return response.data;
    },

    get: async (id: string): Promise<Report> => {
      const response = await this.axios.get<Report>(`/anomaly/anomaly-reports/${id}`);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await this.axios.delete(`/anomaly/anomaly-reports/${id}`);
    },

    exportPDF: async (id: string): Promise<Blob> => {
      const response = await this.axios.get(`/anomaly/anomaly-reports/${id}/export`, {
        params: { format: 'pdf' },
        responseType: "blob",
      });
      return response.data;
    },

    exportExcel: async (id: string): Promise<Blob> => {
      const response = await this.axios.get(`/anomaly/anomaly-reports/${id}/export`, {
        params: { format: 'excel' },
        responseType: "blob",
      });
      return response.data;
    },
  };

  // ============================================
  // Statistics
  // ============================================

  statistics = {
    get: async (): Promise<Statistics> => {
      const response = await this.axios.get<Statistics>("/anomaly/statistics");
      return response.data;
    },
  };
}

// ============================================
// Create default client instance
// ============================================

export const createClient = (config: {
  baseURL: string;
  getToken: () => string | null;
}): StarAIClient => {
  return new StarAIClient(config);
};

// Export a default instance for convenience
const defaultClient = new StarAIClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  getToken: () => {
    // This will be overridden when used with the store
    return null;
  },
});

export default defaultClient;
