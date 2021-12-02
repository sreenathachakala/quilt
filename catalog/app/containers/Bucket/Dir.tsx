import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as IPC from 'utils/electron/ipc-provider'
import parseSearch from 'utils/parseSearch'
import { getBreadCrumbs, ensureNoSlash, withoutPrefix, up, decode } from 'utils/s3paths'
import mkStorage from 'utils/storage'
import type * as workflows from 'utils/workflows'

import Code from './Code'
import CopyButton from './CopyButton'
import * as Download from './Download'
import { Listing, PrefixFilter } from './Listing'
import PackageDirectoryDialog from './PackageDirectoryDialog'
import Section from './Section'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

interface RouteMap {
  bucketDir: [bucket: string, path?: string, prefix?: string]
  bucketFile: [bucket: string, path: string, version?: string]
}

type Urls = NamedRoutes.Urls<RouteMap>

const getCrumbs = R.compose(
  R.intersperse(Crumb.Sep(<>&nbsp;/ </>)),
  ({ bucket, path, urls }: { bucket: string; path: string; urls: Urls }) =>
    [{ label: bucket, path: '' }, ...getBreadCrumbs(path)].map(
      ({ label, path: segPath }) =>
        Crumb.Segment({
          label,
          to: segPath === path ? undefined : urls.bucketDir(bucket, segPath),
        }),
    ),
)

function useFormattedListing(r: requests.BucketListingResult) {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useMemo(() => {
    const dirs = r.dirs.map((name) => ({
      type: 'dir' as const,
      name: ensureNoSlash(withoutPrefix(r.path, name)),
      to: urls.bucketDir(r.bucket, name),
    }))
    const files = r.files.map(({ key, size, modified, archived }) => ({
      type: 'file' as const,
      name: withoutPrefix(r.path, key),
      to: urls.bucketFile(r.bucket, key),
      size,
      modified,
      archived,
    }))
    const items = [
      ...(r.path !== '' && !r.prefix
        ? [
            {
              type: 'dir' as const,
              name: '..',
              to: urls.bucketDir(r.bucket, up(r.path)),
            },
          ]
        : []),
      ...dirs,
      ...files,
    ]
    // filter-out files with same name as one of dirs
    return R.uniqBy(R.prop('name'), items)
  }, [r, urls])
}

interface DirContentsProps {
  response: requests.BucketListingResult
  locked: boolean
  bucket: string
  path: string
  successor: workflows.Successor | null
  setSuccessor: (successor: workflows.Successor | null) => void
  loadMore?: () => void
}

function DirContents({
  response,
  locked,
  bucket,
  path,
  successor,
  setSuccessor,
  loadMore,
}: DirContentsProps) {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()

  const onPackageDirectoryDialogExited = React.useCallback(() => {
    setSuccessor(null)
  }, [setSuccessor])

  const setPrefix = React.useCallback(
    (newPrefix) => {
      history.push(urls.bucketDir(bucket, path, newPrefix))
    },
    [history, urls, bucket, path],
  )

  const items = useFormattedListing(response)

  // TODO: should prefix filtering affect summary?
  return (
    <>
      <PackageDirectoryDialog
        bucket={bucket}
        path={path}
        files={response.files}
        dirs={response.dirs}
        truncated={response.truncated}
        open={!!successor}
        successor={successor}
        onExited={onPackageDirectoryDialogExited}
      />

      <Listing
        items={items}
        locked={locked}
        loadMore={loadMore}
        truncated={response.truncated}
        prefixFilter={response.prefix}
        toolbarContents={
          <PrefixFilter
            key={`${response.bucket}/${response.path}`}
            prefix={response.prefix}
            setPrefix={setPrefix}
          />
        }
      />
      {/* Remove TS workaround when Summary will be converted to .tsx */}
      {/* @ts-expect-error */}
      <Summary files={response.files} mkUrl={null} />
    </>
  )
}

interface LocalFolderInputProps {
  onChange: (path: string) => void
  open: boolean
  value: string | null
}

const STORAGE_KEYS = {
  LOCAL_FOLDER: 'LOCAL_FOLDER',
}
const storage = mkStorage({
  [STORAGE_KEYS.LOCAL_FOLDER]: STORAGE_KEYS.LOCAL_FOLDER,
})

