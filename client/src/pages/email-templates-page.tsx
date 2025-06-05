import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { DataTable } from '@/components/ui/data-table';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Copy,
  Save,
  X
} from 'lucide-react';

interface EmailTemplate {
  id: number;
  name: string;
  type: string;
  subject: string;
  htmlContent: string;
  variables: string[];
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateFormData {
  name: string;
  type: string;
  subject: string;
  htmlContent: string;
  description: string;
  isActive: boolean;
  variables: string;
}

const EMAIL_TEMPLATE_TYPES = [
  { value: 'feedback_confirmation', label: 'Xác nhận Feedback' },
  { value: 'support_confirmation', label: 'Xác nhận Hỗ trợ' },
  { value: 'welcome', label: 'Chào mừng' },
  { value: 'admin_reply', label: 'Phản hồi từ Admin' },
  { value: 'system_notification', label: 'Thông báo hệ thống' },
  { value: 'custom', label: 'Tùy chỉnh' }
];

const COMMON_VARIABLES = [
  '{{fullName}}',
  '{{email}}', 
  '{{subject}}',
  '{{requestId}}',
  '{{feedbackType}}',
  '{{adminMessage}}',
  '{{userName}}',
  '{{title}}',
  '{{message}}',
  '{{companyName}}',
  '{{companyTagline}}'
];

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function EmailTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    type: '',
    subject: '',
    htmlContent: '',
    description: '',
    isActive: true,
    variables: ''
  });

  // Fetch email templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/email-templates'],
    queryFn: async () => {
      const response = await fetch('/api/email-templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: Omit<TemplateFormData, 'variables'> & { variables: string[] }) => {
      const response = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: 'Template đã được tạo' });
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Lỗi', description: 'Không thể tạo template', variant: 'destructive' });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Omit<TemplateFormData, 'variables'> & { variables: string[] } }) => {
      console.log('Updating template with data:', data);
      const response = await fetch(`/api/email-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update template error:', errorText);
        throw new Error(`Failed to update template: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: 'Template đã được cập nhật' });
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Update template mutation error:', error);
      toast({ title: 'Lỗi', description: 'Không thể cập nhật template', variant: 'destructive' });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/email-templates/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        if (response.status === 404) {
          // Template already deleted, treat as success
          return { success: true, message: 'Template already deleted' };
        }
        throw new Error('Failed to delete template');
      }
      return response.status === 204 ? { success: true } : response.json();
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: 'Template đã được xóa' });
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
    },
    onError: () => {
      toast({ title: 'Lỗi', description: 'Không thể xóa template', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      subject: '',
      htmlContent: '',
      description: '',
      isActive: true,
      variables: ''
    });
    setEditingTemplate(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsEditDialogOpen(true);
  };

  const openEditDialog = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      subject: template.subject,
      htmlContent: template.htmlContent,
      description: template.description || '',
      isActive: template.isActive,
      variables: template.variables.join(', ')
    });
    setIsEditDialogOpen(true);
  };

  const openPreviewDialog = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setIsPreviewDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const variables = formData.variables
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    const { variables: _, ...restFormData } = formData;
    const submitData = {
      ...restFormData,
      variables
    };

    console.log('Submitting data:', submitData);

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: submitData });
    } else {
      createTemplateMutation.mutate(submitData);
    }
  };

  const handleDuplicate = (template: EmailTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      type: template.type,
      subject: template.subject,
      htmlContent: template.htmlContent,
      description: template.description || '',
      isActive: false,
      variables: template.variables.join(', ')
    });
    setEditingTemplate(null);
    setIsEditDialogOpen(true);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea[name="htmlContent"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = formData.htmlContent.substring(0, start) + variable + formData.htmlContent.substring(end);
      setFormData({ ...formData, htmlContent: newContent });

      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Tên Template',
      render: (template: EmailTemplate) => (
        <div>
          <div className="font-medium">{template.name}</div>
          {template.description && (
            <div className="text-sm text-gray-500">{template.description}</div>
          )}
        </div>
      )
    },
    {
      key: 'type',
      header: 'Loại',
      render: (template: EmailTemplate) => {
        const typeInfo = EMAIL_TEMPLATE_TYPES.find(t => t.value === template.type);
        return <Badge variant="outline">{typeInfo?.label || template.type}</Badge>;
      }
    },
    {
      key: 'subject',
      header: 'Chủ đề',
      render: (template: EmailTemplate) => (
        <div className="max-w-xs truncate" title={template.subject}>
          {template.subject}
        </div>
      )
    },
    {
      key: 'variables',
      header: 'Biến',
      render: (template: EmailTemplate) => (
        <div className="flex flex-wrap gap-1">
          {template.variables.slice(0, 2).map((variable, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {variable}
            </Badge>
          ))}
          {template.variables.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{template.variables.length - 2}
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (template: EmailTemplate) => (
        <Badge variant={template.isActive ? 'default' : 'secondary'}>
          {template.isActive ? 'Kích hoạt' : 'Tạm dừng'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (template: EmailTemplate) => (
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openPreviewDialog(template)}
            title="Xem trước"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditDialog(template)}
            title="Chỉnh sửa"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDuplicate(template)}
            title="Sao chép"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Xóa"
                    disabled={deleteTemplateMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bạn có chắc chắn muốn xóa template "{template.name}"? Hành động này không thể hoàn tác.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteTemplateMutation.isPending}>
                      Hủy
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteTemplateMutation.mutate(template.id)}
                      disabled={deleteTemplateMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteTemplateMutation.isPending ? 'Đang xóa...' : 'Xóa'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
        </div>
      )
    }
  ];

  // Function to find duplicate active templates
  const findDuplicateActiveTemplates = (templates: EmailTemplate[]) => {
    const activeTemplatesByType: { [type: string]: EmailTemplate[] } = {};

    templates.forEach(template => {
      if (template.isActive) {
        if (!activeTemplatesByType[template.type]) {
          activeTemplatesByType[template.type] = [];
        }
        activeTemplatesByType[template.type].push(template);
      }
    });

    const duplicateActiveTemplates = Object.entries(activeTemplatesByType)
      .filter(([, templates]) => templates.length > 1)
      .map(([type, templates]) => [type, templates] as [string, EmailTemplate[]]);

    return duplicateActiveTemplates;
  };

  const duplicateActiveTemplates = findDuplicateActiveTemplates(templates);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quản lý Email Templates</h1>
            <p className="text-muted-foreground">
              Quản lý các template email cho các luồng tự động
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm Template
          </Button>
        </div>

      {/* Warning for duplicate active templates */}
      {duplicateActiveTemplates.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Cảnh báo: Có nhiều template cùng loại đang kích hoạt
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Các loại template sau có nhiều hơn 1 template đang kích hoạt. Hệ thống sẽ ưu tiên template được tạo gần đây nhất:</p>
                <ul className="list-disc list-inside mt-2">
                  {duplicateActiveTemplates.map(([type, templates]) => {
                    const typeInfo = EMAIL_TEMPLATE_TYPES.find(t => t.value === type);
                    return (
                      <li key={type}>
                        <strong>{typeInfo?.label || type}</strong>: {templates.length} templates kích hoạt
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 font-medium">
                  Khuyến nghị: Chỉ nên kích hoạt 1 template cho mỗi loại để tránh nhầm lẫn.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Danh sách Templates ({templates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={templates}
            columns={columns}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Chỉnh sửa Template' : 'Tạo Template mới'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên Template *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Xác nhận Feedback v2"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Loại Template *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại template" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Chủ đề Email *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Cảm ơn bạn đã gửi phản hồi - {{companyName}}"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả ngắn về template này"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-2">
                <Label htmlFor="htmlContent">Nội dung HTML *</Label>
                <Textarea
                  id="htmlContent"
                  name="htmlContent"
                  value={formData.htmlContent}
                  onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                  placeholder="<div>Xin chào {{fullName}},<br/>Cảm ơn bạn đã gửi phản hồi...</div>"
                  className="min-h-[300px] font-mono text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Biến có sẵn</Label>
                <div className="border rounded-md p-3 max-h-[300px] overflow-y-auto">
                  <div className="space-y-1">
                    {COMMON_VARIABLES.map(variable => (
                      <Button
                        key={variable}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => insertVariable(variable)}
                      >
                        {variable}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="variables">Danh sách biến sử dụng</Label>
              <Input
                id="variables"
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                placeholder="{{fullName}}, {{email}}, {{subject}}"
                helperText="Nhập các biến cách nhau bằng dấu phẩy"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isActive">Kích hoạt template</Label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {editingTemplate ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-7xl h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Xem trước Template: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>

          {previewTemplate && (
            <div className="flex flex-col space-y-4 h-full">
              {/* Header Info */}
              <div className="grid grid-cols-4 gap-4 flex-shrink-0">
                <div>
                  <Label className="text-sm font-medium">Loại:</Label>
                  <div className="text-sm text-gray-600">
                    {EMAIL_TEMPLATE_TYPES.find(t => t.value === previewTemplate.type)?.label}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Trạng thái:</Label>
                  <div className="text-sm text-gray-600">
                    {previewTemplate.isActive ? 'Kích hoạt' : 'Tạm dừng'}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Chủ đề:</Label>
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {previewTemplate.subject}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0">
                <Label className="text-sm font-medium">Biến sử dụng:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {previewTemplate.variables.map((variable, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Main Content - Split View */}
              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                {/* HTML Content */}
                <div className="flex flex-col">
                  <Label className="text-sm font-medium mb-2">Nội dung HTML:</Label>
                  <div className="border rounded-md p-4 bg-gray-50 flex-1 overflow-y-auto max-h-96">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {previewTemplate.htmlContent}
                    </pre>
                  </div>
                </div>

                {/* Render Preview */}
                <div className="flex flex-col">
                  <Label className="text-sm font-medium mb-2">Render Preview:</Label>
                  <div className="border rounded-md p-4 bg-white flex-1 overflow-y-auto max-h-96">
                    <div dangerouslySetInnerHTML={{ __html: previewTemplate.htmlContent }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}