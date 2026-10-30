import type { ReactElement, ReactNode } from 'react'
import { View } from '@hanzo/gui'
import { liquidGlass, IOS_WIDGET_GLASS, type LiquidGlassOptions } from './liquid'

export interface LiquidGlassProps extends LiquidGlassOptions {
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
  /** The element it is drawn as: a tag, or an element whose own attributes it keeps. */
  render?: string | ReactElement
  'aria-label'?: string
}

/**
 * Liquid glass element with iOS-standard widget chrome, specular border, and optical depth.
 */
export function LiquidGlass({
  children,
  fill,
  radius,
  border,
  blur,
  saturate,
  onClick,
  disabled,
  render,
  'aria-label': ariaLabel,
}: LiquidGlassProps) {
  const glass = liquidGlass({ fill, radius, border, blur, saturate })
  return (
    <View
      {...glass}
      render={render as never}
      position="relative"
      display="flex"
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.45 : 1}
      cursor={onClick && !disabled ? 'pointer' : undefined}
      userSelect="none"
      $platform-web={{
        ...glass['$platform-web'],
        transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPress={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
    >
      {children}
    </View>
  )
}

export { IOS_WIDGET_GLASS }
