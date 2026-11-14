import React from 'react';
import {createRoot} from 'react-dom/client';
import './components.css';
import '../style.css';
import './layout.css';
import App from './App.jsx';
createRoot(document.getElementById('app')).render(<React.StrictMode><App/></React.StrictMode>);
