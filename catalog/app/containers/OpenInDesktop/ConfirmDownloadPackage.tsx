import * as React from 'react'

import { emptyPackageHandle } from 'utils/packageHandle'
import * as IPC from 'utils/electron/ipc-provider'
import * as Download from 'containers/Bucket/Download'
import * as SyncFolders from 'containers/SyncFolders'
import * as s3paths from 'utils/s3paths'

interface ConfirmDownloadPackageProps {
  children: React.ReactNode
}

const EMPTY_LOCAL_HANDLE = { id: '', path: '' }

export default function ConfirmDownloadPackage({
  children,
}: ConfirmDownloadPackageProps) {
  const ipc = IPC.use()

  const [packageHandle, setPackageHandle] = React.useState(emptyPackageHandle)
  const [localHandle, setLocalHandle] = React.useState(EMPTY_LOCAL_HANDLE)
  const [resolution, setResolution] = React.useState<boolean | null>(false)

  const handleConfirmRequest = React.useCallback((_event, action, r, handles) => {
    setResolution(r)
    switch (action) {
      case 'download_package': {
        setPackageHandle(handles.packageHandle)
        setLocalHandle(handles.localHandle || EMPTY_LOCAL_HANDLE)
        break
      }
    }
  }, [])

  const handleCancel = React.useCallback(() => setResolution(false), [])
  const handleConfirm = React.useCallback(() => setResolution(true), [])

  const [folders] = SyncFolders.useSyncFolders()
  const [localEditing, setLocalEditing] = React.useState<SyncFolders.DataRow | null>(null)
  const handleLocalClick = React.useCallback(() => {
    const row = folders?.find(({ id }) => id === localHandle?.id)
    setLocalEditing(
      row || {
        s3: s3paths.handleToS3Url({
          bucket: packageHandle.bucket,
          key: packageHandle.name,
        }),
        local: EMPTY_LOCAL_HANDLE.path,
        id: '',
      },
    )
  }, [folders, localHandle, packageHandle])
  const handleChangeLocalFolder = React.useCallback((row: SyncFolders.DataRow) => {
    setLocalHandle({
      id: row.id || '',
      path: row.local,
    })
    setLocalEditing(null)
  }, [])

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
        localPath={localHandle?.path || ''}
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
