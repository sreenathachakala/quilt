import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Mono from 'components/Code'
import * as SyncFolders from 'containers/SyncFolders'
import * as Config from 'utils/Config'
import * as IPC from 'utils/electron/ipc-provider'
import * as packageHandleUtils from 'utils/packageHandle'

import * as FileView from './FileView'
import Section from './Section'

interface DownloadButtonProps {
  className: string
  label?: string
  onClick: () => void
  path?: string
}

export function DownloadButton({ className, label, onClick, path }: DownloadButtonProps) {
  const { desktop, noDownload }: { desktop: boolean; noDownload: boolean } = Config.use()

  if (noDownload) return null

  if (desktop) {
    return (
      <FileView.DownloadButtonLayout
        className={className}
        label={label}
        icon="archive"
        type="submit"
        onClick={onClick}
      />
    )
  }

  return <FileView.ZipDownloadForm className={className} label={label} suffix={path} />
}

const useConfirmDownloadDialogStyles = M.makeStyles({
  progressbar: {
    margin: '0 0 16px',
  },
  shrink: {
    width: 0,
  },
})

interface ConfirmDownloadDialogProps {
  localPath: string
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false
  onCancel: () => void
  onConfirm: () => void
  onLocalClick?: () => void
  open: boolean
  packageHandle: packageHandleUtils.PackageHandle
}

export function ConfirmDialog({
  localPath,
  maxWidth = 'md',
  onCancel,
  onConfirm,
  onLocalClick,
  open,
  packageHandle,
}: ConfirmDownloadDialogProps) {
  const ipc = IPC.use()

  const classes = useConfirmDownloadDialogStyles()
  const [syncing, setSyncing] = React.useState(false)

  const handleCancel = React.useCallback(() => onCancel(), [onCancel])
  const handleConfirm = React.useCallback(async () => {
    setSyncing(true)
    await ipc.invoke(IPC.EVENTS.DOWNLOAD_PACKAGE, packageHandle, localPath)
    onConfirm()
  }, [ipc, localPath, onConfirm, packageHandle])

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
    <M.Dialog maxWidth={maxWidth} open={open}>
      <M.DialogTitle>
        {syncing ? 'Package is downloading' : 'Confirm download'}
      </M.DialogTitle>
      <M.DialogContent>
        {syncing && (
          <M.LinearProgress
            color="primary"
            className={cx(classes.progressbar, { [classes.shrink]: fakeProgress === 1 })}
            variant={progressVariant}
            value={fakeProgress === 1 ? 0 : fakeProgress}
          />
        )}
        From <Mono>{`s3://${packageHandle.bucket}/${packageHandle.name}`}</Mono>
        <br />
        to <Mono>{localPath}</Mono>
        <M.IconButton onClick={onLocalClick}>
          <M.Icon>edit</M.Icon>
        </M.IconButton>
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

interface LocalFolderInputProps {
  onChange: (path: string) => void
  open: boolean
  value: string | null
}

export function LocalFolderInput({ onChange, open, value }: LocalFolderInputProps) {
  const ipc = IPC.use()

  const handleClick = React.useCallback(async () => {
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [ipc, onChange])

  return (
    <Section
      icon="folder_open"
      heading="Local folder"
      defaultExpanded={open}
      gutterTop
      gutterBottom
    >
      <M.TextField
        fullWidth
        size="small"
        helperText="Click to set local folder with your file browser"
        label="Path to local folder"
        onClick={handleClick}
        value={value}
      />
    </Section>
  )
}

export function useLocalFolder(
  packageHandle: packageHandleUtils.PackageHandle,
): [string, Date | null, (v: string) => void] {
  const [folders, inc] = SyncFolders.useFolders()
  const { manage } = SyncFolders.useActions()
  const syncGroup = SyncFolders.getSyncGroup(folders, packageHandle)

  const value = React.useMemo(() => syncGroup?.local || '', [syncGroup])
  const localModified = React.useMemo(() => syncGroup?.lastModified || null, [syncGroup])
  const onChange = React.useCallback(
    async (path: string) => {
      await manage({
        local: path,
        packageHandle,
      })
      inc()
    },
    [inc, manage, packageHandle],
  )
  return React.useMemo(
    () => [value, localModified, onChange],
    [value, localModified, onChange],
  )
}
