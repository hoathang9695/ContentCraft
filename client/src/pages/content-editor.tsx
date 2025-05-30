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
      try {
        const res = await apiRequest('POST', '/api/contents', {
          ...data,
          source: data.source || null,
        });
        const responseData = await res.json();
        
        if (!res.ok) {
          throw new Error(responseData.message || 'Failed to create content');
        }
        
        return responseData;
      } catch (error) {
        console.error('Create content error:', error);
        // Ensure cache is updated even if there's an error
        queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
        queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
        queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });

      toast({
        title: 'Success',
        description: 'Content has been created successfully'
      });

      navigate('/contents');
    },
    onError: (error) => {
      toast({
        title: 'Content created with warning',
        description: 'Content was saved but there were some issues. Please check the content list.',
        variant: 'default'
      });
      navigate('/contents');
    }
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