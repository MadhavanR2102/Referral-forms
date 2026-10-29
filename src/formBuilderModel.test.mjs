import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canUseVisibilitySource, createField, createItem, duplicateField, duplicateSection, findItem, getFieldValidationError, getSubmissionAnswers, insertItem, isFieldVisible, locateItem, moveItem, prepareForPublication, removeItem, updateItem, validateNhsNumber, validatePhoneNumber } from './formBuilderModel.ts'
import { createFieldFromTemplate, createSectionFromTemplate, FIELD_TEMPLATES, SECTION_TEMPLATES } from './formTemplates.ts'

const field = (id, label = id) => ({ ...createItem('shortText', id), label })
const section = (id, items = [], title = '') => ({ type: 'section', id, title, description: '', items })
const ids = (items) => items.map((item) => item.id)

test('standalone fields and information can precede an empty optional section', () => {
  let items = insertItem([], field('field-1'), { sectionId: null, index: 0 })
  items = insertItem(items, createItem('information', 'info-1'), { sectionId: null, index: 1 })
  items = insertItem(items, createItem('section', 'section-1'), { sectionId: null, index: 2 })
  assert.deepEqual(ids(items), ['field-1', 'info-1', 'section-1'])
  assert.deepEqual(items[2].items, [])
})

test('fields can move between root and sections without duplication or loss of settings', () => {
  const original = { ...field('field-1'), required: true, helperText: 'Keep this', hasHelperText: true }
  let items = [original, section('section-1'), section('section-2')]
  items = moveItem(items, 'field-1', { sectionId: 'section-1', index: 0 })
  assert.deepEqual(ids(items), ['section-1', 'section-2'])
  assert.deepEqual(items[0].items, [original])
  items = moveItem(items, 'field-1', { sectionId: 'section-2', index: 0 })
  assert.deepEqual(items[0].items, [])
  assert.deepEqual(items[1].items, [original])
  items = moveItem(items, 'field-1', { sectionId: null, index: 1 })
  assert.deepEqual(ids(items), ['section-1', 'field-1', 'section-2'])
  assert.deepEqual(items[1], original)
  assert.deepEqual(items[2].items, [])
})

test('root and child reordering preserve order and move sections with their children', () => {
  const items = [field('a'), section('s', [field('b'), field('c')]), field('d')]
  const reordered = moveItem(items, 's', { sectionId: null, index: 3 })
  assert.deepEqual(ids(reordered), ['a', 'd', 's'])
  assert.deepEqual(ids(reordered[2].items), ['b', 'c'])
  const childReordered = moveItem(reordered, 'b', { sectionId: 's', index: 2 })
  assert.deepEqual(ids(childReordered[2].items), ['c', 'b'])
  assert.deepEqual(ids(items), ['a', 's', 'd'])
})

test('nested sections, invalid targets, and duplicate IDs cannot mutate the model', () => {
  const items = [section('s1', [field('a')]), section('s2')]
  assert.equal(moveItem(items, 's1', { sectionId: 's2', index: 0 }), items)
  assert.equal(moveItem(items, 's1', { sectionId: 's1', index: 0 }), items)
  assert.equal(moveItem(items, 'a', { sectionId: 'missing', index: 0 }), items)
  assert.equal(insertItem(items, section('s3'), { sectionId: 's1', index: 0 }), items)
  assert.equal(insertItem(items, field('a'), { sectionId: null, index: 0 }), items)
  assert.equal(insertItem(items, section('s3', [field('a')]), { sectionId: null, index: 0 }), items)
})

test('keeping section children restores them at the section position in their original order', () => {
  const info = { type: 'information', id: 'info', text: 'Instructions' }
  const items = [field('before'), section('s', [field('one'), info, field('two')]), field('after')]
  const kept = removeItem(items, 's', true)
  assert.deepEqual(ids(kept), ['before', 'one', 'info', 'two', 'after'])
  assert.deepEqual(kept[2], info)
  assert.deepEqual(ids(removeItem(items, 's')), ['before', 'after'])
})

