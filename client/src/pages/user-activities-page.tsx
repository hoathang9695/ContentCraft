import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn, queryClient } from '@/lib/queryClient';
import { UserActivity } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

type ActivityType = 'all' | 'login' | 'logout' | 'register';

export default function UserActivitiesPage() {
  const [activityType, setActivityType] = useState<ActivityType>('all');
  const [userFilter, setUserFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all users for filtering
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  // Fetch activities
  const { data: activities, isLoading } = useQuery({
    queryKey: ['/api/user-activities'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  // Generate user lookup map for quick access
  const userLookup = React.useMemo(() => {
    if (!users || !Array.isArray(users)) return {} as Record<number, any>;
    return users.reduce((acc: Record<number, any>, user: any) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<number, any>);
  }, [users]);

  // Filter and paginate activities
  const filteredActivities = React.useMemo(() => {
    if (!activities || !Array.isArray(activities)) return [];

    return activities
      .filter((activity: UserActivity) => {
        // Filter by activity type
        if (activityType !== 'all' && activity.activityType !== activityType) {
          return false;
        }

        // Filter by user if userFilter is provided
        if (userFilter && activity.userId && userLookup[activity.userId]) {
          const user = userLookup[activity.userId];
          const userText = `${user.name || ''} ${user.username || ''} ${user.email || ''}`.toLowerCase();
          return userText.includes(userFilter.toLowerCase());
        }

        return true;
      })
      .sort((a: UserActivity, b: UserActivity) => {
        // Sort by timestamp descending
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [activities, activityType, userFilter, userLookup]);

  // Calculate pagination
  const paginatedActivities = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredActivities.slice(start, end);
  }, [filteredActivities, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / itemsPerPage));

  const handleSearch = (value: string) => {
    setUserFilter(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const activityTypeColors: Record<string, string> = {
    login: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    logout: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    register: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  };

  // Render activity badge with appropriate color
  const ActivityBadge = ({ type }: { type: string }) => (
    <Badge className={activityTypeColors[type] || 'bg-gray-100 text-gray-800'}>
      {type}
    </Badge>
  );

  return (
    <DashboardLayout onSearch={handleSearch}>
      <div className="container mx-auto py-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle>Lịch sử hoạt động người dùng</CardTitle>
              <div className="flex gap-2">
                <Select
                  value={activityType}
                  onValueChange={(value) => {
                    setActivityType(value as ActivityType);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Loại hoạt động" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="login">Đăng nhập</SelectItem>
                    <SelectItem value="logout">Đăng xuất</SelectItem>
                    <SelectItem value="register">Đăng ký</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={paginatedActivities}
              columns={[
                {
                  key: 'timestamp',
                  header: 'Thời gian',
                  render: (row: UserActivity) => (
                    <span>{format(new Date(row.timestamp), 'dd/MM/yyyy HH:mm:ss')}</span>
                  ),
                },
                {
                  key: 'activityType',
                  header: 'Loại hoạt động',
                  render: (row: UserActivity) => <ActivityBadge type={row.activityType} />,
                },
                {
                  key: 'user',
                  header: 'Người dùng',
                  render: (row: UserActivity) => {
                    const user = row.userId && userLookup[row.userId];
                    return user ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-sm text-gray-500">{user.username}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">ID: {row.userId}</span>
                    );
                  },
                },
                {
                  key: 'ipAddress',
                  header: 'IP',
                  render: (row: UserActivity) => <span>{row.ipAddress || 'N/A'}</span>,
                },
                {
                  key: 'userAgent',
                  header: 'Trình duyệt',
                  render: (row: UserActivity) => (
                    <span className="truncate block max-w-[200px]">
                      {row.userAgent?.substring(0, 30) || 'N/A'}
                      {row.userAgent && row.userAgent.length > 30 ? '...' : ''}
                    </span>
                  ),
                },
                {
                  key: 'createdTime',
                  header: 'Thời gian chi tiết',
                  render: (row: UserActivity) => {
                    const date = new Date(row.timestamp);
                    return (
                      <div className="flex flex-col">
                        <span className="font-medium">{format(date, 'HH:mm:ss')}</span>
                        <span className="text-sm text-gray-500">{format(date, 'dd/MM/yyyy')}</span>
                      </div>
                    );
                  },
                },
              ]}
              isLoading={isLoading}
              searchable={false}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: setCurrentPage,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}