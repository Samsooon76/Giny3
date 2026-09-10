import { describe, expect, it } from 'vitest'
import {
  DROPDOWN_TYPES, ENTITY_TYPES, INPUT_BINDINGS, PROGRESS_TYPES, SCROLL_TYPES,
  checkboxLineNeedsCaption, childScope, hideClosedDropdownList, initialChecked, isDropdownListPart, isStatefulControl, mergeExclusiveClasses, progressColor, progressFill, progressOrientation, swapFlagClass, swapSideClass, withCheckboxLineCaption, withCheckboxState, withSwitchSide,
} from './controls'

describe('runtime C# control adapters', () => {
  it('keeps React state only on dropdowns and toggles', () => {
    expect(isStatefulControl('Dropdown')).toBe(true)
    expect(isStatefulControl('CheckboxCustom')).toBe(true)
    expect(isStatefulControl('ScrollView')).toBe(false)
    expect(isStatefulControl('EntityDisplayer')).toBe(false)
    expect(isStatefulControl('VisualElement')).toBe(false)
    expect(DROPDOWN_TYPES.has('Dropdown')).toBe(true)
    expect(SCROLL_TYPES.has('ListView')).toBe(true)
    expect(ENTITY_TYPES.has('EntityPortrait')).toBe(true)
    expect(ENTITY_TYPES.has('EntityDisplayer')).toBe(true)
    expect(PROGRESS_TYPES.has('ExtendedProgressBarInt')).toBe(true)
  })

  it('hides a closed dropdown list and keeps the trigger', () => {
    expect(isDropdownListPart({ binding: 'dropdown_list' })).toBe(true)
    expect(isDropdownListPart({ binding: 'dropdown_listElement' })).toBe(true)
    expect(isDropdownListPart({ binding: 'dropdown_content' })).toBe(false)
    expect(hideClosedDropdownList(false, { binding: 'dropdown_list' })).toBe(true)
    expect(hideClosedDropdownList(false, { binding: 'dropdown_listElement_content' })).toBe(true)
    expect(hideClosedDropdownList(true, { binding: 'dropdown_list' })).toBe(false)
    expect(hideClosedDropdownList(false, { binding: 'dropdown_caption' })).toBe(false)
  })

  it('reads the constructor boolean off the instance classes', () => {
    expect(initialChecked({ classes: ['checkbox', 'activeFalse'] })).toBe(false)
    expect(initialChecked({ classes: ['checkbox', 'activeTrue'] })).toBe(true)
    expect(initialChecked({ properties: { state: 'true' } })).toBe(true)
    expect(swapFlagClass(['checkbox', 'activeFalse'], true, 'active')).toEqual(['checkbox', 'activeTrue'])
    expect(mergeExclusiveClasses(['button', 'secondary', 'medium', 'text'], 'primary')).toEqual([
      'button', 'medium', 'text', 'primary',
    ])
    expect(mergeExclusiveClasses(['entityMainStats', 'Simple'], 'Advanced')).toEqual([
      'entityMainStats', 'Advanced',
    ])
    expect(mergeExclusiveClasses(
      ['renderstudio-grid-view__dummy-item', 'itemTile', 'medium', 'inventory'],
      'asset acquiredTrue',
    )).toEqual(['itemTile', 'medium', 'inventory', 'asset', 'acquiredTrue'])
    expect(mergeExclusiveClasses(
      ['sectionHeader', 'openFalse', 'nav', 'activeFalse', 'category'],
      'quest',
    )).toEqual(['sectionHeader', 'openFalse', 'nav', 'activeFalse', 'quest'])
    expect(mergeExclusiveClasses(
      ['sectionHeader', 'openFalse', 'nav', 'activeFalse', 'category'],
      'quest dungeon',
    )).toEqual(['sectionHeader', 'openFalse', 'nav', 'activeFalse', 'quest', 'dungeon'])
    expect(mergeExclusiveClasses(
      ['tab', 'medium', 'text', 'activeFalse', 'notificationFalse', 'normal'],
      'activeTrue',
    )).toEqual(['tab', 'medium', 'text', 'notificationFalse', 'normal', 'activeTrue'])
  })

  it('treats a Switch .right class as on, and copies it onto the inner track', () => {
    expect(initialChecked({ type: 'Switch', classes: ['switchLine', 'choice', 'right', 'icon'] })).toBe(true)
    expect(initialChecked({ type: 'Switch', classes: ['switchLine', 'choice', 'left', 'icon'] })).toBe(false)
    expect(initialChecked({ classes: ['switch', 'choice', 'right'] })).toBe(true)
    expect(swapSideClass(['switch', 'choice', 'right'], false)).toEqual(['switch', 'choice', 'left'])
    const sided = withSwitchSide([
      {
        name: 'switchLine_switch',
        classes: ['switch', 'choice', 'right'],
        children: [{ name: 'switch_circle', classes: [] }],
      },
    ], false)
    expect(sided[0].classes).toEqual(['switch', 'choice', 'left'])
    expect(sided[0].children?.[0].classes).toEqual([])
  })

  it('clamps a progress bar to 0–100 and honours vertical gauges', () => {
    expect(progressFill({ properties: { value: 25, 'high-value': 50 } })).toBe(50)
    expect(progressFill({ properties: { 'high-value': 50 } })).toBe(0)
    expect(progressFill({}, 120)).toBe(100)
    expect(progressOrientation({ properties: { 'gauge-orientation': 'vertical' } })).toBe('vertical')
    expect(progressOrientation({ properties: { gaugeOrientation: '0' } })).toBe('horizontal')
    expect(progressColor({ properties: { 'custom-progressBar-color': 'rgb(229, 33, 64)' } })).toBe('rgb(229, 33, 64)')
    expect(progressColor({ properties: { 'gauge-color': 'primary' } })).toBe('var(--highlight_primary100)')
    expect(progressColor({ properties: { 'gauge-color': 'green' } })).toBe('var(--qualitative_lightGreen100)')
    expect(progressColor({ classes: ['extend-progress-bar'] }, 'primary')).toBe('var(--highlight_primary100)')
    expect(progressColor({ properties: { 'gauge-color': 'green', 'progressBar-color': '#C2E900FF' } })).toBe('#C2E900FF')
  })

  it('does not treat the placeholder Label as a native input', () => {
    expect(INPUT_BINDINGS.has('textInput_userText')).toBe(true)
    expect(INPUT_BINDINGS.has('textInput_placeholder')).toBe(false)
    expect(INPUT_BINDINGS.has('textInput_text')).toBe(false)
  })

  it('scopes ColorPickerField children to the host binding', () => {
    expect(childScope('ColorPickerField', 'colorPicker_skin')).toBe('colorPicker_skin')
    expect(childScope('VisualElement', 'colorPickerField_color', 'colorPicker_skin')).toBe('colorPicker_skin')
    expect(childScope('Instance', 'btn_guild')).toBe('btn_guild')
    expect(childScope('VisualElement', 'lbl_content', 'btn_guild')).toBe('btn_guild')
    expect(childScope('Tile', 'craftedItemTile')).toBe('craftedItemTile')
    expect(childScope('CharacterPresetManager', 'presetManager')).toBe('presetManager')
    expect(childScope('VisualElement', 'itemTile_container', 'tile3')).toBe('tile3')
    expect(childScope('CheckboxCustom', 'chbx_membersOffline')).toBe('chbx_membersOffline')
    expect(childScope('DofusLabel', 'checkboxLine_labelRight', 'chbx_membersOffline')).toBe('chbx_membersOffline')
  })

  it('promotes a caption-less CheckboxCustom to the official checkboxLine', () => {
    const kids = [{ binding: 'checkbox_background', type: 'VisualElement' }]
    expect(checkboxLineNeedsCaption(kids)).toBe(true)
    const lined = withCheckboxLineCaption(kids, 'Non obtenus', false)
    expect(lined.map((child) => child.binding)).toEqual([undefined, 'checkboxLine_labelRight'])
    expect(lined[0].classes).toEqual(['checkbox', 'activeFalse'])
    expect(lined[1].text).toBe('Non obtenus')
    expect(lined[1].type).toBe('DofusLabel')
    expect(checkboxLineNeedsCaption(lined)).toBe(false)
    expect(withCheckboxLineCaption(lined, 'ignored', true)).toBe(lined)
    expect(mergeExclusiveClasses(['checkbox', 'activeFalse'], 'checkboxLine')).toEqual([
      'activeFalse', 'checkboxLine',
    ])
  })
})

it('propagates checkbox state into an extracted checkboxLine without mutating its template', () => {
  const children = [{ type: 'VisualElement', classes: ['checkbox', 'activeFalse'] }]
  expect(withCheckboxState(children, true)[0].classes).toEqual(['checkbox', 'activeTrue'])
  expect(children[0].classes).toEqual(['checkbox', 'activeFalse'])
  expect(withCheckboxState(withCheckboxState(children, true), false)[0].classes).toEqual(['checkbox', 'activeFalse'])
})