function LocalFolderInput({ onChange, open, value }: LocalFolderInputProps) {
  const ipc = IPC.use()

  const handleClick = React.useCallback(async () => {
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [ipc, onChange])

  return (
    <Section
      icon="folder_open"
      extraSummary={null}
      heading="Local folder"
      defaultExpanded={open}
      gutterBottom
    >
      <M.TextField
        fullWidth
        size="small"
        disabled={false}
        helperText="Click to set local folder with your file browser"
        id="localPath"
        label="Path to local folder"
        onClick={handleClick}
        value={value}
      />
    </Section>
  )
}

const useStyles = M.makeStyles((t) => ({
  crumbs: {
    ...t.typography.body1,
    maxWidth: '100%',
    overflowWrap: 'break-word',
  },
  button: {
    flexShrink: 0,
    marginBottom: '-3px',
    marginLeft: t.spacing(1),
    marginTop: '-3px',
  },
}))

interface DirParams {
  bucket: string
  path?: string
}

export default function Dir({
  match: {
    params: { bucket, path: encodedPath = '' },
  },
  location: l,
}: RRDom.RouteComponentProps<DirParams>) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use<RouteMap>()
  const s3 = AWS.S3.use()
  const preferences = BucketPreferences.use()
  const { prefix } = parseSearch(l.search)
  const path = decode(encodedPath)
  const dest = path ? basename(path) : bucket

  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: dedent`
          import quilt3
          b = quilt3.Bucket("s3://${bucket}")
          # list files
          b.ls("${path}")
          # download
          b.fetch("${path}", "./${dest}")
        `,
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: dedent`
          # list files
          aws s3 ls "s3://${bucket}/${path}"
          # download
          aws s3 cp --recursive "s3://${bucket}/${path}" "./${dest}"
        `,
      },
    ],
    [bucket, path, dest],
  )

  const [successor, setSuccessor] = React.useState<workflows.Successor | null>(null)

  const [prev, setPrev] = React.useState<requests.BucketListingResult | null>(null)

  React.useLayoutEffect(() => {
    // reset accumulated results when path and / or prefix change
    setPrev(null)
  }, [path, prefix])

  const data = useData(requests.bucketListing, {
    s3,
    bucket,
    path,
    prefix,
    prev,
  })

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

  const [expandedLocalFolder, setExpandedLocalFolder] = React.useState(false)

  const [localFolder, setLocalFolder] = React.useState(() => {
    try {
      return storage.get(STORAGE_KEYS.LOCAL_FOLDER) || ''
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      return ''
    }
  })
  const handleLocalFolderChange = React.useCallback(
    (newLocalPath) => {
      storage.set(STORAGE_KEYS.LOCAL_FOLDER, newLocalPath)
      setLocalFolder(newLocalPath)
    },
    [setLocalFolder],
  )

  return (
    <M.Box pt={2} pb={4}>
      <MetaTitle>{[path || 'Files', bucket]}</MetaTitle>

      <M.Box display="flex" alignItems="flex-start" mb={2}>
        <div className={classes.crumbs} onCopy={copyWithoutSpaces}>
          {renderCrumbs(getCrumbs({ bucket, path, urls }))}
        </div>
        <M.Box flexGrow={1} />
        {preferences?.ui?.actions?.createPackage && (
          <CopyButton bucket={bucket} className={classes.button} onChange={setSuccessor}>
            Create package from directory
          </CopyButton>
        )}
        <Download.DirectoryButton
          className={classes.button}
          bucket={bucket}
          path={path}
          onClick={() => setExpandedLocalFolder(true)}
        />
      </M.Box>

      <LocalFolderInput
        onChange={handleLocalFolderChange}
        open={expandedLocalFolder}
        value={localFolder}
      />

      <Download.ConfirmDialog
        open={!!localFolder && !!expandedLocalFolder}
        localPath={localFolder}
        remotePath={`s3://${bucket}/${path}`}
        onClose={() => setExpandedLocalFolder(false)}
      />

      <Code gutterBottom>{code}</Code>

      {data.case({
        Err: displayError(),
        Init: () => null,
        _: (x: $TSFixMe) => {
          const res: requests.BucketListingResult | null = AsyncResult.getPrevResult(x)
          return res ? (
            <DirContents
              response={res}
              locked={!AsyncResult.Ok.is(x)}
              bucket={bucket}
              path={path}
              successor={successor}
              setSuccessor={setSuccessor}
              loadMore={loadMore}
            />
          ) : (
            <M.CircularProgress />
          )
        },
      })}
    </M.Box>
  )
}
