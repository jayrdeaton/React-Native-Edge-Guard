/**
 * @jest-environment node
 */
import { readFileSync } from 'fs'
import { join } from 'path'

import { EDGE_GUARD_USER_DEFAULTS_KEY } from '../useEdgeGestureGuard'

// app.plugin.js is what "plugins": ["@tastic/edge-guard"] resolves to. Plain CommonJS with no type
// declarations (it only ever runs in Node at prebuild time), hence require() rather than an import.
const withEdgeGestureGuard = require('../../app.plugin.js')

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8')

// Real AppDelegate.swift files — see each fixture's own header for where it came from.
const SDK_57 = fixture('AppDelegate-57.0.27.swift')
const SDK_57_SCENE_SUPPORT = fixture('AppDelegate-57.0.27-scene-support.swift')
const SDK_58 = fixture('AppDelegate-58.0.6.swift')
const SDK_57_EDGE_GUARD_0_1_4 = fixture('AppDelegate-57.0.27-edge-guard-0.1.4.swift')

const IMPORT_LINE = 'import ReactAppDependencyProvider\n'
const RETURN_SUPER_LINE = '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n'
const START_REACT_NATIVE_LINE = '    factory.startReactNative(\n'
const SWIZZLE_CALL_LINE = '    _ = tastic_edgeGuardSwizzle\n'
const SWIZZLE_DEFINITION = '\nprivate let tastic_edgeGuardSwizzle: Void = {\n'

// Runs the plugin's AppDelegate mod through expo/config-plugins' real withAppDelegate chain, the way
// prebuild evaluates it, minus the base mod that reads and writes the file itself.
async function applyPlugin(contents: string, language = 'swift'): Promise<string> {
  const config = withEdgeGestureGuard({ name: 'test', slug: 'test' })
  const result = await config.mods.ios.appDelegate({ ...config, modResults: { contents, language, path: 'AppDelegate.swift' }, modRequest: {} })
  return result.modResults.contents
}

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1

describe('withEdgeGestureGuard', () => {
  describe.each([
    ['SDK 57 (window-based)', SDK_57],
    ['SDK 57 with ios.enableSceneSupport (scene-based)', SDK_57_SCENE_SUPPORT],
    ['SDK 58 (scene-based)', SDK_58]
  ])('%s AppDelegate', (_label, template) => {
    it('inserts only the import and the swizzle call into the template, then appends the swizzle definitions', async () => {
      const output = await applyPlugin(template)
      const definitionsAt = output.indexOf(SWIZZLE_DEFINITION)

      expect(definitionsAt).toBeGreaterThan(-1)
      expect(output.slice(0, definitionsAt)).toBe(template.replace(IMPORT_LINE, `${IMPORT_LINE}import ObjectiveC\n`).replace(RETURN_SUPER_LINE, `${SWIZZLE_CALL_LINE}${RETURN_SUPER_LINE}`))
      expect(output.slice(definitionsAt)).toContain(`UserDefaults.standard.bool(forKey: "${EDGE_GUARD_USER_DEFAULTS_KEY}")`)
    })

    it('adds each piece exactly once, with the call directly before didFinishLaunching returns', async () => {
      const output = await applyPlugin(template)

      expect(count(output, 'import ObjectiveC\n')).toBe(1)
      expect(count(output, SWIZZLE_CALL_LINE)).toBe(1)
      expect(count(output, SWIZZLE_DEFINITION)).toBe(1)
      expect(output).toContain(`${SWIZZLE_CALL_LINE}${RETURN_SUPER_LINE}`)
    })

    it('is idempotent', async () => {
      const once = await applyPlugin(template)
      expect(await applyPlugin(once)).toBe(once)
    })
  })

  it('still calls the swizzle after factory.startReactNative(...) in the window-based SDK 57 template', async () => {
    const output = await applyPlugin(SDK_57)
    expect(output.indexOf(SWIZZLE_CALL_LINE)).toBeGreaterThan(output.indexOf(START_REACT_NATIVE_LINE))
  })

  it('does not need factory.startReactNative(...), which the scene-based templates moved to SceneDelegate', async () => {
    expect(SDK_58).not.toContain(START_REACT_NATIVE_LINE)
    expect(SDK_57_SCENE_SUPPORT).not.toContain(START_REACT_NATIVE_LINE)
    await expect(applyPlugin(SDK_58)).resolves.toContain(SWIZZLE_CALL_LINE)
  })

  // `expo prebuild --clean` regenerates ios/ from the template, so an AppDelegate 0.1.4 already
  // patched only reaches this plugin again on a prebuild without --clean. Its call is still valid
  // there (that's the window-based template), and patching it again would only duplicate it.
  it('leaves an AppDelegate already patched by 0.1.4 (call after factory.startReactNative) untouched', async () => {
    expect(SDK_57_EDGE_GUARD_0_1_4).toContain(`      launchOptions: launchOptions)\n${SWIZZLE_CALL_LINE}#endif\n`)
    await expect(applyPlugin(SDK_57_EDGE_GUARD_0_1_4)).resolves.toBe(SDK_57_EDGE_GUARD_0_1_4)
  })

  it('throws, naming the missing line, when the didFinishLaunching return anchor is gone', async () => {
    await expect(applyPlugin(SDK_58.replace(RETURN_SUPER_LINE, '    return true\n'))).rejects.toThrow('withEdgeGestureGuard could not find `return super.application(application, didFinishLaunchingWithOptions: launchOptions)` in AppDelegate.swift')
  })

  it('throws, naming the missing line, when the import anchor is gone', async () => {
    await expect(applyPlugin(SDK_58.replace(IMPORT_LINE, ''))).rejects.toThrow('withEdgeGestureGuard could not find `import ReactAppDependencyProvider` in AppDelegate.swift')
  })

  it('throws for an Objective-C AppDelegate', async () => {
    await expect(applyPlugin(SDK_57, 'objc')).rejects.toThrow('withEdgeGestureGuard expects AppDelegate.swift, got language "objc"')
  })
})
