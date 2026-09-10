import { describe, expect, it } from 'vitest'
import appCss from '../../App.css?raw'
import officialCss from './official.css?raw'
import { treeFrameOffset } from './treeFrame'

describe('overlay tree placement', () => {
  it('pins overlay chrome at the authored origin instead of letterboxing', () => {
    const canvas = { width: 1470, height: 827 }
    const header = { width: 1910, height: 1024 }
    expect(treeFrameOffset(canvas, header)).toEqual({ left: 0, top: 0 })
    expect(treeFrameOffset(canvas, header, true)).toEqual({ left: 0, top: 0 })
  })

  it('pins a smaller full screen to the runtime origin as well', () => {
    expect(treeFrameOffset({ width: 1470, height: 827 }, { width: 1280, height: 1024 })).toEqual({
      left: 0, top: 0,
    })
  })
})

describe('host CSS', () => {
  it('does not rattrape official trees with a data-binding selector or !important', () => {
    const css = `${appCss}\n${officialCss}`
    expect(css).not.toMatch(/\[data-binding/)
    expect(css).not.toMatch(/!important/)
  })
})
