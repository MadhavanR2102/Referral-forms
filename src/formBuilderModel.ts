export type FieldType = 'shortText' | 'longText' | 'singleChoice' | 'multipleChoice' | 'dropdown' | 'yesNo' | 'snomed' | 'number' | 'date'
export type PaletteType = FieldType | 'section' | 'information'

export type ValidationKind = 'nhsNumber' | 'phone' | 'notFuture'
export interface FieldValidation {
  kind: ValidationKind
  message: string
}
export interface FieldVisibility {
  fieldId: string
  value: string
}
export type FieldAnswer = string | string[]
export type FormAnswers = Record<string, FieldAnswer>

export interface FieldItem {
  type: 'field'
  id: string
  fieldType: FieldType
  label: string
  options: string
  required: boolean
  hasCharacterLimit: boolean
  characterLimit: string
  hasHelperText: boolean
  helperText: string
  placeholder: string
  validation: FieldValidation[]
  visibleWhen?: FieldVisibility
}

export interface InformationItem {
  type: 'information'
  id: string
  text: string
}

export type SectionChild = FieldItem | InformationItem

export interface SectionItem {
  type: 'section'
  id: string
  title: string
  description: string
  items: SectionChild[]
}

export type FormItem = SectionChild | SectionItem

export interface ItemLocation {
  sectionId: string | null
  index: number
}

export function createField(fieldType: FieldType, id: string, defaults: Partial<Omit<FieldItem, 'type' | 'id' | 'fieldType'>> = {}): FieldItem {
  return {
    label: '', options: '', required: false, hasCharacterLimit: false, characterLimit: '',
    hasHelperText: false, helperText: '', placeholder: '', validation: [],
    ...structuredClone(defaults), type: 'field', id, fieldType,
  }
}

export function createSection(id: string, defaults: Partial<Omit<SectionItem, 'type' | 'id'>> = {}): SectionItem {
  return { title: '', description: '', items: [], ...structuredClone(defaults), type: 'section', id }
}

export function createItem(paletteType: PaletteType, id: string): FormItem {
  if (paletteType === 'section') return createSection(id)
  if (paletteType === 'information') return { type: 'information', id, text: '' }
  return createField(paletteType, id)
}

export function getFields(items: FormItem[]): FieldItem[] {
  return items.flatMap((item) => item.type === 'section' ? item.items : [item]).filter((item): item is FieldItem => item.type === 'field')
}

export function isFieldVisible(items: FormItem[], field: FieldItem, answers: FormAnswers, visited = new Set<string>()): boolean {
  if (!field.visibleWhen) return true
  if (visited.has(field.id)) return false
  visited.add(field.id)
  const controller = getFields(items).find((candidate) => candidate.id === field.visibleWhen?.fieldId)
  return Boolean(controller && isFieldVisible(items, controller, answers, visited) && answers[controller.id] === field.visibleWhen.value)
}

export function canUseVisibilitySource(items: FormItem[], fieldId: string, sourceId: string): boolean {
  const visited = new Set([fieldId])
  let source = getFields(items).find((field) => field.id === sourceId)
  while (source) {
    if (visited.has(source.id)) return false
    visited.add(source.id)
    if (!source.visibleWhen) return true
    source = getFields(items).find((field) => field.id === source?.visibleWhen?.fieldId)
  }
  return false
}

export function getSubmissionAnswers(items: FormItem[], answers: FormAnswers): FormAnswers {
  return Object.fromEntries(getFields(items).filter((field) => isFieldVisible(items, field, answers) && answers[field.id] !== undefined).map((field) => [field.id, structuredClone(answers[field.id])]))
}

export function validateNhsNumber(value: string): boolean {
  return /^\d{10}$/.test(value.replace(/ /g, ''))
}

export function validatePhoneNumber(value: string): boolean {
  return /\d/.test(value) && /^[\d +()-]+$/.test(value)
}

export function parseDateValue(value: string): number | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return undefined
  const [, dayText, monthText, yearText] = match
  const day = Number(dayText), month = Number(monthText), year = Number(yearText)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return year > 0 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() : undefined
}

export function getFieldValidationError(field: FieldItem, answer: FieldAnswer | undefined, now = new Date()): 'required' | 'maximumLength' | 'date' | FieldValidation | undefined {
  if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) return field.required ? 'required' : undefined
  if (Array.isArray(answer)) return undefined
  if (!answer.trim()) return field.required ? 'required' : undefined
  if (field.hasCharacterLimit && Number(field.characterLimit) > 0 && answer.length > Number(field.characterLimit)) return 'maximumLength'
  const parsedDate = field.fieldType === 'date' ? parseDateValue(answer) : undefined
  if (field.fieldType === 'date' && parsedDate === undefined) return 'date'
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return field.validation.find((rule) => rule.kind === 'nhsNumber' ? !validateNhsNumber(answer) : rule.kind === 'phone' ? !validatePhoneNumber(answer) : parsedDate !== undefined && parsedDate > today)
}

