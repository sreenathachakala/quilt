import cx from 'classnames'
import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import Layout from 'components/Layout'
import * as S3FilePicker from 'containers/Bucket/PackageDialog/S3FilePicker'
import * as BucketConfig from 'utils/BucketConfig'
import * as IPC from 'utils/electron-ipc'
import mkStorage from 'utils/storage'

import ConfirmDialog from './ConfirmDialog'
import RemoteDirContents from './RemoteDirContents'

interface InputLocalPathProps {
  className: string
  disabled: boolean
  onClick: () => void
  value: string
}

function InputLocalPath({ className, disabled, onClick, value }: InputLocalPathProps) {
  return (
    <M.TextField
      className={className}
      disabled={disabled}
      helperText="Click to set local folder with your file browser"
      id="localPath"
      label="Path to local folder"
      onClick={onClick}
      value={value}
    />
  )
}

interface DownloadCompleteProps {
  localPath: string
  onClose: () => void
  open: boolean
}

function DownloadComplete({ open, localPath, onClose }: DownloadCompleteProps) {
  const ipc = IPC.use()
  const handleOpenLocalPath = React.useCallback(async () => {
    await ipc.invoke(IPC.EVENTS.OPEN_IN_EXPLORER, localPath)
    onClose()
  }, [ipc, localPath, onClose])
  return (
    <M.Dialog open={open} maxWidth="sm">
      <M.DialogTitle>Download complete</M.DialogTitle>
      <M.DialogContent>
        Files are downloaded to <Code>{localPath}</Code>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
        <M.Button onClick={handleOpenLocalPath} color="primary" variant="contained">
          Open folder
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

const useSpinnerStyles = M.makeStyles({
  root: {
    padding: '12px',
    textAlign: 'center',
    width: '80%',
  },
  shrink: {
    width: 0,
  },
})

interface SpinnerProps {
  className?: string
  value: number
}

function Spinner({ className, value }: SpinnerProps) {
  const classes = useSpinnerStyles()
  const title = value ? 'Files are downloading…' : 'Files are preparing for download…'
  const progressVariant = value ? 'determinate' : 'indeterminate'
  return (
    <M.Container maxWidth="lg" className={cx(classes.root, className)}>
      <M.Typography gutterBottom variant="h5">
        {title}
      </M.Typography>
      <M.LinearProgress
        color="primary"
        className={cx({ [classes.shrink]: value === 1 })}
        variant={progressVariant}
        value={value === 1 ? 0 : value}
      />
    </M.Container>
  )
}

function getUniqS3Paths(s3Files: S3FilePicker.S3File[]): S3FilePicker.S3File[] {
  return s3Files.reduce((memo, s3File) => {
    if (
      s3Files.some(
        (comparingS3File) =>
          comparingS3File !== s3File && s3File.key.includes(comparingS3File.key, 0),
      )
    )
      return memo
    return memo.concat(s3File)
  }, [] as S3FilePicker.S3File[])
}

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'flex-start',
    display: 'flex',
    margin: t.spacing(4, 0),
    minHeight: t.spacing(50),
    position: 'relative',
  },
  actions: {
    display: 'flex',
    margin: t.spacing(0, 0, 0, 4),
  },
  actionButton: {
    margin: t.spacing(0, 1, 0, 0),
  },
  selectedFile: {
    margin: t.spacing(0, 1, 1, 0),
    maxWidth: '100%',
  },
  downloadButton: {
    margin: t.spacing(0, 0, 0, 'auto'),
  },
  localContainer: {
    margin: t.spacing(0, 0, 2),
    padding: t.spacing(2),
  },
  local: {
    width: '100%',
  },
  remote: {
    display: 'flex',
    flexDirection: 'column',
    height: t.spacing(79),
  },
  remoteContainer: {
    flexGrow: 1,
    margin: t.spacing(0, 0, 2),
  },
  sidePane: {
    display: 'flex',
    flexDirection: 'column',
    margin: t.spacing(0, 0, 0, 2),
    width: t.spacing(40),
  },
  spinner: {
    background: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'column',
    zIndex: 10,
  },
  filesContainer: {
    margin: t.spacing(0, 0, 2),
    maxHeight: t.spacing(58),
    overflowX: 'hidden',
    overflowY: 'auto',
    padding: t.spacing(2, 2, 1),
    '&:empty': {
      display: 'none',
    },
  },
}))

const STORAGE_KEYS = {
  LOCAL_PATH: 'LOCAL_PATH',
  REMOTE_BUCKET: 'REMOTE_BUCKET',
}
const storage = mkStorage({
  [STORAGE_KEYS.LOCAL_PATH]: STORAGE_KEYS.LOCAL_PATH,
  [STORAGE_KEYS.REMOTE_BUCKET]: STORAGE_KEYS.REMOTE_BUCKET,
})