test('section duplication gives every item a new ID and creates an independent copy', () => {
  let counter = 0
  const source = section('s', [{ ...field('a'), required: true }, { type: 'information', id: 'i', text: 'Guidance' }], 'Patient details')
  const result = duplicateSection([source, field('after')], 's', () => `copy-${++counter}`, 'Copy')
  assert.equal(result.copyId, 'copy-1')
  assert.deepEqual(ids(result.items), ['s', 'copy-1', 'after'])
  assert.equal(result.items[1].title, 'Patient details Copy')
  assert.deepEqual(ids(result.items[1].items), ['copy-2', 'copy-3'])
  assert.equal(result.items[1].items[0].required, true)
  const changed = updateItem(result.items, 'copy-2', (item) => ({ ...item, label: 'Changed' }))
  assert.equal(findItem(changed, 'a').label, 'a')
  const unnamed = duplicateSection([section('unnamed')], 'unnamed', () => 'new', 'Copy')
  assert.equal(unnamed.items[1].title, '')
})

test('publication omits unused sections, flags empty named sections, and supports information-only content', () => {
  const items = [field('standalone'), section('unused'), section('named', [], 'Empty'), section('described'), section('info', [{ type: 'information', id: 'i', text: 'Guidance' }])]
  items[3].description = 'Description only'
  const result = prepareForPublication(items)
  assert.deepEqual(ids(result.items), ['standalone', 'named', 'described', 'info'])
  assert.deepEqual(result.emptySectionIds, ['named', 'described'])
  assert.equal(items.length, 5)
  assert.deepEqual(locateItem(items, 'i'), { sectionId: 'info', index: 0 })
})

test('editing nested fields does not convert them into a section or alter their siblings', () => {
  const items = [section('s', [field('a'), field('b')])]
  const updated = updateItem(items, 'a', (item) => ({ ...item, label: 'Patient name' }))
  assert.equal(findItem(updated, 'a').label, 'Patient name')
  assert.equal(findItem(updated, 'b').label, 'b')
  assert.equal(findItem(updateItem(items, 'a', () => section('a')), 'a').type, 'field')
})

test('the shared field factory deep-copies defaults and protects instance identity', () => {
  const defaults = { label: 'NHS number', validation: [{ kind: 'nhsNumber', message: 'Invalid NHS number' }], visibleWhen: { fieldId: 'source', value: 'yes' } }
  const first = createField('shortText', 'first', defaults)
  const second = createField('shortText', 'second', defaults)
  first.validation[0].message = 'Changed'
  first.visibleWhen.value = 'no'
  assert.equal(second.validation[0].message, 'Invalid NHS number')
  assert.equal(defaults.validation[0].message, 'Invalid NHS number')
  assert.equal(defaults.visibleWhen.value, 'yes')
})

test('NHS validation ignores spaces, requires exactly ten digits, and does not apply checksum validation', () => {
  assert.equal(validateNhsNumber('485 777 3456'), true)
  assert.equal(validateNhsNumber('0000000000'), true)
  for (const invalid of ['123456789', '12345678901', '485777345x']) assert.equal(validateNhsNumber(invalid), false)
})

test('phone validation accepts the supplied characters and rejects letters and other punctuation', () => {
  assert.equal(validatePhoneNumber('+44 (0)20-7123 4567'), true)
  for (const invalid of ['call me', '123/456', '()+ -']) assert.equal(validatePhoneNumber(invalid), false)
})

test('date validation rejects future and impossible dates without imposing an initial answer', () => {
  const date = createField('date', 'dob', { required: true, validation: [{ kind: 'notFuture', message: 'Date of birth cannot be in the future.' }] })
  const today = new Date(2026, 9, 29)
  assert.equal(getFieldValidationError(date, undefined, today), 'required')
  assert.equal(getFieldValidationError(date, '29/10/2026', today), undefined)
  assert.equal(getFieldValidationError(date, '28/10/2026', today), undefined)
  assert.equal(getFieldValidationError(date, '30/10/2026', today).message, 'Date of birth cannot be in the future.')
  assert.equal(getFieldValidationError(date, '31/02/2026', today), 'date')
  assert.equal(getFieldValidationError(date, '29/02/2024', today), undefined)
})

