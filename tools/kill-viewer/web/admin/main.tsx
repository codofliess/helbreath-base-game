import { createRoot } from 'react-dom/client';
import '../public/styles.css';
import './admin.css';
import { AdminApp } from './AdminApp';
createRoot(document.getElementById('root')!).render(<AdminApp />);
