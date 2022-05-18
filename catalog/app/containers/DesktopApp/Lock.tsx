import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as IPC from 'utils/electron/ipc-provider'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(4, 2),
  },
  progress: {
    margin: t.spacing(2, 0, 0),
  },
}))

export default function Lock() {
  const classes = useStyles()

  const ipc = IPC.use()

  const [open, setOpen] = React.useState(false)
  const [eta, setEta] = React.useState(5)

  const disabled = React.useMemo(() => eta > 0, [eta])

  const handleClose = React.useCallback(() => {
    if (disabled) return
    setOpen(false)
  }, [disabled])

  const handleLock = React.useCallback((event, lock) => setOpen(lock), [])

  React.useEffect(() => {
    ipc.on(IPC.EVENTS.LOCK, handleLock)
    return () => ipc.off(IPC.EVENTS.LOCK, handleLock)
  }, [ipc, handleLock])

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (disabled) {
        setEta(R.dec)
      } else {
        clearInterval(timer)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [disabled])

  return (
    <M.Dialog
      className={classes.root}
      fullWidth
      maxWidth="sm"
      onClose={handleClose}
      open={open}
    >
      <M.DialogTitle>Action is in progress</M.DialogTitle>
      <M.DialogContent>
        <M.LinearProgress className={classes.progress} />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button
          variant="contained"
          onClick={handleClose}
          color="primary"
          disabled={disabled}
        >
          Acknowledge and proceed to the app{disabled ? ` (${eta})` : ''}
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
