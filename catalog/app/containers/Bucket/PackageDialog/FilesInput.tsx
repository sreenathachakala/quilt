import cx from 'classnames'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone, FileWithPath } from 'react-dropzone'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as Lab from '@material-ui/lab'

import * as urls from 'constants/urls'
import * as Model from 'model'
import StyledLink from 'utils/StyledLink'
import dissocBy from 'utils/dissocBy'
import useDragging from 'utils/dragging'
import { withoutPrefix } from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import * as tagged from 'utils/taggedV2'
import useMemoEq from 'utils/useMemoEq'
import * as Types from 'utils/types'

import EditFileMeta from './EditFileMeta'
import * as PD from './PackageDialog'
import * as S3FilePicker from './S3FilePicker'

const stopPropagation = (e: React.MouseEvent) => {
  // stop click from propagating to parent elements and triggering their handlers
  e.stopPropagation()
}

interface FileAction {
  icon: React.ReactNode
  key: string
  onClick: () => void
  text: string
}

interface FileMenuProps {
  actions: FileAction[]
  className: string
}

function FileMenu({ className, actions }: FileMenuProps) {
  return (
    <M.ButtonGroup className={className} size="small" variant="text">
      {actions.map(({ onClick, icon, text, key }) => (
        <M.Button startIcon={icon} key={key} onClick={onClick}>
          {text}
        </M.Button>
      ))}
    </M.ButtonGroup>
  )
}

const useCheckboxStyles = M.makeStyles((t) => ({
  root: {
    color: `${t.palette.action.active} !important`,
    padding: 3,
    '&:hover': {
      backgroundColor: `${fade(
        t.palette.action.active,
        t.palette.action.hoverOpacity,
      )} !important`,
    },
    '& svg': {
      fontSize: '18px',
    },
  },
}))

export function Checkbox({ className, ...props }: M.CheckboxProps) {
  const classes = useCheckboxStyles()
  return <M.Checkbox className={cx(classes.root, className)} {...props} />
}

const COLORS = {
  default: M.colors.grey[900],
  added: M.colors.green[900],
  modified: M.darken(M.colors.yellow[900], 0.2),
  deleted: M.colors.red[900],
}

interface FileWithHash extends File {
  hash: {
    ready: boolean
    value?: string
    error?: Error
    promise: Promise<string | undefined>
  }
  meta?: Types.JsonRecord
}

const hasHash = (f: File): f is FileWithHash => !!f && !!(f as FileWithHash).hash

const hashLimit = pLimit(2)

function computeHash(f: File) {
  if (hasHash(f)) return f
  const hashP = hashLimit(PD.hashFile, f)
  const fh = f as FileWithHash
  fh.hash = { ready: false } as any
  fh.hash.promise = hashP
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.log(`Error hashing file "${fh.name}":`)
      // eslint-disable-next-line no-console
      console.error(e)
      fh.hash.error = e
      fh.hash.ready = true
      return undefined
    })
    .then((hash) => {
      fh.hash.value = hash
      fh.hash.ready = true
      return hash
    })
  return fh
}

