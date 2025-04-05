import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ContentTable } from '@/components/ContentTable';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState('all');
  
  const handleSearch = (query: string) => {
    // In a real app, this might filter by API
    console.log('Search query:', query);
  };
  
  return (
    <DashboardLayout onSearch={handleSearch}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Content Management</h1>
        <p className="text-muted-foreground mt-1">Create, edit, and manage your content</p>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="processed">Đã xử lý</TabsTrigger>
          <TabsTrigger value="unprocessed">Chưa xử lý</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <ContentTable title="Tất cả nội dung" />
        </TabsContent>
        
        <TabsContent value="processed">
          <ContentTable title="Nội dung đã xử lý" statusFilter="published" />
        </TabsContent>
        
        <TabsContent value="unprocessed">
          <ContentTable title="Nội dung chưa xử lý" statusFilter="draft" />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
