export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  requestId?: string;
  timestamp: string;
}
