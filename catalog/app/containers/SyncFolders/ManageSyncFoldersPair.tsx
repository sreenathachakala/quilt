import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as IPC from 'utils/electron/ipc-provider'
import * as validators from 'utils/validators'

import { DataRow } from './data'

export interface FieldProps {
  errors: Record<string, React.ReactNode>
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
}

export function Field({
  input,
  meta,
  errors,
  helperText,
  InputLabelProps,
  ...rest
}: FieldProps & M.TextFieldProps) {
  const error = meta.submitFailed && (meta.error || meta.submitError)
  const props = {
    error: !!error,
    helperText: error ? errors[error] || error : helperText,
    disabled: meta.submitting || meta.submitSucceeded,
    InputLabelProps: { shrink: true, ...InputLabelProps },
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}

type LocalFolderInputProps = M.TextFieldProps & FieldProps

export function LocalFolderInput({ input, ...props }: LocalFolderInputProps) {
  const ipc = IPC.use()
  const { onChange } = input

  const handleClick = React.useCallback(async () => {
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [ipc, onChange])

  return <Field onClick={handleClick} size="small" input={input} {...props} />
}

interface ManageFolderDialogProps {
  onCancel: () => void
  onSubmit: (v: DataRow) => void
  s3Disabled?: boolean
  title?: string
  value: Partial<DataRow> | null
}
export default function ManageFolderDialog({
  onCancel,
  onSubmit,
  s3Disabled,
  title,
  value,
}: ManageFolderDialogProps) {
  return (
    <M.Dialog open={!!value}>
      <RF.Form onSubmit={onSubmit} initialValues={value}>
        {({ handleSubmit, submitting, submitFailed, hasValidationErrors }) => (
          <>
            <M.DialogTitle>{title || 'Add local ⇄ s3 folder pair'}</M.DialogTitle>
            <M.DialogContent>
              <RF.Field
                component={LocalFolderInput}
                name="local"
                label="Local folder"
                placeholder="Folder on local file system"
                validate={validators.required as FF.FieldValidator<any>}
                errors={{
                  required: 'Path to local directory is required',
                }}
                fullWidth
                margin="normal"
              />
              <RF.Field
                component={Field}
                disabled={!!s3Disabled}
                label="S3 bucket + Package name"
                name="s3"
                placeholder="s3://bucket/namespace/package"
                validate={
                  validators.composeAnd(
                    validators.required,
                    validators.s3Url,
                  ) as FF.FieldValidator<any>
                }
                errors={{
                  required: 'S3 URL is required',
                  s3Url: 'Enter valid S3 URL to package',
                }}
                fullWidth
                margin="normal"
              />
            </M.DialogContent>
            <M.DialogActions>
              <M.Button onClick={onCancel} color="primary" disabled={submitting}>
                Cancel
              </M.Button>
              <M.Button
                color="primary"
                disabled={submitting || (submitFailed && hasValidationErrors)}
                onClick={handleSubmit}
                variant="contained"
              >
                {value ? 'Save' : 'Add'}
              </M.Button>
            </M.DialogActions>
          </>
        )}
      </RF.Form>
    </M.Dialog>
  )
}
