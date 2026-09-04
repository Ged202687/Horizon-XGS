import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import DayView from './pages/DayView'
import WeekView from './pages/WeekView'
import MonthView from './pages/MonthView'
import AgentDetail from './pages/AgentDetail'

function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/jour" element={<RequireAuth><DayView /></RequireAuth>} />
      <Route path="/semaine" element={<RequireAuth><WeekView /></RequireAuth>} />
      <Route path="/mois" element={<RequireAuth><MonthView /></RequireAuth>} />
      <Route path="/agent/:agentId" element={<RequireAuth><AgentDetail /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/jour" replace />} />
    </Routes>
  )
}
