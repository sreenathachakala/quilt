import * as React from 'react'

import { emptyPackageHandle } from 'utils/packageHandle'
import * as IPC from 'utils/electron/ipc-provider'
import * as Download from 'containers/Bucket/Download'

interface ConfirmDownloadPackageProps {
  children: React.ReactNode
}

export default function ConfirmDownloadPackage({
  children,
}: ConfirmDownloadPackageProps) {
  const ipc = IPC.use()

  const [packageHandle, setPackageHandle] = React.useState(emptyPackageHandle)
  const [localHandle, setLocalHandle] = React.useState({ path: '' })
  const [resolution, setResolution] = React.useState<boolean | null>(false)

  const handleConfirmRequest = React.useCallback((_event, action, r, handles) => {
    setResolution(r)
    switch (action) {
      case 'download_package': {
        setPackageHandle(handles.packageHandle)
        setLocalHandle(handles.localHandle)
        break
      }
    }
  }, [])

  const handleCancel = React.useCallback(() => setResolution(false), [])
  const handleConfirm = React.useCallback(() => setResolution(true), [])

  React.useEffect(() => {
    ipc.on(IPC.EVENTS.CONFIRM, handleConfirmRequest)
    return () => ipc.off(IPC.EVENTS.CONFIRM, handleConfirmRequest)
  }, [ipc, handleConfirmRequest])

  return (
    <>
      <Download.ConfirmDialog
        localPath={localHandle?.path || ''}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        open={resolution === null}
        packageHandle={packageHandle}
      />
      {children}
    </>
  )
}
