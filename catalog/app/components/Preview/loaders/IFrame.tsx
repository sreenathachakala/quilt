import { dirname } from 'path'

import type { S3 } from 'aws-sdk'
import * as R from 'ramda'
import * as React from 'react'

import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { mkSearch } from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewData } from '../types'

import * as iframeSdk from './IframeSdk'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

type Sign = (handle: s3paths.S3HandleBase) => string

function generateJsonUrl(handle: s3paths.S3HandleBase, endpoint: string, sign: Sign) {
  return encodeURIComponent(
    `${endpoint}/preview${mkSearch({
      url: sign(handle),
      input: 'txt',
      max_bytes: 20 * 1024 * 1024,
    })}`,
  )
}

function generateCsvUrl(handle: s3paths.S3HandleBase, endpoint: string, sign: Sign) {
  return encodeURIComponent(
    `${endpoint}/tabular-preview${mkSearch({
      url: sign(handle),
      input: 'csv',
      size: 'large',
    })}`,
  )
}

interface Env {
  fileHandle: s3paths.S3HandleBase
  packageHandle: PackageHandle
}

interface FileHandle extends s3paths.S3HandleBase {
  packageHandle: PackageHandle
}

function prepareSrcDoc(html: string, env: Env, scripts: string) {
  return html.replace(
    '</head>',
    `${scripts}

  <script>
    function onReady(callback) {
      const env = ${JSON.stringify(env)}
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => callback(env))
      } else {
        callback(env)
      }
    }
    if (!window.quilt) {
      window.quilt = {}
    }
    window.quilt.onReady = onReady
  </script>
</head>`,
  )
}

interface PartialS3Handle {
  bucket?: string
  key: string
}

function useContextEnv(handle: FileHandle): Env {
  return React.useMemo(() => {
    const { packageHandle, ...fileHandle } = handle
    return {
      fileHandle,
      packageHandle,
    }
  }, [handle])
}

function generateSignedUrl(
  partialHandle: PartialS3Handle,
  config: Config.Config,
  sign: Sign,
  baseHandle: s3paths.S3HandleBase,
): string {
  const handle = {
    key: partialHandle.key,
    bucket: partialHandle.bucket || baseHandle.bucket,
  }
  if (utils.extIs('.csv')(handle.key)) {
    return generateCsvUrl(handle, config.binaryApiGatewayEndpoint, sign)
  }
  return generateJsonUrl(handle, config.apiGatewayEndpoint, sign)
}

async function listFiles(
  s3: S3,
  baseHandle: s3paths.S3HandleBase,
): Promise<s3paths.S3HandleBase[]> {
  const response = await requests.bucketListing({
    s3,
    bucket: baseHandle.bucket,
    path: s3paths.ensureSlash(dirname(baseHandle.key)),
  })
  return response.files.map(R.pick(['bucket', 'key']))
}

function useMessageBus(handle: FileHandle) {
  const s3 = AWS.S3.use()
  const sign = AWS.Signer.useS3Signer()
  const config = Config.use()

  return React.useCallback(
    async ({ name, payload }) => {
      // TODO: error handling
      switch (name) {
        case iframeSdk.EVENT_NAME.LIST_FILES: {
          return listFiles(s3, handle)
        }
        case iframeSdk.EVENT_NAME.GET_FILE_URL: {
          return generateSignedUrl(payload as PartialS3Handle, config, sign, handle)
        }
        case iframeSdk.EVENT_NAME.FIND_FILE_URL: {
          const { key: searchKey } = payload as PartialS3Handle
          const files = await listFiles(s3, handle)
          const h = files.find(({ key }) => key.endsWith(searchKey))
          if (!h) return null
          return generateSignedUrl(h, config, sign, handle)
        }
        default: {
          return null
        }
      }
    },
    [config, handle, sign, s3],
  )
}

function useInjectedScripts() {
  return React.useCallback(async () => {
    const response = await window.fetch('/__iframe-sdk')
    const html = await response.text()
    return html.replace('<html>', '').replace('</html>', '')
  }, [])
}

interface TextDataOutput {
  info: {
    data: {
      head: string[]
      tail: string[]
    }
    note: string
    warnings: string
  }
}

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: FileHandle
}

export const Loader = function IFrameLoader({ handle, children }: IFrameLoaderProps) {
  const env = useContextEnv(handle)

  const sign = AWS.Signer.useS3Signer()
  const onMessage = useMessageBus(handle)

  const injectScripts = useInjectedScripts()

  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: MAX_BYTES },
  })
  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }: TextDataOutput) => {
      const scripts = await injectScripts()
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      // TODO: get storage class
      const srcDoc = prepareSrcDoc([head, tail].join('\n'), env, scripts)
      return PreviewData.IFrame({ onMessage, srcDoc, src, note, warnings })
    },
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
