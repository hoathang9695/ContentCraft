import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Activity,
  Users,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  Trash2,
  RotateCcw
} from 'lucide-react';

interface CommentQueueReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QueueStats {
  currentProcessingCount: number;
  maxConcurrentQueues: number;
  processingQueues: Array<{
    sessionId: string;
    startTime: number;
  }>;
}

interface QueueItem {
  session_id: string;
  external_id: string;
  total_comments: number;
  processed_count: number;
  success_count: number;
  failure_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export default function CommentQueueReportDialog({ 
  open, 
  onOpenChange 
}: CommentQueueReportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Reset auto refresh khi đóng dialog
  useEffect(() => {
    if (!open) {
      setAutoRefresh(true); // Reset về default khi đóng
    }
  }, [open]);

  // Fetch processor status - chỉ khi dialog mở
  const { data: processorStatus, refetch: refetchStatus } = useQuery<QueueStats>({
    queryKey: ['/api/comment-queues/processor/status'],
    refetchInterval: open && autoRefresh ? 5000 : false,
    enabled: open,
    staleTime: 0, // Luôn fetch fresh data khi mở dialog
    gcTime: 0, // Không cache data khi đóng dialog
  });

  // Fetch user queues - chỉ khi dialog mở
  const { data: userQueuesResponse, refetch: refetchQueues } = useQuery<{success: boolean, data: QueueItem[]}>({
    queryKey: ['/api/comment-queues'],
    refetchInterval: open && autoRefresh ? 5000 : false,
    enabled: open,
    staleTime: 0, // Luôn fetch fresh data khi mở dialog
    gcTime: 0, // Không cache data khi đóng dialog
  });

  const userQueues = userQueuesResponse?.data || [];

  // Calculate statistics
  const stats = {
    total: userQueues.length,
    pending: userQueues.filter(q => q.status === 'pending').length,
    processing: userQueues.filter(q => q.status === 'processing').length,
    completed: userQueues.filter(q => q.status === 'completed').length,
    failed: userQueues.filter(q => q.status === 'failed').length,
    totalComments: userQueues.reduce((sum, q) => sum + q.total_comments, 0),
    successfulComments: userQueues.reduce((sum, q) => sum + (q.success_count || 0), 0),
    failedComments: userQueues.reduce((sum, q) => sum + (q.failure_count || 0), 0),
  };

  const successRate = stats.totalComments > 0 
    ? Math.round((stats.successfulComments / stats.totalComments) * 100) 
    : 0;

  const handleForceCleanup = async () => {
    try {
      const result = await apiRequest('POST', '/api/comment-queues/force-cleanup', {});
      toast({
        title: "Thành công",
        description: `Đã force cleanup stuck queues`,
      });
      refetchStatus();
      refetchQueues();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể thực hiện force cleanup",
        variant: "destructive",
      });
    }
  };

  const handleManualCleanup = async () => {
    try {
      const result = await apiRequest('DELETE', '/api/comment-queues/cleanup', {
        hoursOld: 24
      });
      toast({
        title: "Thành công",
        description: `Đã cleanup ${result.deletedCount || 0} queue cũ`,
      });
      refetchQueues();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể thực hiện cleanup",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'processing': return <Activity className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

    // Reset individual queue mutation
  const resetQueueMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest('POST', `/api/comment-queues/reset-queue/${sessionId}`, {});
    },
    onSuccess: (data) => {
      toast({
        title: "Queue Reset Thành Công",
        description: data.message || "Queue đã được reset về trạng thái pending",
      });
      // Refetch data
      refetchQueues();
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/comment-queues/processor/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/comment-queues'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi Reset Queue",
        description: error.message || "Không thể reset queue",
      });
    }
  });

  // Force cleanup mutation (enhanced)
  const forceCleanupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/comment-queues/force-cleanup', {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Force Cleanup Thành Công",
        description: data.status?.message || "Đã reset tất cả queue bị stuck",
      });
      // Refetch all data
      refetchQueues();
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/comment-queues/processor/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/comment-queues'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi Force Cleanup",
        description: error.message || "Không thể thực hiện force cleanup",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Báo cáo Comment Queue
          </DialogTitle>
          <DialogDescription>
            Dashboard theo dõi trạng thái hệ thống queue comment tự động
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Control Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Điều khiển</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetchStatus();
                    refetchQueues();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Làm mới
                </Button>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-refresh"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="auto-refresh" className="text-sm">
                    Tự động làm mới (5s)
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleForceCleanup}
                  className="text-orange-600 hover:text-orange-700"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Force Cleanup
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualCleanup}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cleanup (24h)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Đang xử lý</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {processorStatus?.currentProcessingCount || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      / {processorStatus?.maxConcurrentQueues || 10} tối đa
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng Queue</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.pending} chờ xử lý
                    </p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng Comments</p>
                    <p className="text-2xl font-bold">{stats.totalComments}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.successfulComments} thành công
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tỷ lệ thành công</p>
                    <p className="text-2xl font-bold text-green-600">{successRate}%</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.failedComments} thất bại
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Phân bố trạng thái Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium">Chờ xử lý</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Đang xử lý</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Hoàn thành</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Thất bại</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
              </div>

              {stats.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tiến độ tổng thể</span>
                    <span>{Math.round(((stats.completed + stats.failed) / stats.total) * 100)}%</span>
                  </div>
                  <Progress 
                    value={((stats.completed + stats.failed) / stats.total) * 100} 
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Queues */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Queue gần đây</CardTitle>
              <CardDescription>
                {userQueues.length} queue (hiển thị 10 mới nhất)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {userQueues.slice(0, 10).map((queue) => (
                  <div key={queue.session_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(queue.status)}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {queue.session_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          External ID: {queue.external_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-medium">
                          {queue.processed_count || 0}/{queue.total_comments}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ✓{queue.success_count || 0} ✗{queue.failure_count || 0}
                        </p>
                      </div>

                      <Badge variant="outline" className="flex items-center gap-1">
                        {getStatusIcon(queue.status)}
                        {queue.status}
                      </Badge>
                    </div>
                  </div>
                ))}

                {userQueues.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Chưa có queue nào được tạo</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Currently Processing */}
          {processorStatus?.processingQueues && processorStatus.processingQueues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Đang xử lý ({processorStatus.processingQueues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {processorStatus.processingQueues.map((pq) => {
                    const startTime = new Date(pq.startTime);
                    const duration = Math.floor((Date.now() - pq.startTime) / 1000 / 60);

                    return (
                      <div key={pq.sessionId} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                        <span className="text-sm font-mono">{pq.sessionId}</span>
                        <div className="text-xs text-muted-foreground">
                          Đã chạy {duration} phút
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Đang Xử Lý</CardTitle>
                <Activity className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {processorStatus?.currentProcessingCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Max: {processorStatus?.maxConcurrentQueues || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tổng Queues</CardTitle>
                <MessageSquare className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userQueues?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Queue gần đây
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hoàn Thành</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {userQueues?.filter((q: any) => q.status === 'completed').length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Queue thành công
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Thất Bại</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {userQueues?.filter((q: any) => q.status === 'failed').length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Queue lỗi
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stuck Queues Section */}
          {userQueues?.filter((q: any) => q.status === 'processing').length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Queues Đang Processing ({userQueues.filter((q: any) => q.status === 'processing').length})
                </CardTitle>
                <CardDescription>
                  Các queue có thể bị stuck. Click "Reset" để reset từng queue hoặc "Force Cleanup" để reset tất cả.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userQueues
                    .filter((q: any) => q.status === 'processing')
                    .map((queue: any) => (
                      <div key={queue.session_id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-mono text-sm font-medium">
                            {queue.session_id}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            External ID: {queue.external_id} | 
                            Progress: {queue.processed_count || 0}/{queue.total_comments} |
                            Success: {queue.success_count || 0} |
                            Failed: {queue.failure_count || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created: {new Date(queue.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetQueueMutation.mutate(queue.session_id)}
                          disabled={resetQueueMutation.isPending}
                          className="ml-2"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                      </div>
                    ))}
                </div>

                <Separator className="my-4" />

                <div className="flex gap-2">
                  <Button
                    onClick={() => forceCleanupMutation.mutate()}
                    disabled={forceCleanupMutation.isPending}
                    variant="destructive"
                    size="sm"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {forceCleanupMutation.isPending ? 'Đang Reset...' : 'Force Cleanup All'}
                  </Button>

                  <Button
                    onClick={() => {
                      refetchQueues();
                      refetchStatus();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}