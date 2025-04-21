
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
import UserFeedbackPage from "@/pages/user-feedback-page";
import SupportPage from "@/pages/user-feedback/support-page";
import VerificationPage from "@/pages/user-feedback/verification-page";
import TickPage from "@/pages/user-feedback/tick-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Switch>
            <Route path="/login">
              {() => <AuthPage />}
            </Route>
            <Route path="/">
              {() => (
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/content">
              {() => (
                <ProtectedRoute>
                  <ContentPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/content/:id">
              {() => (
                <ProtectedRoute>
                  <ContentEditor />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/users">
              {() => (
                <ProtectedRoute>
                  <UsersPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/real-user">
              {() => (
                <ProtectedRoute>
                  <RealUserPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/profile">
              {() => (
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/activities">
              {() => (
                <ProtectedRoute>
                  <UserActivitiesPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/categories">
              {() => (
                <ProtectedRoute>
                  <CategoriesPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/fake-users">
              {() => (
                <ProtectedRoute>
                  <FakeUsersPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/feedback">
              {() => (
                <ProtectedRoute>
                  <UserFeedbackPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/feedback/support">
              {() => (
                <ProtectedRoute>
                  <SupportPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/feedback/verification">
              {() => (
                <ProtectedRoute>
                  <VerificationPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/feedback/tick">
              {() => (
                <ProtectedRoute>
                  <TickPage />
                </ProtectedRoute>
              )}
            </Route>
            <Route>
              {() => <NotFound />}
            </Route>
          </Switch>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
