import React, { type CSSProperties, type ReactNode } from 'react'
import { liquidGlass, IOS_WIDGET_GLASS, type LiquidGlassOptions } from './liquid'

export interface LiquidGlassProps extends LiquidGlassOptions {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  disabled?: boolean
  as?: keyof React.JSX.IntrinsicElements
  'aria-label'?: string
}

/**
 * Liquid glass element with iOS-standard widget chrome, specular border, and optical depth.
 */
export function LiquidGlass({
  children,
  className,
  style,
  fill,
  radius,
  border,
  blur,
  saturate,
  onClick,
  disabled,
  as: Component = 'div',
  'aria-label': ariaLabel,
  ...rest
}: LiquidGlassProps) {
  const baseStyle = liquidGlass({ fill, radius, border, blur, saturate })

  const combinedStyle: CSSProperties = {
    ...baseStyle,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease',
    opacity: disabled ? 0.45 : 1,
    cursor: onClick && !disabled ? 'pointer' : undefined,
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    ...style,
  }

  return (
    <Component
      className={className}
      style={combinedStyle}
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {children}
    </Component>
  )
}

export { IOS_WIDGET_GLASS }
