import { BrowserRouter, Routes, Route } from "react-router-dom";
import './App.css';
import SignUpPage from "./features/auth/signupPage.jsx";
import LoginPage from "./features/auth/loginPage.jsx";
import ResetPasswordPage from "./features/auth/resetPasswordPage.jsx";
import GroupDetailPage from "./features/groups/GroupDetailPage.jsx";
import SchedulePage from "./features/schedules/SchedulePage.jsx";
import MyGroupsPage from "./features/groups/MyGroupsPage.jsx";
import SettingsPage from "./features/settings/SettingsPage.jsx";
import DefaultLayout from "./layouts/DefaultLayout.jsx";
import LandingPage from "./features/landing/LandingPage.jsx";
import { ProtectedRoute, PublicRoute } from "./components/RouteGuards.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import InvitePage from "./features/auth/InvitePage.jsx";
import { ProfileProvider } from "./contexts/ProfileContext.jsx";
import { NotificationsProvider } from "./contexts/NotificationsContext.jsx";
import { SessionProvider } from "./contexts/SessionContext.jsx";

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <NotificationsProvider>
          <Routes>
            <Route element={<DefaultLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route element={<PublicRoute />}>
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>
              <Route path="/invite/:inviteCode" element={<InvitePage />} />
            </Route>

            <Route
              element={(
                <ProtectedRoute>
                  <ProfileProvider>
                    <AppLayout />
                  </ProfileProvider>
                </ProtectedRoute>
              )}
            >
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/mygroups" element={<MyGroupsPage />} />
              <Route path="/groups/:groupId" element={<GroupDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </NotificationsProvider>
      </BrowserRouter>
    </SessionProvider>
  )
}

export default App
