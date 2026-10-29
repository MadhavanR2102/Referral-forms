import ReferralForms from './ReferralForms'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'

const Router = import.meta.env.MODE === 'pages' ? HashRouter : BrowserRouter

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/referral-forms" element={<ReferralForms />} />
        <Route path="/referral-forms/new" element={<ReferralForms />} />
        <Route path="/referral-forms/new/blank" element={<ReferralForms />} />
        <Route path="*" element={<Navigate replace to="/referral-forms" />} />
      </Routes>
    </Router>
  )
}

export default App
