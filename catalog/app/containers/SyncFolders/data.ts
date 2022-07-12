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

export function useLocalHandle(
  packageHandle: PackageHandleBase,
): [LocalHandle | null, () => void] {
  const ipc = IPC.use()
  const [key, setKey] = React.useState(1)
  const inc = React.useCallback(() => setKey(R.inc), [setKey])
  const [localHandle, setLocalHandle] = React.useState<null | LocalHandle>(null)
  React.useEffect(() => {
    async function fetchData() {
      try {
        const data = await ipc.invoke(IPC.EVENTS.SYNC_LOCAL_HANDLE, packageHandle)
        setLocalHandle(data)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Couldnt get syncing folder groups')
        // eslint-disable-next-line no-console
        console.log(error)
      }
    }

    fetchData()
  }, [ipc, key, packageHandle])
  return [localHandle, inc]
}
