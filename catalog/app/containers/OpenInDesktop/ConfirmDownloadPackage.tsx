import * as React from 'react'

import { areEqual, emptyPackageHandle } from 'utils/packageHandle'
import * as IPC from 'utils/electron/ipc-provider'
import * as Download from 'containers/Bucket/Download'
import * as SyncFolders from 'containers/SyncFolders'

interface ConfirmDownloadPackageProps {
  children: React.ReactNode
}

const EMPTY_LOCAL_HANDLE = { path: '' }

export default function ConfirmDownloadPackage({
  children,
}: ConfirmDownloadPackageProps) {
  const ipc = IPC.use()

  const [packageHandle, setPackageHandle] = React.useState(emptyPackageHandle)
  const [localHandle, setLocalHandle] = React.useState(EMPTY_LOCAL_HANDLE)
  const [resolution, setResolution] = React.useState<boolean | null>(false)

  const handleConfirmRequest = React.useCallback((_event, action, r, syncGroup) => {
    setResolution(r)
    switch (action) {
      case 'download_package': {
        setPackageHandle(syncGroup.packageHandle)
        setLocalHandle(syncGroup.localHandle || EMPTY_LOCAL_HANDLE)
        break
      }
    }
  }, [])

  const handleCancel = React.useCallback(() => setResolution(false), [])
  const handleConfirm = React.useCallback(() => setResolution(true), [])

  const [folders] = SyncFolders.useFolders()
  const { manage } = SyncFolders.useActions()
  const [localEditing, setLocalEditing] = React.useState<SyncFolders.SyncGroup | null>(
    null,
  )
  const handleLocalClick = React.useCallback(() => {
    const syncGroup = folders?.find((group) =>
      areEqual(packageHandle, group.packageHandle),
    )
    setLocalEditing(
      syncGroup || {
        packageHandle,
        localHandle: EMPTY_LOCAL_HANDLE,
        id: '',
      },
    )
  }, [folders, packageHandle])
  const handleChangeLocalFolder = React.useCallback(
    async (row: SyncFolders.SyncGroup) => {
      await manage(row)

      setLocalHandle(row.localHandle || EMPTY_LOCAL_HANDLE)
      setLocalEditing(null)
    },
    [manage],
  )

  React.useEffect(() => {
    ipc.on(IPC.EVENTS.CONFIRM, handleConfirmRequest)
    return () => ipc.off(IPC.EVENTS.CONFIRM, handleConfirmRequest)
  }, [ipc, handleConfirmRequest])

  return (
    <>
      <SyncFolders.ManageSyncFoldersPair
        onCancel={() => setLocalEditing(null)}
        onSubmit={handleChangeLocalFolder}
        s3Disabled
        title={
          localEditing?.id
            ? 'Change local folder path'
            : 'Associate local folder with package'
        }
        value={localEditing}
      />

      <Download.ConfirmDialog
        localHandle={localHandle}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        open={resolution === null}
        packageHandle={packageHandle}
        onLocalClick={handleLocalClick}
      />
      {children}
    </>
  )
}
