import * as React from 'react'

export * as EVENTS from './events'

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

export const Provider = function IpcProvider({ children, value }: SentryProviderProps) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function useIPC(): IPC {
  return React.useContext(Ctx)
}

export const use = useIPC
