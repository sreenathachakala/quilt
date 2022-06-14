import * as R from 'ramda'
import * as React from 'react'

import * as IPC from 'utils/electron/ipc-provider'
import { PackageHandleBase, areEqual } from 'utils/packageHandle'

export interface RootHandle {
  path: string
}

export interface LocalHandle {
  id?: string
  lastModified?: Date
  path: string
}

export interface SyncGroup {
  id?: string
  localHandle: LocalHandle
  packageHandle: PackageHandleBase
}

export function useRoot(): [RootHandle | null, () => void] {
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
  return [root, inc]
}

export function useFolders(): [null | SyncGroup[], () => void] {
  const ipc = IPC.use()
  const [key, setKey] = React.useState(1)
  const inc = React.useCallback(() => setKey(R.inc), [setKey])
  const [folders, setFolders] = React.useState<null | SyncGroup[]>(null)
  React.useEffect(() => {
    async function fetchData() {
      try {
        const foldersList = await ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_LIST)
        setFolders(foldersList)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Couldnt get syncing folder groups')
        // eslint-disable-next-line no-console
        console.log(error)
      }
    }

    fetchData()
  }, [ipc, key])
  return [folders, inc]
}

export function getSyncGroup(
  groups: SyncGroup[] | null,
  packageHandle: PackageHandleBase,
): SyncGroup | null {
  return groups?.find((group) => areEqual(group.packageHandle, packageHandle)) || null
}

export function useActions() {
  const ipc = IPC.use()

  const changeRoot = React.useCallback(
    (rootHandle: RootHandle) => ipc.invoke(IPC.EVENTS.SYNC_ROOT, rootHandle),
    [ipc],
  )

  const remove = React.useCallback(
    (row: SyncGroup) => ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_REMOVE, row),
    [ipc],
  )
  const manage = React.useCallback(
    (row: SyncGroup) =>
      ipc.invoke(
        row.id ? IPC.EVENTS.SYNC_FOLDERS_EDIT : IPC.EVENTS.SYNC_FOLDERS_ADD,
        row,
      ),
    [ipc],
  )
  return React.useMemo(
    () => ({
      changeRoot,
      manage,
      remove,
    }),
    [changeRoot, manage, remove],
  )
}

export function useLocalHandle(
  packageHandle: PackageHandleBase,
): [LocalHandle | null, (v: string) => void] {
  const [folders, inc] = useFolders()
  const { manage } = useActions()
  const syncGroup = getSyncGroup(folders, packageHandle)

  const value = React.useMemo(() => syncGroup?.localHandle || null, [syncGroup])
  const onChange = React.useCallback(
    async (path: string) => {
      try {
        await manage({
          id: syncGroup?.id,
          localHandle: {
            path,
          },
          packageHandle,
        })
        inc()
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Couldnt update local handle')
        // eslint-disable-next-line no-console
        console.error(error)
      }
    },
    [inc, manage, packageHandle, syncGroup],
  )
  return React.useMemo(() => [value, onChange], [value, onChange])
}
