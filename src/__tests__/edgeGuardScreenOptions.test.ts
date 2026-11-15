import { Platform } from 'react-native'

import { edgeGuardScreenOptions } from '../edgeGuardScreenOptions'

describe('edgeGuardScreenOptions', () => {
  afterEach(() => {
    Platform.OS = 'ios'
  })

  it('hides both bars on Android while enabled', () => {
    Platform.OS = 'android'
    expect(edgeGuardScreenOptions(true)).toEqual({ navigationBarHidden: true, statusBarHidden: true })
  })

  it('shows the navigation bar on Android while disabled and leaves the status bar to the screen', () => {
    Platform.OS = 'android'
    expect(edgeGuardScreenOptions(false)).toEqual({ navigationBarHidden: false })
  })

  it('wins over a screen that keeps its status bar when spread after its options', () => {
    Platform.OS = 'android'
    expect({ statusBarHidden: false, ...edgeGuardScreenOptions(true) }).toEqual({ statusBarHidden: true, navigationBarHidden: true })
    expect({ statusBarHidden: true, ...edgeGuardScreenOptions(false) }).toEqual({ statusBarHidden: true, navigationBarHidden: false })
  })

  it.each(['ios', 'web'] as const)('adds nothing on %s', (os) => {
    Platform.OS = os
    expect(edgeGuardScreenOptions(true)).toEqual({})
    expect(edgeGuardScreenOptions(false)).toEqual({})
  })
})
