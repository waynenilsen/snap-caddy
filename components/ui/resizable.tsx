"use client"

import * as React from "react"

// Stub - react-resizable-panels integration needs to be fixed
// This component is not used in the current app

function ResizablePanelGroup({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={className} {...props}>{children}</div>
}

function ResizablePanel({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
  return <div {...props}>{children}</div>
}

function ResizableHandle({ withHandle, className, ...props }: { withHandle?: boolean; className?: string }) {
  return <div className={className} {...props} />
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
