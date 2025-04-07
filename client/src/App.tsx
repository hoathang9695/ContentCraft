import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import ContentPage from "@/pages/content-page";
import ContentEditor from "@/pages/content-editor";
import UsersPage from "@/pages/users-page";
import ProfilePage from "@/pages/profile-page";
import UserActivitiesPage from "@/pages/user-activities-page";
import CategoriesPage from "@/pages/categories-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardPage} adminOnly={false} />
      <ProtectedRoute path="/contents" component={ContentPage} />
      <ProtectedRoute path="/contents/new" component={ContentEditor} adminOnly={true} />
      <ProtectedRoute path="/contents/:id/edit" component={ContentEditor} adminOnly={true} />
      <ProtectedRoute path="/users" component={UsersPage} adminOnly={true} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/user-activities" component={UserActivitiesPage} adminOnly={true} />
      <ProtectedRoute path="/categories" component={CategoriesPage} adminOnly={true} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
