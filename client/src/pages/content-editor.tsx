import { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ContentForm, ContentFormValues } from '@/components/ContentForm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { InsertContent, Content } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function ContentEditor() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditMode = Boolean(params.id);
  
  // Fetch content if in edit mode
  const { data: content, isLoading } = useQuery<Content>({
    queryKey: [`/api/contents/${params.id}`],
    enabled: isEditMode,
  });
  
  // Create content mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertContent) => {
      const res = await apiRequest('POST', '/api/contents', data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create content');
      }
      return await res.json();
    },
    onSuccess: () => {
      // Cập nhật cache
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });

      toast({
        title: 'Success',
        description: 'Content has been created successfully',
      });

      // Chuyển hướng về trang contents
      navigate('/contents');
    },
    onError: (error) => {
      toast({
        title: 'Error creating content',
        description: error.message,
        variant: 'destructive',
      });
    }'/api/stats'] });
        navigate('/contents');
        return null; // Trả về null để không gọi onSuccess
      }
    },
    onSuccess: (data) => {
      if (!data) return; // Nếu đã xử lý trong try-catch, không thực hiện onSuccess
      
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: 'Content created',
        description: 'Your content has been successfully created.',
      });
      navigate('/contents');
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast({
        title: 'Error creating content',
        description: String(error),
        variant: 'destructive',
      });
      // Đảm bảo làm mới dữ liệu sau khi gặp lỗi
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
    },
  });
  
  // Update content mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertContent>) => {
      const res = await apiRequest('PUT', `/api/contents/${params.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contents/${params.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: 'Content updated',
        description: 'Your content has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating content',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const handleSubmit = (data: ContentFormValues) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data as InsertContent);
    }
  };
  
  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2" 
            onClick={() => navigate('/contents')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Content
          </Button>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEditMode ? 'Edit Content' : 'Create New Content'}
          </h1>
        </div>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          {isEditMode && isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <ContentForm
              defaultValues={content}
              onSubmit={handleSubmit}
              isSubmitting={createMutation.isPending || updateMutation.isPending}
            />
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
