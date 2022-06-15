import * as React from 'react'

// import Lock from './Lock'
import Navigate from './Navigate'

interface HandlerProps {
  children: React.ReactNode
}

export default function Handler({ children }: HandlerProps) {
  return (
    <Navigate>
      {/* <Lock /> */}
      {children}
    </Navigate>
  )
}
