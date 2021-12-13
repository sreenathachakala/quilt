import * as React from 'react'
import * as M from '@material-ui/core'

import { JsonValue } from 'components/JsonEditor/constants'
import * as IPC from 'utils/electron/ipc-provider'
import { JsonSchema } from 'utils/json-schema'
import * as workflows from 'utils/workflows'
import { getMetaValue, getWorkflowApiParam } from 'containers/Bucket/requests/package'

interface UploadPackagePayload {
  message: string
  meta: JsonValue
  workflow: workflows.Workflow
  entry: string
}

interface UploadPackageTarget {
  bucket: string
  name: string
}

export function useUploadPackage() {
  const ipc = IPC.use()
  return React.useCallback(
    (payload: UploadPackagePayload, target: UploadPackageTarget, schema?: JsonSchema) => {
      const body = {
        ...payload,
        meta: getMetaValue(payload.meta, schema),
        workflow: getWorkflowApiParam(payload.workflow.slug),
      }
      return ipc.invoke(IPC.EVENTS.SYNC_UPLOAD, body, target)
    },
    [ipc],
  )
}

interface LocalFolderInputProps {
  input: {
    onChange: (path: string) => void
    value: string | null
  }
}

export function LocalFolderInput({ input: { onChange, value } }: LocalFolderInputProps) {
  const ipc = IPC.use()

  const handleClick = React.useCallback(async () => {
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [ipc, onChange])

  return (
    <>
      <M.TextField
        fullWidth
        size="small"
        disabled={false}
        helperText="Click to set local folder with your file browser"
        id="localPath"
        label="Path to local folder"
        onClick={handleClick}
        value={value}
      />
    </>
  )
}
