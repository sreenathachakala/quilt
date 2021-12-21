import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Loading from 'components/Placeholder'
import StyledLink from 'utils/StyledLink'
import * as IPC from 'utils/electron/ipc-provider'

interface BrowserStyledLinkProps {
  href: string
  children: React.ReactNode
}

function BrowserStyledLink({ children, href }: BrowserStyledLinkProps) {
  const ipc = IPC.use()
  const [invoking, setInvoking] = React.useState(false)
  const onClick = React.useCallback(async () => {
    if (invoking) return

    setInvoking(true)
    await ipc.invoke(IPC.EVENTS.OPEN_IN_BROWSER, href)
    setInvoking(false)
  }, [href, invoking, ipc, setInvoking])
  return (
    <StyledLink component="span" onClick={onClick}>
      {children}
    </StyledLink>
  )
}

interface CliNotInstalledProps {
  open: boolean
  error?: Error
  onCancel: () => void
  onProceed: () => void
}

function CliNotInstalled({ error, onCancel, onProceed, open }: CliNotInstalledProps) {
  const INSTALLATION_URL = 'https://docs.quiltdata.com/installation'
  return (
    <M.Dialog open={open} maxWidth="xs" fullWidth>
      <M.DialogTitle>quilt3 is required for Quilt to work</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText>
          Install <BrowserStyledLink href={INSTALLATION_URL}>quilt3</BrowserStyledLink> to
          proceed, please.
        </M.DialogContentText>
        {error && <Lab.Alert severity="error">{error.message}</Lab.Alert>}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary">
          Quit application
        </M.Button>
        <M.Button onClick={onProceed} color="primary" variant="outlined">
          {error ? 'I resolved error' : 'Yes, I installed quilt3'}
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface CliPlaceholderState {
  ready: Error | boolean | null
  onCancel: () => void
  onProceed: () => void
}

interface CliPlaceholderProps {
  state: CliPlaceholderState
}

export function Placeholder({
  state: { ready, onCancel, onProceed },
}: CliPlaceholderProps) {
  if (ready === null) return <Loading />

  if (ready === false)
    return <CliNotInstalled open onCancel={onCancel} onProceed={onProceed} />

  if (ready instanceof Error)
    return (
      <CliNotInstalled open error={ready} onCancel={onCancel} onProceed={onProceed} />
    )

  throw new Error('Unexpected state')
}

export function useCliReadiness(): [boolean, CliPlaceholderState] {
  const ipc = IPC.use()

  const [cliReadyKey, setCliReadyKey] = React.useState(0)
  const [ready, setReady] = React.useState<Error | boolean | null>(null)

  const onCancel = React.useCallback(() => {
    ipc.send(IPC.EVENTS.QUIT)
  }, [ipc])

  const onProceed = React.useCallback(() => {
    setReady(null)
    setCliReadyKey(R.inc)
  }, [setReady, setCliReadyKey])

  React.useEffect(() => {
    const handleReady = async () => {
      try {
        const { requirementsInstalled } = await ipc.invoke(IPC.EVENTS.READY)
        setReady(requirementsInstalled)
      } catch (error) {
        if (error instanceof Error) {
          setReady(error)
        }
      }
    }
    handleReady()
  }, [ipc, cliReadyKey])

  return [
    ready === true,
    {
      ready,
      onCancel,
      onProceed,
    },
  ]
}

export const use = useCliReadiness
