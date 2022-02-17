import { ipcRenderer, IpcRendererEvent } from 'electron'

export * as EVENTS from './events'

export function off(
  eventName: string,
  callback: (event: IpcRendererEvent, ...args: any[]) => void,
) {
  ipcRenderer.off(eventName, callback)
}

export function on(
  eventName: string,
  callback: (event: IpcRendererEvent, ...args: any[]) => void,
) {
  ipcRenderer.on(eventName, callback)
}

export function invoke(channel: string, ...args: any[]) {
  return ipcRenderer.invoke(channel, ...args)
}

export function send(channel: string, ...args: any[]) {
  ipcRenderer.send(channel, ...args)
  return Promise.resolve(null)
}

export interface IPC {
  invoke: typeof invoke
  off: typeof off
  on: typeof on
  send: typeof send
}

const ipc: IPC = {
  on,
  off,
  invoke,
  send,
}

export default ipc
