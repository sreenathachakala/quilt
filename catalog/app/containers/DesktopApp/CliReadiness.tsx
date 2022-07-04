import * as R from 'ramda'
import * as React from 'react'
import * as Remarkable from 'remarkable'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Loading from 'components/Placeholder'
import StyledLink from 'utils/StyledLink'
import * as IPC from 'utils/electron/ipc-provider'

const markdown = new Remarkable.Remarkable('full', {
  html: true,
  typographer: true,
})

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

interface WhatsNewProps {
  changelog?: string
  open: boolean
  error?: Error
  onProceed: () => void
}

function WhatsNew({ changelog, onProceed, open }: WhatsNewProps) {
  const content = React.useMemo(
    () => (changelog ? markdown.render(changelog) : ''),
    [changelog],
  )
  return (
    <M.Dialog open={open} maxWidth="xs" fullWidth>
      <M.DialogTitle>You've upgraded to the new version</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText dangerouslySetInnerHTML={{ __html: content }} />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onProceed} color="primary" variant="outlined">
          Got it!
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface WelcomeProps {
  open: boolean
  onProceed: () => void
}

function Welcome({ onProceed, open }: WelcomeProps) {
  return (
    <M.Dialog open={open} maxWidth="sm" fullWidth>
      <M.DialogTitle>Thank you for installing Teleport</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText>
          <M.Typography>
            Teleport app accompanied to `quilt3` and Catalog will help you download and
            upload packages faster
          </M.Typography>
          <M.Typography variant="h4">Okta login</M.Typography>
          <M.Typography>
            To enable Okta login set http://localhost:3000 as available host
          </M.Typography>
          <M.Typography variant="h4">Download</M.Typography>
          <M.Typography>
            To download package you can click on "Download package" button.
          </M.Typography>
          <M.Typography>
            Package will be installed in your <code>~/Quilt</code> directory
          </M.Typography>
          <M.Typography variant="h4">Upload</M.Typography>
          <M.Typography>
            To download package you can click on "Revise package" button.
          </M.Typography>
        </M.DialogContentText>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onProceed} color="primary" variant="outlined">
          Got it!
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
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

interface BootInfo {
  quilt3: {
    installed: boolean
  }
  lastBoot?: {
    version: string
  }
  currentBoot: {
    version: string
  }
  versionDiff: {
    compare: number
    changelog?: string
  }
}

interface CliPlaceholderState {
  bootInfo: Error | BootInfo | null
  onCancel: () => void
  onProceed: () => void
}

interface CliPlaceholderProps {
  state: CliPlaceholderState
}

export function Placeholder({
  state: { bootInfo, onCancel, onProceed },
}: CliPlaceholderProps) {
  if (bootInfo === null) return <Loading />

  if (bootInfo instanceof Error)
    return (
      <CliNotInstalled open error={bootInfo} onCancel={onCancel} onProceed={onProceed} />
    )

  if (bootInfo.versionDiff.compare !== 0 && !bootInfo.lastBoot) {
    return <Welcome open onProceed={onProceed} />
  }

  if (bootInfo.versionDiff.compare !== 0) {
    return (
      <WhatsNew open changelog={bootInfo.versionDiff.changelog} onProceed={onProceed} />
    )
  }

  if (bootInfo.quilt3.installed === false)
    return <CliNotInstalled open onCancel={onCancel} onProceed={onProceed} />

  throw new Error('Unexpected state')
}

export function useCliReadiness(): [boolean, CliPlaceholderState] {
  const ipc = IPC.use()

  const [cliReadyKey, setCliReadyKey] = React.useState(0)
  const [ready, setReady] = React.useState<Error | boolean | null>(null)
  const [bootInfo, setBootInfo] = React.useState<BootInfo | null>(null)

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
        const loadedBootInfo = await ipc.invoke(IPC.EVENTS.READY)
        setReady(
          !!loadedBootInfo &&
            loadedBootInfo.quilt3.installed &&
            loadedBootInfo.versionDiff.compare === 0,
        )
        setBootInfo(loadedBootInfo)
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
      bootInfo,
      onCancel,
      onProceed,
    },
  ]
}

export const use = useCliReadiness
