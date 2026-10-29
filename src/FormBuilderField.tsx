import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from '@emisgroup/ui-button'
import { Checkbox } from '@emisgroup/ui-checkbox'
import { Dropdown } from '@emisgroup/ui-dropdown'
import { Input, Textarea } from '@emisgroup/ui-input'
import { RadioButton } from '@emisgroup/ui-radio-button'
import { SearchDropdown } from '@emisgroup/ui-search-dropdown'
import type { FieldAnswer, FieldItem, SectionChild } from './formBuilderModel'
import translations from './locales/en-GB/translation.json'
import '@emisgroup/ui-radio-button/styles.css'
import '@emisgroup/ui-search-dropdown/styles.css'

interface FormBuilderFieldProps {
  item: SectionChild
  editing: boolean
  selected: boolean
  parentSectionId: string | null
  moveHandle?: ReactNode
  onSelect: () => void
  onChange: (item: SectionChild) => void
  registerEditor: (element: HTMLInputElement | HTMLTextAreaElement | null) => void
  registerHelperEditor: (element: HTMLTextAreaElement | null) => void
  answer?: FieldAnswer
  onAnswerChange?: (answer: FieldAnswer) => void
  onAnswerBlur?: () => void
  error?: string
}

const translate = (key: keyof typeof translations.builder) => translations.builder[key]

interface ChoiceEditorProps {
  item: FieldItem
  editing: boolean
  onChange: (item: FieldItem) => void
  answer?: FieldAnswer
  onAnswerChange: (answer: FieldAnswer) => void
  onAnswerBlur: () => void
  error?: string
}

function ChoiceEditor({ item, editing, onChange, answer, onAnswerChange, onAnswerBlur, error }: ChoiceEditorProps) {
  const choiceRefs = useRef(new Map<number, HTMLInputElement>())
  const pendingChoiceIndex = useRef<number | null>(null)
  const choices = editing && item.options === '' ? ['', ''] : item.options.split('\n')
  const visibleChoices = editing ? choices : choices.filter((choice) => choice.trim())

  useLayoutEffect(() => {
    if (pendingChoiceIndex.current === null) return
    choiceRefs.current.get(pendingChoiceIndex.current)?.focus()
    pendingChoiceIndex.current = null
  }, [item.options])

  const handleChoiceChange = (index: number, value: string) => {
    onChange({ ...item, options: choices.map((choice, choiceIndex) => choiceIndex === index ? value : choice).join('\n') })
  }
  const handleAddChoice = () => {
    pendingChoiceIndex.current = choices.length
    onChange({ ...item, options: [...choices, ''].join('\n') })
  }
  const rows = visibleChoices.map((choice, index) => (
    <div className={`builder-choice-option${editing ? ' is-editing' : ''}`} key={index}>
      {item.fieldType === 'multipleChoice' ? (
        <Checkbox aria-label={editing ? `${translate('choice')} ${index + 1}` : choice} checked={!editing && Array.isArray(answer) && answer.includes(choice)} onChange={(checked) => { if (!editing) { const selectedChoices = Array.isArray(answer) ? answer : []; onAnswerChange(checked ? [...selectedChoices, choice] : selectedChoices.filter((selectedChoice) => selectedChoice !== choice)) } }}>{!editing ? choice : null}</Checkbox>
      ) : (
        <RadioButton id={`choice-${item.id}-${index}`} value={editing ? String(index) : choice} aria-label={editing ? `${translate('choice')} ${index + 1}` : choice}>{editing ? <span className="visually-hidden">{`${translate('choice')} ${index + 1}`}</span> : choice}</RadioButton>
      )}
      {editing ? <Input
        ref={(element) => { if (element) choiceRefs.current.set(index, element); else choiceRefs.current.delete(index) }}
        className="builder-choice-input" aria-label={`${translate('choiceText')} ${index + 1}`} placeholder={translate('choice')}
        value={choice} onChange={(event) => handleChoiceChange(index, event.target.value)}
      /> : null}
    </div>
  ))

  return (
    <>
      {item.fieldType === 'multipleChoice' ? (
        <div id={editing ? undefined : `answer-${item.id}`} tabIndex={editing ? undefined : -1} className="builder-choice-options" role="group" aria-label={item.label || translate('multipleChoice')} aria-invalid={Boolean(error)} aria-describedby={error ? `error-${item.id}` : undefined} onBlur={() => { if (!editing) onAnswerBlur() }}>{rows}</div>
      ) : (
        <RadioButton.Group id={editing ? undefined : `answer-${item.id}`} className="builder-choice-options" ariaLabel={item.label || translate('singleChoice')} name={`choice-${item.id}`} required={item.required} value={editing ? '' : typeof answer === 'string' ? answer : ''} onChange={(value) => { if (!editing && typeof value === 'string') onAnswerChange(value) }} invalid={Boolean(error)} aria-describedby={error ? `error-${item.id}` : undefined} onBlur={() => { if (!editing) onAnswerBlur() }}>{rows}</RadioButton.Group>
      )}
      {editing ? <Button type="button" variant="mono" borderless size="small" className="builder-add-choice" onClick={handleAddChoice}>
        <iconify-icon icon="ic:baseline-add-circle" width="20" aria-hidden="true"></iconify-icon>{translate('addChoice')}
      </Button> : null}
    </>
  )
}
ChoiceEditor.displayName = 'ChoiceEditor'

