import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";

const NotFound = lazy(() => import("@/pages/not-found"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const ContentPage = lazy(() => import("@/pages/content-page"));
const ContentEditor = lazy(() => import("@/pages/content-editor"));
const UsersPage = lazy(() => import("@/pages/users-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const UserActivitiesPage = lazy(() => import("@/pages/user-activities-page"));
const CategoriesPage = lazy(() => import("@/pages/categories-page"));  
const FakeUsersPage = lazy(() => import("@/pages/fake-users-page"));
const RealUserPage = lazy(() => import("@/pages/real-user-page"));
const UserFeedbackPage = lazy(() => import("@/pages/user-feedback-page"));
const SupportPage = lazy(() => import("@/pages/user-feedback/support-page"));
const VerificationPage = lazy(() => import("@/pages/user-feedback/verification-page"));
const TickPage = lazy(() => import("@/pages/user-feedback/tick-page"));

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <Switch>
              <Route path="/login">
                <AuthPage />
              </Route>
              <Route path="/">
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              </Route>
              <Route path="/content">
                <ProtectedRoute>
                  <ContentPage />
                </ProtectedRoute>
              </Route>
              <Route path="/content/:id">
                <ProtectedRoute>
                  <ContentEditor />
                </ProtectedRoute>
              </Route>
              <Route path="/users">
                <ProtectedRoute>
                  <UsersPage />
                </ProtectedRoute>
              </Route>
              <Route path="/real-user">
                <ProtectedRoute>
                  <RealUserPage />
                </ProtectedRoute>
              </Route>
              <Route path="/profile">
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              </Route>
              <Route path="/activities">
                <ProtectedRoute>
                  <UserActivitiesPage />
                </ProtectedRoute>
              </Route>
              <Route path="/categories">
                <ProtectedRoute>
                  <CategoriesPage />
                </ProtectedRoute>
              </Route>
              <Route path="/fake-users">
                <ProtectedRoute>
                  <FakeUsersPage />
                </ProtectedRoute>
              </Route>
              <Route path="/feedback">
                <ProtectedRoute>
                  <UserFeedbackPage />
                </ProtectedRoute>
              </Route>
              <Route path="/feedback/support">
                <ProtectedRoute>
                  <SupportPage />
                </ProtectedRoute>
              </Route>
              <Route path="/feedback/verification">
                <ProtectedRoute>
                  <VerificationPage />
                </ProtectedRoute>
              </Route>
              <Route path="/feedback/tick">
                <ProtectedRoute>
                  <TickPage />
                </ProtectedRoute>
              </Route>
              <Route>
                <NotFound />
              </Route>
            </Switch>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}