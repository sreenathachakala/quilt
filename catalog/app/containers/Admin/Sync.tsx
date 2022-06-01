import * as React from 'react'
import * as M from '@material-ui/core'

import * as SyncFolders from 'containers/SyncFolders'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as IPC from 'utils/electron/ipc-provider'
import * as s3paths from 'utils/s3paths'

import * as Table from './Table'

interface ConfirmDeletionDialogProps {
  onCancel: () => void
  onSubmit: (v: SyncFolders.DataRow) => void
  value: SyncFolders.DataRow | null
}

function ConfirmDeletionDialog({
  onCancel,
  onSubmit,
  value,
}: ConfirmDeletionDialogProps) {
  const handleSubmit = React.useCallback(() => {
    if (value) onSubmit(value)
  }, [onSubmit, value])
  return (
    <M.Dialog open={!!value}>
      <M.DialogTitle>Remove local ⇄ s3 folder pair</M.DialogTitle>
      <M.DialogContent>
        Confirm deletion of {value?.local}⇄{value?.s3} sync pair
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary">
          Cancel
        </M.Button>
        <M.Button color="primary" onClick={handleSubmit} variant="contained">
          Remove
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

const useTableRowStyles = M.makeStyles({
  action: {
    opacity: 0.3,
    'tr:hover &': {
      opacity: 1,
    },
  },
})

interface TableRowProps {
  onEdit: (v: SyncFolders.DataRow) => void
  onRemove: (v: SyncFolders.DataRow) => void
  row: SyncFolders.DataRow
}

function TableRow({ onEdit, onRemove, row }: TableRowProps) {
  const classes = useTableRowStyles()
  const { urls } = NamedRoutes.use()
  const handle = s3paths.parseS3Url(row.s3)
  const handleRemove = React.useCallback(() => onRemove(row), [onRemove, row])
  const handleEdit = React.useCallback(() => onEdit(row), [onEdit, row])
  return (
    <M.TableRow hover>
      <M.TableCell>{row.local}</M.TableCell>
      <M.TableCell>
        <StyledLink to={urls.bucketPackageDetail(handle.bucket, handle.key)}>
          {row.s3}
        </StyledLink>
      </M.TableCell>
      <M.TableCell align="right">
        <M.Tooltip title="Remove">
          <M.IconButton
            className={classes.action}
            aria-label="Remove"
            onClick={handleRemove}
          >
            <M.Icon>delete</M.Icon>
          </M.IconButton>
        </M.Tooltip>
        <M.Tooltip title="Edit">
          <M.IconButton className={classes.action} aria-label="Edit" onClick={handleEdit}>
            <M.Icon>edit</M.Icon>
          </M.IconButton>
        </M.Tooltip>
      </M.TableCell>
    </M.TableRow>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 0, 0),
  },
}))

export default function Sync() {
  const classes = useStyles()
  const ipc = IPC.use()

  const [selected, setSelected] = React.useState<Partial<SyncFolders.DataRow> | null>(
    null,
  )
  const [removing, setRemoving] = React.useState<SyncFolders.DataRow | null>(null)

  const [folders, inc] = SyncFolders.useSyncFolders()

  const toolbarActions = React.useMemo(
    () =>
      folders
        ? [
            {
              title: 'Add local ⇄ s3 folder pair',
              icon: <M.Icon>add</M.Icon>,
              fn: () => {
                setSelected({})
              },
            },
          ]
        : [],
    [folders],
  )

  const handleRemove = React.useCallback(
    async (row: SyncFolders.DataRow) => {
      await ipc.invoke(IPC.EVENTS.SYNC_FOLDERS_REMOVE, row)

      setRemoving(null)
      inc()
    },
    [inc, ipc],
  )

  const handleEdit = React.useCallback(
    async (row: SyncFolders.DataRow) => {
      await ipc.invoke(
        row.id ? IPC.EVENTS.SYNC_FOLDERS_EDIT : IPC.EVENTS.SYNC_FOLDERS_ADD,
        row,
      )

      setSelected(null)
      inc()
    },
    [inc, ipc],
  )

  return (
    <div className={classes.root}>
      <MetaTitle>{['Sync Folders', 'Admin']}</MetaTitle>

      <SyncFolders.ManageSyncFoldersPair
        onCancel={() => setSelected(null)}
        onSubmit={handleEdit}
        value={selected}
      />

      <ConfirmDeletionDialog
        onCancel={() => setRemoving(null)}
        onSubmit={handleRemove}
        value={removing}
      />

      <M.Paper>
        <Table.Toolbar heading="Sync folders" actions={toolbarActions} />
        {folders ? (
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell>Local folder</M.TableCell>
                <M.TableCell>S3 folder</M.TableCell>
                <M.TableCell align="right">Actions</M.TableCell>
              </M.TableRow>
            </M.TableHead>
            <M.TableBody>
              {folders.map((row) => (
                <TableRow
                  key={row.id}
                  onEdit={setSelected}
                  onRemove={setRemoving}
                  row={row}
                />
              ))}
            </M.TableBody>
          </M.Table>
        ) : (
          <Table.Progress />
        )}
      </M.Paper>
    </div>
  )
}
