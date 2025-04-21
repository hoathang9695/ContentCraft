
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
              <Route path="/login" component={AuthPage} />
              <Route path="/real-user" component={() => (
                <ProtectedRoute>
                  <RealUserPage />
                </ProtectedRoute>
              )} />
              <Route path="/content/:id" component={() => (
                <ProtectedRoute>
                  <ContentEditor />
                </ProtectedRoute>
              )} />
              <Route path="/content" component={() => (
                <ProtectedRoute>
                  <ContentPage />
                </ProtectedRoute>
              )} />
              <Route path="/users" component={() => (
                <ProtectedRoute>
                  <UsersPage />
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
              <Route path="/" component={() => (
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              )} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
