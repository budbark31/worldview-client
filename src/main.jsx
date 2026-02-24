import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Note: StrictMode removed - causes double-mount issues with Cesium WebGL context
createRoot(document.getElementById('root')).render(<App />)
