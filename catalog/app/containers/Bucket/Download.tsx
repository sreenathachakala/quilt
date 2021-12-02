import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Mono from 'components/Code'
import * as Config from 'utils/Config'
import * as IPC from 'utils/electron/ipc-provider'
import { parseS3Url } from 'utils/s3paths'

import * as FileView from './FileView'

interface DownloadDirectoryButtonProps {
  bucket: string
  className: string
  onClick: () => void
  path?: string
}

export function DirectoryButton({
  className,
  bucket,
  onClick,
  path,
}: DownloadDirectoryButtonProps) {
  const { desktop, noDownload }: { desktop: boolean; noDownload: boolean } = Config.use()

  if (noDownload) return null

  if (desktop) {
    return (
      <FileView.DownloadButtonLayout
        className={className}
        label="Download directory"
        icon="archive"
        type="submit"
        onClick={onClick}
      />
    )
  }

  return (
    <FileView.ZipDownloadForm
      className={className}
      suffix={`dir/${bucket}/${path}`}
      label="Download directory"
    />
  )
}

interface ConfirmDownloadDialogProps {
  localPath: string
  onClose: () => void
  open: boolean
  remotePath: string
}

const useConfirmDownloadDialogStyles = M.makeStyles({
  progressbar: {
    margin: '0 0 16px',
  },
  shrink: {
    width: 0,
  },
})

export function ConfirmDialog({
  localPath,
  onClose,
  open,
  remotePath,
}: ConfirmDownloadDialogProps) {
  const ipc = IPC.use()

  const classes = useConfirmDownloadDialogStyles()
  const [syncing, setSyncing] = React.useState(false)

  const handleCancel = React.useCallback(() => onClose(), [onClose])
  const handleConfirm = React.useCallback(async () => {
    setSyncing(true)
    await ipc.invoke(IPC.EVENTS.SYNC_DOWNLOAD, [parseS3Url(remotePath)], localPath)
    onClose()
  }, [ipc, localPath, onClose, remotePath])

  const [fakeProgress, setFakeProgress] = React.useState(0)
  const handleCliOutput = React.useCallback(() => {
    if (fakeProgress) {
      setFakeProgress((100 - fakeProgress) * 0.1 + fakeProgress)
    } else {
      setFakeProgress(1)
      setTimeout(() => {
        setFakeProgress((100 - fakeProgress) * 0.1 + fakeProgress)
      }, 300)
    }
  }, [fakeProgress, setFakeProgress])
  React.useEffect(() => {
    ipc.on(IPC.EVENTS.CLI_OUTPUT, handleCliOutput)
    return () => {
      ipc.off(IPC.EVENTS.CLI_OUTPUT, handleCliOutput)
    }
  }, [ipc, handleCliOutput])
  const progressVariant = fakeProgress ? 'determinate' : 'indeterminate'

  return (
    <M.Dialog open={open}>
      <M.DialogTitle>Confirm download</M.DialogTitle>
      <M.DialogContent>
        {syncing && (
          <M.LinearProgress
            color="primary"
            className={cx(classes.progressbar, { [classes.shrink]: fakeProgress === 1 })}
            variant={progressVariant}
            value={fakeProgress === 1 ? 0 : fakeProgress}
          />
        )}
        From <Mono>{remotePath}</Mono> to <Mono>{localPath}</Mono>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button disabled={syncing} onClick={handleCancel}>
          Cancel
        </M.Button>
        <M.Button
          disabled={syncing}
          color="primary"
          onClick={handleConfirm}
          variant="contained"
        >
          Download
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
