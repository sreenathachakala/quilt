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

function useBeaconData() {
  const credentials: Credentials = AWS.Credentials.use()
  return React.useMemo(
    () => ({
      credentials: serializeCredentials(credentials),
    }),
    [credentials],
  )
}

interface BeaconProps {
  children: React.ReactNode
}

export default function Beacon({ children }: BeaconProps) {
  const beaconData = useBeaconData()

  const ipc = IPC.use()
  const sendBeacon = React.useCallback(() => {
    ipc.send(IPC.EVENTS.BEACON, beaconData)
  }, [beaconData, ipc])

  React.useEffect(() => {
    const timer = setInterval(sendBeacon, 5000)
    return () => clearInterval(timer)
  }, [sendBeacon])

  return <>{children}</>
}
