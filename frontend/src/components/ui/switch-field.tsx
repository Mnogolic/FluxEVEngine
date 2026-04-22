'use client'

import { useId, type KeyboardEvent, type ReactNode } from 'react'

interface SwitchFieldProps {
  ariaLabel?: string
  isDisabled?: boolean
  isSelected: boolean
  label: ReactNode
  onValueChange: (value: boolean) => void
}

export function SwitchField({
  ariaLabel,
  isDisabled,
  isSelected,
  label,
  onValueChange
}: SwitchFieldProps) {
  const labelId = useId()
  const toggle = () => {
    if (!isDisabled) {
      onValueChange(!isSelected)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      return
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      onValueChange(!isSelected)
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 self-start">
      <span className="text-center text-xs text-[#8b949e]" id={labelId}>
        {label}
      </span>
      <button
        aria-checked={isSelected}
        aria-disabled={isDisabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : labelId}
        className={[
          'inline-flex min-h-10 items-center justify-center self-center rounded-md p-0 transition-opacity outline-none',
          isDisabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'
        ].join(' ')}
        disabled={isDisabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        role="checkbox"
        type="button"
      >
        <span
          aria-hidden="true"
          className={[
            'flex h-5 w-5 items-center justify-center rounded-[6px] border-[1.5px] transition-all duration-200',
            isSelected
              ? 'border-[#58a6ff] bg-[#58a6ff]'
              : 'border-[#30363d] bg-transparent hover:bg-[#21262d]'
          ].join(' ')}
        >
          <svg
            aria-hidden="true"
            className={[
              'h-2.5 w-3 text-white transition-all duration-200',
              isSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
            ].join(' ')}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 17 18"
          >
            <polyline points="1 9 7 14 15 4" />
          </svg>
        </span>
      </button>
    </div>
  )
}
