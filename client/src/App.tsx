import { Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminDocuments from './pages/admin/AdminDocuments'
import AdminEmployers from './pages/admin/AdminEmployers'
import AdminJobSeekers from './pages/admin/AdminJobSeekers'
import AdminOverview from './pages/admin/AdminOverview'
import AdminUsers from './pages/admin/AdminUsers'
import Companies from './pages/Companies'
import EmployerApplicants from './pages/employer/EmployerApplicants'
import EmployerCandidates from './pages/employer/EmployerCandidates'
import EmployerCompany from './pages/employer/EmployerCompany'
import EmployerJobForm from './pages/employer/EmployerJobForm'
import EmployerJobs from './pages/employer/EmployerJobs'
import EmployerOverview from './pages/employer/EmployerOverview'
import Home from './pages/Home'
import JobDetail from './pages/JobDetail'
import Jobs from './pages/Jobs'
import SeekerApplications from './pages/jobseeker/SeekerApplications'
import SeekerDashboard from './pages/jobseeker/SeekerDashboard'
import SeekerDocuments from './pages/jobseeker/SeekerDocuments'
import SeekerProfile from './pages/jobseeker/SeekerProfile'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route index element={<Home />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/:jobId" element={<JobDetail />} />
        <Route path="companies" element={<Companies />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        {/* Job seeker */}
        <Route element={<ProtectedRoute roles={['job_seeker']} />}>
          <Route path="dashboard" element={<SeekerDashboard />} />
          <Route path="profile" element={<SeekerProfile />} />
          <Route path="documents" element={<SeekerDocuments />} />
          <Route path="applications" element={<SeekerApplications />} />
        </Route>

        {/* Employer */}
        <Route element={<ProtectedRoute roles={['employer']} />}>
          <Route path="employer" element={<EmployerOverview />} />
          <Route path="employer/company" element={<EmployerCompany />} />
          <Route path="employer/jobs" element={<EmployerJobs />} />
          <Route path="employer/jobs/new" element={<EmployerJobForm />} />
          <Route path="employer/jobs/:jobId/edit" element={<EmployerJobForm />} />
          <Route path="employer/applicants" element={<EmployerApplicants />} />
          <Route path="employer/candidates" element={<EmployerCandidates />} />
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminOverview />} />
          <Route path="admin/employers" element={<AdminEmployers />} />
          <Route path="admin/jobseekers" element={<AdminJobSeekers />} />
          <Route path="admin/documents" element={<AdminDocuments />} />
          <Route path="admin/users" element={<AdminUsers />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
