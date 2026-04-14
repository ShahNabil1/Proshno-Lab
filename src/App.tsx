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
import AuthCallback from "./pages/AuthCallback";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import MCQPage from "./pages/MCQPage";
import CQPage from "./pages/CQPage";
import ShortPage from "./pages/ShortPage";

import PricingPage from "./pages/PricingPage";
import CheckoutPage from "./pages/CheckoutPage";
import DemoPage from "./pages/DemoPage";
import NotFound from "./pages/NotFound";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import RefundPage from "./pages/RefundPage";

// Dashboard
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import QuestionCreate from "./pages/dashboard/QuestionCreate";

import MyQuestions from "./pages/dashboard/MyQuestions";
import Packages from "./pages/dashboard/Packages";
import Institute from "./pages/dashboard/Institute";
import Subscription from "./pages/dashboard/Subscription";
import Contact from "./pages/dashboard/Contact";
import Feedback from "./pages/dashboard/Feedback";
import QuestionPaperView from "./pages/dashboard/QuestionPaperView";

// Admin
import AdminLayout from "./components/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminCrudPage from "./pages/admin/AdminCrudPage";
import AdminTeachers from "./pages/admin/AdminTeachers";
import AdminQuestions from "./pages/admin/AdminQuestions";
import AdminInstitutes from "./pages/admin/AdminInstitutes";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminFeedback from "./pages/admin/AdminFeedback";
import AdminPurchases from "./pages/admin/AdminPurchases";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminChapters from "./pages/admin/AdminChapters";
import AdminTopics from "./pages/admin/AdminTopics";
import AdminTopicQuestions from "./pages/admin/AdminTopicQuestions";
import AdminPackages from "./pages/admin/AdminPackages";
import AdminQuestionReports from "./pages/admin/AdminQuestionReports";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminFaqs from "./pages/admin/AdminFaqs";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminSuggestions from "./pages/admin/AdminSuggestions";
import AdminAdvanced from "./pages/admin/AdminAdvanced";
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
            <Route element={<AuthCallback />} path="/auth/callback" />
            <Route element={<Layout><Register /></Layout>} path="/register" />
            <Route element={<Layout><Profile /></Layout>} path="/profile" />
            <Route element={<Layout><MCQPage /></Layout>} path="/questions/mcq" />
            <Route element={<Layout><CQPage /></Layout>} path="/questions/cq" />
            <Route element={<Layout><ShortPage /></Layout>} path="/questions/short" />
            
            <Route element={<Layout><PricingPage /></Layout>} path="/pricing" />
            <Route element={<Layout><CheckoutPage /></Layout>} path="/checkout" />
            <Route element={<Layout><DemoPage /></Layout>} path="/demo" />
            <Route element={<Layout><TermsPage /></Layout>} path="/terms" />
            <Route element={<Layout><PrivacyPage /></Layout>} path="/privacy" />
            <Route element={<Layout><RefundPage /></Layout>} path="/refund" />

            {/* Dashboard */}
            <Route path="/dashboard" element={<DashboardLayout><DashboardHome /></DashboardLayout>} />
            <Route path="/dashboard/create" element={<DashboardLayout><QuestionCreate /></DashboardLayout>} />
            
            <Route path="/dashboard/my-questions" element={<DashboardLayout><MyQuestions /></DashboardLayout>} />
            <Route path="/dashboard/packages" element={<DashboardLayout><Packages /></DashboardLayout>} />
            <Route path="/dashboard/institute" element={<DashboardLayout><Institute /></DashboardLayout>} />
            <Route path="/dashboard/subscription" element={<DashboardLayout><Subscription /></DashboardLayout>} />
            <Route path="/dashboard/contact" element={<DashboardLayout><Contact /></DashboardLayout>} />
            <Route path="/dashboard/feedback" element={<DashboardLayout><Feedback /></DashboardLayout>} />
            <Route path="/dashboard/view-paper" element={<DashboardLayout><QuestionPaperView /></DashboardLayout>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminLayout><AdminHome /></AdminLayout>} />
            <Route path="/admin/classes" element={<AdminLayout><AdminCrudPage title="শ্রেণী ম্যানেজমেন্ট" table="classes" /></AdminLayout>} />
            <Route path="/admin/subjects" element={<AdminLayout><AdminCrudPage title="বিষয় ম্যানেজমেন্ট" table="subjects" parentTable="classes" parentLabel="শ্রেণী" parentKey="class_id" /></AdminLayout>} />
            <Route path="/admin/chapters" element={<AdminLayout><AdminChapters /></AdminLayout>} />
            
            <Route path="/admin/questions" element={<AdminLayout><AdminQuestions /></AdminLayout>} />
            <Route path="/admin/teachers" element={<AdminLayout><AdminTeachers /></AdminLayout>} />
            <Route path="/admin/institutes" element={<AdminLayout><AdminInstitutes /></AdminLayout>} />
            <Route path="/admin/subscriptions" element={<AdminLayout><AdminSubscriptions /></AdminLayout>} />
            <Route path="/admin/topics" element={<AdminLayout><AdminTopics /></AdminLayout>} />
            <Route path="/admin/topic-questions" element={<AdminLayout><AdminTopicQuestions /></AdminLayout>} />
            <Route path="/admin/feedback" element={<AdminLayout><AdminFeedback /></AdminLayout>} />
            <Route path="/admin/purchases" element={<AdminLayout><AdminPurchases /></AdminLayout>} />
            <Route path="/admin/coupons" element={<AdminLayout><AdminCoupons /></AdminLayout>} />
            <Route path="/admin/packages" element={<AdminLayout><AdminPackages /></AdminLayout>} />
            <Route path="/admin/question-reports" element={<AdminLayout><AdminQuestionReports /></AdminLayout>} />
            <Route path="/admin/announcements" element={<AdminLayout><AdminAnnouncements /></AdminLayout>} />
            <Route path="/admin/faqs" element={<AdminLayout><AdminFaqs /></AdminLayout>} />
            <Route path="/admin/reviews" element={<AdminLayout><AdminReviews /></AdminLayout>} />
            <Route path="/admin/analytics" element={<AdminLayout><AdminAnalytics /></AdminLayout>} />
            <Route path="/admin/advanced" element={<AdminLayout><AdminAdvanced /></AdminLayout>} />

            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
