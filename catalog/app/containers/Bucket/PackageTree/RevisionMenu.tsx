import * as React from 'react'
import * as M from '@material-ui/core'

interface RevisionMenuProps {
  className: string
  onDelete: () => void
  onDesktop: () => void
}

export default function RevisionMenu({
  className,
  onDelete,
  onDesktop,
}: RevisionMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  const handleOpen = React.useCallback(
    (event) => {
      setAnchorEl(event.target)
    },
    [setAnchorEl],
  )

  const handleClose = React.useCallback(() => {
    setAnchorEl(null)
  }, [setAnchorEl])

  const handleDeleteClick = React.useCallback(() => {
    onDelete()
    setAnchorEl(null)
  }, [onDelete, setAnchorEl])
  const handleDesktopClick = React.useCallback(() => {
    onDesktop()
    setAnchorEl(null)
  }, [setAnchorEl])

  return (
    <>
      <M.IconButton className={className} onClick={handleOpen} size="small">
        <M.Icon>more_vert</M.Icon>
      </M.IconButton>

      <M.Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        <M.MenuItem onClick={handleDeleteClick}>Delete revision</M.MenuItem>
        <M.MenuItem onClick={handleDesktopClick}>Open in Desktop</M.MenuItem>
      </M.Menu>
    </>
  )
}
