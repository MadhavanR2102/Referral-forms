import { Fragment, useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { Button } from '@emisgroup/ui-button'
import { Checkbox } from '@emisgroup/ui-checkbox'
import { DetailPanel } from '@emisgroup/ui-detail-panel'
import { Dialog } from '@emisgroup/ui-dialog'
import { Dropdown } from '@emisgroup/ui-dropdown'
import { Input, Textarea } from '@emisgroup/ui-input'
import { Tabs } from '@emisgroup/ui-tabs'
import FormBuilderField from './FormBuilderField'
import { createItem, duplicateField, duplicateSection, findItem, getFields, getFieldValidationError, getSubmissionAnswers, insertItem, isFieldVisible, locateItem, moveItem, prepareForPublication, removeItem, updateItem, type FieldAnswer, type FieldItem, type FieldType, type FormAnswers, type FormItem, type ItemLocation, type PaletteType, type SectionChild, type SectionItem } from './formBuilderModel'
import { createFieldFromTemplate, createSectionFromTemplate, FIELD_TEMPLATES, SECTION_TEMPLATES, type FieldTemplateId, type SectionTemplateId } from './formTemplates'
import translations from './locales/en-GB/translation.json'
import '@emisgroup/ui-dialog/styles.css'
import '@emisgroup/ui-dropdown/styles.css'
import './FormBuilder.css'

interface FormBuilderProps {
  onBack: () => void
}

type BuilderTextKey = keyof typeof translations.builder
type TemplatePayload = { kind: 'fieldTemplate'; templateId: FieldTemplateId } | { kind: 'sectionTemplate'; templateId: SectionTemplateId }
type DragPayload = { kind: 'new'; paletteType: PaletteType } | { kind: 'existing'; id: string } | TemplatePayload

interface DropSlotProps {
  target: ItemLocation
  active: boolean
  enabled: boolean
  empty: boolean
  onLeave: () => void
  onOver: (event: DragEvent<HTMLDivElement>, target: ItemLocation) => void
  onDrop: (event: DragEvent<HTMLDivElement>, target: ItemLocation) => void
}

const translate = (key: BuilderTextKey) => translations.builder[key]
const FIELD_GROUPS: { name: BuilderTextKey; fields: PaletteType[] }[] = [
  { name: 'text', fields: ['shortText', 'longText'] },
  { name: 'choice', fields: ['singleChoice', 'multipleChoice', 'dropdown', 'yesNo'] },
  { name: 'clinical', fields: ['snomed'] },
  { name: 'other', fields: ['number', 'date'] },
  { name: 'structure', fields: ['section', 'information'] },
]
const FIELD_TYPES = FIELD_GROUPS.flatMap((group) => group.fields).filter((type): type is FieldType => type !== 'section' && type !== 'information')
const ITEM_DRAG_TYPE = 'application/x-referral-form-item'
const ROOT_LOCATION = '__root__'
const nextId = () => crypto.randomUUID()

function DropSlot({ target, active, enabled, empty, onLeave, onOver, onDrop }: DropSlotProps) {
  return (
    <div
      className={`builder-drop-slot${active ? ' is-active' : ''}${enabled ? ' is-enabled' : ''}${empty ? ' is-empty-section' : ''}`}
      data-drop-parent={target.sectionId ?? ROOT_LOCATION}
      data-drop-index={target.index}
      onDragOver={(event) => onOver(event, target)}
      onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) onLeave() }}
      onDrop={(event) => onDrop(event, target)}
    >
      {empty && !active ? translate('emptySection') : null}
    </div>
  )
}
DropSlot.displayName = 'DropSlot'

