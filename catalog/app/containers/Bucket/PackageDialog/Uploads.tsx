import type { S3 } from 'aws-sdk'
import * as FP from 'fp-ts'
import invariant from 'invariant'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'

import * as IPC from 'utils/electron-ipc'
import * as AWS from 'utils/AWS'
import dissocBy from 'utils/dissocBy'
import * as s3paths from 'utils/s3paths'
import useMemoEq from 'utils/useMemoEq'

import type { LocalFile, ExistingFile } from './FilesInput'

export interface UploadResult extends S3.ManagedUpload.SendData {
  VersionId: string
}

export interface UploadTotalProgress {
  total: number
  loaded: number
  percent: number
}

export interface UploadsState {
  [path: string]: {
    file: File
    // upload: S3.ManagedUpload
    promise: Promise<UploadResult>
    progress?: { total: number; loaded: number }
  }
}

export const computeTotalProgress = (uploads: UploadsState): UploadTotalProgress =>
  FP.function.pipe(
    uploads,
    R.values,
    R.reduce(
      (acc, { progress: p }) => ({
        total: acc.total + ((p && p.total) || 0),
        loaded: acc.loaded + ((p && p.loaded) || 0),
      }),
      { total: 0, loaded: 0 },
    ),
    (p) => ({
      ...p,
      percent: p.total ? Math.floor((p.loaded / p.total) * 100) : 100,
    }),
  )

async function uploadFileUsingSDK(
  s3: S3,
  file: LocalFile,
  handle: { bucket: string; prefix: string; path: string },
  abortController: AbortController,
  onProgress: (progress: number) => void,
): Promise<UploadResult> {
  const upload: S3.ManagedUpload = s3.upload(
    {
      Bucket: handle.bucket,
      Key: `${handle.prefix}/${handle.path}`,
      Body: file,
    },
    {
      queueSize: 2,
    },
  )
  upload.on('httpUploadProgress', ({ loaded }) => {
    onProgress(loaded)
  })

  if (abortController.signal.aborted) {
    throw new Error('Aborted')
  }

  try {
    const uploadP = upload.promise()
    await file.hash.promise
    return (await uploadP) as UploadResult
  } catch (e) {
    abortController.abort()
    throw e
  }
}

async function uploadFileUsingCLI(
  ipc: IPC.IPC,
  file: LocalFile,
  handle: { bucket: string; prefix: string; path: string },
  abortController: AbortController,
  onProgress: (progress: number) => void,
) {
  ipc.on(IPC.EVENTS.CLI_OUTPUT, () => onProgress(49))

  try {
    const result = await ipc.invoke(
      IPC.EVENTS.SYNC_UPLOAD,
      [file.path || file.name],
      `${handle.bucket}.${handle.prefix}.${handle.path}`,
    )
    return result
  } catch (e) {
    abortController.abort()
    throw e
  }
}

async function uploadFile(
  { s3, ipc }: { ipc: IPC.IPC; s3: S3 },
  file: LocalFile,
  handle: { bucket: string; prefix: string; path: string },
  abortController: AbortController,
  onProgress: (progress: number) => void,
): Promise<UploadResult> {
  if (!ipc) {
    return uploadFileUsingSDK(s3, file, handle, abortController, onProgress)
  }
  return uploadFileUsingCLI(ipc, file, handle, abortController, onProgress)
}

export function useUploads() {
  const s3 = AWS.S3.use()

  const [uploads, setUploads] = React.useState<UploadsState>({})
  const progress = React.useMemo(() => computeTotalProgress(uploads), [uploads])

  const remove = React.useCallback(
    (path: string) => setUploads(R.dissoc(path)),
    [setUploads],
  )
  const removeByPrefix = React.useCallback(
    (prefix: string) => setUploads(dissocBy(R.startsWith(prefix))),
    [setUploads],
  )
  const reset = React.useCallback(() => setUploads({}), [setUploads])
  const ipc = IPC.use()

  const doUpload = React.useCallback(
    async ({
      files,
      bucket,
      prefix,
      getMeta,
    }: {
      files: { path: string; file: LocalFile }[]
      bucket: string
      prefix: string
      getMeta?: (path: string) => object | undefined
    }) => {
      const limit = pLimit(2)
      const abortController = new AbortController()
      const uploadStates = files.map(({ path, file }) => {
        // reuse state if file hasnt changed
        const entry = uploads[path]
        if (entry && entry.file === file) return { ...entry, path }

        const promise = limit(() =>
          uploadFile(
            { ipc, s3 },
            file,
            { bucket, prefix, path },
            abortController,
            (loaded) => {
              if (abortController.signal.aborted) return
              setUploads(R.assocPath([path, 'progress', 'loaded'], loaded))
            },
          ).then(async (data) => {
            if (abortController.signal.aborted) {
              remove(path)
            }
            return data
          }),
        )
        return { path, file, promise, progress: { total: file.size, loaded: 0 } }
      })

      FP.function.pipe(
        uploadStates,
        R.map(({ path, ...rest }) => ({ [path]: rest })),
        R.mergeAll,
        setUploads,
      )

      const uploaded = await Promise.all(uploadStates.map((x) => x.promise))

      return FP.function.pipe(
        FP.array.zipWith(files, uploaded, (f, r) => {
          invariant(f.file.hash.value, 'File must have a hash')
          return [
            f.path,
            {
              physicalKey: s3paths.handleToS3Url({
                bucket,
                key: r.Key,
                version: r.VersionId,
              }),
              size: f.file.size,
              hash: f.file.hash.value,
              meta: getMeta?.(f.path),
            },
          ] as R.KeyValuePair<string, ExistingFile>
        }),
        R.fromPairs,
      )
    },
    [ipc, remove, s3, uploads],
  )

  return useMemoEq(
    { uploads, upload: doUpload, progress, remove, removeByPrefix, reset },
    R.identity,
  )
}
