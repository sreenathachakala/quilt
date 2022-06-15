import * as React from 'react'

import * as Config from 'utils/Config'

import * as FileView from './FileView'

interface DownloadButtonProps {
  className: string
  label?: string
  onClick: () => void
  path?: string
}

export function DownloadButton({ className, label, onClick, path }: DownloadButtonProps) {
  const { desktop, noDownload }: { desktop: boolean; noDownload: boolean } = Config.use()

  if (noDownload) return null

  if (desktop) {
    return (
      <FileView.DownloadButtonLayout
        className={className}
        label={label}
        icon="archive"
        type="submit"
        onClick={onClick}
      />
    )
  }

  return <FileView.ZipDownloadForm className={className} label={label} suffix={path} />
}
