export interface LoginRequest {
  username: string;
  password: string;
  client: string;
}

export interface WorkshopUser {
  username?: string;
  displayName?: string;
  [field: string]: unknown;
}

export interface LoginResponse {
  token?: string | null;
  user?: WorkshopUser;
}

export interface WorkshopTask {
  status?: string | null;
  priority?: string | number | boolean | null;
  owner?: unknown;
  title?: string;
  description?: string;
  label?: string;
  [field: string]: unknown;
}

export type TasksResponse = WorkshopTask[];

export interface Preferences {
  theme: unknown;
  showTips: unknown;
  compact: unknown;
  [field: string]: unknown;
}