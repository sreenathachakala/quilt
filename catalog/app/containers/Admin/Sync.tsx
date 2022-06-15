import * as React from 'react'
import * as M from '@material-ui/core'

import * as SyncFolders from 'containers/SyncFolders'
import MetaTitle from 'utils/MetaTitle'
import * as IPC from 'utils/electron/ipc-provider'

type LocalFolderInputProps = M.TextFieldProps & {
  input: {
    value: string
    onChange: (value: string) => void
  }
}

function LocalFolderInput({ input, ...props }: LocalFolderInputProps) {
  const ipc = IPC.use()

  const { onChange, value } = input

  const handleClick = React.useCallback(async () => {
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [ipc, onChange])

  return (
    <M.TextField
      onClick={handleClick}
      placeholder="~/Quilt"
      size="small"
      value={value}
      {...props}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 0, 0),
  },
  content: {
    padding: t.spacing(2),
  },
  title: {
    margin: t.spacing(0, 0, 2),
    padding: t.spacing(0, 2),
  },
  input: {
    width: '100%',
  },
}))

export default function Sync() {
  const classes = useStyles()

  const [root, inc] = SyncFolders.useRoot()
  const { changeRoot } = SyncFolders.useActions()

  const handleEdit = React.useCallback(
    async (path: string) => {
      await changeRoot({ path })
      inc()
    },
    [inc, changeRoot],
  )

  const inputProps = React.useMemo(
    () => ({
      onChange: handleEdit,
      value: root?.path || '',
    }),
    [handleEdit, root?.path],
  )

  return (
    <div className={classes.root}>
      <MetaTitle>{['Sync Folders', 'Admin']}</MetaTitle>

      <M.Typography variant="h4" className={classes.title}>
        Teleport settings
      </M.Typography>

      <M.Paper className={classes.content}>
        <M.Typography variant="h6">Local root directory</M.Typography>

        <LocalFolderInput className={classes.input} input={inputProps} />
      </M.Paper>
    </div>
  )
}
