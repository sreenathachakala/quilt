import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as DG from '@material-ui/data-grid'

import { Crumb, render as renderCrumbs } from 'components/BreadCrumbs'
import * as Listing from 'containers/Bucket/Listing'
import SubmitSpinner from 'containers/Bucket/PackageDialog/SubmitSpinner'
import { displayError } from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import { linkStyle } from 'utils/StyledLink'
import { getBreadCrumbs, ensureSlash, ensureNoSlash, withoutPrefix } from 'utils/s3paths'

export interface S3File {
  bucket: string
  key: string
  version?: string
  size: number
}

function useFormattedListing(r: requests.BucketListingResult) {
  return React.useMemo(() => {
    const dirs = r.dirs.map((name) => ({
      type: 'dir' as const,
      name: ensureNoSlash(withoutPrefix(r.path, name)),
      to: name,
    }))
    const files = r.files.map(({ key, size, modified, archived }) => ({
      type: 'file' as const,
      name: withoutPrefix(r.path, key),
      to: key,
      size,
      modified,
      archived,
    }))
    const items = [...dirs, ...files]
    // filter-out files with same name as one of dirs
    return R.uniqBy(R.prop('name'), items)
  }, [r])
}

const useDirContentsStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    borderTop: `1px solid ${t.palette.divider}`,
    flexGrow: 1,
    marginLeft: t.spacing(2),
    marginRight: t.spacing(2),
    marginTop: t.spacing(1),
  },
  interactive: {
    cursor: 'pointer',
  },
}))

interface DirContentsProps {
  response: requests.BucketListingResult
  locked: boolean
  setPath: (path: string) => void
  setPrefix: (prefix: string) => void
  loadMore: () => void
  selection: DG.GridRowId[]
  onSelectionChange: (newSelection: DG.GridRowId[]) => void
}

function DirContents({
  response,
  locked,
  setPath,
  setPrefix,
  loadMore,
  selection,
  onSelectionChange,
}: DirContentsProps) {
  const classes = useDirContentsStyles()
  const items = useFormattedListing(response)
  const { bucket, path, prefix, truncated } = response

  React.useLayoutEffect(() => {
    // reset selection when bucket, path and / or prefix change
    onSelectionChange([])
  }, [onSelectionChange, bucket, path, prefix])

  const CellComponent = React.useMemo(
    () =>
      function Cell({ item, className, ...props }: Listing.CellProps) {
        const onClick = React.useCallback(() => {
          if (item.type === 'dir') {
            setPath(item.to)
            setPrefix('')
          }
        }, [item])
        return (
          // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
          <div
            role="button"
            onClick={onClick}
            className={cx(item.type === 'dir' && classes.interactive, className)}
            {...props}
          />
        )
      },
    [classes.interactive, setPath, setPrefix],
  )

  return (
    <Listing.Listing
      items={items}
      locked={locked}
      loadMore={loadMore}
      truncated={truncated}
      prefixFilter={prefix}
      selection={selection}
      onSelectionChange={onSelectionChange}
      CellComponent={CellComponent}
      RootComponent="div"
      className={classes.root}
      dataGridProps={{ autoHeight: false }}
      pageSize={10}
      toolbarContents={
        <Listing.PrefixFilter
          key={`${bucket}/${path}`}
          prefix={prefix}
          setPrefix={setPrefix}
        />
      }
    />
  )
}

const getCrumbs = R.compose(R.intersperse(Crumb.Sep(<>&nbsp;/ </>)), (path: string) =>
  [{ label: 'ROOT', path: '' }, ...getBreadCrumbs(path)].map(({ label, path: segPath }) =>
    Crumb.Segment({ label, to: segPath === path ? undefined : segPath }),
  ),
)

function ExpandMore({ className }: { className?: string }) {
  return <M.Icon className={className}>expand_more</M.Icon>
}

const useBucketSelectStyles = M.makeStyles({
  root: {
    ...linkStyle,
    font: 'inherit',
  },
  select: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  icon: {
    color: 'inherit',
  },
})

interface BucketSelectProps {
  bucket: string
  buckets: string[]
  selectBucket: (bucket: string) => void
}

function BucketSelect({ bucket, buckets, selectBucket }: BucketSelectProps) {
  const classes = useBucketSelectStyles()

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<{ value: unknown }>) => {
      selectBucket(e.target.value as string)
    },
    [selectBucket],
  )

  return (
    <M.Select
      value={bucket}
      onChange={handleChange}
      input={<M.InputBase />}
      className={classes.root}
      classes={{ select: classes.select, icon: classes.icon }}
      IconComponent={ExpandMore}
    >
      {buckets.map((b) => (
        <M.MenuItem key={b} value={b}>
          {b}
        </M.MenuItem>
      ))}
    </M.Select>
  )
}

export type CloseReason = { path: string; files: S3File[] }

