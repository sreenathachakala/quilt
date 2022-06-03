// import { extname } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import { DecompressorRegistry } from 'ngl'

import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import mkSearch from 'utils/mkSearch'
import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData } from '../types'

import * as utils from './utils'

const openchem = import('openchemlib/minimal')

// type ResponseFile = string | ArrayBuffer
type ResponseFile = string

async function parseResponse(
  file: ResponseFile,
  handle: S3HandleBase,
): Promise<{ file: ResponseFile; ext: string }> {
  // console.log('PARSE REsPONSE', file, handle)
  // const ext = extname(utils.stripCompression(handle.key)).substring(1)
  // if (ext !== 'sdf' && ext !== 'mol' && ext !== 'mol2')
  //   return {
  //     ext,
  //     file,
  //   }
  const strFile = file.toString()
  console.log({ strFile })
  if (strFile.indexOf('V3000') === -1) return { ext: 'mol', file }
  const { Molecule } = await openchem
  return {
    ext: 'mol',
    file: Molecule.fromMolfile(strFile).toMolfile(),
  }
}

export const detect = R.pipe(
  utils.stripCompression,
  utils.extIn(['.cif', '.ent', '.mol', '.mol2', '.pdb', '.sdf']),
)

const gzipDecompress = DecompressorRegistry.get('gz')

interface LoadMoleculeArgs {
  format: string
  endpoint: string
  handle: S3HandleBase
  sign: (h: S3HandleBase) => string
}

async function loadMolecule({
  format,
  endpoint,
  handle,
  sign,
}: LoadMoleculeArgs): Promise<ResponseFile> {
  const url = sign(handle)
  const r = await window.fetch(
    `${endpoint}/molecule${mkSearch({
      format,
      url,
    })}`,
  )
  return r.text()
}

interface NglLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3HandleBase
}

export const Loader = function NglLoader({ handle, children }: NglLoaderProps) {
  const { binaryApiGatewayEndpoint: endpoint } = Config.use()
  const sign = AWS.Signer.useS3Signer()
  const data = Data.use(loadMolecule, {
    endpoint,
    handle,
    sign,
    format: 'chemical/x-mdl-molfile',
  })

  const processed = utils.useAsyncProcessing(data.result, async (r: ResponseFile) => {
    const compression = utils.getCompression(handle.key)
    const body = compression === 'gz' ? gzipDecompress(r as string) : r
    const { file, ext } = await parseResponse(body, handle)
    return PreviewData.Ngl({ blob: new Blob([file]), ext })
  })
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  return children(handled)
}
