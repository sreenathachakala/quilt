import * as React from 'react'
import * as M from '@material-ui/core'

interface ConfirmDialogProps {
  children: React.ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <M.Dialog open={!!children}>
      <M.DialogTitle>Network actions need your approval:</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText>
          <pre>{children}</pre>
        </M.DialogContentText>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onConfirm} color="primary">
          Ok
        </M.Button>
        <M.Button onClick={onCancel} color="primary">
          Cancel
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
