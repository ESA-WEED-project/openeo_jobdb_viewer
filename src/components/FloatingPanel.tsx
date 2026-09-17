import type { ReactNode } from 'react'

interface FloatingPanelProps {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  collapsed?: boolean
  contentClassName?: string
  title: string
}

export function FloatingPanel({
  actions,
  children,
  className,
  collapsed = false,
  contentClassName,
  title,
}: FloatingPanelProps) {
  return (
    <section className={`panel floating-panel ${collapsed ? 'is-collapsed' : ''} ${className ?? ''}`.trim()}>
      <div className="panel-header">
        <h2>{title}</h2>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      {!collapsed ? <div className={contentClassName}>{children}</div> : null}
    </section>
  )
}
