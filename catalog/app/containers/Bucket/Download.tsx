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

interface ConfirmDialogContentProps {
  packageHandle: packageHandleUtils.PackageHandleBase
  localHandle: SyncFolders.LocalHandle | null
  onLocalClick?: () => void
}

function ConfirmDialogContent({
  localHandle,
  onLocalClick,
  packageHandle,
}: ConfirmDialogContentProps) {
  return (
    <M.Stepper activeStep={!localHandle?.path ? 1 : 2} orientation="vertical">
      <M.Step>
        <M.StepLabel>
          <M.Typography>
            From <Mono>{`s3://${packageHandle.bucket}/${packageHandle.name}`}</Mono>
          </M.Typography>
        </M.StepLabel>
      </M.Step>
      <M.Step>
        {localHandle?.path ? (
          <M.StepLabel>
            <M.Typography>
              to <Mono>{localHandle?.path}</Mono>
            </M.Typography>
          </M.StepLabel>
        ) : (
          <M.StepLabel>
            <M.Typography>Local handle wasn't set</M.Typography>
          </M.StepLabel>
        )}
        <M.StepContent>
          <M.Button
            startIcon={<M.Icon>edit</M.Icon>}
            onClick={onLocalClick}
            variant="outlined"
          >
            {localHandle?.path ? 'Change local handle' : 'Add local handle'}
          </M.Button>
        </M.StepContent>
      </M.Step>
    </M.Stepper>
  )
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
  localHandle: SyncFolders.LocalHandle | null
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false
  onCancel: () => void
  onConfirm: () => void
  onLocalClick?: () => void
  open: boolean
  packageHandle: packageHandleUtils.PackageHandleBase
}

export function ConfirmDialog({
  localHandle,
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
    try {
      await ipc.invoke(IPC.EVENTS.DOWNLOAD_PACKAGE, packageHandle, localHandle)
      onConfirm()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Download package was unsuccessful', packageHandle, localHandle)
      // eslint-disable-next-line no-console
      console.error(error)
      onCancel()
    }
  }, [ipc, localHandle, onCancel, onConfirm, packageHandle])

  const [fakeProgress, setFakeProgress] = React.useState(0)
  const incrementFakeProgress = React.useCallback(() => {
    setFakeProgress((100 - fakeProgress) * 0.1 + fakeProgress)
  }, [fakeProgress])
  const handleCliOutput = React.useCallback(() => {
    if (fakeProgress) {
      incrementFakeProgress()
    } else {
      setFakeProgress(1)
      setTimeout(() => {
        incrementFakeProgress()
      }, 300)
    }
  }, [fakeProgress, incrementFakeProgress, setFakeProgress])
  React.useEffect(() => {
    ipc.on(IPC.EVENTS.CLI_OUTPUT, handleCliOutput)
    return () => {
      ipc.off(IPC.EVENTS.CLI_OUTPUT, handleCliOutput)
    }
  }, [ipc, handleCliOutput])
  // TODO: indeterminate always, change to circular
  //       move determinate to its own component, tiny line under header
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
        <ConfirmDialogContent
          localHandle={localHandle}
          onLocalClick={onLocalClick}
          packageHandle={packageHandle}
        />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button disabled={syncing} onClick={handleCancel}>
          Cancel
        </M.Button>
        <M.Button
          disabled={syncing || !localHandle?.path}
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
    try {
      const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
      if (!newLocalPath) return
      onChange(newLocalPath)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Couldnt get local path')
      // eslint-disable-next-line no-console
      console.error(error)
    }
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
