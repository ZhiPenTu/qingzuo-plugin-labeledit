import React from 'react';
import ReactDOM from 'react-dom/client';
import LabelEdit from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ThemeProvider><TooltipProvider><LabelEdit /></TooltipProvider></ThemeProvider></React.StrictMode>,
);
