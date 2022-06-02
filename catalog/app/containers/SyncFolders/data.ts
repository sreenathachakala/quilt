import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'

import * as IPC from 'utils/electron/ipc-provider'
import { PackageHandle, toS3Handle } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'

export interface LocalHandle {
  id?: string
  path: string
}

export interface DataRow {
  id?: string
  local: string
  s3: string
}

export function useFolders(): [null | DataRow[], () => void] {
  const ipc = IPC.use()
  const [key, setKey] = React.useState(1)
  const inc = React.useCallback(() => setKey(R.inc), [setKey])
  const [folders, setFolders] = React.useState<null | DataRow[]>(null)
  React.useEffect(() => {
    async function fetchData() {
      const folders = await ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_LIST)
      setFolders(folders)
    }

    fetchData()
  }, [ipc, key])
  return [folders, inc]
}

export function getLocalHandle(
  folders: DataRow[] | null,
  packageHandle: PackageHandle,
): LocalHandle | null {
  if (!folders) return null
  const url = FP.function.pipe(packageHandle, toS3Handle, s3paths.handleToS3Url)
  const foundRow = folders?.find(({ s3 }) => url.includes(s3))
  if (!foundRow) return null
  return {
    id: foundRow.id, // FIXME: this is not id of the local handle
    path: foundRow.local,
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
