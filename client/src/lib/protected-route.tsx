import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useLocation } from "wouter";
import NotFound from "@/pages/not-found";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
  adminOnly?: boolean;
  allowedRoles?: string[];
  allowedDepartments?: string[];
}

export function ProtectedRoute({ 
  path, 
  component: Component, 
  adminOnly = false,
  allowedRoles = [],
  allowedDepartments = []
}: ProtectedRouteProps) {
  return (
    <Route path={path}>
      {(params) => {
        const { user, isLoading } = useAuth();

        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          );
        }

        if (!user) {
          return <Redirect to="/auth" replace />;
        }

        // Check admin only routes
        if (adminOnly && user.role !== 'admin') {
          return <Redirect to="/" replace />;
        }

        // Check if user has required role or department
        const hasRequiredRole = allowedRoles.length === 0 || allowedRoles.includes(user.role);
        const hasRequiredDepartment = allowedDepartments.length === 0 || 
          (user.department && allowedDepartments.includes(user.department));

        // Allow access if user has admin role OR required role/department
        const hasAccess = user.role === 'admin' || (hasRequiredRole && hasRequiredDepartment);

        if (!hasAccess) {
          return <Redirect to="/" replace />;
        }

        return <Component {...params} />;
      }}
    </Route>
  );
}