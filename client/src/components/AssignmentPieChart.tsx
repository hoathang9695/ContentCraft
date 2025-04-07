import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

// Mảng màu sắc cho biểu đồ tròn
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#4CAF50', '#E91E63', '#3F51B5', '#009688', '#FFC107'];

interface AssignmentData {
  userId: number;
  username: string;
  name: string;
  count: number;
}

interface AssignmentPieChartProps {
  title: string;
  data: AssignmentData[];
  onViewAll?: () => void;
  isLoading?: boolean;
}

// Type for custom legend payload
interface CustomLegendPayload {
  value: string;
  type: 'circle' | 'line' | 'rect';
  id: string;
  color: string;
}

export function AssignmentPieChart({ title, data, onViewAll, isLoading = false }: AssignmentPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Chuyển đổi dữ liệu cho biểu đồ tròn
  const chartData = data.map(item => ({
    name: item.name || item.username,
    value: item.count,
    userId: item.userId,
    username: item.username
  }));

  // Xử lý hover chuột
  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  // Custom tooltip hiển thị thông tin khi hover
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-md p-3 shadow-md">
          <p className="font-medium">{data.name}</p>
          <p>Tài khoản: <span className="text-muted-foreground">{data.username}</span></p>
          <p>Số lượng nội dung: <span className="font-medium">{data.value}</span></p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Đang tải dữ liệu...</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Không có dữ liệu phân công</p>
        </CardContent>
      </Card>
    );
  }

  // Create custom legend payload
  const legendPayload: CustomLegendPayload[] = chartData.map((item, index) => ({
    id: item.userId.toString(),
    value: `${item.name}: ${item.value}`,
    color: COLORS[index % COLORS.length],
    type: 'circle'
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    style={{
                      filter: activeIndex === index ? 'drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.3))' : 'none',
                      opacity: activeIndex === null || activeIndex === index ? 1 : 0.6,
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                payload={legendPayload}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {onViewAll && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={onViewAll}>
              <Eye className="h-4 w-4 mr-2" />
              Xem tất cả nội dung
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}