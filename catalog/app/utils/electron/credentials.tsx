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

interface SyncCredentialsProvider {
  children: React.ReactNode
}

export default function SyncCredentials({ children }: SyncCredentialsProvider) {
  const ipc = IPC.use()
  const credentials: Credentials = AWS.Credentials.use()
  const sendCredentials = React.useCallback(() => {
    ipc.send(IPC.EVENTS.CREDENTIALS, serializeCredentials(credentials))
  }, [credentials, ipc])
  React.useEffect(() => {
    const timer = setInterval(sendCredentials, 5000)
    return () => clearInterval(timer)
  }, [sendCredentials])
  return <>{children}</>
}
