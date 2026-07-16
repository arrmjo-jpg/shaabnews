import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { NewspaperEnabledRoute } from './NewspaperEnabledRoute';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import LoginPage from '@/features/auth/pages/LoginPage';
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage';
import VerifyEmailPage from '@/features/auth/pages/VerifyEmailPage';
import SettingsLayoutPage from '@/features/settings/pages/SettingsLayoutPage';
import GeneralSettingsPage from '@/features/settings/pages/GeneralSettingsPage';
import BrandingSettingsPage from '@/features/settings/pages/BrandingSettingsPage';
import EmailSettingsPage from '@/features/settings/pages/EmailSettingsPage';
import SocialSettingsPage from '@/features/settings/pages/SocialSettingsPage';
import AnalyticsSettingsPage from '@/features/settings/pages/AnalyticsSettingsPage';
import MediaStorageSettingsPage from '@/features/settings/pages/MediaStorageSettingsPage';
import NewspaperSettingsPage from '@/features/settings/pages/NewspaperSettingsPage';
import MatchBarSettingsPage from '@/features/sport/pages/MatchBarSettingsPage';
import CompetitionsPage from '@/features/sport/pages/CompetitionsPage';
import ThirdPartyLayoutPage from '@/features/third-party/pages/ThirdPartyLayoutPage';
import SocialLoginPage from '@/features/third-party/pages/SocialLoginPage';
import RecaptchaPage from '@/features/third-party/pages/RecaptchaPage';
import FirebasePage from '@/features/third-party/pages/FirebasePage';
import GoogleMapsPage from '@/features/third-party/pages/GoogleMapsPage';
import AiProvidersPage from '@/features/third-party/pages/AiProvidersPage';
import WhatsappPage from '@/features/third-party/pages/WhatsappPage';
import AppLinksPage from '@/features/third-party/pages/AppLinksPage';
import IntegrationsPage from '@/features/third-party/pages/IntegrationsPage';
import CdnPage from '@/features/cdn/pages/CdnPage';
import SchedulerPage from '@/features/system/pages/SchedulerPage';
import OpsOverviewPage from '@/features/system/pages/OpsOverviewPage';
import FailedJobsPage from '@/features/system/pages/FailedJobsPage';
import DiagnosticsPage from '@/features/system/pages/DiagnosticsPage';
import AiUsagePage from '@/features/ai/pages/AiUsagePage';
import UsersPage from '@/features/user-management/pages/UsersPage';
import TeamMembersPage from '@/features/team/pages/TeamMembersPage';
import TeamMemberFormPage from '@/features/team/pages/TeamMemberFormPage';
import UserFormPage from '@/features/user-management/pages/UserFormPage';
import RolesPage from '@/features/user-management/pages/RolesPage';
import PermissionsPage from '@/features/user-management/pages/PermissionsPage';
import PermissionGroupsPage from '@/features/user-management/pages/PermissionGroupsPage';
import WriterRequestsPage from '@/features/user-management/pages/WriterRequestsPage';
import ProfilePage from '@/features/profile/pages/ProfilePage';
import ChatPage from '@/features/chat/pages/ChatPage';
import ContactUsPage from '@/features/contact/pages/ContactUsPage';
import ActivityLogPage from '@/features/user-management/pages/ActivityLogPage';
import ArticlesPage from '@/features/content/pages/ArticlesPage';
import ArticleFormPage from '@/features/content/pages/ArticleFormPage';
import ArticleAnalyticsPage from '@/features/content/pages/ArticleAnalyticsPage';
import ArticleAnalyticsOverviewPage from '@/features/content/pages/ArticleAnalyticsOverviewPage';
import ReviewQueuePage from '@/features/content/pages/ReviewQueuePage';
import CategoriesPage from '@/features/content/pages/CategoriesPage';
import TagsPage from '@/features/content/pages/TagsPage';
import CommentsModerationPage from '@/features/content/pages/CommentsModerationPage';
import ReelsPage from '@/features/content/pages/ReelsPage';
import ReelFormPage from '@/features/content/pages/ReelFormPage';
import ReelAnalyticsPage from '@/features/content/pages/ReelAnalyticsPage';
import ReelAnalyticsOverviewPage from '@/features/content/pages/ReelAnalyticsOverviewPage';
import PagesPage from '@/features/content/pages/PagesPage';
import PageFormPage from '@/features/content/pages/PageFormPage';
import LiveCoverageConsole from '@/features/content/pages/LiveCoverageConsole';
import MediaLibraryPage from '@/features/content/pages/MediaLibraryPage';
import VideoDashboardPage from '@/features/video-library/pages/VideoDashboardPage';
import VideosPage from '@/features/video-library/pages/VideosPage';
import VideoFormPage from '@/features/video-library/pages/VideoFormPage';
import VideoCategoriesPage from '@/features/video-library/pages/VideoCategoriesPage';
import PlaylistsPage from '@/features/video-library/pages/PlaylistsPage';
import PlaylistFormPage from '@/features/video-library/pages/PlaylistFormPage';
import AnalyticsPage from '@/features/video-library/pages/AnalyticsPage';
import VideoAnalyticsPage from '@/features/video-library/pages/VideoAnalyticsPage';
import OperationsPage from '@/features/video-library/pages/OperationsPage';
import CommandCenterPage from '@/features/broadcast/pages/CommandCenterPage';
import BroadcastsPage from '@/features/broadcast/pages/BroadcastsPage';
import BroadcastFormPage from '@/features/broadcast/pages/BroadcastFormPage';
import BroadcastCategoriesPage from '@/features/broadcast/pages/BroadcastCategoriesPage';
import BroadcastAnalyticsPage from '@/features/broadcast/pages/BroadcastAnalyticsPage';
import MigrationConsolePage from '@/features/wp-migration/pages/MigrationConsolePage';
import VertixMigrationPage from '@/features/vertix/pages/VertixMigrationPage';
import EpapersPage from '@/features/epaper/pages/EpapersPage';
import EpaperFormPage from '@/features/epaper/pages/EpaperFormPage';
import EpaperAnalyticsDashboardPage from '@/features/epaper/pages/EpaperAnalyticsDashboardPage';
import WhatsappGroupsPage from '@/features/whatsapp/pages/WhatsappGroupsPage';
import WhatsappContactsPage from '@/features/whatsapp/pages/WhatsappContactsPage';
import WhatsappCampaignsPage from '@/features/whatsapp/pages/WhatsappCampaignsPage';
import WhatsappCampaignFormPage from '@/features/whatsapp/pages/WhatsappCampaignFormPage';
import WhatsappCampaignDetailPage from '@/features/whatsapp/pages/WhatsappCampaignDetailPage';
import CampaignsPage from '@/features/advertising/pages/CampaignsPage';
import CampaignFormPage from '@/features/advertising/pages/CampaignFormPage';
import AdZonesPage from '@/features/advertising/pages/AdZonesPage';
import AdZoneFormPage from '@/features/advertising/pages/AdZoneFormPage';
import CreativesPage from '@/features/advertising/pages/CreativesPage';
import CreativeFormPage from '@/features/advertising/pages/CreativeFormPage';
import AdPlacementsPage from '@/features/advertising/pages/PlacementsPage';
import AdsAnalyticsPage from '@/features/advertising/pages/AdsAnalyticsPage';
import PollsPage from '@/features/polls/pages/PollsPage';
import PollFormPage from '@/features/polls/pages/PollFormPage';
import PollsTrashPage from '@/features/polls/pages/PollsTrashPage';
import PollAnalyticsOverviewPage from '@/features/polls/pages/PollAnalyticsOverviewPage';
import PollAnalyticsPage from '@/features/polls/pages/PollAnalyticsPage';
import NotifDashboardPage from '@/features/notifications/pages/NotificationsDashboardPage';
import NotifCampaignsPage from '@/features/notifications/pages/CampaignsPage';
import NotifCampaignDetailPage from '@/features/notifications/pages/CampaignDetailPage';
import NotifChannelHealthPage from '@/features/notifications/pages/ChannelHealthPage';
import NotifComposerPage from '@/features/notifications/pages/CampaignComposerPage';
import NotifEventMatrixPage from '@/features/notifications/pages/EventMatrixPage';
import NotifTemplatesPage from '@/features/notifications/pages/TemplatesPage';
import NotifSettingsPage from '@/features/notifications/pages/NotificationSettingsPage';
import { RouteError } from '@/components/RouteError';
import { paths } from './paths';

