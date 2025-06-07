export interface SupportRequest {
  id: number;
  full_name: string;
  email: string;
  subject: string;
  content: string;
  status: 'pending' | 'processing' | 'completed';
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  response_content: string | null;
  responder_id: number | null;
  response_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackRequest extends SupportRequest {
  type: 'feedback';
}

export interface FeedbackRequest {
  id: number;
  full_name: string;
  email: string;
  subject: string;
  content: string;
  status: 'pending' | 'processing' | 'completed';
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  response_content: string | null;
  responder_id: number | null;
  response_time: string | null;
  created_at: string;
  updated_at: string;
  feedback_type?: 'bug_report' | 'feature_request' | 'complaint' | 'suggestion' | 'other';
  feature_type?: string;
  detailed_description?: string;
  attachment_url?: string;
}

export interface BadgeCounts {
  realUsers: number;
  pages: number;
  groups: number;
  supportRequests: number;
  feedbackRequests: number;
  verificationRequests: number;
  totalRequests: number; // Tổng support + feedback + verification cho menu cha
}