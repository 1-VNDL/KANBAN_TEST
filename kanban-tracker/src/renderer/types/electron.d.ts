import { IpcRendererEvent } from 'electron'

export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => () => void
  once: (channel: string, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => void
  removeListener: (channel: string, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => void
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
