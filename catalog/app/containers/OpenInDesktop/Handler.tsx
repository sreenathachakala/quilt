import * as React from 'react'

import ConfirmDownloadPackage from './ConfirmDownloadPackage'
// import Lock from './Lock'
import Navigate from './Navigate'

interface HandlerProps {
  children: React.ReactNode
}

export default function Handler({ children }: HandlerProps) {
  return (
    <ConfirmDownloadPackage>
      <Navigate>
        {/* <Lock /> */}
        {children}
      </Navigate>
    </ConfirmDownloadPackage>
  )
}