const useStyles = M.makeStyles((t) => ({
  actions: {
    display: 'flex',
    alignItems: 'flex-end',
    padding: t.spacing(2, 3),
  },
  crumbs: {
    ...t.typography.body1,
    marginTop: -t.spacing(1),
    maxWidth: '100%',
    overflowWrap: 'break-word',
    paddingLeft: t.spacing(3),
    paddingRight: t.spacing(3),
  },
  header: {
    padding: t.spacing(2, 3),
  },
  lock: {
    background: 'rgba(255,255,255,0.5)',
    bottom: 52,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 56,
    zIndex: 1,
  },
}))

interface RemoteDirContentsProps {
  bucket: string
  buckets?: string[]
  className: string
  onAdd: (reason: CloseReason) => void
  resetSelectionKey?: number
  selectBucket?: (bucket: string) => void
}

export default function RemoteDirContents({
  bucket,
  buckets,
  className,
  onAdd,
  selectBucket,
  resetSelectionKey = 0,
}: RemoteDirContentsProps) {
  const classes = useStyles()

  const bucketListing = requests.useBucketListing()

  const [path, setPath] = React.useState('')
  const [prefix, setPrefix] = React.useState('')
  const [prev, setPrev] = React.useState<requests.BucketListingResult | null>(null)
  const [selection, setSelection] = React.useState<DG.GridRowId[]>([])

  const [locked] = React.useState(false)

  const crumbs = React.useMemo(() => getCrumbs(path), [path])

  const getCrumbLinkProps = ({ to }: { to: string }) => ({
    onClick: () => {
      setPath(to)
    },
  })

  React.useLayoutEffect(() => {
    // reset accumulated results when bucket, path and / or prefix change
    setPrev(null)
  }, [bucket, path, prefix])

  React.useLayoutEffect(() => {
    // reset state when bucket changes
    setPath('')
    setPrefix('')
    setSelection([])
  }, [bucket])

  React.useLayoutEffect(() => {
    // reset selection on demand
    setSelection([])
  }, [resetSelectionKey])

  const data = useData(bucketListing, { bucket, path, prefix, prev, drain: true })

  const loadMore = React.useCallback(() => {
    AsyncResult.case(
      {
        Ok: (res: requests.BucketListingResult) => {
          // this triggers a re-render and fetching of next page of results
          if (res.continuationToken) setPrev(res)
        },
        _: () => {},
      },
      data.result,
    )
  }, [data.result])

  const add = React.useCallback(() => {
    data.case({
      Ok: async (r: requests.BucketListingResult) => {
        onAdd({
          files: selection.map((basename) => {
            const isDir = r.dirs.some(
              (dir) => ensureNoSlash(dir) === ensureNoSlash(path + basename),
            )
            const slashPolicy = isDir ? ensureSlash : ensureNoSlash
            return {
              bucket,
              key: slashPolicy(path + basename),
              size: 0,
            }
          }),
          path,
        })
      },
      _: () => {},
    })
  }, [data, onAdd, selection, bucket, path])

  return (
    <M.Box className={className}>
      <M.Box className={classes.header}>
        <M.Typography component="h2" variant="h6">
          Download files from s3://
          {!!buckets && buckets.length > 1 && !!selectBucket ? (
            <BucketSelect bucket={bucket} buckets={buckets} selectBucket={selectBucket} />
          ) : (
            bucket
          )}
        </M.Typography>
      </M.Box>
      <div className={classes.crumbs}>
        {renderCrumbs(crumbs, { getLinkProps: getCrumbLinkProps })}
      </div>
      {data.case({
        // TODO: customized error display?
        Err: displayError(),
        Init: () => null,
        _: (x: $TSFixMe) => {
          const res: requests.BucketListingResult | null = AsyncResult.getPrevResult(x)
          return res ? (
            <DirContents
              response={res}
              locked={!AsyncResult.Ok.is(x)}
              setPath={setPath}
              setPrefix={setPrefix}
              loadMore={loadMore}
              selection={selection}
              onSelectionChange={setSelection}
            />
          ) : (
            // TODO: skeleton
            <M.Box px={3} pt={2} flexGrow={1}>
              <M.CircularProgress />
            </M.Box>
          )
        },
      })}
      {locked && <div className={classes.lock} />}
      <M.Box className={classes.actions}>
        {locked ? (
          <SubmitSpinner>Adding files</SubmitSpinner>
        ) : (
          <M.Box flexGrow={1} display="flex" alignItems="center">
            <M.Typography variant="body2" color="textSecondary">
              {selection.length} item{selection.length === 1 ? '' : 's'} selected
            </M.Typography>
          </M.Box>
        )}
        <M.Button
          onClick={add}
          variant="outlined"
          color="primary"
          disabled={locked || !selection.length}
        >
          Add selected files to batch download
        </M.Button>
      </M.Box>
    </M.Box>
  )
}