export default function SyncDownload() {
  const classes = useStyles()

  const ipc = IPC.use()

  const [syncing, setSyncing] = React.useState(false)
  const [actionsToConfirm, setActionsToConfirm] = React.useState('')
  const [fakeProgress, setFakeProgress] = React.useState(0)
  const [localPath, setLocalPath] = React.useState(() => {
    try {
      return storage.get(STORAGE_KEYS.LOCAL_PATH) || ''
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      return ''
    }
  })
  const [key, setKey] = React.useState(0)

  const handleSync = React.useCallback(
    (event, shouldLock) => setSyncing(shouldLock),
    [setSyncing],
  )

  const handleConfirmRequest = React.useCallback(
    (event, output: string) => setActionsToConfirm(output),
    [setActionsToConfirm],
  )

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
    ipc.on(IPC.EVENTS.LOCK_SET, handleSync)
    ipc.on(IPC.EVENTS.CONFIRM_REQUEST, handleConfirmRequest)
    ipc.on(IPC.EVENTS.CLI_OUTPUT, handleCliOutput)

    return () => {
      ipc.off(IPC.EVENTS.LOCK_SET, handleSync)
      ipc.off(IPC.EVENTS.CONFIRM_REQUEST, handleConfirmRequest)
      ipc.off(IPC.EVENTS.CLI_OUTPUT, handleCliOutput)
    }
  }, [ipc, handleSync, handleConfirmRequest, handleCliOutput])

  const [selectedFiles, setSelectedFiles] = React.useState<S3FilePicker.S3File[]>([])
  const [succeed, setSucceed] = React.useState(false)

  const handleDownloadClick = React.useCallback(async () => {
    setSyncing(true)
    await ipc.invoke(IPC.EVENTS.SYNC_DOWNLOAD, selectedFiles, localPath)
    setFakeProgress(100)
    setSelectedFiles([])
    setKey(R.inc)
    setSyncing(false)
    setSucceed(true)
    setFakeProgress(0)
  }, [ipc, localPath, selectedFiles, setSyncing])

  const handleOk = React.useCallback(() => {
    ipc.invoke(IPC.EVENTS.CONFIRM_RESPONSE, true)
    setActionsToConfirm('')
  }, [ipc, setActionsToConfirm])

  const handleCancel = React.useCallback(() => {
    ipc.invoke(IPC.EVENTS.CONFIRM_RESPONSE, false)
    setActionsToConfirm('')
  }, [ipc, setActionsToConfirm])

  const handleLocalPath = React.useCallback(async () => {
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    setLocalPath(newLocalPath)
    storage.set(STORAGE_KEYS.LOCAL_PATH, newLocalPath)
  }, [ipc, setLocalPath])

  const actionsDisabled = syncing || !localPath || !selectedFiles.length

  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const buckets = FP.function.pipe(
    bucketConfigs,
    R.sortBy(({ relevanceScore }) => -relevanceScore),
    R.pluck('name'),
  )

  const [bucket, setBucket] = React.useState(
    storage.get(STORAGE_KEYS.REMOTE_BUCKET) || buckets[0],
  )
  const handleAddingS3Files = React.useCallback(
    (reason: S3FilePicker.CloseReason) => {
      if (!!reason && typeof reason === 'object') {
        setSelectedFiles(getUniqS3Paths(selectedFiles.concat(reason.files)))
        setKey(R.inc)
      }
    },
    [selectedFiles, setSelectedFiles],
  )
  const handleSelectingBucket = React.useCallback(
    (newBucket) => {
      setBucket(newBucket)
      storage.set(STORAGE_KEYS.REMOTE_BUCKET, newBucket)
    },
    [setBucket],
  )

  const removeSelectedFile = React.useCallback(
    (file) => {
      setSelectedFiles(R.without([file], selectedFiles))
    },
    [selectedFiles, setSelectedFiles],
  )

  return (
    <Layout noFooter>
      <M.Container maxWidth="lg" className={classes.root}>
        <M.Paper className={classes.remoteContainer}>
          <RemoteDirContents
            className={classes.remote}
            bucket={bucket}
            buckets={buckets}
            selectBucket={handleSelectingBucket}
            onAdd={handleAddingS3Files}
            resetSelectionKey={key}
          />
        </M.Paper>

        <div className={classes.sidePane}>
          <M.Paper className={classes.localContainer}>
            <InputLocalPath
              className={classes.local}
              disabled={syncing}
              onClick={handleLocalPath}
              value={localPath}
            />
          </M.Paper>

          <M.Grow in={!!selectedFiles.length}>
            <M.Paper className={classes.filesContainer}>
              {selectedFiles.map((selectedFile) => (
                <M.Chip
                  className={classes.selectedFile}
                  key={selectedFile.key}
                  label={selectedFile.key}
                  onDelete={() => removeSelectedFile(selectedFile)}
                  title={selectedFile.key}
                />
              ))}
            </M.Paper>
          </M.Grow>

          <div className={classes.actions}>
            <M.Button
              className={cx(classes.actionButton, classes.downloadButton)}
              variant="contained"
              color="primary"
              disabled={actionsDisabled}
              onClick={handleDownloadClick}
            >
              Download files
            </M.Button>
          </div>
        </div>

        <M.Backdrop open={syncing} className={classes.spinner}>
          <Spinner value={fakeProgress} />
        </M.Backdrop>

        <DownloadComplete
          open={succeed}
          localPath={localPath}
          onClose={() => setSucceed(false)}
        />

        <ConfirmDialog onConfirm={handleOk} onCancel={handleCancel}>
          {actionsToConfirm}
        </ConfirmDialog>
      </M.Container>
    </Layout>
  )
}
