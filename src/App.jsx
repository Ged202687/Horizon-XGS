import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import DayView from './pages/DayView'
import WeekView from './pages/WeekView'
import MonthView from './pages/MonthView'
import AgentDetail from './pages/AgentDetail'
import MyDayView from './pages/MyDayView'
import MyMonthView from './pages/MyMonthView'

function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}

// Vues Jour/Semaine/Mois (tous agents) et fiche agent : réservées au staff (coach, superviseur,
// admin, super_admin). Un agent est redirigé vers sa propre session en lecture seule.
function RequireStaff({ children }) {
  const { session, profil, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (profil?.role === 'agent') return <Navigate to="/mon-jour" replace />
  return children
}

function HomeRedirect() {
  const { session, profil, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={profil?.role === 'agent' ? '/mon-jour' : '/jour'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/jour" element={<RequireStaff><DayView /></RequireStaff>} />
      <Route path="/semaine" element={<RequireStaff><WeekView /></RequireStaff>} />
      <Route path="/mois" element={<RequireStaff><MonthView /></RequireStaff>} />
      <Route path="/agent/:agentId" element={<RequireStaff><AgentDetail /></RequireStaff>} />
      <Route path="/mon-jour" element={<RequireAuth><MyDayView /></RequireAuth>} />
      <Route path="/mon-mois" element={<RequireAuth><MyMonthView /></RequireAuth>} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
