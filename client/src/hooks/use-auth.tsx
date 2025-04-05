import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser, LoginData } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type AuthResponse = Omit<SelectUser, "password"> & {
  message?: string;
  avatarUrl?: string;
};

type AuthContextType = {
  user: AuthResponse | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<AuthResponse, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<AuthResponse, Error, InsertUser>;
};

// Extend user schema with validation for registration
const registerUserSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<AuthResponse | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: AuthResponse) => {
      queryClient.setQueryData(["/api/user"], user);
      // Chuyển hướng người dùng dựa trên vai trò
      if (user.role === 'admin') {
        // Admin vào trang dashboard
        window.location.href = "/";
      } else {
        // Người dùng thường vào trang nội dung
        window.location.href = "/contents";
      }
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
      });
    },
    onError: (error: any) => {
      // Error message is now handled directly by throwIfResNotOk
      let errorMessage = error.message || "An unknown error occurred";
      let errorTitle = "Login failed";
      
      // Set appropriate title based on the error message
      if (errorMessage.includes("pending") || errorMessage.includes("approval")) {
        errorTitle = "Account pending approval";
      } else if (errorMessage.includes("blocked")) {
        errorTitle = "Account blocked";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      // Validate data before sending
      registerUserSchema.parse(userData);
      const res = await apiRequest("POST", "/api/register", userData);
      return await res.json();
    },
    onSuccess: (user: AuthResponse) => {
      // If the user has message and is pending, don't set them as logged in
      if (user.message) {
        // Clear any existing user data
        queryClient.setQueryData(["/api/user"], null);
      } else {
        // Set user data if they're immediately approved (admin account)
        queryClient.setQueryData(["/api/user"], user);
      }
      
      // Show appropriate toast message
      toast({
        title: "Registration successful",
        description: user.message || `Welcome, ${user.name}! Your account has been created and is pending approval from an administrator.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You've been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
