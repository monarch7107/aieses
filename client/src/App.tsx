import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireRole, homeFor, useAuth } from './lib/auth';
import { AppShell } from './components/layout/AppShell';
import { Spinner } from './components/ui';
import { LoginPage } from './pages/Login';

// Student
import { StudentDashboard } from './pages/student/Dashboard';
import { SubjectsPage } from './pages/student/Subjects';
import { CoursePage } from './pages/student/CoursePage';
import { LessonPage } from './pages/student/LessonPage';
import { AssessmentPage } from './pages/student/AssessmentPage';
import { AttemptResultPage } from './pages/student/AttemptResultPage';
import { ProgressPage } from './pages/student/ProgressPage';
import { RecommendationsPage } from './pages/student/RecommendationsPage';
import { ResourcesPage } from './pages/student/ResourcesPage';
import { WorkspacePage } from './pages/student/WorkspacePage';
import { ProjectPage } from './pages/student/ProjectPage';
import { AssignmentsPage } from './pages/student/AssignmentsPage';
import { TutorPage } from './pages/student/TutorPage';
import { ClassroomPage } from './pages/student/ClassroomPage';
// Teacher
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import { ClassesPage, ClassPage } from './pages/teacher/ClassPage';
import { StudentDetailPage } from './pages/teacher/StudentDetailPage';
import { TeacherAssignmentsPage, TeacherAssignmentDetailPage } from './pages/teacher/AssignmentsPage';
import { TeacherAnalyticsPage } from './pages/teacher/AnalyticsPage';
import { TeacherLibraryPage } from './pages/teacher/LibraryPage';
// Admin
import { AdminPage, AdminUsersPage } from './pages/admin/AdminPage';

// Heavy editors are code-split
const DocumentEditorPage = lazy(() => import('./pages/student/DocumentEditorPage').then((m) => ({ default: m.DocumentEditorPage })));
const IdePage = lazy(() => import('./pages/student/IdePage').then((m) => ({ default: m.IdePage })));

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading AIESES…" className="h-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student') return <Navigate to={homeFor(user.role)} replace />;
  return <StudentDashboard />;
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-black text-slate-200">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">The page you are looking for does not exist.</p>
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<Spinner label="Loading…" className="h-screen" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Student area */}
        <Route
          element={
            <RequireRole roles={['student']}>
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<RootRedirect />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="courses/:id" element={<CoursePage />} />
          <Route path="lessons/:id" element={<LessonPage />} />
          <Route path="assessments/:id" element={<AssessmentPage />} />
          <Route path="attempts/:id" element={<AttemptResultPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="projects/:id" element={<ProjectPage />} />
          <Route path="documents/:id" element={<DocumentEditorPage />} />
          <Route path="ide" element={<IdePage />} />
          <Route path="ide/:projectId" element={<IdePage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="tutor" element={<TutorPage />} />
          <Route path="classroom" element={<ClassroomPage />} />
        </Route>

        {/* Teacher area */}
        <Route
          path="/teacher"
          element={
            <RequireRole roles={['teacher', 'admin']}>
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<TeacherDashboard />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="classes/:id" element={<ClassPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="assignments" element={<TeacherAssignmentsPage />} />
          <Route path="assignments/:id" element={<TeacherAssignmentDetailPage />} />
          <Route path="analytics" element={<TeacherAnalyticsPage />} />
          <Route path="library" element={<TeacherLibraryPage />} />
        </Route>

        {/* Admin area */}
        <Route
          path="/admin"
          element={
            <RequireRole roles={['admin']}>
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<AdminPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
