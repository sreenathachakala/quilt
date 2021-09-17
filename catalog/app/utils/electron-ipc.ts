import { ipcRenderer, IpcRendererEvent } from 'electron'
import * as React from 'react'

import * as AWS from 'utils/AWS'

export enum EVENTS {
  CLI_OUTPUT = 'cli_output',
  CONFIRM_REQUEST = 'confirm_request',
  CONFIRM_RESPONSE = 'confirm_response',
  LOCALPATH_REQUEST = 'localpath_request', // TODO: OPEN_IN_EXPLORER
  LOCK_SET = 'lock',
  LOCK_UNSET = 'unlock',
  OPEN_IN_BROWSER = 'open_in_browser',
  OPEN_IN_EXPLORER = 'open_in_explorer',
  QUIT = 'quit',
  READY = 'ready',
  SYNC_DOWNLOAD = 'sync_download',
  SYNC_UPLOAD = 'sync_upload',
}

export function off(
  eventName: EVENTS,
  callback: (event: IpcRendererEvent, ...args: any[]) => void,
) {
  ipcRenderer.off(eventName, callback)
}

export function on(
  eventName: EVENTS,
  callback: (event: IpcRendererEvent, ...args: any[]) => void,
) {
  ipcRenderer.on(eventName, callback)
}

export function invoke(channel: EVENTS, ...args: any[]) {
  return ipcRenderer.invoke(channel, ...args)
}

export function send(channel: EVENTS, ...args: any[]) {
  ipcRenderer.send(channel, ...args)
}

interface Credentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

export interface IPC {
  invoke: typeof invoke
  off: typeof off
  on: typeof on
  send: typeof send
}

function useIPC(): IPC {
  const { accessKeyId, secretAccessKey, sessionToken }: Credentials =
    AWS.Credentials.use()
  const serializedCredentials = React.useMemo(
    () => ({
      accessKeyId,
      secretAccessKey,
      sessionToken,
    }),
    [accessKeyId, secretAccessKey, sessionToken],
  )
  return React.useMemo(
    () => ({
      off,
      on,
      invoke: (channel: EVENTS, ...args: any[]) =>
        invoke(channel, serializedCredentials, ...args),
      send,
    }),
    [serializedCredentials],
  )
}

export const use = useIPC