test('conditional fields retain hidden answers but submission excludes them until visible again', () => {
  const source = createField('yesNo', 'care')
  const dependent = createField('shortText', 'provider', { visibleWhen: { fieldId: 'care', value: 'yes' } })
  const items = [source, dependent]
  const answers = { care: 'yes', provider: 'Existing provider' }
  assert.equal(isFieldVisible(items, dependent, {}), false)
  assert.equal(isFieldVisible(items, dependent, answers), true)
  answers.care = 'no'
  assert.equal(isFieldVisible(items, dependent, answers), false)
  assert.deepEqual(getSubmissionAnswers(items, answers), { care: 'no' })
  assert.equal(answers.provider, 'Existing provider')
  answers.care = 'yes'
  assert.equal(getSubmissionAnswers(items, answers).provider, 'Existing provider')
  assert.equal(canUseVisibilitySource(items, 'care', 'provider'), false)
  assert.equal(canUseVisibilitySource(items, 'provider', 'care'), true)
})

test('duplicating a conditional section remaps its controller and copies nested validation', () => {
  let counter = 0
  const source = section('care-section', [createField('yesNo', 'care'), createField('shortText', 'provider', { visibleWhen: { fieldId: 'care', value: 'yes' }, validation: [{ kind: 'phone', message: 'Phone' }] })])
  const result = duplicateSection([source], source.id, () => `new-${++counter}`, 'Copy')
  const copied = result.items[1]
  assert.equal(copied.items[1].visibleWhen.fieldId, copied.items[0].id)
  assert.notEqual(copied.items[1].visibleWhen.fieldId, 'care')
  copied.items[1].validation[0].message = 'Changed'
  assert.equal(source.items[1].validation[0].message, 'Phone')
  const fieldCopy = duplicateField([source], 'provider', () => 'copy-provider')
  assert.deepEqual(ids(fieldCopy.items[0].items), ['care', 'provider', 'copy-provider'])
  assert.notEqual(fieldCopy.items[0].items[1].validation, fieldCopy.items[0].items[2].validation)
})

test('the template palette exposes the 19 field and seven section templates in the requested order', () => {
  assert.deepEqual(FIELD_TEMPLATES.filter((template) => !template.internal).map((template) => template.id), ['title', 'gender', 'patient-name', 'nhs-number', 'date-of-birth', 'address', 'phone-number', 'diagnosis', 'patient-consent', 'reason-for-referral', 'lives-alone', 'current-patient-location', 'relationship-to-patient', 'gp-practice', 'existing-package-of-care', 'chc-funded', 'referrer-name', 'referrer-designation', 'referral-date'])
  assert.deepEqual(SECTION_TEMPLATES.map((template) => template.id), ['patient-details-section', 'next-of-kin-details-section', 'gp-details-section', 'clinical-information-section', 'referral-details-section', 'package-of-care-section', 'referrer-details-section'])
})

test('every template creates an independent normal field with its configured defaults', () => {
  const before = JSON.stringify(FIELD_TEMPLATES)
  let counter = 0
  for (const template of FIELD_TEMPLATES) {
    const field = createFieldFromTemplate(template.id, () => `instance-${++counter}`)
    assert.equal(field.type, 'field')
    assert.equal(field.fieldType, template.fieldType)
    assert.equal(field.label, template.label)
    assert.equal(field.required, template.required)
    assert.equal(field.placeholder, template.placeholder ?? '')
    assert.equal(field.helperText, template.helperText ?? '')
    assert.equal(field.options, template.options?.join('\n') ?? '')
    assert.equal(field.characterLimit, template.maximumLength === undefined ? '' : String(template.maximumLength))
    assert.notEqual(field.id, template.id)
    assert.equal('templateId' in field, false)
    if (field.validation[0]) field.validation[0].message = 'Edited locally'
  }
  assert.equal(JSON.stringify(FIELD_TEMPLATES), before)
})

