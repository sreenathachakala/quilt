import * as R from 'ramda'
import * as React from 'react'

import * as IPC from 'utils/electron/ipc-provider'
import { PackageHandle, areEqual } from 'utils/packageHandle'

export interface LocalHandle {
  id?: string
  lastModified?: Date // FIXME: move modified to local field
  path: string
}

export interface DataRow {
  id?: string
  local: string
  lastModified?: Date // FIXME: move modified to local field
  packageHandle: PackageHandle
}

export function useFolders(): [null | DataRow[], () => void] {
  const ipc = IPC.use()
  const [key, setKey] = React.useState(1)
  const inc = React.useCallback(() => setKey(R.inc), [setKey])
  const [folders, setFolders] = React.useState<null | DataRow[]>(null)
  React.useEffect(() => {
    async function fetchData() {
      const foldersList = await ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_LIST)
      setFolders(foldersList)
    }

    fetchData()
  }, [ipc, key])
  return [folders, inc]
}

// TODO: getGroup
export function getLocalHandle(
  groups: DataRow[] | null,
  packageHandle: PackageHandle,
): LocalHandle | null {
  if (!groups) return null
  const foundGroup = groups?.find((group) => areEqual(group.packageHandle, packageHandle))
  if (!foundGroup) return null
  return {
    id: foundGroup.id, // FIXME: this is not id of the local handle
    lastModified: foundGroup.lastModified,
    path: foundGroup.local,
  }
}

export function useActions() {
  const ipc = IPC.use()
  const remove = React.useCallback(
    (row: DataRow) => ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_REMOVE, row),
    [ipc],
  )
  const manage = React.useCallback(
    (row: DataRow) =>
      ipc.invoke(
        row.id ? IPC.EVENTS.SYNC_FOLDERS_EDIT : IPC.EVENTS.SYNC_FOLDERS_ADD,
        row,
      ),
    [ipc],
  )
  return React.useMemo(
    () => ({
      manage,
      remove,
    }),
    [manage, remove],
  )
}
