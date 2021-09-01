import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Loading from 'components/Placeholder'
import StyledLink from 'utils/StyledLink'
import * as IPC from 'utils/electron-ipc'

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

interface AwsNotInstalledProps {
  open: boolean
  error?: Error
  onCancel: () => void
  onProceed: () => void
}

function AwsNotInstalled({ error, onCancel, onProceed, open }: AwsNotInstalledProps) {
  const AWS_CLI = 'https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html'
  return (
    <M.Dialog open={open} maxWidth="xs" fullWidth>
      <M.DialogTitle>AWS CLI is required for Quilt to work</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText>
          Install <BrowserStyledLink href={AWS_CLI}>AWS CLI</BrowserStyledLink> to
          proceed, please.
        </M.DialogContentText>
        {error && <Lab.Alert severity="error">{error.message}</Lab.Alert>}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onCancel} color="primary">
          Quit application
        </M.Button>
        <M.Button onClick={onProceed} color="primary" variant="outlined">
          {error ? 'I resolved error' : 'Yes, I installed AWS CLI'}
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface AwsPlaceholderState {
  ready: Error | boolean | null
  onCancel: () => void
  onProceed: () => void
}

interface AwsPlaceholderProps {
  state: AwsPlaceholderState
}

export function Placeholder({
  state: { ready, onCancel, onProceed },
}: AwsPlaceholderProps) {
  if (ready === null) return <Loading />

  if (ready === false)
    return <AwsNotInstalled open onCancel={onCancel} onProceed={onProceed} />

  if (ready instanceof Error)
    return (
      <AwsNotInstalled open error={ready} onCancel={onCancel} onProceed={onProceed} />
    )

  throw new Error('Unexpected state')
}

export function useAwsReadiness(): [boolean, AwsPlaceholderState] {
  const ipc = IPC.use()

  const [awsReadyKey, setAwsReadyKey] = React.useState(0)
  const [ready, setReady] = React.useState<Error | boolean | null>(null)

  const onCancel = React.useCallback(() => {
    ipc.send(IPC.EVENTS.QUIT)
  }, [ipc])

  const onProceed = React.useCallback(() => {
    setReady(null)
    setAwsReadyKey(R.inc)
  }, [setReady, setAwsReadyKey])

  React.useEffect(() => {
    const handleReady = async () => {
      try {
        const { awsInstalled } = await ipc.invoke(IPC.EVENTS.READY)
        setReady(awsInstalled)
      } catch (error) {
        setReady(error)
      }
    }
    handleReady()
  }, [ipc, awsReadyKey])

  return [
    ready === true,
    {
      ready,
      onCancel,
      onProceed,
    },
  ]
}

export const use = useAwsReadiness
