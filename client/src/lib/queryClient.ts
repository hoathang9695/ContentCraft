import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage: string;
    
    try {
      // Try to parse as JSON first
      const errorData = await res.json();
      errorMessage = errorData.message || res.statusText;
    } catch (e) {
      // If not JSON, use text
      const text = await res.text();
      errorMessage = text || res.statusText;
    }
    
    const error = new Error(errorMessage);
    (error as any).status = res.status;
    (error as any).response = res;
    throw error;
  }
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Nếu mã status 204 No Content, không cần parse JSON
  if (res.status === 204) {
    return {} as T;
  }
  
  return await res.json() as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Debug console logs
    console.log("Fetching from queryKey:", queryKey[0]);
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    console.log("API Response status:", res.status);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Nếu mã status 204 No Content, không cần parse JSON
    if (res.status === 204) {
      return {} as T;
    }
    
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Cập nhật khi cửa sổ có focus
      staleTime: 60000, // 1 phút thay vì Infinity để đảm bảo dữ liệu fresh
      retry: 1, // Thử lại 1 lần nếu thất bại
    },
    mutations: {
      retry: 1, // Thử lại 1 lần nếu thất bại
    },
  },
});