export const FilesAction = tagged.create(
  'app/containers/Bucket/PackageDialog/FilesInput:FilesAction' as const,
  {
    Add: (v: { files: FileWithHash[]; prefix?: string }) => v,
    AddFromS3: (v: {
      files: S3FilePicker.S3File[]
      basePrefix: string
      prefix?: string
    }) => v,
    Delete: (path: string) => path,
    DeleteDir: (prefix: string) => prefix,
    Meta: (v: { path: string; meta: Types.JsonRecord }) => v,
    Revert: (path: string) => path,
    RevertDir: (prefix: string) => prefix,
    Reset: () => {},
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FilesAction = tagged.InstanceOf<typeof FilesAction>

export type LocalFile = FileWithPath & FileWithHash

export interface FilesState {
  added: Record<string, LocalFile | S3FilePicker.S3File>
  deleted: Record<string, true>
  existing: Record<string, Model.PackageEntry>
  // XXX: workaround used to re-trigger validation and dependent computations
  // required due to direct mutations of File objects
  counter?: number
}

const addMetaToFile = (
  file: Model.PackageEntry | LocalFile | S3FilePicker.S3File,
  meta: Types.JsonRecord,
) => {
  if (file instanceof window.File) {
    const fileCopy = new window.File([file as File], (file as File).name, {
      type: (file as File).type,
    })
    Object.defineProperty(fileCopy, 'meta', {
      value: meta,
    })
    Object.defineProperty(fileCopy, 'hash', {
      value: (file as FileWithHash).hash,
    })
    return fileCopy
  }
  return R.assoc('meta', meta, file)
}

const handleFilesAction = FilesAction.match<
  (state: FilesState) => FilesState,
  [{ initial: FilesState }]
>({
  Add:
    ({ files, prefix }) =>
    (state) =>
      files.reduce((acc, file) => {
        const path = (prefix || '') + PD.getNormalizedPath(file)
        return R.evolve(
          {
            added: R.assoc(path, file),
            deleted: R.dissoc(path),
          },
          acc,
        )
      }, state),
  AddFromS3:
    ({ files, basePrefix, prefix }) =>
    (state) =>
      files.reduce((acc, file) => {
        const path = (prefix || '') + withoutPrefix(basePrefix, file.key)
        return R.evolve(
          {
            added: R.assoc(path, file),
            deleted: R.dissoc(path),
          },
          acc,
        )
      }, state),
  Delete: (path) =>
    R.evolve({
      added: R.dissoc(path),
      deleted: R.assoc(path, true as const),
    }),
  // add all descendants from existing to deleted
  DeleteDir:
    (prefix) =>
    ({ existing, added, deleted, ...rest }) => ({
      existing,
      added: dissocBy(R.startsWith(prefix))(added),
      deleted: R.mergeLeft(
        Object.keys(existing).reduce(
          (acc, k) => (k.startsWith(prefix) ? { ...acc, [k]: true } : acc),
          {},
        ),
        deleted,
      ),
      ...rest,
    }),
  Meta: ({ path, meta }) => {
    const mkSetMeta =
      <T extends Model.PackageEntry | LocalFile | S3FilePicker.S3File>() =>
      (filesDict: Record<string, T>) => {
        const file = filesDict[path]
        if (!file) return filesDict
        return R.assoc(path, addMetaToFile(file, meta), filesDict)
      }
    return R.evolve({
      added: mkSetMeta<LocalFile | S3FilePicker.S3File>(),
      existing: mkSetMeta<Model.PackageEntry>(),
    })
  },
  Revert: (path) => R.evolve({ added: R.dissoc(path), deleted: R.dissoc(path) }),
  // remove all descendants from added and deleted
  RevertDir: (prefix) =>
    R.evolve({
      added: dissocBy(R.startsWith(prefix)),
      deleted: dissocBy(R.startsWith(prefix)),
    }),
  Reset:
    (_, { initial }) =>
    () =>
      initial,
})

interface DispatchFilesAction {
  (action: FilesAction): void
}

type FilesEntryState = 'deleted' | 'modified' | 'unchanged' | 'hashing' | 'added'

type FilesEntryType = 's3' | 'local'

const FilesEntryTag = 'app/containers/Bucket/PackageDialog/FilesInput:FilesEntry' as const

const FilesEntry = tagged.create(FilesEntryTag, {
  Dir: (v: {
    name: string
    state: FilesEntryState
    childEntries: tagged.Instance<typeof FilesEntryTag>[]
  }) => v,
  File: (v: {
    name: string
    state: FilesEntryState
    type: FilesEntryType
    size: number
    meta?: Types.JsonRecord | null
  }) => v,
})

// eslint-disable-next-line @typescript-eslint/no-redeclare
type FilesEntry = tagged.InstanceOf<typeof FilesEntry>
type FilesEntryDir = ReturnType<typeof FilesEntry.Dir>

const insertIntoDir = (path: string[], file: FilesEntry, dir: FilesEntryDir) => {
  const { name, childEntries } = FilesEntry.Dir.unbox(dir)
  const newChildren = insertIntoTree(path, file, childEntries)
  const state = newChildren
    .map(FilesEntry.match({ Dir: R.prop('state'), File: R.prop('state') }))
    .reduce((acc, entryState) => {
      if (entryState === 'hashing' || acc === 'hashing') return 'hashing'
      if (acc === entryState) return acc
      return 'modified'
    })
  return FilesEntry.Dir({ name, state, childEntries: newChildren })
}

// eslint-disable-next-line @typescript-eslint/default-param-last
const insertIntoTree = (path: string[] = [], file: FilesEntry, entries: FilesEntry[]) => {
  let inserted = file
  let restEntries = entries
  if (path.length) {
    const [current, ...rest] = path
    const state = FilesEntry.match({ File: (f) => f.state, Dir: (d) => d.state }, file)
    let baseDir = FilesEntry.Dir({ name: current, state, childEntries: [] })
    const existingDir = entries.find(
      FilesEntry.match({
        File: () => false,
        Dir: R.propEq('name', current),
      }),
    )
    if (existingDir) {
      restEntries = R.without([existingDir], entries)
      baseDir = existingDir as FilesEntryDir
    }
    inserted = insertIntoDir(rest, file, baseDir)
  }
  const sort = R.sortWith([
    R.ascend(FilesEntry.match({ Dir: () => 0, File: () => 1 })),
    R.ascend(FilesEntry.match({ Dir: (d) => d.name, File: (f) => f.name })),
  ])
  return sort([inserted, ...restEntries])
}

interface IntermediateEntry {
  state: FilesEntryState
  type: FilesEntryType
  path: string
  size: number
  meta?: Types.JsonRecord | null
}

const computeEntries = ({ added, deleted, existing }: FilesState) => {
  const existingEntries: IntermediateEntry[] = Object.entries(existing).map(
    ([path, { size, hash, meta }]) => {
      if (path in deleted) {
        return { state: 'deleted' as const, type: 'local' as const, path, size, meta }
      }
      if (path in added) {
        const a = added[path]
        let state: FilesEntryState
        let type: FilesEntryType
        if (S3FilePicker.isS3File(a)) {
          type = 's3' as const
          state = 'modified' as const
        } else {
          type = 'local' as const
          // eslint-disable-next-line no-nested-ternary
          state = !a.hash.ready
            ? ('hashing' as const)
            : a.hash.value === hash
            ? ('unchanged' as const)
            : ('modified' as const)
        }
        return { state, type, path, size: a.size, meta }
      }
      return { state: 'unchanged' as const, type: 'local' as const, path, size, meta }
    },
  )
  const addedEntries = Object.entries(added).reduce((acc, [path, f]) => {
    if (path in existing) return acc
    const type = S3FilePicker.isS3File(f) ? ('s3' as const) : ('local' as const)
    return acc.concat({ state: 'added', type, path, size: f.size, meta: f.meta })
  }, [] as IntermediateEntry[])
  const entries: IntermediateEntry[] = [...existingEntries, ...addedEntries]
  return entries.reduce((children, { path, ...rest }) => {
    const parts = path.split('/')
    const prefixPath = R.init(parts).map((p) => `${p}/`)
    const name = R.last(parts)!
    const file = FilesEntry.File({ name, ...rest })
    return insertIntoTree(prefixPath, file, children)
  }, [] as FilesEntry[])
}

export const HASHING = 'hashing'
export const HASHING_ERROR = 'hashingError'

export const validateHashingComplete = (state: FilesState) => {
  const files = Object.values(state.added).filter(
    (f) => !S3FilePicker.isS3File(f),
  ) as FileWithHash[]
  if (files.some((f) => f.hash.ready && !f.hash.value)) return HASHING_ERROR
  if (files.some((f) => !f.hash.ready)) return HASHING
  return undefined
}

const useEntryIconStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  icon: {
    boxSizing: 'content-box',
    display: 'block',
    fontSize: 18,
    padding: 3,
  },
  overlay: {
    alignItems: 'center',
    bottom: 0,
    color: t.palette.background.paper,
    display: 'flex',
    fontFamily: t.typography.fontFamily,
    fontSize: 8,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  stateContainer: {
    alignItems: 'center',
    background: 'currentColor',
    border: `1px solid ${t.palette.background.paper}`,
    borderRadius: '100%',
    bottom: 0,
    display: 'flex',
    height: 12,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    width: 12,
  },
  state: {
    fontFamily: t.typography.fontFamily,
    fontWeight: t.typography.fontWeightBold,
    fontSize: 9,
    color: t.palette.background.paper,
  },
  hashProgress: {
    color: t.palette.background.paper,
  },
}))

