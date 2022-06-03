import * as R from 'ramda'
import * as React from 'react'

import * as IPC from 'utils/electron/ipc-provider'
import { PackageHandleBase, areEqual } from 'utils/packageHandle'

export interface LocalHandle {
  id?: string
  lastModified?: Date // FIXME: move modified to local field
  path: string
}

export interface DataRow {
  id?: string
  local: string
  lastModified?: Date // FIXME: move modified to local field
  packageHandle: PackageHandleBase
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

export function getSyncGroup(
  groups: DataRow[] | null,
  packageHandle: PackageHandleBase,
): DataRow | null {
  return groups?.find((group) => areEqual(group.packageHandle, packageHandle)) || null
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
