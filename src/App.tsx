import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ScrollToTop from "@/components/ScrollToTop";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import EmailLogin from "./pages/EmailLogin";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import MCQPage from "./pages/MCQPage";
import CQPage from "./pages/CQPage";
import ShortPage from "./pages/ShortPage";

import PricingPage from "./pages/PricingPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentCallback from "./pages/PaymentCallback";
import DemoPage from "./pages/DemoPage";
import NotFound from "./pages/NotFound";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import RefundPage from "./pages/RefundPage";

// Dashboard
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import QuestionCreateHub from "./pages/dashboard/QuestionCreateHub";

import MyQuestions from "./pages/dashboard/MyQuestions";
import Packages from "./pages/dashboard/Packages";
import Institute from "./pages/dashboard/Institute";
import Subscription from "./pages/dashboard/Subscription";
import Contact from "./pages/dashboard/Contact";
import Feedback from "./pages/dashboard/Feedback";
import QuestionPaperView from "./pages/dashboard/QuestionPaperView";
import SmartBoard from "./pages/dashboard/SmartBoard";
import FeatureComingSoon from "./pages/dashboard/FeatureComingSoon";
import OmrTutorial from "./pages/dashboard/omr/OmrTutorial";
import OmrCreate from "./pages/dashboard/omr/OmrCreate";
import OmrTokens from "./pages/dashboard/omr/OmrTokens";
import OmrEvaluation from "./pages/dashboard/omr/OmrEvaluation";

// Admin
import AdminLayout from "./components/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminCrudPage from "./pages/admin/AdminCrudPage";
import AdminTeachers from "./pages/admin/AdminTeachers";
import AdminQuestions from "./pages/admin/AdminQuestions";
import AdminQuestionsBulk from "./pages/admin/AdminQuestionsBulk";
import AdminInstitutes from "./pages/admin/AdminInstitutes";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminFeedback from "./pages/admin/AdminFeedback";

