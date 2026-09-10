export type Screen = 'login' | 'servers' | 'characters' | 'creation' | 'loading' | 'world'

export type CreationState = {
  classIndex: number
  gender: 'male' | 'female'
  headIndex: number
  name: string
  colors: string[]
}

export const INITIAL_CREATION: CreationState = {
  classIndex: 0,
  gender: 'male',
  headIndex: 0,
  name: '',
  colors: [],
}
