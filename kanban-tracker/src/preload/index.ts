import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Exposed API for renderer process
const electronAPI = {
  // Database operations
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  // Event listeners
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.on(channel, callback)
    return () => ipcRenderer.removeListener(channel, callback)
  },

  once: (channel: string, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.once(channel, callback)
  },

  removeListener: (channel: string, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

// Expose in main world
contextBridge.exposeInMainWorld('electron', electronAPI)

// Type declaration for renderer
export type ElectronAPI = typeof electronAPI