type EntryIconProps = React.PropsWithChildren<{
  state: FilesEntryState
  overlay?: React.ReactNode
}>

function EntryIcon({ state, overlay, children }: EntryIconProps) {
  const classes = useEntryIconStyles()
  const stateContents = {
    added: '+',
    deleted: <>&ndash;</>,
    modified: '~',
    hashing: 'hashing',
    unchanged: undefined,
  }[state]
  return (
    <div className={classes.root}>
      <M.Icon className={classes.icon}>{children}</M.Icon>
      {!!overlay && <div className={classes.overlay}>{overlay}</div>}
      {!!stateContents && (
        <div className={classes.stateContainer}>
          {stateContents === 'hashing' ? (
            <M.CircularProgress size={8} thickness={6} className={classes.hashProgress} />
          ) : (
            <div className={classes.state}>{stateContents}</div>
          )}
        </div>
      )}
    </div>
  )
}

const useEntryStyles = M.makeStyles((t) => ({
  added: {},
  modified: {},
  hashing: {},
  deleted: {},
  unchanged: {},
  root: {
    alignItems: 'center',
    color: COLORS.default,
    cursor: 'default',
    display: 'flex',
    outline: 'none',
    position: 'relative',
    minHeight: '32px',
    '&:hover': {
      background: t.palette.background.default,
    },
    '&$added': {
      color: COLORS.added,
    },
    '&$modified': {
      color: COLORS.modified,
    },
    '&$hashing': {
      color: COLORS.modified,
    },
    '&$deleted': {
      color: COLORS.deleted,
    },
    '&:hover $menu': {
      background: t.palette.background.default,
      opacity: 1,
    },
  },
  menuOpened: {
    '& $menu': {
      opacity: 1,
    },
  },
  menu: {
    background: t.palette.common.white,
    opacity: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
  },
  faint: {
    opacity: 0.5,
  },
  inner: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    overflow: 'hidden',
  },
  name: {
    ...t.typography.body2,
    flexGrow: 1,
    marginRight: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clickable: {
    cursor: 'pointer',
    outline: 'none',
  },
  size: {
    ...t.typography.body2,
    marginRight: t.spacing(0.5),
    opacity: 0.6,
  },
}))

interface EntryProps extends React.HTMLAttributes<HTMLDivElement> {
  actions: FileAction[]
  checkbox: React.ReactNode
  children: React.ReactNode
  className?: string
  faint: boolean
  icon: string
  name: string
  onClick?: () => void
  size?: number
  type?: FilesEntryType
  state: FilesEntryState
}

