import { renderHook } from '@testing-library/react'
import { Platform, Settings } from 'react-native'

import { EDGE_GUARD_USER_DEFAULTS_KEY, useEdgeGestureGuard } from '../useEdgeGestureGuard'

describe('useEdgeGestureGuard', () => {
  afterEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'ios'
  })

  it('mirrors enabled into UserDefaults via Settings.set on iOS', () => {
    renderHook(() => useEdgeGestureGuard(true))
    expect(Settings.set).toHaveBeenCalledWith({ [EDGE_GUARD_USER_DEFAULTS_KEY]: true })
  })

  it('mirrors false just as readily as true', () => {
    renderHook(() => useEdgeGestureGuard(false))
    expect(Settings.set).toHaveBeenCalledWith({ [EDGE_GUARD_USER_DEFAULTS_KEY]: false })
  })

  it('re-syncs whenever enabled changes', () => {
    const { rerender } = renderHook(({ enabled }) => useEdgeGestureGuard(enabled), { initialProps: { enabled: false } })
    rerender({ enabled: true })
    expect(Settings.set).toHaveBeenNthCalledWith(1, { [EDGE_GUARD_USER_DEFAULTS_KEY]: false })
    expect(Settings.set).toHaveBeenNthCalledWith(2, { [EDGE_GUARD_USER_DEFAULTS_KEY]: true })
  })

  it('does not touch Settings on non-iOS platforms', () => {
    Platform.OS = 'android'
    renderHook(() => useEdgeGestureGuard(true))
    expect(Settings.set).not.toHaveBeenCalled()
  })
})
