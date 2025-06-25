import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import ContentPage from "@/pages/content-page";
import InfringingContentPage from "@/pages/infringing-content-page";
import ContentEditor from "@/pages/content-editor";
import UsersPage from "@/pages/users-page";
import ProfilePage from "@/pages/profile-page";
import UserActivitiesPage from "@/pages/user-activities-page";
import CategoriesPage from "@/pages/categories-page";
import FakeUsersPage from "@/pages/fake-users-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import PageManagementPage from "@/pages/page-management-page";
import GroupsManagementPage from "@/pages/groups-management-page";
import UserFeedbackPage from "@/pages/user-feedback-page";
import SupportPage from "@/pages/user-feedback/support-page";
import VerificationPage from "@/pages/user-feedback/verification-page";
import TickPage from "@/pages/user-feedback/tick-page";
import RealUserPage from "@/pages/real-user-page";
import SettingsPage from "@/pages/settings-page";
import EmailTemplatesPage from '@/pages/email-templates-page';
import { SendNotificationPage } from '@/pages/campaign/send-notification-page';
import { EmailMarketingPage } from '@/pages/campaign/email-marketing-page';
import FeedbackPage from "@/pages/user-feedback/feedback-page";
import ReportManagementPage from "@/pages/report-management-page";
import ReviewReportsPage from "@/pages/review-reports-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardPage} adminOnly={false} />
      <ProtectedRoute path="/infringing-content" component={InfringingContentPage} />
      <ProtectedRoute path="/contents" component={ContentPage} />
      <ProtectedRoute path="/contents/new" component={ContentEditor} adminOnly={false} />
      <ProtectedRoute path="/contents/:id/edit" component={ContentEditor} adminOnly={true} />
      <ProtectedRoute path="/users" component={UsersPage} adminOnly={true} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/user-activities" component={UserActivitiesPage} adminOnly={true} />
      <ProtectedRoute path="/categories" component={CategoriesPage} adminOnly={true} />
      <ProtectedRoute path="/fake-users" component={FakeUsersPage} adminOnly={true} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/page-management" component={PageManagementPage} />
      <Route path="/groups-management" component={GroupsManagementPage} />
      <ProtectedRoute path="/report-management" component={ReportManagementPage} adminOnly={false} />
      <Route path="/review-reports" component={ReviewReportsPage} />
      <Route path="/user-feedback/support" component={SupportPage} />
      <Route path="/user-feedback/verification" component={VerificationPage} />
      <Route path="/user-feedback/tick" component={TickPage} />
      <Route path="/user-feedback/feedback" component={FeedbackPage} />
      <Route path="/real-user" component={RealUserPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} adminOnly={true} />
      <Route path="/email-templates" component={ProtectedRoute(EmailTemplatesPage, ['admin'])} />

              {/* Campaign Routes - Admin and Marketing only */}
              <Route 
                path="/campaign/send-notification" 
                component={ProtectedRoute(SendNotificationPage, ['admin'], ['Marketing'])} 
              />
              <Route 
                path="/campaign/email-marketing" 
                component={ProtectedRoute(EmailMarketingPage, ['admin'], ['Marketing'])} 
              />
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