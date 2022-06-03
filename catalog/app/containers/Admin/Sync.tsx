import * as React from 'react'
import * as M from '@material-ui/core'

import * as SyncFolders from 'containers/SyncFolders'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { PackageHandleBase, toS3Url } from 'utils/packageHandle'

import * as Table from './Table'

interface ConfirmDeletionDialogProps {
  onCancel: () => void
  onSubmit: (v: SyncFolders.SyncGroup) => void
  value: SyncFolders.SyncGroup | null
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
        Confirm deletion of {value?.localHandle.path}⇄{toS3Url(value?.packageHandle)} sync
        pair
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

interface PackageLinkProps {
  packageHandle: PackageHandleBase
}

function PackageLink({ packageHandle }: PackageLinkProps) {
  const { urls } = NamedRoutes.use()
  const { name, bucket } = packageHandle
  return (
    <StyledLink to={urls.bucketPackageDetail(bucket, name)}>
      {toS3Url(packageHandle)}
    </StyledLink>
  )
}

interface TableRowProps {
  onEdit: (v: SyncFolders.SyncGroup) => void
  onRemove: (v: SyncFolders.SyncGroup) => void
  row: SyncFolders.SyncGroup
}

function TableRow({ onEdit, onRemove, row }: TableRowProps) {
  const classes = useTableRowStyles()
  const handleRemove = React.useCallback(() => onRemove(row), [onRemove, row])
  const handleEdit = React.useCallback(() => onEdit(row), [onEdit, row])
  return (
    <M.TableRow hover>
      <M.TableCell>{row.localHandle.path}</M.TableCell>
      <M.TableCell>
        <PackageLink packageHandle={row.packageHandle} />
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

  const [selected, setSelected] = React.useState<Partial<SyncFolders.SyncGroup> | null>(
    null,
  )
  const [removing, setRemoving] = React.useState<SyncFolders.SyncGroup | null>(null)

  const [folders, inc] = SyncFolders.useFolders()
  const { remove, manage } = SyncFolders.useActions()

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
    async (row: SyncFolders.SyncGroup) => {
      await remove(row)

      setRemoving(null)
      inc()
    },
    [inc, remove],
  )

  const handleEdit = React.useCallback(
    async (row: SyncFolders.SyncGroup) => {
      await manage(row)

      setSelected(null)
      inc()
    },
    [inc, manage],
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
