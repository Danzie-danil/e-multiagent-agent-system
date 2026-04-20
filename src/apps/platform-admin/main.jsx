// src/apps/platform-admin/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { ThemeProvider } from '../../context/ThemeContext'
import { ToastProvider } from '../../context/ToastContext'
import { NotificationProvider } from '../../context/NotificationContext'
import { ToastContainer } from '../../components/ui/Toast'
import App from './App'

import '../../styles/tokens.css'
import '../../styles/reset.css'
import '../../styles/typography.css'
import '../../styles/animations.css'
import '../../styles/global.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter 
      basename="/platform" 
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <NotificationProvider>
              <App />
              <ToastContainer />
            </NotificationProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
