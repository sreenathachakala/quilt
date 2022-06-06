import { ipcRenderer, IpcRendererEvent } from 'electron'

export * as EVENTS from './events'

const debug = (...args: any[]) => {
  // eslint-disable-next-line no-console
  console.debug(...args)
}

export function off(
  eventName: string,
  callback: (event: IpcRendererEvent, ...args: any[]) => void,
) {
  debug('Off', eventName)
  ipcRenderer.off(eventName, callback)
}

export function on(
  eventName: string,
  callback: (event: IpcRendererEvent, ...args: any[]) => void,
) {
  // TODO: add debug to callback, return new function wrapper for callback
  //       and use wrapper to unsubscribe
  ipcRenderer.on(eventName, callback)
}

export function invoke(channel: string, ...args: any[]) {
  debug('Invoke', channel, '. Arguments:', args)
  return ipcRenderer.invoke(channel, ...args)
}

export function send(channel: string, ...args: any[]) {
  debug('Send', channel, '. Arguments:', args)
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
