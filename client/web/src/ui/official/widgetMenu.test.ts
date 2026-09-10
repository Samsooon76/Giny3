import { describe, expect, it } from 'vitest'
import { widgetMenuState, type WidgetMenuContext } from './widgetMenu'

const widget: WidgetMenuContext = { titled: true, reducedHeader: false, locked: false }
const untitled: WidgetMenuContext = { ...widget, titled: false }

describe('what a menu entry does for one module', () => {
  it('offers the move the title can still make, never both', () => {
    expect(widgetMenuState('ReduceWidgetHeader', widget).shown).toBe(true)
    expect(widgetMenuState('MaximizeWidgetHeader', widget).shown).toBe(false)
    const reduced = { ...widget, reducedHeader: true }
    expect(widgetMenuState('ReduceWidgetHeader', reduced).shown).toBe(false)
    expect(widgetMenuState('MaximizeWidgetHeader', reduced).shown).toBe(true)
  })

  it('drops the title entries for a module that ships no handle', () => {
    // A `WindowFigma` has no official header until the client builds its bar,
    // so there is no `.header.widget` title to switch between heights.
    expect(widgetMenuState('ReduceWidgetHeader', untitled).shown).toBe(false)
    expect(widgetMenuState('MaximizeWidgetHeader', untitled).shown).toBe(false)
  })

  it('ticks the lock, which is shared by every module', () => {
    expect(widgetMenuState('LockWidgetPosition', widget).checked).toBe(false)
    expect(widgetMenuState('LockWidgetPosition', { ...widget, locked: true }).checked).toBe(true)
  })

  it('shows an entry it cannot carry out disabled rather than hiding it', () => {
    // The menu is the client's; leaving a row out would misreport it.
    for (const option of ['SmallWidget', 'LargeWidget', 'DuplicateWidget']) {
      expect(widgetMenuState(option, widget)).toEqual({ shown: true, enabled: false, checked: false })
    }
  })

  it('enables the entries that act on every module at once', () => {
    for (const option of ['ReduceAll', 'MaximizeAll', 'HideAllWidget', 'DisplayAllWidget', 'HideWidget']) {
      expect(widgetMenuState(option, widget).enabled).toBe(true)
    }
  })
})
