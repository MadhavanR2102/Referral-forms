import translations from './locales/en-GB/translation.json' with { type: 'json' }
import { createField, createSection, type FieldItem, type FieldType, type FieldValidation, type SectionItem } from './formBuilderModel.ts'

export type FieldTemplateId = keyof typeof translations.templateContent.fields
export type SectionTemplateId = keyof typeof translations.templateContent.sections

interface FieldTemplate {
  id: FieldTemplateId
  name: string
  label: string
  fieldType: FieldType
  required: boolean
  placeholder?: string
  helperText?: string
  options?: readonly string[]
  maximumLength?: number
  validation?: readonly FieldValidation[]
  internal?: boolean
}

interface SectionTemplate {
  id: SectionTemplateId
  name: string
  fields: readonly FieldTemplateId[]
  visibility?: { target: FieldTemplateId; source: FieldTemplateId; value: string }
}

const defineField = (id: FieldTemplateId, fieldType: FieldType, required = false, maximumLength?: number): FieldTemplate => ({ id, ...translations.templateContent.fields[id], fieldType, required, maximumLength })
const phoneValidation: FieldValidation[] = [{ kind: 'phone', message: translations.builder.phoneError }]

export const FIELD_TEMPLATES: readonly FieldTemplate[] = [
  defineField('title', 'dropdown'),
  defineField('gender', 'dropdown'),
  defineField('patient-name', 'shortText', true, 200),
  { ...defineField('nhs-number', 'shortText'), validation: [{ kind: 'nhsNumber', message: translations.builder.nhsError }] },
  { ...defineField('date-of-birth', 'date', true), validation: [{ kind: 'notFuture', message: translations.builder.dobFutureError }] },
  defineField('address', 'longText', false, 500),
  { ...defineField('phone-number', 'shortText', false, 30), validation: phoneValidation },
  defineField('diagnosis', 'snomed'),
  defineField('patient-consent', 'yesNo', true),
  defineField('reason-for-referral', 'longText', true, 2000),
  defineField('lives-alone', 'yesNo'),
  defineField('current-patient-location', 'shortText', false, 200),
  defineField('relationship-to-patient', 'dropdown'),
  defineField('gp-practice', 'shortText', false, 200),
  defineField('existing-package-of-care', 'yesNo'),
  defineField('chc-funded', 'yesNo'),
  defineField('referrer-name', 'shortText', true, 200),
  defineField('referrer-designation', 'shortText', false, 200),
  { ...defineField('referral-date', 'date', true), validation: [{ kind: 'notFuture', message: translations.builder.referralFutureError }] },
  { ...defineField('care-provider', 'shortText', false, 200), internal: true },
  { ...defineField('next-of-kin-name', 'shortText', false, 200), internal: true },
  { ...defineField('next-of-kin-phone', 'shortText', false, 30), validation: phoneValidation, internal: true },
  { ...defineField('referrer-contact-number', 'shortText', true, 30), validation: phoneValidation, internal: true },
]

export const SECTION_TEMPLATES: readonly SectionTemplate[] = [
  { id: 'patient-details-section', name: translations.templateContent.sections['patient-details-section'], fields: ['title', 'patient-name', 'nhs-number', 'date-of-birth', 'gender', 'address', 'phone-number', 'lives-alone', 'current-patient-location'] },
  { id: 'next-of-kin-details-section', name: translations.templateContent.sections['next-of-kin-details-section'], fields: ['next-of-kin-name', 'relationship-to-patient', 'next-of-kin-phone'] },
  { id: 'gp-details-section', name: translations.templateContent.sections['gp-details-section'], fields: ['gp-practice'] },
  { id: 'clinical-information-section', name: translations.templateContent.sections['clinical-information-section'], fields: ['diagnosis'] },
  { id: 'referral-details-section', name: translations.templateContent.sections['referral-details-section'], fields: ['patient-consent', 'reason-for-referral', 'referral-date'] },
  { id: 'package-of-care-section', name: translations.templateContent.sections['package-of-care-section'], fields: ['existing-package-of-care', 'chc-funded', 'care-provider'], visibility: { target: 'care-provider', source: 'existing-package-of-care', value: 'yes' } },
  { id: 'referrer-details-section', name: translations.templateContent.sections['referrer-details-section'], fields: ['referrer-name', 'referrer-contact-number', 'referrer-designation', 'referral-date'] },
]

export function createFieldFromTemplate(templateId: FieldTemplateId, nextId: () => string): FieldItem | undefined {
  const definition = FIELD_TEMPLATES.find((template) => template.id === templateId)
  if (!definition) return undefined
  return createField(definition.fieldType, nextId(), {
    label: definition.label, required: definition.required, placeholder: definition.placeholder ?? '',
    options: definition.options?.join('\n') ?? '', hasHelperText: Boolean(definition.helperText), helperText: definition.helperText ?? '',
    hasCharacterLimit: definition.maximumLength !== undefined, characterLimit: definition.maximumLength === undefined ? '' : String(definition.maximumLength),
    validation: [...definition.validation ?? []],
  })
}

export function createSectionFromTemplate(templateId: SectionTemplateId, nextId: () => string): SectionItem | undefined {
  const definition = SECTION_TEMPLATES.find((template) => template.id === templateId)
  if (!definition) return undefined
  const id = nextId()
  const fields = definition.fields.map((fieldId) => {
    const field = createFieldFromTemplate(fieldId, nextId)
    if (!field) throw new Error('Unknown field template')
    return field
  })
  const visibility = definition.visibility
  if (visibility) {
    const target = fields[definition.fields.indexOf(visibility.target)]
    const source = fields[definition.fields.indexOf(visibility.source)]
    if (target && source) target.visibleWhen = { fieldId: source.id, value: visibility.value }
  }
  return createSection(id, { title: definition.name, description: '', items: fields })
}