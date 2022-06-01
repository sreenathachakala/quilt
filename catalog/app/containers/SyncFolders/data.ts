import * as R from 'ramda'
import * as React from 'react'

import * as IPC from 'utils/electron/ipc-provider'

export interface DataRow {
  id?: string
  local: string
  s3: string
}

export function useSyncFolders(): [null | DataRow[], () => void] {
  const ipc = IPC.use()
  const [key, setKey] = React.useState(1)
  const inc = React.useCallback(() => setKey(R.inc), [setKey])
  const [folders, setFolders] = React.useState<null | DataRow[]>(null)
  React.useEffect(() => {
    async function fetchData() {
      const config = await ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_LIST)
      setFolders(config.folders)
    }

    fetchData()
  }, [ipc, key])
  return [folders, inc]
}
