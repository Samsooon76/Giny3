import { LoadingScreen } from './ui/screens/LoadingScreen'
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './ui/official/ThemeProvider'
import { installSessionLogger } from './debug/sessionLogger'
import './index.css'

installSessionLogger()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider />
    <Suspense fallback={<LoadingScreen />}><App /></Suspense>
  </StrictMode>,
)
