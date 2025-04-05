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
        <h1 className="text-2xl font-semibold text-gray-900">Content Management</h1>
        <p className="text-gray-500 mt-1">Create, edit, and manage your content</p>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Content</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="review">In Review</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <ContentTable title="All Content" />
        </TabsContent>
        
        <TabsContent value="published">
          <ContentTable title="Published Content" statusFilter="published" />
        </TabsContent>
        
        <TabsContent value="draft">
          <ContentTable title="Draft Content" statusFilter="draft" />
        </TabsContent>
        
        <TabsContent value="review">
          <ContentTable title="Content In Review" statusFilter="review" />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
