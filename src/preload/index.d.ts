import type { ElectronAPI } from '@electron-toolkit/preload'
import type { AcademyFlowAPI } from './api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: AcademyFlowAPI
  }
}
