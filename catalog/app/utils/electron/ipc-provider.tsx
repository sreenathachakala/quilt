import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'

export * as EVENTS from './events'

interface Credentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = (eventName: string, callback: (event: any, ...args: any[]) => void) => {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const request = (eventName: string, ...args: any[]): Promise<any> => Promise.resolve(null)

export interface IPC {
  on: typeof handler
  off: typeof handler
  invoke: typeof request
  send: typeof request
}

const Ctx = React.createContext({
  on: handler,
  off: handler,
  invoke: request,
  send: request,
})

interface SentryProviderProps {
  children: React.ReactNode
  value: IPC
}

export const Provider = function SentryProvider({
  children,
  value: { off, on, invoke, send },
}: SentryProviderProps) {
  const credentials: Credentials = AWS.Credentials.use()
  const serializedCredentials = React.useMemo(
    () => R.pick(['accessKeyId', 'secretAccessKey', 'sessionToken'], credentials),
    [credentials],
  )
  const ipc = React.useMemo(
    () => ({
      off,
      on,
      invoke: (channel: string, ...args: any[]) =>
        invoke(channel, serializedCredentials, ...args),
      send,
    }),
    [serializedCredentials, on, off, send, invoke],
  )
  return <Ctx.Provider value={ipc}>{children}</Ctx.Provider>
}

function useIPC(): IPC {
  return React.useContext(Ctx)
}

export const use = useIPC
