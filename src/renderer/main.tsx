import { Buffer } from 'buffer'

// @react-pdf/renderer s'appuie sur l'API Node `Buffer` (encodage des polices/
// images embarquées). Le renderer Electron tourne avec nodeIntegration
// désactivé et contextIsolation activé (bonne pratique de sécurité), donc ce
// global n'existe pas nativement côté navigateur : on le polyfill ici, avant
// tout le reste, pour que la génération de PDF fonctionne.
window.Buffer = window.Buffer ?? Buffer
window.global = window.global ?? window

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
