import type { Account, Character, SelectedServer } from '../../giny/types'

export const PREVIEW_ACCOUNT: Account = { id: 1, username: 'admin', nickname: 'Hugo', tag: 'Giny' }
export const PREVIEW_SERVER: SelectedServer = {
  id: 50, name: 'Giny', host: '127.0.0.1', ports: [5555], canCreateCharacter: true,
  status: 'Online', population: '2', selectable: true, monoAccount: false, type: 0,
  charactersCount: 1, characterSlots: 5,
}
export const PREVIEW_CHARACTER: Character = {
  id: 1, name: 'Hugo', level: 200,
  look: '{1|10,2012|1=#e59b68,2=#773f29,3=#d8742e,4=#496352,5=#512a15,6=#5b5243|53}',
  breedId: 1, breedName: 'Féca', sex: false, prestige: 0,
}