function Entry({
  actions,
  checkbox,
  children,
  className,
  faint,
  icon,
  name,
  onClick,
  size,
  state,
  type,
  ...props
}: EntryProps) {
  const [isMenuOpened, setMenuOpened] = React.useState(false)
  const toggleMenu = React.useCallback(() => setMenuOpened(!isMenuOpened), [isMenuOpened])
  const clickableProps = !!onClick
    ? {
        onClick,
        role: 'button',
        tabIndex: 0,
      }
    : {
        onClick: toggleMenu,
      }
  const classes = useEntryStyles()

  return (
    <div
      className={cx(
        classes.root,
        classes[state],
        isMenuOpened && classes.menuOpened,
        className,
      )}
      {...props}
    >
      {checkbox}
      <div
        className={cx(
          classes.inner,
          faint && classes.faint,
          onClick && classes.clickable,
        )}
        {...clickableProps}
      >
        <EntryIcon state={state} overlay={type === 's3' ? 'S3' : undefined}>
          {icon}
        </EntryIcon>
        <div className={classes.name} title={name}>
          {name}
        </div>
        {size != null && <div className={classes.size}>{readableBytes(size)}</div>}
      </div>
      {!!actions.length && <FileMenu className={classes.menu} actions={actions} />}
      {children}
    </div>
  )
}

interface FileProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  state?: FilesEntryState
  type?: FilesEntryType
  size?: number
  checkbox: React.ReactNode
  actions: FileAction[]
  faint?: boolean
  disableStateDisplay?: boolean
}

export function File({
  name,
  state = 'unchanged',
  type = 'local',
  size,
  checkbox,
  faint = false,
  className,
  disableStateDisplay = false,
  actions,
  children,
  onClick,
  ...props
}: FileProps) {
  const stateDisplay = disableStateDisplay ? 'unchanged' : state

  return (
    <Entry
      {...{
        actions,
        checkbox,
        children,
        className,
        faint,
        icon: 'insert_drive_file',
        name,
        size,
        state: stateDisplay,
        type,
        ...props,
      }}
    />
  )
}

const useDirStyles = M.makeStyles((t) => ({
  added: {},
  modified: {},
  hashing: {},
  deleted: {},
  unchanged: {},
  active: {
    '&:before': {
      position: 'absolute',
      content: '""',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      border: '2px dashed #333',
    },
  },
  root: {
    position: 'relative',
  },
  head: {
    alignItems: 'center',
    color: COLORS.default,
    display: 'flex',
    outline: 'none',
    '$active > &, &:hover': {},
    '$added > &': {
      color: COLORS.added,
    },
    '$modified > &': {
      color: COLORS.modified,
    },
    '$hashing > &': {
      color: COLORS.modified,
    },
    '$deleted > &': {
      color: COLORS.deleted,
    },
  },
  headInner: {
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    flexGrow: 1,
    outline: 'none',
    overflow: 'hidden',
  },
  faint: {
    opacity: 0.5,
  },
  name: {
    ...t.typography.body2,
    flexGrow: 1,
    marginRight: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  body: {
    paddingLeft: 20,
  },
  bar: {
    bottom: 0,
    cursor: 'pointer',
    left: 0,
    opacity: 0.3,
    position: 'absolute',
    top: 24,
    width: 24,
    '$active > $head > &, $head:hover > &': {
      opacity: 0.4,
    },
    '&::before': {
      background: 'currentColor',
      borderRadius: 2,
      bottom: 4,
      content: '""',
      left: 10,
      position: 'absolute',
      top: 4,
      width: 4,
    },
  },
  emptyDummy: {
    height: 24,
  },
  empty: {
    ...t.typography.body2,
    bottom: 0,
    fontStyle: 'italic',
    left: 24,
    lineHeight: '24px',
    opacity: 0.6,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 24,
  },
}))

interface DirProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  state?: FilesEntryState
  disableStateDisplay?: boolean
  empty?: boolean
  expanded?: boolean
  faint?: boolean
  checkbox: React.ReactNode
  actions: FileAction[]
  onToggle?: () => void
  onDropFiles?: (files: FileWithPath[]) => void
}

export const Dir = React.forwardRef<HTMLDivElement, DirProps>(function Dir(
  {
    checkbox,
    name,
    state = 'unchanged',
    disableStateDisplay = false,
    empty = false,
    expanded = false,
    faint = false,
    actions,
    className,
    onToggle,
    children,
    onDropFiles: onDrop,
    ...props
  },
  ref,
) {
  const classes = useDirStyles()
  const stateDisplay = disableStateDisplay ? 'unchanged' : state

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    noDragEventsBubbling: true,
    noClick: true,
  })

  return (
    <div
      {...getRootProps({ onClick: stopPropagation })}
      className={cx(className, classes.root, classes[stateDisplay], {
        [classes.active]: isDragActive,
      })}
      ref={ref}
      {...props}
    >
      <Entry
        actions={actions}
        checkbox={checkbox}
        faint={faint}
        icon={expanded ? 'folder_open' : 'folder'}
        name={name}
        state={stateDisplay}
        onClick={onToggle}
      >
        {(!!children || empty) && (
          <>
            <div className={classes.bar} onClick={onToggle} />
            {empty && <div className={classes.empty}>{'<EMPTY DIRECTORY>'}</div>}
          </>
        )}
      </Entry>
      {(!!children || empty) && (
        <M.Collapse in={expanded} mountOnEnter unmountOnExit>
          <div className={classes.body}>
            {children || <div className={classes.emptyDummy} />}
          </div>
        </M.Collapse>
      )}
    </div>
  )
})

const useDropzoneMessageStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.action.hover,
    cursor: 'pointer',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
    padding: t.spacing(6, 0),
    textAlign: 'center',
  },
  error: {
    color: t.palette.error.main,
  },
  warning: {
    color: t.palette.warning.dark,
  },
}))

interface DropzoneMessageProps {
  label?: React.ReactNode
  error: React.ReactNode
  warn: { upload: boolean; s3: boolean; count: boolean }
  onClick: () => void
}

export function DropzoneMessage({
  label: defaultLabel,
  error,
  warn,
  onClick,
}: DropzoneMessageProps) {
  const classes = useDropzoneMessageStyles()

  const label = React.useMemo(() => {
    if (error) return <span>{error}</span>
    if (!warn.s3 && !warn.count && !warn.upload) {
      return <span>{defaultLabel || 'Drop files here or click to browse'}</span>
    }
    return (
      <div onClick={onClick}>
        {warn.upload && (
          <p>
            Total size of local files exceeds recommended maximum of{' '}
            {readableBytes(PD.MAX_UPLOAD_SIZE)}.
          </p>
        )}
        {warn.s3 && (
          <p>
            Total size of files from S3 exceeds recommended maximum of{' '}
            {readableBytes(PD.MAX_S3_SIZE)}.
          </p>
        )}
        {warn.count && (
          <p>Total number of files exceeds recommended maximum of {PD.MAX_FILE_COUNT}.</p>
        )}
      </div>
    )
  }, [defaultLabel, error, warn.upload, warn.s3, warn.count, onClick])

  return (
    <div
      className={cx(classes.root, {
        [classes.error]: error,
        [classes.warning]: !error && (warn.upload || warn.s3 || warn.count),
      })}
    >
      {label}
    </div>
  )
}

const useRootStyles = M.makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
})

export function Root({
  className,
  ...props
}: React.PropsWithChildren<{ className?: string }>) {
  const classes = useRootStyles()
  return <div className={cx(classes.root, className)} {...props} />
}

const useHeaderStyles = M.makeStyles({
  root: {
    display: 'flex',
    height: 24,
  },
})

export function Header(props: React.PropsWithChildren<{}>) {
  const classes = useHeaderStyles()
  return <div className={classes.root} {...props} />
}

const useHeaderTitleStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body1,
    alignItems: 'center',
    display: 'flex',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  regular: {},
  disabled: {
    color: t.palette.text.secondary,
  },
  error: {
    color: t.palette.error.main,
  },
  warn: {
    color: t.palette.warning.dark,
  },
}))

type HeaderTitleState = 'disabled' | 'error' | 'warn' | 'regular'

export function HeaderTitle({
  state = 'regular',
  ...props
}: React.PropsWithChildren<{ state?: HeaderTitleState }>) {
  const classes = useHeaderTitleStyles()
  return <div className={cx(classes.root, classes[state])} {...props} />
}

const useLockStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: 'rgba(255,255,255,0.9)',
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    bottom: 0,
    cursor: 'not-allowed',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  progressContainer: {
    display: 'flex',
    position: 'relative',
  },
  progressPercent: {
    ...t.typography.h5,
    alignItems: 'center',
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  progressSize: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(1),
  },
}))

export function Lock({
  progress,
}: {
  progress?: {
    total: number
    loaded: number
    percent: number
  }
}) {
  const classes = useLockStyles()
  return (
    <div className={classes.root}>
      {!!progress && (
        <>
          <div className={classes.progressContainer}>
            <M.CircularProgress
              size={80}
              value={progress.total ? progress.percent : undefined}
              variant={progress.total ? 'determinate' : 'indeterminate'}
            />
            {!!progress.total && (
              <div className={classes.progressPercent}>{progress.percent}%</div>
            )}
          </div>
          {!!progress.total && (
            <div className={classes.progressSize}>
              {readableBytes(progress.loaded)}
              {' / '}
              {readableBytes(progress.total)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const useFilesContainerStyles = M.makeStyles((t) => ({
  root: {
    overflowX: 'hidden',
    overflowY: 'auto',
  },
  border: {
    borderBottom: `1px solid ${t.palette.action.disabled}`,
  },
  err: {
    borderColor: t.palette.error.main,
  },
  warn: {
    borderColor: t.palette.warning.dark,
  },
}))

type FilesContainerProps = React.PropsWithChildren<{
  error?: boolean
  warn?: boolean
  noBorder?: boolean
}>

export function FilesContainer({ error, warn, noBorder, children }: FilesContainerProps) {
  const classes = useFilesContainerStyles()
  return (
    <div
      className={cx(
        classes.root,
        !noBorder && classes.border,
        error && classes.err,
        !error && warn && classes.warn,
      )}
    >
      {children}
    </div>
  )
}

const useContentsContainerStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    marginTop: t.spacing(2),
    overflowY: 'auto',
    position: 'relative',
  },
  outlined: {
    outline: `2px dashed ${t.palette.primary.light}`,
    outlineOffset: '-2px',
  },
}))

type ContentsContainerProps = {
  outlined?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export function ContentsContainer({
  outlined,
  className,
  ...props
}: ContentsContainerProps) {
  const classes = useContentsContainerStyles()
  return (
    <div
      className={cx(className, classes.root, outlined && classes.outlined)}
      {...props}
    />
  )
}

const useContentsStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minHeight: 80,
    outline: 'none',
    overflow: 'hidden',
    position: 'relative',
  },
  active: {
    background: t.palette.action.selected,
  },
  err: {
    borderColor: t.palette.error.main,
  },
  warn: {
    borderColor: t.palette.warning.dark,
  },
}))

