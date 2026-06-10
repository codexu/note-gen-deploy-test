'use client'

import { useEffect } from 'react'

function shouldFilterConsoleMessage(args: unknown[]) {
  const message = args.map((arg) => String(arg)).join(' ')

  if (isKnownTauriDevNoise(message)) {
    return true
  }

  if (message.includes('flushSync')) {
    return true
  }

  return (
    message.includes("[TAURI] Couldn't find callback id") &&
    message.includes('app is reloaded while Rust is running an asynchronous operation')
  )
}

function getErrorMessage(value: unknown) {
  if (value instanceof Error) {
    return value.message
  }

  if (typeof value === 'object' && value !== null && 'message' in value) {
    return String((value as { message?: unknown }).message)
  }

  return String(value)
}

function isKnownTauriDevNoise(message: string) {
  if (message.includes('IPC custom protocol failed') && message.includes('postMessage interface')) {
    return true
  }

  if (
    message.includes("[TAURI] Couldn't find callback id") &&
    message.includes('app is reloaded while Rust is running an asynchronous operation')
  ) {
    return true
  }

  if (
    message.includes('undefined is not an object') &&
    message.includes('callbackId')
  ) {
    return true
  }

  return (
    message.includes('__nextjs_original-stack-frames') &&
    message.includes('access control')
  )
}

export function ConsoleFilter() {
  useEffect(() => {
    const originalError = console.error
    const originalWarn = console.warn

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isKnownTauriDevNoise(getErrorMessage(event.reason))) {
        event.preventDefault()
      }
    }

    const handleError = (event: ErrorEvent) => {
      const message = event.message || getErrorMessage(event.error)
      if (isKnownTauriDevNoise(message)) {
        event.preventDefault()
      }
    }

    console.error = (...args: unknown[]) => {
      if (shouldFilterConsoleMessage(args)) {
        return
      }
      originalError.apply(console, args)
    }

    console.warn = (...args: unknown[]) => {
      if (shouldFilterConsoleMessage(args)) {
        return
      }
      originalWarn.apply(console, args)
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      console.error = originalError
      console.warn = originalWarn
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  return null
}