export function locateItem(items: FormItem[], id: string): ItemLocation | undefined {
  for (const [index, item] of items.entries()) {
    if (item.id === id) return { sectionId: null, index }
    if (item.type === 'section') {
      const childIndex = item.items.findIndex((child) => child.id === id)
      if (childIndex !== -1) return { sectionId: item.id, index: childIndex }
    }
  }
  return undefined
}

export function findItem(items: FormItem[], id: string | null): FormItem | undefined {
  if (id === null) return undefined
  return items.flatMap((item): FormItem[] => item.type === 'section' ? [item, ...item.items] : [item]).find((item) => item.id === id)
}

export function updateItem(items: FormItem[], id: string, update: (item: FormItem) => FormItem): FormItem[] {
  return items.map((item) => {
    if (item.id === id) {
      const updated = update(item)
      return updated.id === id && updated.type === item.type ? updated : item
    }
    if (item.type !== 'section') return item
    return { ...item, items: item.items.map((child) => {
      if (child.id !== id) return child
      const updated = update(child)
      return updated.id === id && updated.type === child.type ? updated : child
    }) }
  })
}

export function insertItem(items: FormItem[], item: FormItem, target: ItemLocation): FormItem[] {
  const incomingIds = item.type === 'section' ? [item.id, ...item.items.map((child) => child.id)] : [item.id]
  if (new Set(incomingIds).size !== incomingIds.length || incomingIds.some((id) => locateItem(items, id))) return items
  if (target.sectionId === null) {
    const result = [...items]
    result.splice(Math.max(0, Math.min(target.index, result.length)), 0, item)
    return result
  }
  if (item.type === 'section') return items
  return items.map((section) => {
    if (section.id !== target.sectionId || section.type !== 'section') return section
    const children = [...section.items]
    children.splice(Math.max(0, Math.min(target.index, children.length)), 0, item)
    return { ...section, items: children }
  })
}

export function removeItem(items: FormItem[], id: string, keepChildren = false): FormItem[] {
  return items.flatMap((item): FormItem[] => {
    if (item.id === id) return item.type === 'section' && keepChildren ? item.items : []
    return item.type === 'section' ? [{ ...item, items: item.items.filter((child) => child.id !== id) }] : [item]
  })
}

export function moveItem(items: FormItem[], id: string, target: ItemLocation): FormItem[] {
  const item = findItem(items, id)
  const source = locateItem(items, id)
  if (!item || !source || (item.type === 'section' && target.sectionId !== null)) return items
  if (target.sectionId !== null && findItem(items, target.sectionId)?.type !== 'section') return items
  const index = source.sectionId === target.sectionId && source.index < target.index ? target.index - 1 : target.index
  return insertItem(removeItem(items, id), item, { ...target, index })
}

export function duplicateSection(items: FormItem[], id: string, nextId: () => string, copySuffix: string): { items: FormItem[]; copyId: string | null } {
  const section = findItem(items, id)
  if (section?.type !== 'section') return { items, copyId: null }
  const copyId = nextId()
  const childIds = new Map(section.items.map((item) => [item.id, nextId()]))
  const copy: SectionItem = {
    ...structuredClone(section),
    id: copyId,
    title: section.title.trim() ? `${section.title} ${copySuffix}` : '',
    items: section.items.map((item) => {
      const child = { ...structuredClone(item), id: childIds.get(item.id) ?? nextId() }
      if (child.type === 'field' && child.visibleWhen) child.visibleWhen.fieldId = childIds.get(child.visibleWhen.fieldId) ?? child.visibleWhen.fieldId
      return child
    }),
  }
  const updated = insertItem(items, copy, { sectionId: null, index: items.findIndex((item) => item.id === id) + 1 })
  return { items: updated, copyId: updated === items ? null : copy.id }
}

export function duplicateField(items: FormItem[], id: string, nextId: () => string): { items: FormItem[]; copyId: string | null } {
  const field = findItem(items, id)
  const location = locateItem(items, id)
  if (field?.type !== 'field' || !location) return { items, copyId: null }
  const copy = { ...structuredClone(field), id: nextId() }
  const updated = insertItem(items, copy, { ...location, index: location.index + 1 })
  return { items: updated, copyId: updated === items ? null : copy.id }
}

export function prepareForPublication(items: FormItem[]): { items: FormItem[]; emptySectionIds: string[] } {
  const emptySectionIds: string[] = []
  const prepared = items.flatMap((item): FormItem[] => {
    if (item.type !== 'section') return [item]
    const children = item.items.filter((child) => child.type === 'field' || child.text.trim())
    if (children.length === 0) {
      if (!item.title.trim() && !item.description.trim()) return []
      emptySectionIds.push(item.id)
    }
    return [{ ...item, items: children }]
  })
  return { items: prepared, emptySectionIds }
}