import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminChapters from "./pages/admin/AdminChapters";
import AdminTopics from "./pages/admin/AdminTopics";
import AdminTopicQuestions from "./pages/admin/AdminTopicQuestions";
import AdminPackages from "./pages/admin/AdminPackages";
import AdminQuestionReports from "./pages/admin/AdminQuestionReports";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminSuggestions from "./pages/admin/AdminSuggestions";
import AdminAdvanced from "./pages/admin/AdminAdvanced";
import AdminHomepageVideo from "./pages/admin/AdminHomepageVideo";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            {/* Public pages */}
            <Route element={<Layout><Index /></Layout>} path="/" />
            <Route element={<Layout><Login /></Layout>} path="/login" />
            <Route element={<Layout><EmailLogin /></Layout>} path="/login/email" />
            <Route element={<Layout><ResetPassword /></Layout>} path="/reset-password" />
            <Route element={<AuthCallback />} path="/auth/callback" />
            <Route element={<Layout><Register /></Layout>} path="/register" />
            <Route element={<Layout><Profile /></Layout>} path="/profile" />
            <Route element={<Layout><MCQPage /></Layout>} path="/questions/mcq" />
            <Route element={<Layout><CQPage /></Layout>} path="/questions/cq" />
            <Route element={<Layout><ShortPage /></Layout>} path="/questions/short" />
            
            <Route element={<Layout><PricingPage /></Layout>} path="/pricing" />
            <Route element={<Layout><CheckoutPage /></Layout>} path="/checkout" />
            <Route element={<PaymentCallback />} path="/payment/callback" />
            <Route element={<Layout><DemoPage /></Layout>} path="/demo" />
            <Route element={<Layout><TermsPage /></Layout>} path="/terms" />
            <Route element={<Layout><PrivacyPage /></Layout>} path="/privacy" />
            <Route element={<Layout><RefundPage /></Layout>} path="/refund" />
            <Route element={<Layout><Contact /></Layout>} path="/helpline" />

            {/* Dashboard */}
            <Route path="/dashboard" element={<DashboardLayout><DashboardHome /></DashboardLayout>} />
            <Route path="/dashboard/create" element={<DashboardLayout><QuestionCreateHub /></DashboardLayout>} />
            
            <Route path="/dashboard/my-questions" element={<DashboardLayout><MyQuestions /></DashboardLayout>} />
            <Route path="/dashboard/packages" element={<DashboardLayout><Packages /></DashboardLayout>} />
            <Route path="/dashboard/institute" element={<DashboardLayout><Institute /></DashboardLayout>} />
            <Route path="/dashboard/subscription" element={<DashboardLayout><Subscription /></DashboardLayout>} />
            <Route path="/dashboard/contact" element={<DashboardLayout><Contact /></DashboardLayout>} />
            <Route path="/dashboard/feedback" element={<DashboardLayout><Feedback /></DashboardLayout>} />
            <Route path="/dashboard/view-paper" element={<DashboardLayout><QuestionPaperView /></DashboardLayout>} />
            <Route path="/dashboard/smartboard" element={<DashboardLayout><SmartBoard /></DashboardLayout>} />
            <Route path="/dashboard/students" element={<DashboardLayout><FeatureComingSoon /></DashboardLayout>} />
            <Route path="/dashboard/omr-tutorial" element={<DashboardLayout><OmrTutorial /></DashboardLayout>} />
            <Route path="/dashboard/omr-create" element={<DashboardLayout><OmrCreate /></DashboardLayout>} />
            <Route path="/dashboard/omr-tokens" element={<DashboardLayout><OmrTokens /></DashboardLayout>} />
            <Route path="/dashboard/omr-evaluation" element={<DashboardLayout><OmrEvaluation /></DashboardLayout>} />
            <Route path="/dashboard/affiliate" element={<DashboardLayout><FeatureComingSoon /></DashboardLayout>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminLayout><AdminHome /></AdminLayout>} />
            <Route path="/admin/classes" element={<AdminLayout><AdminCrudPage title="শ্রেণী ম্যানেজমেন্ট" table="classes" /></AdminLayout>} />
            <Route path="/admin/subjects" element={<AdminLayout><AdminCrudPage title="বিষয় ম্যানেজমেন্ট" table="subjects" parentTable="classes" parentLabel="শ্রেণী" parentKey="class_id" /></AdminLayout>} />
            <Route path="/admin/chapters" element={<AdminLayout><AdminChapters /></AdminLayout>} />
            
            <Route path="/admin/questions" element={<AdminLayout><AdminQuestions /></AdminLayout>} />
            <Route path="/admin/questions/bulk" element={<AdminLayout><AdminQuestionsBulk /></AdminLayout>} />
            <Route path="/admin/teachers" element={<AdminLayout><AdminTeachers /></AdminLayout>} />
            <Route path="/admin/institutes" element={<AdminLayout><AdminInstitutes /></AdminLayout>} />
            <Route path="/admin/subscriptions" element={<AdminLayout><AdminSubscriptions /></AdminLayout>} />
            <Route path="/admin/topics" element={<AdminLayout><AdminTopics /></AdminLayout>} />
            <Route path="/admin/topic-questions" element={<AdminLayout><AdminTopicQuestions /></AdminLayout>} />
            <Route path="/admin/feedback" element={<AdminLayout><AdminFeedback /></AdminLayout>} />
            
            <Route path="/admin/coupons" element={<AdminLayout><AdminCoupons /></AdminLayout>} />
            <Route path="/admin/packages" element={<AdminLayout><AdminPackages /></AdminLayout>} />
            <Route path="/admin/question-reports" element={<AdminLayout><AdminQuestionReports /></AdminLayout>} />
            <Route path="/admin/announcements" element={<AdminLayout><AdminAnnouncements /></AdminLayout>} />
            <Route path="/admin/reviews" element={<AdminLayout><AdminReviews /></AdminLayout>} />
            <Route path="/admin/analytics" element={<AdminLayout><AdminAnalytics /></AdminLayout>} />
            <Route path="/admin/homepage-video" element={<AdminLayout><AdminHomepageVideo /></AdminLayout>} />
            <Route path="/admin/advanced" element={<AdminLayout><AdminAdvanced /></AdminLayout>} />

            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
