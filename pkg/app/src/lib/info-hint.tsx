import React from 'react'
import { Info } from 'lucide-react'
import { Text, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Box } from '@hanzo/ui'

export interface InfoHintProps {
  text: string
  size?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function InfoHint({ text, size = 13, side = 'top' }: InfoHintProps) {
  if (!text) return null
  return (
    <TooltipProvider delay={150}>
      <Tooltip placement={side} offset={6}>
        <TooltipTrigger asChild>
          <Box
            render={<button type="button" aria-label={text} />}
            items="center"
            justify="center"
            p="$0.5"
            m={0}
            borderWidth={0}
            bg="transparent"
                        rounded="$10"
            cursor="help"
            focusVisibleStyle={{ outlineWidth: 1, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <Info size={size} color="var(--muted-foreground)" aria-hidden />
          </Box>
        </TooltipTrigger>
        <TooltipContent
          maxW={260}
          px="$3"
          py="$2"
          rounded="$3"
          bg="var(--popover)"
          borderWidth={1}
          borderColor="$edge"
          z="var(--z-tooltip)"
        >
          <Text fontFamily="$body" fontSize="$1" lineHeight={16} color="$aside">
            {text}
          </Text>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