function FormBuilderField({ item, editing, selected, parentSectionId, moveHandle, onSelect, onChange, registerEditor, registerHelperEditor, answer, onAnswerChange = () => {}, onAnswerBlur = () => {}, error }: FormBuilderFieldProps) {
  if (!editing && item.type === 'information' && !item.text.trim()) return null
  const labelId = `field-label-${item.id}`
  const helperId = `field-helper-${item.id}`
  const fieldLabel = item.type === 'field' ? item.label : ''
  const configuredLimit = item.type === 'field' && item.hasCharacterLimit && Number.isInteger(Number(item.characterLimit)) && Number(item.characterLimit) > 0 ? Number(item.characterLimit) : null
  const answerText = typeof answer === 'string' ? answer : ''
  const describedBy = [item.type === 'field' && item.hasHelperText && item.helperText ? helperId : '', error ? `error-${item.id}` : ''].filter(Boolean).join(' ') || undefined
  const answerId = editing ? undefined : `answer-${item.id}`
  const controlLabel = editing && item.type === 'field' ? `${translate('placeholder')}: ${fieldLabel || translate(item.fieldType)}` : fieldLabel || translate('answerPreview')
  const controlValue = editing && item.type === 'field' ? item.placeholder : answerText
  const handleControlChange = (value: string) => {
    if (item.type !== 'field') return
    if (editing) onChange({ ...item, placeholder: value })
    else onAnswerChange(value)
  }

  return (
    <article
      className={`builder-field${editing && selected ? ' is-selected' : ''}`}
      data-item-id={item.id}
      data-kind={item.type}
      data-field-type={item.type === 'field' ? item.fieldType : undefined}
      data-parent-section={parentSectionId ?? ''}
      aria-label={item.type === 'field' ? fieldLabel || translate(item.fieldType) : translate('information')}
      onFocus={(event) => { if (editing) { event.stopPropagation(); onSelect() } }}
      onPointerDown={(event) => { if (editing) { event.stopPropagation(); onSelect() } }}
    >
      {item.type === 'information' ? (
        editing ? <Textarea ref={registerEditor} aria-label={translate('information')} placeholder={translate('addInformation')} value={item.text} onChange={(event) => onChange({ ...item, text: event.target.value })} /> : <p className="builder-information-text">{item.text}</p>
      ) : (
        <div className="builder-field-preview">
          {editing ? (
            <div className="builder-field-label-row">
              {item.required ? <span className="builder-required-marker" aria-hidden="true">*</span> : null}
              <Input ref={registerEditor} className="builder-field-label" aria-label={translate('fieldLabel')} placeholder={translate('addLabel')} value={item.label} onChange={(event) => onChange({ ...item, label: event.target.value })} />
            </div>
          ) : item.label.trim() ? (
            <p id={labelId} className="builder-completed-label">{item.required ? <span className="builder-required-marker" aria-hidden="true">*</span> : null}{item.label}</p>
          ) : null}
          {item.hasHelperText ? editing ? (
            <Textarea ref={registerHelperEditor} id={helperId} className="builder-field-helper builder-helper-editor" aria-label={translate('helperText')} placeholder={translate('addHelperText')} rows={1} value={item.helperText} onChange={(event) => onChange({ ...item, helperText: event.target.value })} />
          ) : item.helperText ? <p id={helperId} className="builder-field-helper">{item.helperText}</p> : null : null}
          {item.fieldType === 'longText' ? (
            <>
              <p id={`${item.id}-remaining`} className="builder-character-count">{configuredLimit === null ? translate('charactersRemainingPlaceholder') : `${(configuredLimit - (editing ? 0 : answerText.length)).toLocaleString('en-GB')} ${translate('charactersRemaining')}`}</p>
              <Textarea id={answerId} rows={3} className={`builder-answer-preview builder-long-text${editing ? ' builder-placeholder-editor' : ''}`} aria-label={controlLabel} aria-required={!editing && item.required} aria-invalid={Boolean(error)} aria-describedby={[describedBy ?? '', `${item.id}-remaining`].filter(Boolean).join(' ')} placeholder={editing ? translate('addPlaceholder') : item.placeholder} value={controlValue} onChange={(event) => handleControlChange(event.target.value)} onBlur={() => { if (!editing) onAnswerBlur() }} />
            </>
          ) : item.fieldType === 'singleChoice' || item.fieldType === 'multipleChoice' ? (
            <ChoiceEditor item={item} editing={editing} onChange={onChange} answer={answer} onAnswerChange={onAnswerChange} onAnswerBlur={onAnswerBlur} error={error} />
          ) : item.fieldType === 'yesNo' ? (
            <RadioButton.Group id={answerId} className="builder-yes-no" ariaLabel={fieldLabel || translate('yesNo')} name={`yes-no-${item.id}`} required={item.required} value={editing ? '' : answerText} onChange={(value) => { if (!editing && typeof value === 'string') onAnswerChange(value) }} invalid={Boolean(error)} aria-describedby={describedBy} onBlur={() => { if (!editing) onAnswerBlur() }}>
              <RadioButton id={`yes-${item.id}`} value="yes" aria-label={translate('yes')}>{translate('yes')}</RadioButton>
              <RadioButton id={`no-${item.id}`} value="no" aria-label={translate('no')}>{translate('no')}</RadioButton>
            </RadioButton.Group>
          ) : item.fieldType === 'dropdown' ? (
            editing ? <div className="builder-dropdown-control">
              <Input className="builder-answer-preview builder-placeholder-editor builder-dropdown-placeholder" aria-label={controlLabel} placeholder={translate('addPlaceholder')} value={item.placeholder} onChange={(event) => handleControlChange(event.target.value)} />
              <iconify-icon icon="ic:outline-arrow-drop-down" width="20" aria-hidden="true"></iconify-icon>
            </div> : <Dropdown value={answerText} onValueChange={(value) => onAnswerChange(value)}><Dropdown.Trigger id={answerId} aria-label={fieldLabel || translate('answerPreview')} aria-required={item.required} aria-invalid={Boolean(error)} aria-describedby={describedBy} placeholder={item.placeholder || translate('selectOption')} onBlur={onAnswerBlur} /><Dropdown.Content>{item.options.split('\n').filter((option) => option.trim()).map((option, optionIndex) => <Dropdown.Item key={optionIndex} value={option}>{option}</Dropdown.Item>)}</Dropdown.Content></Dropdown>
          ) : item.fieldType === 'date' ? (
            <div className="builder-date-control">
              <Input id={answerId} className={`builder-answer-preview builder-date-input${editing ? ' builder-placeholder-editor' : ''}`} aria-label={editing ? controlLabel : fieldLabel || translate('date')} aria-required={!editing && item.required} aria-invalid={Boolean(error)} aria-describedby={describedBy} placeholder={editing ? translate('addPlaceholder') : item.placeholder || translate('datePlaceholder')} inputMode={editing ? 'text' : 'numeric'} value={controlValue} onChange={(event) => handleControlChange(event.target.value)} onBlur={() => { if (!editing) onAnswerBlur() }} />
              <iconify-icon icon="ic:outline-calendar-today" width="16" aria-hidden="true"></iconify-icon>
            </div>
          ) : item.fieldType === 'snomed' ? (
            editing ? <div className="builder-snomed-control builder-snomed-editor">
              <iconify-icon icon="ic:outline-search" width="20" aria-hidden="true"></iconify-icon>
              <Input className="builder-answer-preview builder-placeholder-editor builder-snomed-placeholder" aria-label={controlLabel} placeholder={translate('addPlaceholder')} value={item.placeholder} onChange={(event) => handleControlChange(event.target.value)} />
              <iconify-icon className="builder-control-chevron" icon="ic:outline-unfold-more" width="20" aria-hidden="true"></iconify-icon>
            </div> : <SearchDropdown>
              <div className="builder-snomed-control">
                <iconify-icon icon="ic:outline-search" width="20" aria-hidden="true"></iconify-icon>
                <SearchDropdown.Trigger id={answerId} className="builder-snomed-trigger" aria-label={fieldLabel || translate('snomed')} placeholder={item.placeholder || translate('search')} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
              </div>
              <SearchDropdown.Content aria-label={translate('searchSnomed')}>
                <SearchDropdown.Input aria-label={translate('searchSnomed')} placeholder={translate('search')} />
                <SearchDropdown.List><SearchDropdown.Item value="unavailable" disabled forceMount>{translate('snomedUnavailable')}</SearchDropdown.Item></SearchDropdown.List>
              </SearchDropdown.Content>
            </SearchDropdown>
          ) : (
            <Input id={answerId} className={`builder-answer-preview${editing ? ' builder-placeholder-editor' : ''}`} type={!editing && item.fieldType === 'number' ? 'number' : 'text'} placeholder={editing ? translate('addPlaceholder') : item.placeholder || (item.fieldType === 'number' ? translate('text') : undefined)} aria-label={controlLabel} aria-required={!editing && item.required} aria-invalid={Boolean(error)} aria-describedby={describedBy} value={controlValue} onChange={(event) => handleControlChange(event.target.value)} onBlur={() => { if (!editing) onAnswerBlur() }} />
          )}
          {error ? <p className="builder-answer-error" id={`error-${item.id}`} role="alert">{error}</p> : null}
          {!editing && answer !== undefined && answer !== '' && ['yesNo', 'singleChoice', 'multipleChoice', 'dropdown'].includes(item.fieldType) ? <Button type="button" variant="mono" borderless size="small" onClick={() => onAnswerChange('')} aria-label={`${translate('clearAnswer')}: ${item.label || translate(item.fieldType)}`}>{translate('clearAnswer')}</Button> : null}
        </div>
      )}
      {editing ? moveHandle : null}
    </article>
  )
}

export default FormBuilderField
FormBuilderField.displayName = 'FormBuilderField'