interface ContentsProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean
  error?: boolean
  warn?: boolean
}

export const Contents = React.forwardRef<HTMLDivElement, ContentsProps>(function Contents(
  { active, error, warn, className, ...props },
  ref,
) {
  const classes = useContentsStyles()
  return (
    <div
      className={cx(
        className,
        classes.root,
        active && classes.active,
        error && classes.err,
        !error && warn && classes.warn,
      )}
      ref={ref}
      {...props}
    />
  )
})

type FileUploadProps = tagged.ValueOf<typeof FilesEntry.File> & {
  prefix?: string
  disableStateDisplay?: boolean
  dispatch: DispatchFilesAction
}

function FileUpload({
  name,
  state,
  type,
  size,
  prefix,
  disableStateDisplay,
  dispatch,
  meta,
}: FileUploadProps) {
  const path = (prefix || '') + name

  const handleCheckbox = React.useCallback(() => {
    if (state === 'deleted') {
      dispatch(FilesAction.Revert(path))
    } else {
      dispatch(FilesAction.Delete(path))
    }
  }, [dispatch, path, state])

  const onClick = React.useCallback((e: React.MouseEvent) => {
    // stop click from propagating to parent elements and triggering their handlers
    e.stopPropagation()
  }, [])

  const [metaOpen, setMetaOpen] = React.useState(false)
  const handleMetaEdit = React.useCallback(
    (m: Types.JsonRecord) => {
      setMetaOpen(false)
      dispatch(FilesAction.Meta({ path, meta: m }))
    },
    [dispatch, path],
  )

  // XXX: reset EditFileMeta state when file is reverted
  const metaKey = React.useMemo(() => JSON.stringify(meta), [meta])

  const metaAction = React.useMemo(
    () => ({
      onClick: () => setMetaOpen(true),
      icon: <M.Icon>list</M.Icon>,
      text: R.isEmpty(meta) ? 'Add meta' : 'Edit meta',
      key: 'meta',
    }),
    [meta],
  )
  const undoAction = React.useMemo(
    () => ({
      onClick: () => dispatch(FilesAction.Revert(path)),
      icon: <M.Icon>undo</M.Icon>,
      text: 'Revert',
      key: 'revert',
    }),
    [dispatch, path],
  )
  const actions: FileAction[] = React.useMemo(() => {
    const output: FileAction[] = []
    if (state !== 'deleted') output.push(metaAction)
    if (state === 'modified' || state === 'hashing') output.push(undoAction)
    return output
  }, [metaAction, undoAction, state])

  return (
    <File
      onClick={onClick}
      role="button"
      tabIndex={0}
      state={state}
      disableStateDisplay={disableStateDisplay}
      type={type}
      name={name}
      size={size}
      checkbox={<Checkbox onChange={handleCheckbox} checked={state !== 'deleted'} />}
      actions={actions}
    >
      <EditFileMeta
        key={metaKey}
        name={name}
        onChange={handleMetaEdit}
        onClose={() => setMetaOpen(false)}
        open={metaOpen}
        value={meta}
      />
    </File>
  )
}

type DirUploadProps = tagged.ValueOf<typeof FilesEntry.Dir> & {
  prefix?: string
  dispatch: DispatchFilesAction
  delayHashing: boolean
  disableStateDisplay?: boolean
}

function DirUpload({
  name,
  state,
  childEntries,
  prefix,
  dispatch,
  delayHashing,
  disableStateDisplay,
}: DirUploadProps) {
  const [expanded, setExpanded] = React.useState(false)

  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [setExpanded])

  const path = (prefix || '') + name

  const onDropFiles = React.useCallback(
    (files: FileWithPath[]) => {
      // TODO: fix File ⟷ DOMFile ⟷ FileWithHash ⟷ FileWithPath interplay
      // @ts-expect-error
      dispatch(FilesAction.Add({ prefix: path, files: files.map(computeHash) }))
    },
    [dispatch, path],
  )

  const handleCheckbox = React.useCallback(() => {
    if (state === 'deleted') {
      dispatch(FilesAction.RevertDir(path))
    } else {
      dispatch(FilesAction.DeleteDir(path))
    }
  }, [dispatch, path, state])

  const undoAction = React.useMemo(
    () => ({
      onClick: () => dispatch(FilesAction.RevertDir(path)),
      icon: <M.Icon>undo</M.Icon>,
      text: 'Revert',
      key: 'revert',
    }),
    [dispatch, path],
  )

  const actions: FileAction[] = React.useMemo(
    () => (state === 'modified' || state === 'hashing' ? [undoAction] : []),
    [undoAction, state],
  )

  return (
    <Dir
      onToggle={toggleExpanded}
      onDropFiles={onDropFiles}
      expanded={expanded}
      name={name}
      state={state}
      disableStateDisplay={disableStateDisplay}
      checkbox={<Checkbox onChange={handleCheckbox} checked={state !== 'deleted'} />}
      actions={actions}
      empty={!childEntries.length}
    >
      {!!childEntries.length &&
        childEntries.map(
          FilesEntry.match({
            Dir: (ps) => (
              <DirUpload
                {...ps}
                key={ps.name}
                prefix={path}
                dispatch={dispatch}
                delayHashing={delayHashing}
                disableStateDisplay={disableStateDisplay}
              />
            ),
            File: (ps) => (
              <FileUpload
                {...ps}
                key={ps.name}
                prefix={path}
                dispatch={dispatch}
                disableStateDisplay={disableStateDisplay}
              />
            ),
          }),
        )}
    </Dir>
  )
}

