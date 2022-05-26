import * as React from 'react'

import Navigate from './Navigate'
import Lock from './Lock'

interface HandlerProps {
  children: React.ReactNode
}

export default function Handler({ children }: HandlerProps) {
  return (
    <Navigate>
      <Lock />
      {children}
    </Navigate>
  )
}
