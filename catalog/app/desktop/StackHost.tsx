import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import mkStorage from 'utils/storage'

const STORAGE_KEYS = {
  HOST: 'HOST',
}
const storage = mkStorage({ [STORAGE_KEYS.HOST]: STORAGE_KEYS.HOST })

interface HostInputProps {
  value: string
  onChange: (host: string) => void
}

function HostInput({ value, onChange }: HostInputProps) {
  const handleChange = React.useCallback(
    (event) => {
      onChange(event.target.value)
    },
    [onChange],
  )
  return (
    <M.TextField
      autoFocus
      fullWidth
      id="host"
      label="Stack host"
      margin="normal"
      onChange={handleChange}
      type="text"
      value={value}
    />
  )
}

function isHostValid(host: string) {
  return !!host && host.includes('http', 0)
}

interface HostFormProps {
  initialHost: string | null
  onSubmit: (host: string) => void
}

function HostForm({ initialHost, onSubmit }: HostFormProps) {
  const [host, setHost] = React.useState<string | null>(initialHost)
  const [hostValue, setHostValue] = React.useState(host || '')
  const [error, setError] = React.useState('')
  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      if (isHostValid(hostValue)) {
        setHost(hostValue)
        onSubmit(hostValue)
      } else {
        setError('Host should be url starting from http://')
      }
    },
    [hostValue, onSubmit, setHost],
  )
  const handleHostValue = React.useCallback(
    (value) => {
      setError('')
      setHostValue(value)
    },
    [setError, setHostValue],
  )
  return (
    <M.Dialog open={host === null}>
      <M.DialogTitle>Set stack host</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText>
          Application requires internet connection and uses assets and config from
          deployed stack
        </M.DialogContentText>
        <form onSubmit={handleSubmit}>
          <HostInput value={hostValue} onChange={handleHostValue} />
        </form>
        {error && <Lab.Alert severity="error">{error}</Lab.Alert>}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={handleSubmit} color="primary" disabled={!!error}>
          Submit
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

const initialHost = storage.get(STORAGE_KEYS.HOST)

function getStackData(host: string) {
  const configPath = '/config.json'
  return {
    host,
    configUrl: (() => {
      const url = host ? new URL(configPath, host) : configPath
      return url.toString()
    })(),
  }
}

interface StackHostProps {
  children: React.ReactNode
  onChange: (stack: { host: string; configUrl: string }) => void
}

export default function StackHost({ children, onChange }: StackHostProps) {
  const [host, setHost] = React.useState<string | null>(initialHost)

  const handleSubmit = React.useCallback(
    (newHost) => {
      storage.set(STORAGE_KEYS.HOST, newHost)

      setHost(newHost)
      onChange(getStackData(newHost))
    },
    [onChange, setHost],
  )

  React.useEffect(() => {
    if (host !== null) onChange(getStackData(host))
  }, [host, onChange])

  return (
    <>
      <HostForm initialHost={initialHost} onSubmit={handleSubmit} />
      {host === null ? null : children}
    </>
  )
}
