import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as IPC from 'utils/electron/ipc-provider'

interface Credentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

const serializeCredentials = (credentials: Credentials) => ({
  accessKeyId: credentials.accessKeyId,
  secretAccessKey: credentials.secretAccessKey,
  sessionToken: credentials.sessionToken,
})

interface BeaconProps {
  children: React.ReactNode
}

export default function Beacon({ children }: BeaconProps) {
  const credentials: Credentials = AWS.Credentials.use()
  const ipc = IPC.use()
  const sendBeacon = React.useCallback(() => {
    const beaconData = { credentials: serializeCredentials(credentials) }
    ipc.send(IPC.EVENTS.BEACON, beaconData)
  }, [credentials, ipc])

  React.useEffect(() => {
    const timer = setInterval(sendBeacon, 5000)
    return () => clearInterval(timer)
  }, [sendBeacon])

  return <>{children}</>
}
