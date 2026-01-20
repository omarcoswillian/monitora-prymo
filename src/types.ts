export interface PageConfig {
  name: string;
  url: string;
  interval?: number;
  timeout?: number;
}

export interface CheckResult {
  url: string;
  name: string;
  status: number | null;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface MonitorConfig {
  pages: PageConfig[];
  defaults?: {
    interval?: number;
    timeout?: number;
  };
}
