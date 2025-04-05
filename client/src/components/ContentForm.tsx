import { useState } from 'react';
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

// Content schema with validation
const contentSchema = insertContentSchema.extend({
  source: z.string().optional(),
  categories: z.string().optional(),
  labels: z.string().optional(),
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
  
  // Form
  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      source: defaultValues?.source || '',
      categories: defaultValues?.categories || '',
      labels: defaultValues?.labels || '',
      status: defaultValues?.status || 'draft',
      authorId: user?.id || 0
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