function FormBuilder({ onBack }: FormBuilderProps) {
  const [name, setName] = useState(translate('untitled'))
  const [description, setDescription] = useState('')
  const [formItems, setFormItems] = useState<FormItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  const [dropTarget, setDropTarget] = useState<ItemLocation | null>(null)
  const [preview, setPreview] = useState(false)
  const [answers, setAnswers] = useState<FormAnswers>({})
  const [touchedAnswers, setTouchedAnswers] = useState<Record<string, boolean>>({})
  const [answersValidated, setAnswersValidated] = useState(false)
  const [validated, setValidated] = useState(false)
  const [headerFeedback, setHeaderFeedback] = useState<'draftUnavailable' | 'publishUnavailable' | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null)
  const editorRefs = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>())
  const pendingFocusId = useRef<string | null>(null)
  const focusAfterDialog = useRef<string | null | undefined>(undefined)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const paletteRef = useRef<HTMLElement>(null)
  const selectedItem = findItem(formItems, selectedId)
  const sections = formItems.filter((item): item is SectionItem => item.type === 'section')
  const publication = prepareForPublication(formItems)
  const getAnswerError = (field: FieldItem) => {
    const error = getFieldValidationError(field, answers[field.id])
    if (error === 'required') return translate('requiredAnswer')
    if (error === 'date') return translate('invalidDate')
    if (error === 'maximumLength') return translate('maximumLengthError').replace('{{count}}', field.characterLimit)
    return error?.message
  }
  const visibleAnswerErrors = getFields(formItems).filter((field) => isFieldVisible(formItems, field, answers)).map(getAnswerError).filter(Boolean)

  useLayoutEffect(() => {
    if (pendingFocusId.current === null) return
    const editor = editorRefs.current.get(pendingFocusId.current)
    editor?.focus()
    editor?.setSelectionRange(editor.value.length, editor.value.length)
    pendingFocusId.current = null
  }, [formItems, selectedId, preview, focusRequest])

  const registerEditor = (id: string, element: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (element) editorRefs.current.set(id, element)
    else editorRefs.current.delete(id)
  }
  const handleUpdate = (id: string, update: (item: FormItem) => FormItem) => {
    setFormItems((items) => updateItem(items, id, update))
  }
  const handleFieldUpdate = (id: string, changes: Partial<FieldItem>) => {
    handleUpdate(id, (item) => item.type === 'field' ? { ...item, ...changes } : item)
  }
  const handleSectionUpdate = (id: string, changes: Partial<Pick<SectionItem, 'title' | 'description'>>) => {
    handleUpdate(id, (item) => item.type === 'section' ? { ...item, ...changes } : item)
  }
  const handleInsert = (item: FormItem, target: ItemLocation) => {
    setFormItems((items) => insertItem(items, item, target))
    setSelectedId(item.id)
    pendingFocusId.current = item.id
  }
  const handleAdd = (type: PaletteType) => {
    const item = createItem(type, nextId())
    const target = type !== 'section' && selectedItem?.type === 'section'
      ? { sectionId: selectedItem.id, index: selectedItem.items.length }
      : { sectionId: null, index: formItems.length }
    handleInsert(item, target)
  }
  const handleTemplate = (payload: TemplatePayload, target?: ItemLocation) => {
    const item = payload.kind === 'fieldTemplate' ? createFieldFromTemplate(payload.templateId, nextId) : createSectionFromTemplate(payload.templateId, nextId)
    if (!item) return
    const insertion = target ?? (item.type !== 'section' && selectedItem?.type === 'section' ? { sectionId: selectedItem.id, index: selectedItem.items.length } : { sectionId: null, index: formItems.length })
    if (item.type !== 'section' || insertion.sectionId === null) handleInsert(item, insertion)
  }
  const handleRemove = (id: string, keepChildren = false) => {
    const location = locateItem(formItems, id)
    const remaining = removeItem(formItems, id, keepChildren)
    const parent = location?.sectionId ? findItem(remaining, location.sectionId) : undefined
    const siblings = parent?.type === 'section' ? parent.items : remaining
    const nextSelectedId = siblings[location?.index ?? 0]?.id ?? siblings[(location?.index ?? 0) - 1]?.id ?? location?.sectionId ?? null
    setFormItems(remaining)
    const remainingIds = new Set(getFields(remaining).map((field) => field.id))
    setAnswers((current) => Object.fromEntries(Object.entries(current).filter(([fieldId]) => remainingIds.has(fieldId))))
    setTouchedAnswers((current) => Object.fromEntries(Object.entries(current).filter(([fieldId]) => remainingIds.has(fieldId))))
    setSelectedId(nextSelectedId)
    if (deleteSectionId !== null) {
      focusAfterDialog.current = nextSelectedId
      setDeleteSectionId(null)
    } else if (nextSelectedId) pendingFocusId.current = nextSelectedId
    else requestAnimationFrame(() => paletteRef.current?.querySelector<HTMLButtonElement>('button[draggable]')?.focus())
  }
  const handleDuplicate = (id: string) => {
    const result = findItem(formItems, id)?.type === 'field' ? duplicateField(formItems, id, nextId) : duplicateSection(formItems, id, nextId, translate('copy'))
    setFormItems(result.items)
    setSelectedId(result.copyId)
    pendingFocusId.current = result.copyId
  }
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, payload: DragPayload) => {
    event.stopPropagation()
    event.dataTransfer.setData(ITEM_DRAG_TYPE, JSON.stringify(payload))
    event.dataTransfer.effectAllowed = payload.kind === 'existing' ? 'move' : 'copy'
    setDragPayload(payload)
  }
  const handleDragEnd = () => { setDragPayload(null); setDropTarget(null) }
  const canDrop = (target: ItemLocation) => {
    if (!dragPayload || preview) return false
    const isSection = dragPayload.kind === 'sectionTemplate' || (dragPayload.kind === 'new' ? dragPayload.paletteType === 'section' : dragPayload.kind === 'existing' && findItem(formItems, dragPayload.id)?.type === 'section')
    return target.sectionId === null || !isSection
  }
  const handleDragOver = (event: DragEvent<HTMLDivElement>, target: ItemLocation) => {
    event.stopPropagation()
    if (!canDrop(target) || !event.dataTransfer.types.includes(ITEM_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = dragPayload?.kind === 'existing' ? 'move' : 'copy'
    setDropTarget(target)
  }
  const handleDrop = (event: DragEvent<HTMLDivElement>, target: ItemLocation) => {
    event.stopPropagation()
    event.preventDefault()
    if (canDrop(target) && dragPayload && event.dataTransfer.types.includes(ITEM_DRAG_TYPE)) {
      if (dragPayload.kind === 'existing') {
        setFormItems((items) => moveItem(items, dragPayload.id, target))
        setSelectedId(dragPayload.id)
      } else if (dragPayload.kind === 'new') handleInsert(createItem(dragPayload.paletteType, nextId()), target)
      else handleTemplate(dragPayload, target)
    }
    handleDragEnd()
  }
  const renderMoveHandle = (item: FormItem) => (
    <Button type="button" variant="mono" borderless className="builder-drag-handle" draggable aria-label={translate('moveItem')} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight" title={translate('moveItem')} onKeyDown={(event) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      const location = locateItem(formItems, item.id)
      if (!location) return
      let target: ItemLocation
      if (event.key === 'ArrowLeft') {
        if (item.type === 'section' || location.sectionId === null) return
        target = { sectionId: null, index: formItems.findIndex((rootItem) => rootItem.id === location.sectionId) + 1 }
      } else if (event.key === 'ArrowRight') {
        if (item.type === 'section' || sections.length === 0) return
        const currentSectionIndex = sections.findIndex((section) => section.id === location.sectionId)
        const section = location.sectionId === null
          ? sections.find((sectionItem) => formItems.findIndex((rootItem) => rootItem.id === sectionItem.id) > location.index) ?? sections[0]
          : sections[(currentSectionIndex + 1) % sections.length]
        if (!section || section.id === location.sectionId) return
        target = { sectionId: section.id, index: section.items.length }
      } else {
        target = { sectionId: location.sectionId, index: location.index + (event.key === 'ArrowUp' ? -1 : 2) }
      }
      setSelectedId(item.id)
      setFormItems((items) => moveItem(items, item.id, target))
    }} onDragStart={(event) => handleDragStart(event, { kind: 'existing', id: item.id })} onDragEnd={handleDragEnd}>
      <iconify-icon icon="ic:outline-drag-indicator" width="20" aria-hidden="true"></iconify-icon>
    </Button>
  )
  const renderDropSlot = (target: ItemLocation, empty = false) => (
    <DropSlot target={target} empty={empty} enabled={canDrop(target)} active={canDrop(target) && dropTarget?.sectionId === target.sectionId && dropTarget.index === target.index} onLeave={() => setDropTarget(null)} onOver={handleDragOver} onDrop={handleDrop} />
  )
  const renderField = (item: SectionChild, sectionId: string | null) => {
    if (preview && item.type === 'field' && !isFieldVisible(formItems, item, answers)) return null
    return <FormBuilderField item={item} editing={!preview} selected={selectedId === item.id} parentSectionId={sectionId} moveHandle={renderMoveHandle(item)} onSelect={() => setSelectedId(item.id)} onChange={(updated) => handleUpdate(item.id, () => updated)} registerEditor={(element) => registerEditor(item.id, element)} registerHelperEditor={(element) => registerEditor(`helper-${item.id}`, element)} answer={answers[item.id]} onAnswerChange={(answer: FieldAnswer) => setAnswers((current) => ({ ...current, [item.id]: answer }))} onAnswerBlur={() => setTouchedAnswers((current) => ({ ...current, [item.id]: true }))} error={preview && item.type === 'field' && (answersValidated || touchedAnswers[item.id]) ? getAnswerError(item) : undefined} />
  }
  const renderSection = (section: SectionItem, index: number) => {
    const sectionLabel = section.title.trim() || `${translate('section')} ${index + 1}`
    const hasError = validated && publication.emptySectionIds.includes(section.id)
    return (
      <section
        className={`builder-section${!preview && selectedId === section.id ? ' is-selected' : ''}${hasError ? ' has-error' : ''}`}
        data-item-id={section.id} data-kind="section" role="group"
        aria-label={!preview || !section.title.trim() ? sectionLabel : undefined}
        aria-labelledby={preview && section.title.trim() ? `section-title-${section.id}` : undefined}
        aria-describedby={hasError ? `section-error-${section.id}` : undefined}
        onFocus={() => { if (!preview) setSelectedId(section.id) }}
        onPointerDown={() => { if (!preview) setSelectedId(section.id) }}
      >
        {!preview ? (
          <>
            <div className="builder-section-title-row">
              <Input ref={(element) => registerEditor(section.id, element)} className="builder-section-name" aria-label={translate('sectionName')} placeholder={translate('addSectionName')} value={section.title} onChange={(event) => handleSectionUpdate(section.id, { title: event.target.value })} />
              {renderMoveHandle(section)}
            </div>
            <Textarea className="builder-section-description" aria-label={translate('sectionDescription')} placeholder={translate('addSectionDescription')} value={section.description} rows={1} onChange={(event) => handleSectionUpdate(section.id, { description: event.target.value })} />
          </>
        ) : (
          <>
            {section.title.trim() ? <h2 id={`section-title-${section.id}`}>{section.title}</h2> : null}
            {section.description.trim() ? <p className="builder-section-description-text">{section.description}</p> : null}
          </>
        )}
        {renderItems(section.items, section.id)}
        {hasError ? <p className="builder-section-error" id={`section-error-${section.id}`} role="alert">{translate('emptySectionValidation')}</p> : null}
      </section>
    )
  }
  const renderItems = (items: FormItem[], sectionId: string | null) => (
    <div className={`builder-items${preview ? ' is-preview' : ''}`} data-items-parent={sectionId ?? ROOT_LOCATION}>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {!preview ? renderDropSlot({ sectionId, index }) : null}
          {item.type === 'section' ? renderSection(item, index) : renderField(item, sectionId)}
        </Fragment>
      ))}
      {!preview ? renderDropSlot({ sectionId, index: items.length }, sectionId !== null && items.length === 0) : null}
    </div>
  )

  return (
    <Dialog open={deleteSectionId !== null} onOpenChange={(open) => { if (!open) setDeleteSectionId(null) }}>
      <section className="form-builder" aria-label={name.trim() || translate('untitled')}>
        <header className="builder-header">
          <div className="builder-header-title">
            <Button type="button" variant="mono" borderless className="builder-back-button" aria-label={translate('back')} title={translate('back')} onClick={onBack}><iconify-icon icon="ic:outline-arrow-back" width="24" title="" aria-hidden="true"></iconify-icon></Button>
            <h1>{name.trim() || translate('untitled')}</h1>
          </div>
          <Button type="button" className="builder-preview-button" onClick={() => { setPreview(!preview); setHeaderFeedback(null); handleDragEnd() }}>
            <iconify-icon icon={preview ? 'ic:outline-edit' : 'ic:outline-play-arrow'} width="24" title="" aria-hidden="true"></iconify-icon>
            {translate(preview ? 'editForm' : 'preview')}
          </Button>
          <Button.Group className="builder-header-actions">
            <Button type="button" onClick={() => setHeaderFeedback('draftUnavailable')}>{translate('saveAsDraft')}</Button>
            <Button type="button" variant="filled" onClick={() => {
              setValidated(true)
              const invalidSectionId = publication.emptySectionIds[0]
              if (invalidSectionId) {
                setHeaderFeedback(null)
                setPreview(false)
                setSelectedId(invalidSectionId)
                pendingFocusId.current = invalidSectionId
                setFocusRequest((request) => request + 1)
              } else setHeaderFeedback('publishUnavailable')
            }}>{translate('publish')}</Button>
          </Button.Group>
        </header>
        {preview ? <div className="builder-preview-tools">
            <Button type="button" variant="mono" size="small" onClick={() => {
              setAnswersValidated(true)
              const submissionValues = getSubmissionAnswers(formItems, answers)
              const invalidField = getFields(formItems).find((field) => isFieldVisible(formItems, field, answers) && getFieldValidationError(field, submissionValues[field.id]))
              if (invalidField) requestAnimationFrame(() => document.getElementById(`answer-${invalidField.id}`)?.focus())
            }}>{translate('validateAnswers')}</Button>
        </div> : null}
        {headerFeedback ? <p className="builder-validation-status" role="status">{translate(headerFeedback)}</p> : null}
        {validated && publication.emptySectionIds.length > 0 ? <p className="builder-validation-status" role="alert">{translate('publishErrors')}</p> : null}
        {preview && answersValidated ? <p className="builder-validation-status" role={visibleAnswerErrors.length ? 'alert' : 'status'}>{translate(visibleAnswerErrors.length ? 'answersInvalid' : 'answersValid')}</p> : null}
        <div className={`builder-workspace${selectedItem && !preview ? ' has-selection' : ''}`}>
          <aside className="builder-palette" ref={paletteRef}>
            <Tabs defaultValue="fields" className="builder-palette-tabs">
              <Tabs.TabList aria-label={translate('fields')}><Tabs.Tab value="fields">{translate('fields')}</Tabs.Tab><Tabs.Tab value="templates">{translate('templates')}</Tabs.Tab></Tabs.TabList>
              <Tabs.TabContent value="fields" className="builder-field-groups">
                {FIELD_GROUPS.map((group) => <section key={group.name} className="builder-field-group" aria-labelledby={`builder-group-${group.name}`}>
                  <h2 id={`builder-group-${group.name}`}>{translate(group.name)}</h2>
                  {group.fields.map((type) => <Button key={type} type="button" variant="mono" disabled={preview} draggable={!preview} onDragStart={(event) => handleDragStart(event, { kind: 'new', paletteType: type })} onDragEnd={handleDragEnd} onClick={() => handleAdd(type)}>{translate(type)}</Button>)}
                </section>)}
              </Tabs.TabContent>
              <Tabs.TabContent value="templates" className="builder-template-content">
                <section className="builder-field-group" aria-labelledby="builder-section-templates"><h2 id="builder-section-templates">{translate('sectionTemplates')}</h2>
                  {SECTION_TEMPLATES.map((template) => <Button key={template.id} type="button" variant="mono" disabled={preview} draggable={!preview} data-template-id={template.id} onDragStart={(event) => handleDragStart(event, { kind: 'sectionTemplate', templateId: template.id })} onDragEnd={handleDragEnd} onClick={() => handleTemplate({ kind: 'sectionTemplate', templateId: template.id })}>{template.name}</Button>)}
                </section>
                <section className="builder-field-group" aria-labelledby="builder-field-templates"><h2 id="builder-field-templates">{translate('fieldTemplates')}</h2>
                  {FIELD_TEMPLATES.filter((template) => !template.internal).map((template) => <Button key={template.id} type="button" variant="mono" disabled={preview} draggable={!preview} data-template-id={template.id} onDragStart={(event) => handleDragStart(event, { kind: 'fieldTemplate', templateId: template.id })} onDragEnd={handleDragEnd} onClick={() => handleTemplate({ kind: 'fieldTemplate', templateId: template.id })}>{template.name}</Button>)}
                </section>
              </Tabs.TabContent>
            </Tabs>
          </aside>
          <div className="builder-stage">
            <div className="builder-document">
              <header className="builder-document-header">
                {preview ? <><h2>{name}</h2>{description.trim() ? <p>{description}</p> : null}</> : <>
                  <Input className="builder-name" aria-label={translate('name')} value={name} onChange={(event) => setName(event.target.value)} onBlur={() => { if (!name.trim()) setName(translate('untitled')) }} />
                  <Textarea className="builder-description" aria-label={translate('description')} placeholder={translate('descriptionPlaceholder')} rows={1} value={description} onChange={(event) => setDescription(event.target.value)} />
                </>}
              </header>
              <section className={`builder-canvas${formItems.length === 0 && !preview ? ' is-empty' : ''}${dragPayload ? ' is-dragging' : ''}`} aria-label={translate('fields')} onPointerDown={(event) => {
                if (!preview && event.target instanceof Element && !event.target.closest('[data-item-id]')) setSelectedId(null)
              }}>
                {formItems.length === 0 && !preview ? <div className="builder-empty-state"><span className="builder-empty-icon"><iconify-icon icon="ic:outline-table-rows" width="56" aria-hidden="true"></iconify-icon></span><h2>{translate('start')}</h2><p>{translate('emptyHint')}</p></div> : null}
                {renderItems(preview ? publication.items : formItems, null)}
              </section>
            </div>
          </div>
          {selectedItem && !preview ? (
            <div className="builder-properties-slot">
              <DetailPanel className="builder-properties" role="region" aria-labelledby="builder-settings-heading">
                <DetailPanel.Header className="builder-properties-header"><h2 id="builder-settings-heading">{translate(selectedItem.type === 'section' ? 'sectionSettings' : selectedItem.type === 'information' ? 'informationSettings' : 'fieldSettings')}</h2></DetailPanel.Header>
                <DetailPanel.Content className="builder-properties-content">
                  {selectedItem.type === 'section' ? <>
                    <Button type="button" variant="mono" onClick={() => handleDuplicate(selectedItem.id)}>{translate('duplicateSection')}</Button>
                    <Dialog.Trigger asChild><Button type="button" variant="mono" onClick={(event) => { if (selectedItem.items.length === 0) { event.preventDefault(); handleRemove(selectedItem.id) } else setDeleteSectionId(selectedItem.id) }}>{translate('deleteSection')}</Button></Dialog.Trigger>
                  </> : selectedItem.type === 'information' ? <Textarea aria-label={translate('information')} value={selectedItem.text} onChange={(event) => handleUpdate(selectedItem.id, (item) => item.type === 'information' ? { ...item, text: event.target.value } : item)} /> : <>
                    <div className="builder-property"><span id="builder-field-type-label">{translate('fieldType')}</span><Dropdown value={selectedItem.fieldType} onValueChange={(value) => { const fieldType = FIELD_TYPES.find((type) => type === value); if (fieldType) handleFieldUpdate(selectedItem.id, { fieldType, validation: selectedItem.validation.filter((rule) => rule.kind === 'notFuture' ? fieldType === 'date' : fieldType === 'shortText') }) }}><Dropdown.Trigger aria-labelledby="builder-field-type-label" /><Dropdown.Content>{FIELD_TYPES.map((type) => <Dropdown.Item key={type} value={type}>{translate(type)}</Dropdown.Item>)}</Dropdown.Content></Dropdown></div>
                    <Checkbox checked={selectedItem.required} onChange={(required) => handleFieldUpdate(selectedItem.id, { required })}>{translate('markRequired')}</Checkbox>
                    {['shortText', 'longText'].includes(selectedItem.fieldType) ? <div className="builder-property"><Checkbox checked={selectedItem.hasCharacterLimit} onChange={(hasCharacterLimit) => handleFieldUpdate(selectedItem.id, { hasCharacterLimit })}>{translate('characterLimit')}</Checkbox>{selectedItem.hasCharacterLimit ? <Input type="number" min={1} step={1} aria-label={translate('maximumCharacters')} value={selectedItem.characterLimit} onChange={(event) => handleFieldUpdate(selectedItem.id, { characterLimit: event.target.value })} /> : null}</div> : null}
                    <Checkbox checked={selectedItem.hasHelperText} onChange={(hasHelperText) => {
                      if (hasHelperText) pendingFocusId.current = `helper-${selectedItem.id}`
                      handleFieldUpdate(selectedItem.id, { hasHelperText })
                    }}>{translate('helperText')}</Checkbox>
                    {selectedItem.fieldType === 'dropdown' ? <Textarea aria-label={translate('options')} placeholder={translate('options')} value={selectedItem.options} onChange={(event) => handleFieldUpdate(selectedItem.id, { options: event.target.value })} /> : null}
                    <Button type="button" variant="mono" onClick={() => handleDuplicate(selectedItem.id)}>{translate('duplicateField')}</Button>
                  </>}
                  {selectedItem.type !== 'section' ? <Button type="button" variant="mono" onClick={() => handleRemove(selectedItem.id)}>{translate('removeItem')}</Button> : null}
                </DetailPanel.Content>
              </DetailPanel>
            </div>
          ) : null}
        </div>
      </section>
      <Dialog.Inner onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus() }} onCloseAutoFocus={(event) => {
        if (focusAfterDialog.current === undefined) return
        event.preventDefault()
        const targetId = focusAfterDialog.current
        focusAfterDialog.current = undefined
        requestAnimationFrame(() => { if (targetId) editorRefs.current.get(targetId)?.focus(); else paletteRef.current?.querySelector<HTMLButtonElement>('button[draggable]')?.focus() })
      }}>
        <Dialog.Header omitCloseButton><Dialog.Title>{translate('deleteSectionTitle')}</Dialog.Title></Dialog.Header>
        <Dialog.Content><Dialog.Description>{translate('deleteSectionMessage')}</Dialog.Description></Dialog.Content>
        <Dialog.Footer><Button.Group className="builder-delete-actions">
          <Button type="button" variant="danger" onClick={() => { if (deleteSectionId) handleRemove(deleteSectionId) }}>{translate('deleteSectionAndFields')}</Button>
          <Button type="button" variant="mono" onClick={() => { if (deleteSectionId) handleRemove(deleteSectionId, true) }}>{translate('keepFields')}</Button>
          <Button ref={cancelRef} type="button" variant="mono" onClick={() => setDeleteSectionId(null)}>{translate('cancel')}</Button>
        </Button.Group></Dialog.Footer>
      </Dialog.Inner>
    </Dialog>
  )
}

export default FormBuilder
FormBuilder.displayName = 'FormBuilder'