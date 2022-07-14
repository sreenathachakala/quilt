import * as R from 'ramda'
import * as React from 'react'

import * as IPC from 'utils/electron/ipc-provider'
import { PackageHandleBase } from 'utils/packageHandle'

export interface RootHandle {
  path: string
}

export interface LocalHandle {
  id?: string
  lastModified?: Date
  path: string

  children: { name: string; path: string; size: number; hash: string }[]
}

export function useRoot(): [RootHandle | null, (rootHandle: RootHandle) => void] {
  const ipc = IPC.use()
  const [key, setKey] = React.useState(1)
  const inc = React.useCallback(() => setKey(R.inc), [setKey])
  const [root, setRoot] = React.useState<null | RootHandle>(null)
  React.useEffect(() => {
    async function fetchData() {
      try {
        const rootHandle = await ipc.invoke(IPC.EVENTS.SYNC_ROOT)
        setRoot(rootHandle)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Couldnt get syncing folder groups')
        // eslint-disable-next-line no-console
        console.log(error)
      }
    }

    fetchData()
  }, [ipc, key])

  const changeRoot = React.useCallback(
    async (rootHandle: RootHandle) => {
      await ipc.invoke(IPC.EVENTS.SYNC_ROOT, rootHandle)
      inc()
    },
    [inc, ipc],
  )

  return [root, changeRoot]
}

export function useLocalHandle(packageHandle: PackageHandleBase): LocalHandle | null {
  const ipc = IPC.use()
  const [localHandle, setLocalHandle] = React.useState<null | LocalHandle>(null)
  const fetchData = React.useCallback(async () => {
    try {
      const data = await ipc.invoke(IPC.EVENTS.SYNC_LOCAL_HANDLE, packageHandle)
      if (!R.equals(localHandle, data)) {
        setLocalHandle(data)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Couldnt get syncing folder groups')
      // eslint-disable-next-line no-console
      console.log(error)
    }
  }, [ipc, localHandle, packageHandle])
  React.useEffect(() => {
    const timer = setInterval(fetchData, 1000)
    return () => clearInterval(timer)
  }, [fetchData])

  return localHandle
}
