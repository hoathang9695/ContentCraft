export interface SupportRequest {
  id: number;
  full_name: string;
  email: string;
  subject: string;
  content: string;
  status: 'pending' | 'processing' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface BadgeCounts {
  realUsers: number;
  pages: number;
  groups: number;
  supportRequests: number;
}