test('section factories preserve predefined field order, unique IDs and empty descriptions', () => {
  const expected = [
    ['Title', 'Patient name', 'NHS number', 'Date of birth', 'Gender', 'Home address', 'Phone number', 'Does the patient live alone?', 'Current patient location'],
    ['Next of kin name', 'Relationship to patient', 'Next of kin phone number'],
    ['GP practice'], ['Diagnosis'],
    ['Does the patient consent to this referral?', 'Reason for referral and current situation', 'Referral date'],
    ['Does the patient have an existing package of care?', "Is the patient's care CHC funded?", "Who provides the patient's care?"],
    ['Referrer name', 'Referrer contact number', 'Referrer designation', 'Referral date'],
  ]
  let counter = 0
  const allIds = []
  SECTION_TEMPLATES.forEach((template, index) => {
    const section = createSectionFromTemplate(template.id, () => `instance-${++counter}`)
    assert.equal(section.type, 'section')
    assert.equal(section.title, template.name)
    assert.equal(section.description, '')
    assert.deepEqual(section.items.map((field) => field.label), expected[index])
    allIds.push(section.id, ...ids(section.items))
  })
  assert.equal(allIds.length, new Set(allIds).size)
})

test('package of care binds visibility to its own newly generated controller in each independent instance', () => {
  let counter = 0
  const first = createSectionFromTemplate('package-of-care-section', () => `field-${++counter}`)
  const second = createSectionFromTemplate('package-of-care-section', () => `field-${++counter}`)
  assert.equal(first.items[2].visibleWhen.fieldId, first.items[0].id)
  assert.equal(second.items[2].visibleWhen.fieldId, second.items[0].id)
  assert.notEqual(first.items[2].visibleWhen.fieldId, second.items[2].visibleWhen.fieldId)
  assert.equal(isFieldVisible([first], first.items[2], {}), false)
  assert.equal(isFieldVisible([first], first.items[2], { [first.items[0].id]: 'yes' }), true)
})

test('required template defaults and dropdown options match the supplied specification', () => {
  assert.deepEqual(FIELD_TEMPLATES.filter((template) => template.required).map((template) => template.id).sort(), ['patient-name', 'date-of-birth', 'patient-consent', 'reason-for-referral', 'referrer-name', 'referral-date', 'referrer-contact-number'].sort())
  assert.equal(createFieldFromTemplate('title', () => 'title-instance').options, 'Mr\nMrs\nMiss\nMs\nMx\nDr\nOther\nPrefer not to say')
  assert.equal(createFieldFromTemplate('gender', () => 'gender-instance').options, 'Male\nFemale\nOther\nNot known\nPrefer not to say')
  assert.equal(createFieldFromTemplate('relationship-to-patient', () => 'relationship-instance').options, 'Partner or spouse\nParent\nChild\nSibling\nRelative\nFriend\nCarer\nOther')
  const diagnosis = createFieldFromTemplate('diagnosis', () => 'diagnosis-instance')
  assert.equal(diagnosis.fieldType, 'snomed')
  assert.equal(diagnosis.options, '')
  assert.equal(diagnosis.placeholder, 'Search SNOMED CT')
  assert.equal(createFieldFromTemplate('referral-date', () => 'referral-instance').validation[0].kind, 'notFuture')
})

test('template length limits validate boundaries and remain editable without truncating answers', () => {
  const limits = { 'patient-name': 200, address: 500, 'phone-number': 30, 'reason-for-referral': 2000, 'current-patient-location': 200, 'gp-practice': 200, 'care-provider': 200, 'referrer-name': 200, 'referrer-designation': 200, 'next-of-kin-name': 200, 'next-of-kin-phone': 30, 'referrer-contact-number': 30 }
  for (const [id, limit] of Object.entries(limits)) {
    const field = createFieldFromTemplate(id, () => `instance-${id}`)
    assert.equal(field.characterLimit, String(limit))
    assert.equal(field.hasCharacterLimit, true)
    assert.equal(getFieldValidationError(field, '1'.repeat(limit)), undefined)
    const answer = '1'.repeat(limit + 1)
    assert.equal(getFieldValidationError(field, answer), 'maximumLength')
    field.hasCharacterLimit = false
    assert.equal(getFieldValidationError(field, answer), undefined)
    assert.equal(answer.length, limit + 1)
  }
})