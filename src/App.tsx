import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import MCQPage from "./pages/MCQPage";
import CQPage from "./pages/CQPage";
import ShortPage from "./pages/ShortPage";
import DescriptivePage from "./pages/DescriptivePage";
import PricingPage from "./pages/PricingPage";
import DemoPage from "./pages/DemoPage";
import NotFound from "./pages/NotFound";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import RefundPage from "./pages/RefundPage";

// Dashboard
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import QuestionCreate from "./pages/dashboard/QuestionCreate";
import QuestionBank from "./pages/dashboard/QuestionBank";
import MyQuestions from "./pages/dashboard/MyQuestions";
import Packages from "./pages/dashboard/Packages";
import Institute from "./pages/dashboard/Institute";
import Subscription from "./pages/dashboard/Subscription";
import Contact from "./pages/dashboard/Contact";
import Feedback from "./pages/dashboard/Feedback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public pages with main layout */}
            <Route element={<Layout><Index /></Layout>} path="/" />
            <Route element={<Layout><Login /></Layout>} path="/login" />
            <Route element={<Layout><Register /></Layout>} path="/register" />
            <Route element={<Layout><Profile /></Layout>} path="/profile" />
            <Route element={<Layout><MCQPage /></Layout>} path="/questions/mcq" />
            <Route element={<Layout><CQPage /></Layout>} path="/questions/cq" />
            <Route element={<Layout><ShortPage /></Layout>} path="/questions/short" />
            <Route element={<Layout><DescriptivePage /></Layout>} path="/questions/descriptive" />
            <Route element={<Layout><PricingPage /></Layout>} path="/pricing" />
            <Route element={<Layout><DemoPage /></Layout>} path="/demo" />
            <Route element={<Layout><TermsPage /></Layout>} path="/terms" />
            <Route element={<Layout><PrivacyPage /></Layout>} path="/privacy" />
            <Route element={<Layout><RefundPage /></Layout>} path="/refund" />

            {/* Dashboard pages with sidebar layout */}
            <Route path="/dashboard" element={<DashboardLayout><DashboardHome /></DashboardLayout>} />
            <Route path="/dashboard/create" element={<DashboardLayout><QuestionCreate /></DashboardLayout>} />
            <Route path="/dashboard/question-bank" element={<DashboardLayout><QuestionBank /></DashboardLayout>} />
            <Route path="/dashboard/my-questions" element={<DashboardLayout><MyQuestions /></DashboardLayout>} />
            <Route path="/dashboard/packages" element={<DashboardLayout><Packages /></DashboardLayout>} />
            <Route path="/dashboard/institute" element={<DashboardLayout><Institute /></DashboardLayout>} />
            <Route path="/dashboard/subscription" element={<DashboardLayout><Subscription /></DashboardLayout>} />
            <Route path="/dashboard/contact" element={<DashboardLayout><Contact /></DashboardLayout>} />
            <Route path="/dashboard/feedback" element={<DashboardLayout><Feedback /></DashboardLayout>} />

            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