/**
 * أماكن الصفحات placeholder الآن — تُملأ في الخطوات 3–7.
 * البنية والحماية مكتملة في هذه الخطوة.
 */
export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      { path: paths.login, element: <LoginPage /> },
      { path: paths.forgotPassword, element: <ForgotPasswordPage /> },
      { path: paths.resetPassword, element: <ResetPasswordPage /> },
    ],
  },
  {
    // مستقل عن AuthLayout/AdminLayout — يُتاح للمصادَق وغير المصادَق
    // (تجنّب حلقة إعادة التوجيه عند البريد غير المؤكَّد).
    path: paths.verifyEmail,
    errorElement: <RouteError />,
    element: (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          <VerifyEmailPage />
        </div>
      </div>
    ),
  },
  {
    element: <AdminLayout />,
    errorElement: <RouteError />,
    children: [
      { path: paths.dashboard, element: <DashboardPage /> },
      { path: paths.profile, element: <ProfilePage /> },
      { path: paths.chat, element: <ChatPage /> },
      {
        path: paths.contactUs,
        element: (
          <ProtectedRoute anyPermission={['contact-messages.view', 'ad-requests.view']}>
            <ContactUsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.usersCreate,
        element: (
          <ProtectedRoute permission="users.create">
            <UserFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.usersEdit,
        element: (
          <ProtectedRoute permission="users.edit">
            <UserFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.users,
        element: (
          <ProtectedRoute permission="users.view">
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.teamMembers,
        element: (
          <ProtectedRoute permission="team.view">
            <TeamMembersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.teamMembersCreate,
        element: (
          <ProtectedRoute permission="team.create">
            <TeamMemberFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.teamMembersEdit,
        element: (
          <ProtectedRoute permission="team.edit">
            <TeamMemberFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.roles,
        element: (
          <ProtectedRoute permission="roles.view">
            <RolesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.permissions,
        element: (
          <ProtectedRoute permission="permissions.view">
            <PermissionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.permissionGroups,
        element: (
          <ProtectedRoute permission="permission-groups.view">
            <PermissionGroupsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.writerRequests,
        element: (
          <ProtectedRoute permission="writer-requests.view">
            <WriterRequestsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.activityLog,
        element: (
          <ProtectedRoute permission="activity.view">
            <ActivityLogPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.settings,
        element: (
          <ProtectedRoute permission="settings.view">
            <SettingsLayoutPage />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to={paths.settingsGeneral} replace /> },
          { path: paths.settingsGeneral, element: <GeneralSettingsPage /> },
          { path: paths.settingsBranding, element: <BrandingSettingsPage /> },
          { path: paths.settingsEmail, element: <EmailSettingsPage /> },
          { path: paths.settingsSocial, element: <SocialSettingsPage /> },
          { path: paths.settingsAnalytics, element: <AnalyticsSettingsPage /> },
          { path: paths.settingsMediaStorage, element: <MediaStorageSettingsPage /> },
          { path: paths.settingsNewspaper, element: <NewspaperSettingsPage /> },
          { path: paths.settingsMatchBar, element: <MatchBarSettingsPage /> },
        ],
      },
      {
        path: paths.thirdParty,
        element: (
          <ProtectedRoute permission="settings.view">
            <ThirdPartyLayoutPage />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to={paths.tpSocialLogin} replace /> },
          { path: paths.tpSocialLogin, element: <SocialLoginPage /> },
          { path: paths.tpRecaptcha, element: <RecaptchaPage /> },
          { path: paths.tpFirebase, element: <FirebasePage /> },
          { path: paths.tpGoogleMaps, element: <GoogleMapsPage /> },
          { path: paths.tpAi, element: <AiProvidersPage /> },
          { path: paths.tpWhatsapp, element: <WhatsappPage /> },
          { path: paths.tpAppLinks, element: <AppLinksPage /> },
          { path: paths.tpIntegrations, element: <IntegrationsPage /> },
        ],
      },
      {
        path: paths.cdn,
        element: (
          <ProtectedRoute permission="cdn.view">
            <CdnPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.scheduler,
        element: (
          <ProtectedRoute permission="scheduler.view">
            <SchedulerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.opsOverview,
        element: (
          <ProtectedRoute permission="scheduler.view">
            <OpsOverviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.failedJobs,
        element: (
          <ProtectedRoute permission="failed_jobs.view">
            <FailedJobsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.diagnostics,
        element: (
          <ProtectedRoute permission="scheduler.view">
            <DiagnosticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.aiUsage,
        element: (
          <ProtectedRoute permission="ai.settings">
            <AiUsagePage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.articles,
        element: (
          <ProtectedRoute permission="articles.view">
            <ArticlesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.articlesCreate,
        element: (
          <ProtectedRoute permission="articles.create">
            <ArticleFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.articlesEdit,
        element: (
          <ProtectedRoute permission="articles.edit">
            <ArticleFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.articlesLive,
        element: (
          <ProtectedRoute permission="articles.edit">
            <LiveCoverageConsole />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.articlesAnalytics,
        element: (
          <ProtectedRoute permission="articles.view">
            <ArticleAnalyticsOverviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.articleAnalytics,
        element: (
          <ProtectedRoute permission="articles.view">
            <ArticleAnalyticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.reviewQueue,
        element: (
          <ProtectedRoute permission="articles.view">
            <ReviewQueuePage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.categories,
        element: (
          <ProtectedRoute permission="categories.view">
            <CategoriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.tags,
        element: (
          <ProtectedRoute permission="tags.view">
            <TagsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.comments,
        element: (
          <ProtectedRoute permission="comments.view">
            <CommentsModerationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.reels,
        element: (
          <ProtectedRoute permission="reels.view">
            <ReelsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.reelsCreate,
        element: (
          <ProtectedRoute permission="reels.create">
            <ReelFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.reelsEdit,
        element: (
          <ProtectedRoute permission="reels.edit">
            <ReelFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.reelsAnalytics,
        element: (
          <ProtectedRoute permission="reels.view">
            <ReelAnalyticsOverviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.reelAnalytics,
        element: (
          <ProtectedRoute permission="reels.view">
            <ReelAnalyticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.pagesList,
        element: (
          <ProtectedRoute permission="pages.view">
            <PagesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.pagesCreate,
        element: (
          <ProtectedRoute permission="pages.create">
            <PageFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.pagesEdit,
        element: (
          <ProtectedRoute permission="pages.edit">
            <PageFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.media,
        element: (
          <ProtectedRoute permission="media.view">
            <MediaLibraryPage />
          </ProtectedRoute>
        ),
      },
      // ─── Video Library (مكتبة الفيديو) ─────────────────────────────────
      { path: paths.videoLibrary, element: <Navigate to={paths.vlDashboard} replace /> },
      {
        path: paths.vlDashboard,
        element: (
          <ProtectedRoute permission="videos.view">
            <VideoDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlVideos,
        element: (
          <ProtectedRoute permission="videos.view">
            <VideosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlVideosCreate,
        element: (
          <ProtectedRoute permission="videos.create">
            <VideoFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlVideosEdit,
        element: (
          <ProtectedRoute permission="videos.edit">
            <VideoFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlVideoAnalytics,
        element: (
          <ProtectedRoute permission="videos.view">
            <VideoAnalyticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlCategories,
        element: (
          <ProtectedRoute permission="video-categories.view">
            <VideoCategoriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.competitions,
        element: (
          <ProtectedRoute permission="competitions.view">
            <CompetitionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlPlaylists,
        element: (
          <ProtectedRoute permission="video-playlists.view">
            <PlaylistsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlPlaylistsCreate,
        element: (
          <ProtectedRoute permission="video-playlists.manage">
            <PlaylistFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlPlaylistsEdit,
        element: (
          <ProtectedRoute permission="video-playlists.manage">
            <PlaylistFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlAnalytics,
        element: (
          <ProtectedRoute permission="videos.view">
            <AnalyticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.vlOperations,
        element: (
          <ProtectedRoute permission="videos.view">
            <OperationsPage />
          </ProtectedRoute>
        ),
      },
      // ─── Broadcast (مركز قيادة البث) ───────────────────────────────────
      { path: paths.broadcast, element: <Navigate to={paths.bcDashboard} replace /> },
      {
        path: paths.bcDashboard,
        element: (
          <ProtectedRoute permission="broadcasts.view">
            <CommandCenterPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.bcBroadcasts,
        element: (
          <ProtectedRoute permission="broadcasts.view">
            <BroadcastsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.bcBroadcastsCreate,
        element: (
          <ProtectedRoute permission="broadcasts.create">
            <BroadcastFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.bcBroadcastsEdit,
        element: (
          <ProtectedRoute permission="broadcasts.edit">
            <BroadcastFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.bcBroadcastAnalytics,
        element: (
          <ProtectedRoute permission="broadcasts.view">
            <BroadcastAnalyticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.bcCategories,
        element: (
          <ProtectedRoute permission="broadcast-categories.view">
            <BroadcastCategoriesPage />
          </ProtectedRoute>
        ),
      },
      // ─── Epaper (الجريدة الرقمية) ──────────────────────────────────────
      { path: paths.epaper, element: <Navigate to={paths.epaperIssues} replace /> },
      {
        path: paths.epaperIssues,
        element: (
          <NewspaperEnabledRoute>
            <ProtectedRoute permission="epapers.view">
              <EpapersPage />
            </ProtectedRoute>
          </NewspaperEnabledRoute>
        ),
      },
      {
        path: paths.epaperAnalytics,
        element: (
          <NewspaperEnabledRoute>
            <ProtectedRoute permission="epapers.view">
              <EpaperAnalyticsDashboardPage />
            </ProtectedRoute>
          </NewspaperEnabledRoute>
        ),
      },
      {
        path: paths.epaperIssuesCreate,
        element: (
          <NewspaperEnabledRoute>
            <ProtectedRoute permission="epapers.create">
              <EpaperFormPage />
            </ProtectedRoute>
          </NewspaperEnabledRoute>
        ),
      },
      {
        path: paths.epaperIssuesEdit,
        element: (
          <NewspaperEnabledRoute>
            <ProtectedRoute permission="epapers.edit">
              <EpaperFormPage />
            </ProtectedRoute>
          </NewspaperEnabledRoute>
        ),
      },
      // ─── WordPress Migration (Discovery → Execution) ───────────────────
      {
        path: paths.wpMigration,
        element: (
          <ProtectedRoute permission="wp-migration.view">
            <MigrationConsolePage />
          </ProtectedRoute>
        ),
      },
      // ─── Vertix Migration (نظام مستقلّ) ────────────────────────────────
      {
        path: paths.vertixMigration,
        element: (
          <ProtectedRoute permission="vertix-migration.view">
            <VertixMigrationPage />
          </ProtectedRoute>
        ),
      },
      // ─── Advertising (الإعلانات) ───────────────────────────────────────
      { path: paths.advertising, element: <Navigate to={paths.adCampaigns} replace /> },
      {
        path: paths.adCampaigns,
        element: (
          <ProtectedRoute permission="ads.view">
            <CampaignsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adCampaignsCreate,
        element: (
          <ProtectedRoute permission="ads.create">
            <CampaignFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adCampaignsEdit,
        element: (
          <ProtectedRoute permission="ads.edit">
            <CampaignFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adZones,
        element: (
          <ProtectedRoute permission="ad-zones.view">
            <AdZonesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adZonesCreate,
        element: (
          <ProtectedRoute permission="ad-zones.manage">
            <AdZoneFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adZonesEdit,
        element: (
          <ProtectedRoute permission="ad-zones.manage">
            <AdZoneFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adCreatives,
        element: (
          <ProtectedRoute permission="ads.view">
            <CreativesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adCreativesCreate,
        element: (
          <ProtectedRoute permission="ads.create">
            <CreativeFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adCreativesEdit,
        element: (
          <ProtectedRoute permission="ads.edit">
            <CreativeFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adPlacements,
        element: (
          <ProtectedRoute permission="ads.view">
            <AdPlacementsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.adsAnalytics,
        element: (
          <ProtectedRoute permission="ads.view">
            <AdsAnalyticsPage />
          </ProtectedRoute>
        ),
      },
      // ─── WhatsApp (حملات واتساب) ───────────────────────────────────────
      {
        path: paths.whatsappCampaigns,
        element: (
          <ProtectedRoute permission="whatsapp.view">
            <WhatsappCampaignsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.whatsappCampaignCreate,
        element: (
          <ProtectedRoute permission="whatsapp.send">
            <WhatsappCampaignFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.whatsappCampaignDetail,
        element: (
          <ProtectedRoute permission="whatsapp.view">
            <WhatsappCampaignDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.whatsappGroups,
        element: (
          <ProtectedRoute permission="whatsapp.view">
            <WhatsappGroupsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.whatsappContacts,
        element: (
          <ProtectedRoute permission="whatsapp.view">
            <WhatsappContactsPage />
          </ProtectedRoute>
        ),
      },
      // ─── Polls (الاستطلاعات) ───────────────────────────────────────────
      {
        path: paths.polls,
        element: (
          <ProtectedRoute permission="polls.view">
            <PollsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.pollCreate,
        element: (
          <ProtectedRoute permission="polls.view">
            <PollFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.pollsTrash,
        element: (
          <ProtectedRoute permission="polls.view">
            <PollsTrashPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.pollsAnalytics,
        element: (
          <ProtectedRoute permission="polls.view">
            <PollAnalyticsOverviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.pollAnalytics,
        element: (
          <ProtectedRoute permission="polls.view">
            <PollAnalyticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: paths.pollEdit,
        element: (
          <ProtectedRoute permission="polls.view">
            <PollFormPage />
          </ProtectedRoute>
        ),
      },
      // ─── Notifications (مركز الإشعارات) ────────────────────────────────
      { path: paths.notifDashboard, element: (<ProtectedRoute permission="notifications.view"><NotifDashboardPage /></ProtectedRoute>) },
      { path: paths.notifCampaigns, element: (<ProtectedRoute permission="notifications.view"><NotifCampaignsPage /></ProtectedRoute>) },
      { path: paths.notifCampaignCompose, element: (<ProtectedRoute permission="notifications.send"><NotifComposerPage /></ProtectedRoute>) },
      { path: paths.notifCampaignDetail, element: (<ProtectedRoute permission="notifications.view"><NotifCampaignDetailPage /></ProtectedRoute>) },
      { path: paths.notifMatrix, element: (<ProtectedRoute permission="notifications.view"><NotifEventMatrixPage /></ProtectedRoute>) },
      { path: paths.notifTemplates, element: (<ProtectedRoute permission="notifications.view"><NotifTemplatesPage /></ProtectedRoute>) },
      { path: paths.notifHealth, element: (<ProtectedRoute permission="notifications.view"><NotifChannelHealthPage /></ProtectedRoute>) },
      { path: paths.notifSettings, element: (<ProtectedRoute permission="notifications.view"><NotifSettingsPage /></ProtectedRoute>) },
    ],
  },
  { path: '*', element: <Navigate to={paths.dashboard} replace /> },
]);
