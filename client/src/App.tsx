
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
import FakeUsersPage from "@/pages/fake-users-page";
import RealUserPage from "@/pages/real-user-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import UserFeedbackPage from './pages/user-feedback-page';
import SupportPage from './pages/user-feedback/support-page';
import VerificationPage from './pages/user-feedback/verification-page';
import TickPage from './pages/user-feedback/tick-page';

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Switch>
            <Route path="/login" component={AuthPage} />
            <Route path="/" component={() => (
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            )} />
            <Route path="/content" component={() => (
              <ProtectedRoute>
                <ContentPage />
              </ProtectedRoute>
            )} />
            <Route path="/content/:id" component={() => (
              <ProtectedRoute>
                <ContentEditor />
              </ProtectedRoute>
            )} />
            <Route path="/users" component={() => (
              <ProtectedRoute>
                <UsersPage />
              </ProtectedRoute>
            )} />
            <Route path="/real-user" component={() => (
              <ProtectedRoute>
                <RealUserPage />
              </ProtectedRoute>
            )} />
            <Route path="/profile" component={() => (
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            )} />
            <Route path="/activities" component={() => (
              <ProtectedRoute>
                <UserActivitiesPage />
              </ProtectedRoute>
            )} />
            <Route path="/categories" component={() => (
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            )} />
            <Route path="/fake-users" component={() => (
              <ProtectedRoute>
                <FakeUsersPage />
              </ProtectedRoute>
            )} />
            <Route path="/feedback" component={() => (
              <ProtectedRoute>
                <UserFeedbackPage />
              </ProtectedRoute>
            )} />
            <Route path="/feedback/support" component={() => (
              <ProtectedRoute>
                <SupportPage />
              </ProtectedRoute>
            )} />
            <Route path="/feedback/verification" component={() => (
              <ProtectedRoute>
                <VerificationPage />
              </ProtectedRoute>
            )} />
            <Route path="/feedback/tick" component={() => (
              <ProtectedRoute>
                <TickPage />
              </ProtectedRoute>
            )} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
