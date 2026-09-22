import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Vite가 제공하는 #root 요소에 WayLog React 애플리케이션을 마운트합니다.
// StrictMode는 개발 중 잘못된 사이드 이펙트와 오래된 React 사용 방식을 발견하도록 돕습니다.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
