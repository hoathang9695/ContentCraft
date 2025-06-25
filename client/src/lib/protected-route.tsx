import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import NotFound from "@/pages/not-found";

export function ProtectedRoute(
  Component: React.ComponentType<any>,
  allowedRoles: string[] = [],
  allowedDepartments: string[] = []
) {
  return function ProtectedComponent(props: any) {
    const { user, isLoading } = useAuth();

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!user) {
      return <Navigate to="/auth" replace />;
    }

    // Check if user has required role or department
    const hasRequiredRole = allowedRoles.length === 0 || allowedRoles.includes(user.role);
    const hasRequiredDepartment = allowedDepartments.length === 0 || 
      (user.department && allowedDepartments.includes(user.department));

    // Allow access if user has admin role OR required department
    const hasAccess = user.role === 'admin' || (hasRequiredRole && hasRequiredDepartment);

    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }

    return <Component {...props} />;
  };
}