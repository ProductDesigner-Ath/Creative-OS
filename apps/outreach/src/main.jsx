import React from 'react';
import {createRoot} from 'react-dom/client';
import './components.css';
import '../style.css';
import './layout.css';
import Workspace from './Workspace.jsx';
createRoot(document.getElementById('app')).render(<React.StrictMode><Workspace/></React.StrictMode>);
