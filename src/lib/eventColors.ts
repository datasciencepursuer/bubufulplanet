export interface EventColor {
  id: string
  name: string
  color: string
  fontColor: string
}

export const EVENT_COLORS: EventColor[] = [
  {
    id: 'cream',
    name: 'Soft Cream',
    color: '#fbf2c4',
    fontColor: '#000000' // black
  },
  {
    id: 'sand',
    name: 'Desert Sand',
    color: '#e5c185',
    fontColor: '#000000' // black
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    color: '#c7522a',
    fontColor: '#000000' // black
  },
  {
    id: 'sage',
    name: 'Sage Green',
    color: '#74a892',
    fontColor: '#000000' // black
  },
  {
    id: 'teal',
    name: 'Deep Teal',
    color: '#008585',
    fontColor: '#000000' // black
  }
]

export const DEFAULT_EVENT_COLOR = '#fbf2c4'

export const getEventColor = (colorValue: string): EventColor => {
  return EVENT_COLORS.find(c => c.color === colorValue) || EVENT_COLORS[0]
}

export const getEventColorById = (colorId: string): EventColor => {
  return EVENT_COLORS.find(c => c.id === colorId) || EVENT_COLORS[0]
}