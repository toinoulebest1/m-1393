
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Assurez-vous que le conteneur racine prend tout l'espace disponible
document.documentElement.style.height = '100%';
document.body.style.height = '100%';
document.body.style.margin = '0';
document.getElementById('root')!.style.height = '100%';

createRoot(document.getElementById("root")!).render(<App />);
