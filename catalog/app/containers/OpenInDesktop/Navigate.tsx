import * as React from 'react'
import { useHistory } from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import * as IPC from 'utils/electron/ipc-provider'

interface NavigateProps {
  children: React.ReactNode
}
export default function Navigate({ children }: NavigateProps) {
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const ipc = IPC.use()

  const handleNavigate = React.useCallback(
    (event, uri) => history.push(urls.uriResolver(uri)),
    [history, urls],
  )
  React.useEffect(() => {
    ipc.on(IPC.EVENTS.NAVIGATE, handleNavigate)
    return () => ipc.off(IPC.EVENTS.NAVIGATE, handleNavigate)
  }, [ipc, handleNavigate])

  return <>{children}</>
}