const DOCS_URL_SOURCE_BUCKETS = `${urls.docsMaster}/catalog/preferences#properties`

const useFilesInputStyles = M.makeStyles((t) => ({
  hashing: {
    marginLeft: t.spacing(1),
  },
  actions: {
    display: 'flex',
    marginTop: t.spacing(1),
  },
  action: {
    flexGrow: 1,
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  warning: {
    marginLeft: t.spacing(1),
  },
}))

interface FilesInputProps {
  input: {
    value: FilesState
    onChange: (value: FilesState) => void
  }
  className?: string
  disabled?: boolean
  errors?: Record<string, React.ReactNode>
  meta: {
    submitting: boolean
    submitSucceeded: boolean
    submitFailed: boolean
    dirty: boolean
    error?: string
    initial: FilesState
  }
  onFilesAction?: (
    action: FilesAction,
    oldValue: FilesState,
    newValue: FilesState,
  ) => void
  title: React.ReactNode
  totalProgress: {
    total: number
    loaded: number
    percent: number
  }
  bucket: string
  buckets?: string[]
  selectBucket?: (bucket: string) => void
  delayHashing?: boolean
  disableStateDisplay?: boolean
  ui?: {
    reset?: React.ReactNode
  }
}

export function FilesInput({
  input: { value, onChange },
  className,
  disabled = false,
  errors = {},
  meta,
  onFilesAction,
  title,
  totalProgress,
  bucket,
  buckets,
  selectBucket,
  delayHashing = false,
  disableStateDisplay = false,
  ui = {},
}: FilesInputProps) {
  const classes = useFilesInputStyles()

  const pRef = React.useRef<Promise<any>>()
  const scheduleUpdate = (waitFor: Promise<any>[]) => {
    const p = waitFor.length ? Promise.all(waitFor) : undefined
    pRef.current = p
    if (p) {
      p.then(() => {
        if (p === pRef.current) {
          const v = ref.current!.value
          onChange({ ...v, counter: (v.counter || 0) + 1 }) // trigger field validation
        }
      })
    }
  }

  const submitting = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error

  const refProps = {
    value,
    disabled: disabled || submitting,
    initial: meta.initial,
    onChange,
    onFilesAction,
    scheduleUpdate,
  }
  const ref = React.useRef<typeof refProps>()
  ref.current = refProps
  const { current: dispatch } = React.useRef((action: FilesAction) => {
    const cur = ref.current!
    if (cur.disabled) return

    const newValue = handleFilesAction(action, { initial: cur.initial })(cur.value)
    // XXX: maybe observe value and trigger this when it changes,
    // regardless of the source of change (e.g. new value supplied directly via the prop)
    const waitFor = Object.values(newValue.added).reduce(
      (acc, f) =>
        S3FilePicker.isS3File(f) || f.hash.ready
          ? acc
          : acc.concat(f.hash.promise.catch(() => {})),
      [] as Promise<any>[],
    )
    cur.scheduleUpdate(waitFor)

    cur.onChange(newValue)
    if (cur.onFilesAction) cur.onFilesAction(action, cur.value, newValue)
  })

  const onDrop = React.useCallback(
    (files) => {
      dispatch(FilesAction.Add({ files: files.map(computeHash) }))
    },
    [dispatch],
  )

  const resetFiles = React.useCallback(() => {
    dispatch(FilesAction.Reset())
  }, [dispatch])

  const isDragging = useDragging()
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    disabled,
    noClick: true,
    onDrop,
  })

  const computedEntries = useMemoEq(value, computeEntries)

  const stats = useMemoEq(value, ({ added, existing }) => ({
    upload: Object.entries(added).reduce(
      (acc, [path, f]) => {
        if (S3FilePicker.isS3File(f)) return acc // dont count s3 files
        const e = existing[path]
        if (e && (!f.hash.ready || f.hash.value === e.hash)) return acc
        return R.evolve({ count: R.inc, size: R.add(f.size) }, acc)
      },
      { count: 0, size: 0 },
    ),
    s3: Object.entries(added).reduce(
      (acc, [, f]) =>
        S3FilePicker.isS3File(f)
          ? R.evolve({ count: R.inc, size: R.add(f.size) }, acc)
          : acc,
      { count: 0, size: 0 },
    ),
    hashing: Object.values(added).reduce(
      (acc, f) => acc || (!S3FilePicker.isS3File(f) && !f.hash.ready),
      false,
    ),
  }))

  const warn = {
    upload: stats.upload.size > PD.MAX_UPLOAD_SIZE,
    s3: stats.s3.size > PD.MAX_S3_SIZE,
    count: stats.upload.count + stats.s3.count > PD.MAX_FILE_COUNT,
  }

  const [s3FilePickerOpen, setS3FilePickerOpen] = React.useState(false)

  const closeS3FilePicker = React.useCallback(
    (reason: S3FilePicker.CloseReason) => {
      if (!!reason && typeof reason === 'object') {
        dispatch(FilesAction.AddFromS3({ files: reason.files, basePrefix: reason.path }))
      }
      setS3FilePickerOpen(false)
    },
    [dispatch, setS3FilePickerOpen],
  )

  const handleS3Btn = React.useCallback(() => {
    setS3FilePickerOpen(true)
  }, [])

  const isS3FilePickerEnabled = !!buckets?.length

  return (
    <Root className={className}>
      {isS3FilePickerEnabled && (
        <S3FilePicker.Dialog
          bucket={bucket}
          buckets={buckets}
          selectBucket={selectBucket}
          open={s3FilePickerOpen}
          onClose={closeS3FilePicker}
        />
      )}
      <Header>
        <HeaderTitle
          state={
            submitting || disabled // eslint-disable-line no-nested-ternary
              ? 'disabled'
              : error // eslint-disable-line no-nested-ternary
              ? 'error'
              : warn.upload || warn.s3 || warn.count
              ? 'warn'
              : undefined
          }
        >
          {title}
          {(!!stats.upload.count || !!stats.s3.count) && (
            <M.Box
              ml={1}
              color={warn.upload || warn.s3 ? 'warning.dark' : 'text.secondary'}
              component="span"
            >
              (
              {!!stats.upload.count && (
                <M.Box
                  color={warn.upload ? 'warning.dark' : 'text.secondary'}
                  component="span"
                >
                  {readableBytes(stats.upload.size)} to upload
                </M.Box>
              )}
              {!!stats.upload.count && !!stats.s3.count && (
                <M.Box
                  color={!warn.upload || !warn.s3 ? 'text.secondary' : undefined}
                  component="span"
                >
                  {', '}
                </M.Box>
              )}
              {!!stats.s3.count && (
                <M.Box
                  color={warn.s3 ? 'warning.dark' : 'text.secondary'}
                  component="span"
                >
                  {readableBytes(stats.s3.size)} from S3
                </M.Box>
              )}
              )
            </M.Box>
          )}
          {(warn.upload || warn.s3 || warn.count) && (
            <M.Icon style={{ marginLeft: 6 }} fontSize="small">
              error_outline
            </M.Icon>
          )}
          {!delayHashing && stats.hashing && (
            <M.CircularProgress
              className={classes.hashing}
              size={16}
              title="Hashing files"
            />
          )}
        </HeaderTitle>
        <M.Box flexGrow={1} />
        {meta.dirty && (
          <M.Button
            onClick={resetFiles}
            disabled={ref.current.disabled}
            size="small"
            endIcon={<M.Icon fontSize="small">undo</M.Icon>}
          >
            {ui.reset || 'Clear files'}
          </M.Button>
        )}
      </Header>

      <ContentsContainer outlined={isDragging && !ref.current.disabled}>
        <Contents
          {...getRootProps()}
          active={isDragActive && !ref.current.disabled}
          error={!!error}
          warn={warn.upload || warn.s3 || warn.count}
        >
          <input {...getInputProps()} />

          {!!computedEntries.length && (
            <FilesContainer error={!!error} warn={warn.upload || warn.s3 || warn.count}>
              {computedEntries.map(
                FilesEntry.match({
                  Dir: (ps) => (
                    <DirUpload
                      {...ps}
                      key={`dir:${ps.name}`}
                      dispatch={dispatch}
                      delayHashing={delayHashing}
                      disableStateDisplay={disableStateDisplay}
                    />
                  ),
                  File: (ps) => (
                    <FileUpload
                      {...ps}
                      key={`file:${ps.name}`}
                      dispatch={dispatch}
                      disableStateDisplay={disableStateDisplay}
                    />
                  ),
                }),
              )}
            </FilesContainer>
          )}

          <DropzoneMessage
            onClick={open}
            error={error && (errors[error] || error)}
            warn={warn}
          />
        </Contents>
        {submitting && <Lock progress={totalProgress} />}
      </ContentsContainer>
      <div className={classes.actions}>
        <M.Button
          onClick={open}
          disabled={submitting || disabled}
          className={classes.action}
          variant="outlined"
          size="small"
        >
          Add local files
        </M.Button>
        {isS3FilePickerEnabled ? (
          <M.Button
            onClick={handleS3Btn}
            disabled={submitting || disabled}
            className={classes.action}
            variant="outlined"
            size="small"
          >
            Add files from bucket
          </M.Button>
        ) : (
          <Lab.Alert className={classes.warning} severity="info">
            <StyledLink href={DOCS_URL_SOURCE_BUCKETS} target="_blank">
              Learn how to add files from a bucket
            </StyledLink>
          </Lab.Alert>
        )}
      </div>
    </Root>
  )
}
