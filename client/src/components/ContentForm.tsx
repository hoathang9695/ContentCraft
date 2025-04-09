import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertContentSchema, Content } from '@shared/schema';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// Content schema with validation
const contentSchema = insertContentSchema.extend({
  externalId: z.string().optional(),
  source: z.string().optional(),
  categories: z.string().optional(),
  labels: z.string().optional(),
  sourceVerification: z.string().optional(),
  assigned_to_id: z.number().optional(),
});

export type ContentFormValues = z.infer<typeof contentSchema>;

interface ContentFormProps {
  defaultValues?: Partial<ContentFormValues>;
  isSubmitting?: boolean;
  onSubmit: (data: ContentFormValues) => void;
}

export function ContentForm({ 
  defaultValues, 
  isSubmitting = false,
  onSubmit 
}: ContentFormProps) {
  const { user } = useAuth();

  // Fetch active editors
  const { data: editors = [], isLoading: isLoadingEditors } = useQuery<{id: number, name: string, username: string}[]>({
    queryKey: ['/api/editors'],
    enabled: user?.role === 'admin', // Only load if user is admin
  });

  // Form
  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      externalId: defaultValues?.externalId || '',
      source: defaultValues?.source || '',
      categories: defaultValues?.categories || '',
      labels: defaultValues?.labels || '',
      status: defaultValues?.status || 'draft',
      sourceVerification: defaultValues?.sourceVerification || 'unverified',
      assigned_to_id: defaultValues?.assigned_to_id || undefined
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="draft">Chưa xử lý</SelectItem>
                  <SelectItem value="review">Đang xử lý</SelectItem>
                  <SelectItem value="published">Đã xử lý</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="externalId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>External ID</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Nhập External ID" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nguồn</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Nhập nguồn dữ liệu" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categories"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Danh mục</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Nhập danh mục (phân tách bằng dấu phẩy)" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="labels"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nhãn</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Nhập nhãn (phân tách bằng dấu phẩy)" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sourceVerification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trạng thái xác minh</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trạng thái xác minh" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="unverified">Chưa xác minh</SelectItem>
                  <SelectItem value="verified">Đã xác minh</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Hiển thị select người xử lý chỉ khi người dùng là admin */}
        {user?.role === 'admin' && (
          <FormField
            control={form.control}
            name="assigned_to_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phân công xử lý cho</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(Number(value))}
                  value={field.value?.toString() || ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn người xử lý" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingEditors ? (
                      <SelectItem value="loading" disabled>
                        Đang tải danh sách người dùng...
                      </SelectItem>
                    ) : editors.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Không có người dùng nào khả dụng
                      </SelectItem>
                    ) : (
                      editors.map((editor) => (
                        <SelectItem key={editor.id} value={editor.id.toString()}>
                          {editor.name} ({editor.username})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end space-x-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Content'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}