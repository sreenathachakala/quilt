import * as React from 'react'

import Navigate from './Navigate'
import Lock from './Lock'

interface OpenInDesktopProps {
  children: React.ReactNode
}

export default function OpenInDesktop({ children }: OpenInDesktopProps) {
  return (
    <Navigate>
      <Lock />
      {children}
    </Navigate>
  )
}
