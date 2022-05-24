// import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import PreviewValue from 'components/JsonEditor/PreviewValue'
import * as IPC from 'utils/electron/ipc-provider'

// STORE at localstorage for command+eventname+jsonstringify(rest) and restore as default value
let config = {
  folders: [
    {
      id: 'ffcc9df3-59e0-4a3a-b59a-a03a1801aec9',
      local: '/home/fiskus/Documents/Top Secret',
      s3: 's3://fiskus-sandbox-dev/fiskus/sandbox',
    },
    {
      id: '7e75063e-1241-4749-9a7b-87c5e41cf8be',
      local: '/home/fiskus/Downloads',
      s3: 's3://fiskus-sandbox-dev/fiskus/test',
    },
    {
      id: '62bd8ee9-80bd-4537-8480-72177b3072fa',
      local: '/Applications',
      s3: 's3://fiskus-sandbox-dev/fiskus/desktop',
    },
    {
      id: 'e7addf89-c0ed-45f2-adfe-652d66a3103f',
      local: '/home/fiskus/Document/Top Secret',
      s3: 's3://quilt-bio-staging/fiskus/sandbox',
    },
    {
      id: '855a550e-bac6-49f3-89d7-5793197e8614',
      local: '/media/fiskus/undq9832nyu/inbox',
      s3: 's3://fiskus-sandbox-dev/fiskus/sandbox',
    },
  ],
}

interface DevToolsItemIconProps {
  children: React.ReactNode
}

function DevToolsItemIcon({ children }: DevToolsItemIconProps) {
  return (
    <M.Avatar>
      <M.Icon>{children}</M.Icon>
    </M.Avatar>
  )
}

const useDevToolsItemStyles = M.makeStyles((t) => ({
  chip: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  rest: {
    marginLeft: t.spacing(1),
    display: 'flex',
  },
}))

function DevToolsItem({ event }: { event: DevToolsEvent }) {
  const classes = useDevToolsItemStyles()
  const [value, setValue] = React.useState<any>(config)
  const [expanded, setExpanded] = React.useState(event.command === 'invoke')
  const handleSubmit = React.useCallback(
    (e) => {
      e.preventDefault()
      setExpanded(false)
      event.resolve(value)
    },
    [event, value],
  )
  return (
    <M.Accordion expanded={expanded} onChange={() => setExpanded(R.not)}>
      <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <M.Chip
          className={classes.chip}
          avatar={<DevToolsItemIcon>send_outlined</DevToolsItemIcon>}
          label={event.command}
          variant="outlined"
        />
        <M.Chip
          className={classes.chip}
          avatar={<DevToolsItemIcon>email_outlined</DevToolsItemIcon>}
          label={event.eventName}
          variant="outlined"
        />
        <M.Chip
          className={classes.chip}
          avatar={<DevToolsItemIcon>data_object_outlined</DevToolsItemIcon>}
          label={<PreviewValue value={event.rest} />}
          variant="outlined"
        />
      </M.AccordionSummary>
      <M.AccordionDetails>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {/* FIXME: switcher (tabs?) from json to string */}
          <JsonEditor errors={[]} value={value} onChange={setValue} />
          <M.Button type="submit" disabled={!value}>
            Submit
          </M.Button>
        </form>
      </M.AccordionDetails>
    </M.Accordion>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    bottom: t.spacing(4),
    padding: t.spacing(2),
    height: '300px',
    position: 'fixed',
    right: t.spacing(4),
    minWidth: '300px',
    zIndex: 1400,
    overflow: 'auto',
  },
}))

interface DevToolsEvent {
  resolve: (v: any) => void
  command: string
  eventName: string
  rest: any[]
}

interface DevToolsProps {
  events: DevToolsEvent[]
}

function DevTools({ events }: DevToolsProps) {
  const classes = useStyles()
  return (
    <M.Paper className={classes.root}>
      {events.map((event, index) => (
        <DevToolsItem key={`${event.command}${event.eventName}${index}`} event={event} />
      ))}
    </M.Paper>
  )
}

function useDevTools(
  onEvent: (
    resolve: (v: any) => void,
    command: string,
    eventName: string,
    ...rest: any[]
  ) => void,
) {
  return React.useMemo(
    () => ({
      invoke: (eventName: string, creds: IPC.Credentials, ...rest: any[]) => {
        return new Promise((resolve) => {
          onEvent(resolve, 'invoke', eventName, rest)
        })
      },
      on: onEvent.bind(null, () => {}, 'on'),
      off: onEvent.bind(null, () => {}, 'off'),
      send: (eventName: string) => {
        return new Promise((resolve) => {
          onEvent(resolve, 'send', eventName)
        })
      },
    }),
    [onEvent],
  )
}

interface DevToolsWrapperProps {
  children: React.ReactNode
}

export default function DevToolsWrapper({ children }: DevToolsWrapperProps) {
  const [events, setEvents] = React.useState([])
  const handleEvent = React.useCallback(
    (resolve, command, eventName, ...rest) => {
      setEvents(R.append({ resolve, command, eventName, rest }))
    },
    [setEvents],
  )
  const value = useDevTools(handleEvent)
  return (
    <IPC.Provider value={value}>
      <DevTools events={events} />
      {children}
    </IPC.Provider>
  )
}
