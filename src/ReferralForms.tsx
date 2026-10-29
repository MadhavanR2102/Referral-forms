import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Accordion, AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from '@emisgroup/ui-accordion'
import { Button } from '@emisgroup/ui-button'
import { Checkbox } from '@emisgroup/ui-checkbox'
import { DetailPanel } from '@emisgroup/ui-detail-panel'
import { Input, Textarea } from '@emisgroup/ui-input'
import { Header as SectionHeader, HeaderPrimary } from '@emisgroup/ui-sections'
import { Table } from '@emisgroup/ui-table'
import { Tabs } from '@emisgroup/ui-tabs'
import { Tag } from '@emisgroup/ui-tag'
import { useLocation, useNavigate } from 'react-router-dom'
import FormBuilder from './FormBuilder'
import { generateFormProposal, updateFormProposal, type ProposalSection } from './formProposalApi'
import '@emisgroup/ui-button/styles.css'
import '@emisgroup/ui-checkbox/styles.css'
import '@emisgroup/ui-detail-panel/styles.css'
import '@emisgroup/ui-accordion/styles.css'
import '@emisgroup/ui-input/styles.css'
import '@emisgroup/ui-sections/styles.css'
import '@emisgroup/ui-table/styles.css'
import '@emisgroup/ui-tabs/styles.css'
import '@emisgroup/ui-tag/styles.css'
import 'iconify-icon'
import './ReferralForms.css'

type TabValue = 'published' | 'drafts' | 'archived'
type ConversationMode = 'landing' | 'processing' | 'reviewing' | 'draft'

interface ReferralFormSummary {
  id: string
  name: string
  lastUpdated: string
  version?: number
  assignedServices?: string
  additionalServiceCount?: number
  assignedServiceNames?: string[]
}

const REFERRAL_FORMS_PATH = '/referral-forms'
const NEW_FORM_PATH = '/referral-forms/new'
const BLANK_FORM_PATH = '/referral-forms/new/blank'
const PLACEHOLDER_TYPING_INTERVAL_MS = 45
const PLACEHOLDER_PAUSE_MS = 1250
const SUPPORTED_FORM_FILE_TYPES = '.jpeg,.jpg,.png,.pdf,.doc,.docx'
const PROMPT_PLACEHOLDERS = [
  'Explain the goal of your form',
  'Type or paste your form questions',
  'Upload an existing form in word or pdf to begin with',
]
const SIMULATED_PROCESSING_STEPS = [
  'Identifying questions and sections',
  'Separating questions from guidance',
  'Suggesting answer types',
  'Preparing a starting point',
]
const mockEastCheshireFormProposal: ProposalSection[] = [
  { id: 'patient-details', name: 'Patient details', preview: 'Name, date of birth, NHS number, address and contact details', questions: [
    { id: 'title', label: 'Title', answerType: 'Short text', patientRecordInfo: true }, { id: 'surname', label: 'Surname', answerType: 'Short text', patientRecordInfo: true }, { id: 'forenames', label: 'Forename(s)', answerType: 'Short text', patientRecordInfo: true }, { id: 'date-of-birth', label: 'Date of birth', answerType: 'Date', patientRecordInfo: true }, { id: 'gender', label: 'Gender', answerType: 'Single selection', patientRecordInfo: true }, { id: 'nhs-number', label: 'NHS number', answerType: 'Short text', patientRecordInfo: true }, { id: 'home-address', label: 'Home address', answerType: 'Long text', patientRecordInfo: true }, { id: 'postcode', label: 'Postcode', answerType: 'Short text', patientRecordInfo: true }, { id: 'home-telephone', label: 'Home telephone', answerType: 'Telephone', patientRecordInfo: true }, { id: 'mobile-telephone', label: 'Mobile telephone', answerType: 'Telephone', patientRecordInfo: true }, { id: 'lives-alone', label: 'Lives alone?', answerType: 'Yes or no' }, { id: 'patient-location', label: 'Current patient location, including ward information', answerType: 'Long text' },
  ] },
  { id: 'next-of-kin', name: 'Next of kin details', preview: 'Name, relationship and contact telephone number', questions: [{ id: 'next-of-kin-name', label: 'Full name', answerType: 'Short text' }, { id: 'next-of-kin-relationship', label: 'Relationship to patient', answerType: 'Short text' }, { id: 'next-of-kin-telephone', label: 'Contact telephone number', answerType: 'Telephone' }] },
  { id: 'gp-details', name: 'GP details', preview: 'Patient’s GP surgery', questions: [{ id: 'gp-surgery', label: 'GP surgery name', answerType: 'Short text' }] },
  { id: 'clinical-referral', name: 'Clinical and referral information', preview: 'Diagnosis, consent and reason for referral', questions: [{ id: 'diagnosis', label: 'Diagnosis', answerType: 'Long text' }, { id: 'consent', label: 'Does the patient consent to the referral?', answerType: 'Yes or no' }, { id: 'reason-referral', label: 'Reason for referral and current situation', answerType: 'Long text', helpText: 'Include relevant information about Advance Care Planning and resuscitation decisions.' }] },
  { id: 'care-arrangements', name: 'Care arrangements', preview: 'Current care package, funding and care provider', questions: [{ id: 'package-of-care', label: 'Existing package of care?', answerType: 'Yes or no' }, { id: 'continuing-healthcare', label: 'Continuing Healthcare funded?', answerType: 'Yes or no' }, { id: 'care-provider', label: 'If a package of care is in place, who provides the care?', answerType: 'Long text' }] },
  { id: 'referrer-details', name: 'Referrer details', preview: 'Referrer name, role, contact number and date', questions: [{ id: 'referrer-name', label: 'Referrer’s name', answerType: 'Short text' }, { id: 'referrer-contact', label: 'Contact number', answerType: 'Telephone' }, { id: 'designation', label: 'Designation', answerType: 'Short text' }, { id: 'referral-date', label: 'Date', answerType: 'Date' }] },
]
const publishedFormSummaries: ReferralFormSummary[] = [
  { id: 'community-nursing', name: 'Community nursing referral', version: 2, lastUpdated: '23-Oct-2026', assignedServices: 'District nursing, Tissue viability, IV therapy', additionalServiceCount: 2, assignedServiceNames: ['District nursing', 'Tissue viability', 'IV therapy', 'MSK physiotherapy', 'Neuro rehab'] },
  { id: 'community-physiotherapy', name: 'Community physiotherapy referral', version: 5, lastUpdated: '21-Oct-2026', assignedServices: 'MSK physiotherapy, Neuro rehab, Falls service', additionalServiceCount: 5 },
  { id: 'community-occupational-therapy', name: 'Community occupational therapy referral', version: 3, lastUpdated: '19-Oct-2026', assignedServices: 'Community OT, Hand therapy, Neuro rehab', additionalServiceCount: 1 },
  { id: 'community-podiatry', name: 'Community podiatry referral', version: 3, lastUpdated: '15-Oct-2026', assignedServices: 'Podiatry, Diabetic foot care, Foot protection', additionalServiceCount: 4 },
  { id: 'speech-language-therapy', name: 'Speech and language therapy referral', version: 3, lastUpdated: '12-Oct-2026', assignedServices: 'Adult SLT, Children’s SLT, Dysphagia', additionalServiceCount: 7 },
  { id: 'community-dietetics', name: 'Community dietetics referral', version: 3, lastUpdated: '08-Oct-2026', assignedServices: 'Community dietetics, Diabetes, Home enteral feeding', additionalServiceCount: 6 },
  { id: 'community-continence', name: 'Community continence referral', version: 3, lastUpdated: '02-Oct-2026', assignedServices: 'Bladder and bowel, Continence, Pelvic health', additionalServiceCount: 9 },
  { id: 'community-diabetes', name: 'Community diabetes referral', version: 3, lastUpdated: '28-Sep-2026', assignedServices: 'Diabetes nursing, Dietetics, Diabetic foot care', additionalServiceCount: 8 },
  { id: 'community-respiratory', name: 'Community respiratory referral', version: 3, lastUpdated: '22-Sep-2026', assignedServices: 'COPD, Pulmonary rehab, Home oxygen', additionalServiceCount: 11 },
  { id: 'community-cardiology', name: 'Community cardiology referral', version: 3, lastUpdated: '16-Sep-2026', assignedServices: 'Heart failure, Cardiac rehab, Community cardiology', additionalServiceCount: 10 },
  { id: 'falls-prevention', name: 'Falls prevention referral', version: 3, lastUpdated: '09-Sep-2026', assignedServices: 'Falls service, Physiotherapy, Community OT', additionalServiceCount: 13 },
  { id: 'community-rehabilitation', name: 'Community rehabilitation referral', version: 3, lastUpdated: '01-Sep-2026', assignedServices: 'Community rehab, Stroke rehab, Neuro rehab', additionalServiceCount: 12 },
]
const draftFormSummaries: ReferralFormSummary[] = [
  { id: 'community-nursing-draft', name: 'Community nursing referral', lastUpdated: '23-Oct-2026' },
  { id: 'community-physiotherapy-draft', name: 'Community physiotherapy referral', lastUpdated: '21-Oct-2026' },
  { id: 'community-occupational-therapy-draft', name: 'Community occupational therapy referral', lastUpdated: '19-Oct-2026' },
]
const archivedFormSummaries = publishedFormSummaries.slice(0, 3).map((form) => ({ ...form, id: `${form.id}-archived` }))
const getActiveTab = (search: string): TabValue => {
  const tab = new URLSearchParams(search).get('tab')

  return tab === 'drafts' || tab === 'archived' ? tab : 'published'
}

interface FormsTableProps {
  forms: ReferralFormSummary[]
  status: TabValue
  searchQuery: string
  onSearchChange: (value: string) => void
}

interface FormDetailFieldProps {
  label: string
  value: string | number
}

function FormDetailField({ label, value }: FormDetailFieldProps) {
  const valueRef = useRef<HTMLElement>(null)
  const [isMultiline, setIsMultiline] = useState(false)

  useEffect(() => {
    const valueElement = valueRef.current
    if (!valueElement) return undefined
    const valueText = valueElement.querySelector('span')
    if (!valueText) return undefined

    const updateLineAlignment = () => {
      const range = document.createRange()
      range.selectNodeContents(valueText)
      const nextIsMultiline = range.getClientRects().length > 1
      setIsMultiline((currentValue) => currentValue === nextIsMultiline ? currentValue : nextIsMultiline)
    }

    updateLineAlignment()
    const resizeObserver = new ResizeObserver(updateLineAlignment)
    resizeObserver.observe(valueElement)
    window.addEventListener('resize', updateLineAlignment)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateLineAlignment)
    }
  }, [value])

  return (
    <div className={`form-detail-field${isMultiline ? ' is-multiline' : ''}`}>
      <dt>{label}</dt>
      <dd ref={valueRef}><span>{value}</span></dd>
    </div>
  )
}
FormDetailField.displayName = 'FormDetailField'

function FormsTable({ forms, status, searchQuery, onSearchChange }: FormsTableProps) {
  const [selectedFormId, setSelectedFormId] = useState<string | null>(status === 'drafts' ? null : forms[0]?.id ?? null)
  const [openActionsFormId, setOpenActionsFormId] = useState<string | null>(null)
  const showsServiceDetails = status !== 'drafts'
  const servicesHeading = status === 'archived' ? 'Previously assigned services' : 'Assigned services'
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('en-GB')
  const filteredForms = forms.filter((form) =>
    `${form.name} ${form.assignedServices ?? ''}`.toLocaleLowerCase('en-GB').includes(normalizedQuery),
  )
  const selectedForm = showsServiceDetails ? filteredForms.find((form) => form.id === selectedFormId) : undefined
  const selectedServiceNames = selectedForm?.assignedServiceNames
    ?? selectedForm?.assignedServices?.split(',').map((service) => service.trim()).filter(Boolean)
    ?? []
  const unlistedServiceCount = selectedForm?.assignedServiceNames ? 0 : selectedForm?.additionalServiceCount ?? 0
  const totalAssignedServiceCount = selectedServiceNames.length + unlistedServiceCount

  const handleFormRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, formId: string) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return

    event.preventDefault()
    setSelectedFormId(formId)
  }

  return (
    <div className="forms-list-content">
      <div className="forms-list-layout">
      <section className="forms-table-panel" aria-label={`${status.charAt(0).toUpperCase()}${status.slice(1)} referral forms`}>
        <div className="forms-table-toolbar">
          <div className="forms-search-container">
            <iconify-icon icon="ic:outline-search" width="16" aria-hidden="true"></iconify-icon>
            <Input
              type="search"
              aria-label="Search by form name or service"
              placeholder="Search by form name or service"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              clearable
              onClear={() => onSearchChange('')}
              className="forms-search-input"
            />
          </div>
        </div>
        <Table className="forms-table">
          <thead>
            <tr>
              <th scope="col" className="form-name-column">Name</th>
              {showsServiceDetails ? <th scope="col" className="form-version-column">Version</th> : null}
              <th scope="col" className="form-updated-column">Last updated</th>
              {showsServiceDetails ? <th scope="col" className="form-services-column">{servicesHeading}</th> : null}
              {!showsServiceDetails ? <th scope="col" className="form-action-spacer-column" aria-hidden="true"></th> : null}
              <th scope="col" className="form-actions-column"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filteredForms.length > 0 ? filteredForms.map((form) => (
              <tr
                key={form.id}
                aria-selected={showsServiceDetails ? selectedFormId === form.id : undefined}
                tabIndex={showsServiceDetails ? 0 : undefined}
                onClick={showsServiceDetails ? () => setSelectedFormId(form.id) : undefined}
                onKeyDown={showsServiceDetails ? (event) => handleFormRowKeyDown(event, form.id) : undefined}
              >
                <th scope="row" className="form-name-cell">{form.name}</th>
                {showsServiceDetails ? <td data-label="Version">{form.version}</td> : null}
                <td data-label="Last updated">{form.lastUpdated}</td>
                {!showsServiceDetails ? <td className="form-action-spacer-cell" aria-hidden="true"></td> : null}
                {showsServiceDetails ? <td data-label={servicesHeading}>
                  <div className="assigned-services-cell">
                    <span>{form.assignedServices}</span>
                    <Button
                      type="button"
                      variant="mono"
                      className="additional-services-button"
                      aria-expanded={selectedFormId === form.id && Boolean(selectedForm)}
                      aria-controls="form-details-panel"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedFormId(form.id)
                      }}
                    >
                      + {form.additionalServiceCount} {form.additionalServiceCount === 1 ? 'service' : 'services'}
                    </Button>
                  </div>
                </td> : null}
                <td data-label="Actions" className="form-actions-cell">
                  <Button
                    type="button"
                    variant="mono"
                    className="form-row-action"
                    aria-label={`More actions for ${form.name}`}
                    aria-expanded={openActionsFormId === form.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpenActionsFormId((currentId) => currentId === form.id ? null : form.id)
                    }}
                  >
                    <iconify-icon icon="ic:outline-more-vert" width="20" aria-hidden="true"></iconify-icon>
                  </Button>
                  {openActionsFormId === form.id ? (
                    <span className="form-actions-detail" role="status">
                      Form actions are not configured in this prototype.
                    </span>
                  ) : null}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={showsServiceDetails ? 5 : 4} className="forms-empty-result">No forms match your search.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </section>
      {showsServiceDetails ? (
        <div id="form-details-panel" className="form-details-slot" hidden={!selectedForm}>
          {selectedForm ? (
            <DetailPanel
              className="form-details-panel"
              role="region"
              aria-labelledby={`form-details-title-${selectedForm.id}`}
              aria-live="polite"
            >
              <DetailPanel.Header className="form-details-header">
                <h2 id={`form-details-title-${selectedForm.id}`} className="form-details-title">Form details</h2>
                <Button
                  type="button"
                  variant="mono"
                  borderless
                  className="form-details-close-button"
                  aria-label="Close form details"
                  onClick={() => setSelectedFormId(null)}
                >
                  <iconify-icon icon="ic:outline-close" width="20" aria-hidden="true"></iconify-icon>
                </Button>
              </DetailPanel.Header>
              <DetailPanel.Content className="form-details-content">
                <dl className="form-details-fields">
                  <FormDetailField label="Name" value={selectedForm.name} />
                  {selectedForm.version !== undefined ? (
                    <FormDetailField label="Version" value={selectedForm.version} />
                  ) : null}
                  <FormDetailField label="Last updated" value={selectedForm.lastUpdated} />
                </dl>
                {selectedServiceNames.length > 0 ? (
                  <>
                    <hr className="form-details-divider" />
                    <p className="form-details-services-heading">
                      {servicesHeading} ({totalAssignedServiceCount})
                    </p>
                    <ul className="form-details-services-list">
                      {selectedServiceNames.map((serviceName) => <li key={serviceName}>{serviceName}</li>)}
                      {unlistedServiceCount > 0 ? (
                        <li>{unlistedServiceCount} additional {unlistedServiceCount === 1 ? 'service' : 'services'}</li>
                      ) : null}
                    </ul>
                  </>
                ) : null}
              </DetailPanel.Content>
            </DetailPanel>
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  )
}
FormsTable.displayName = 'FormsTable'

function ReferralForms() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = getActiveTab(location.search)
  const isNewFormPage = location.pathname === NEW_FORM_PATH || location.pathname === BLANK_FORM_PATH
  const isBlankFormPage = location.pathname === BLANK_FORM_PATH
  const [searchQuery, setSearchQuery] = useState('')
  const [formSearchQuery, setFormSearchQuery] = useState('')
  const [prompt, setPrompt] = useState('')
  const [conversationMode, setConversationMode] = useState<ConversationMode>('landing')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [selectedFormFile, setSelectedFormFile] = useState<File | null>(null)
  const [documentText, setDocumentText] = useState('')
  const [processingStepIndex, setProcessingStepIndex] = useState(0)
  const [proposal, setProposal] = useState<ProposalSection[]>(mockEastCheshireFormProposal)
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, boolean>>({})
  const [followUpPrompt, setFollowUpPrompt] = useState('')
  const [followUpResponse, setFollowUpResponse] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [selectedFormFileName, setSelectedFormFileName] = useState<string | null>(null)
  const [promptPlaceholderIndex, setPromptPlaceholderIndex] = useState(0)
  const [promptPlaceholderLength, setPromptPlaceholderLength] = useState(0)
  const [savedFormName, setSavedFormName] = useState('New form')
  const [draftFormName, setDraftFormName] = useState('New form')
  const [isEditingFormName, setIsEditingFormName] = useState(false)
  const [isSecondaryNavigationExpanded, setIsSecondaryNavigationExpanded] = useState(true)
  const formNameInputRef = useRef<HTMLInputElement>(null)
  const formNameDisplayRef = useRef<HTMLHeadingElement>(null)
  const formFileInputRef = useRef<HTMLInputElement>(null)
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null)
  const completedProposalHeadingRef = useRef<HTMLHeadingElement>(null)
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false)

  useEffect(() => {
    if (isEditingFormName) {
      formNameInputRef.current?.focus()
      formNameInputRef.current?.select()
    }
  }, [isEditingFormName])

  useEffect(() => {
    if (!isNewFormPage || prompt) {
      return undefined
    }

    const placeholder = PROMPT_PLACEHOLDERS[promptPlaceholderIndex]
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      return undefined
    }

    const delay = promptPlaceholderLength < placeholder.length
      ? PLACEHOLDER_TYPING_INTERVAL_MS
      : PLACEHOLDER_PAUSE_MS
    const placeholderTimeout = window.setTimeout(() => {
      if (promptPlaceholderLength < placeholder.length) {
        setPromptPlaceholderLength((currentLength) => currentLength + 1)
        return
      }

      setPromptPlaceholderIndex((currentIndex) => (currentIndex + 1) % PROMPT_PLACEHOLDERS.length)
      setPromptPlaceholderLength(0)
    }, delay)

    return () => window.clearTimeout(placeholderTimeout)
  }, [isNewFormPage, prompt, promptPlaceholderIndex, promptPlaceholderLength])

  useEffect(() => () => speechRecognitionRef.current?.stop(), [])

  useEffect(() => {
    if (conversationMode !== 'processing') {
      return undefined
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const processingDelay = prefersReducedMotion ? 0 : 700
    const processingTimeout = window.setTimeout(() => {
      if (processingStepIndex < SIMULATED_PROCESSING_STEPS.length - 1) {
        setProcessingStepIndex((currentIndex) => currentIndex + 1)
        return
      }

      setConversationMode('reviewing')
      requestAnimationFrame(() => completedProposalHeadingRef.current?.focus({ preventScroll: true }))
    }, processingDelay)

    return () => window.clearTimeout(processingTimeout)
  }, [conversationMode, processingStepIndex])

  const handleCreateForm = () => {
    if (!isNewFormPage) {
      navigate(BLANK_FORM_PATH, { state: { returnTo: `${location.pathname}${location.search}` } })
    }
  }
  const handleTabChange = (value: string) => {
    navigate(`${REFERRAL_FORMS_PATH}${value === 'published' ? '' : `?tab=${value}`}`)
  }
  const handleBack = () => {
    handleSaveFormName()
    const returnTo = location.state?.returnTo

    if (typeof returnTo === 'string' && returnTo.startsWith(REFERRAL_FORMS_PATH)) {
      navigate(-1)
      return
    }

    navigate(REFERRAL_FORMS_PATH)
  }
  const handleSend = async () => {
    if (conversationMode !== 'landing' || !prompt.trim() || !selectedFormFile) {
      return
    }

    if (!documentText.trim()) {
      setGenerationError('This document format cannot be read in the prototype. Upload a text, markdown, CSV or JSON file.')
      return
    }

    setSubmittedPrompt(prompt.trim())
    setGenerationError('')
    setProcessingStepIndex(0)
    setConversationMode('processing')

    try {
      const generatedProposal = await generateFormProposal(prompt.trim(), documentText, selectedFormFileName ?? undefined)
      setProposal(generatedProposal)
      setSelectedQuestions(Object.fromEntries(generatedProposal.flatMap((section) => section.questions.map((question) => [question.id, true]))))
      setProcessingStepIndex(SIMULATED_PROCESSING_STEPS.length - 1)
      setConversationMode('reviewing')
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Unable to generate a form proposal')
      setConversationMode('landing')
    }
  }
  const handleAddSupportingInformation = () => {
    formFileInputRef.current?.click()
  }
  const handleUploadExistingForm = () => {
    formFileInputRef.current?.click()
  }
  const handleFormFileSelection = () => {
    const fileInput = formFileInputRef.current
    const selectedFile = fileInput?.files?.[0]

    if (selectedFile && fileInput) {
      setSelectedFormFile(selectedFile)
      setSelectedFormFileName(selectedFile.name)
      setGenerationError('')
      fileInput.value = ''

      const extension = selectedFile.name.split('.').pop()?.toLowerCase()
      const isReadableText = selectedFile.type.startsWith('text/') || ['csv', 'json', 'md', 'txt', 'html'].includes(extension ?? '')

      if (!isReadableText) {
        setDocumentText('')
        return
      }

      const reader = new FileReader()
      reader.onload = () => setDocumentText(typeof reader.result === 'string' ? reader.result.slice(0, 100_000) : '')
      reader.onerror = () => setDocumentText('')
      reader.readAsText(selectedFile)
    }
  }
  const handleRemoveSelectedFormFile = () => {
    setSelectedFormFile(null)
    setSelectedFormFileName(null)
    setDocumentText('')
  }
  const handleQuestionSelectionChange = (questionId: string, isSelected: boolean) => {
    setSelectedQuestions((currentSelection) => ({ ...currentSelection, [questionId]: isSelected }))
  }
  const handleSectionSelectionChange = (section: ProposalSection, isSelected: boolean) => {
    setSelectedQuestions((currentSelection) => ({
      ...currentSelection,
      ...Object.fromEntries(section.questions.map((question) => [question.id, isSelected])),
    }))
  }
  const handleBackToDocument = () => setConversationMode('landing')
  const handleCreateDraft = () => {
    if (selectedQuestionCount > 0) {
      setSavedFormName('East Cheshire Hospice referral form')
      setDraftFormName('East Cheshire Hospice referral form')
      setConversationMode('draft')
    }
  }
  const handleFollowUpSend = () => {
    if (!followUpPrompt.trim() || !documentText.trim() || !selectedFormFile) return

    void updateFormProposal(prompt, documentText, followUpPrompt.trim(), proposal, selectedFormFile.name)
      .then((updatedProposal) => {
        setProposal(updatedProposal)
        setSelectedQuestions(Object.fromEntries(updatedProposal.flatMap((section) => section.questions.map((question) => [question.id, true]))))
        setFollowUpResponse('The proposal was updated using your document and follow-up request.')
        setFollowUpPrompt('')
      })
      .catch((error: unknown) => {
        setFollowUpResponse(error instanceof Error ? error.message : 'Unable to update the proposal.')
      })
  }
  const selectedQuestionCount = Object.values(selectedQuestions).filter(Boolean).length
  const selectedSectionCount = proposal.filter((section) => section.questions.some((question) => selectedQuestions[question.id])).length
  const handleVoiceInput = () => {
    if (isVoiceInputActive) {
      speechRecognitionRef.current?.stop()
      return
    }

    const SpeechRecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!SpeechRecognitionApi) {
      return
    }

    const recognition = new SpeechRecognitionApi()
    recognition.lang = 'en-GB'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const spokenText = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ')

      if (spokenText) {
        setPrompt((currentPrompt) => `${currentPrompt}${currentPrompt ? ' ' : ''}${spokenText}`)
      }
    }
    recognition.onend = () => setIsVoiceInputActive(false)
    recognition.onerror = () => setIsVoiceInputActive(false)
    speechRecognitionRef.current = recognition
    recognition.start()
    setIsVoiceInputActive(true)
  }
  const handleStartFromScratch = () => {
    navigate(BLANK_FORM_PATH, { state: { returnTo: NEW_FORM_PATH } })
  }
  const handleSecondaryNavigationToggle = () => {
    setIsSecondaryNavigationExpanded((isExpanded) => !isExpanded)
  }
  const handleStartEditingFormName = () => {
    setDraftFormName(savedFormName)
    setIsEditingFormName(true)
  }
  const handleSaveFormName = () => {
    const trimmedFormName = draftFormName.trim()

    if (trimmedFormName) {
      setSavedFormName(trimmedFormName)
    }

    setIsEditingFormName(false)
  }
  const handleCancelFormNameEdit = () => {
    setDraftFormName(savedFormName)
    setIsEditingFormName(false)
    requestAnimationFrame(() => formNameDisplayRef.current?.focus())
  }
  const handleFormNameKeyDown = (event: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault()
      handleStartEditingFormName()
    }
  }
  const handleFormNameInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      handleSaveFormName()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      handleCancelFormNameEdit()
    }
  }

  return (
    <div className="referral-app">
      {/* Global Header */}
      <header className="referral-global-header">
        <SectionHeader displayBackgroundImage className="emis-header">
          <HeaderPrimary className="header-content">
            <div className="header-brand" aria-label="EMIS-X">
              <span className="brand-logo">EMIS-X</span>
            </div>
            <span className="header-separator" aria-hidden="true"></span>
            <div className="header-search-container">
              <iconify-icon icon="ic:outline-search" width="20" aria-hidden="true"></iconify-icon>
              <Input
                type="text"
                placeholder="Find patient by name or date of birth"
                aria-label="Find patient by name or date of birth"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="header-search-input"
              />
            </div>
            <span className="header-separator" aria-hidden="true"></span>
            <div className="header-actions">
              <Button type="button" variant="inverted" className="header-icon-button" aria-label="Calendar">
                <iconify-icon icon="ic:outline-calendar-today" width="20" aria-hidden="true"></iconify-icon>
              </Button>
              <Button type="button" variant="inverted" className="header-icon-button" aria-label="Applications">
                <iconify-icon icon="ic:outline-assignment-turned-in" width="20" aria-hidden="true"></iconify-icon>
              </Button>
              <Button type="button" variant="inverted" className="header-icon-button" aria-label="Recent activity">
                <iconify-icon icon="ic:outline-add-circle-outline" width="20" aria-hidden="true"></iconify-icon>
              </Button>
            </div>
            <div className="header-utility-actions">
              <Button type="button" variant="inverted" className="header-icon-button" aria-label="Messages">
                <iconify-icon icon="ic:outline-chat-bubble-outline" width="20" aria-hidden="true"></iconify-icon>
              </Button>
              <Button type="button" variant="inverted" className="header-icon-button" aria-label="Alerts">
                <iconify-icon icon="ic:outline-error-outline" width="20" aria-hidden="true"></iconify-icon>
              </Button>
            </div>
          </HeaderPrimary>
        </SectionHeader>
      </header>

      <div className="referral-body">
        {/* Primary Navigation Rail */}
        <nav className="referral-nav-rail">
          <Button
            type="button"
            variant="inverted"
            className="nav-rail-item navigation-toggle"
            aria-label={isSecondaryNavigationExpanded ? 'Collapse secondary navigation' : 'Expand secondary navigation'}
            aria-controls="referral-secondary-navigation"
            aria-expanded={isSecondaryNavigationExpanded}
            onClick={handleSecondaryNavigationToggle}
          >
            <iconify-icon
              icon={isSecondaryNavigationExpanded ? 'ic:outline-chevron-left' : 'ic:outline-chevron-right'}
              width="24"
              aria-hidden="true"
            ></iconify-icon>
          </Button>
          <Button type="button" variant="inverted" className="nav-rail-item active" aria-label="Referral forms" aria-current="page">
            <iconify-icon icon="ic:outline-description" width="24" aria-hidden="true"></iconify-icon>
          </Button>
          <Button type="button" variant="inverted" className="nav-rail-item" aria-label="Calendar">
            <iconify-icon icon="ic:outline-calendar-month" width="24" aria-hidden="true"></iconify-icon>
          </Button>
          <Button type="button" variant="inverted" className="nav-rail-item" aria-label="Tasks">
            <iconify-icon icon="ic:outline-assignment" width="24" aria-hidden="true"></iconify-icon>
          </Button>
          <Button type="button" variant="inverted" className="nav-rail-item" aria-label="Settings">
            <iconify-icon icon="ic:outline-settings" width="24" aria-hidden="true"></iconify-icon>
          </Button>
        </nav>

        {/* Secondary Navigation Panel */}
        <aside
          id="referral-secondary-navigation"
          className={`referral-nav-panel${isSecondaryNavigationExpanded && !isBlankFormPage ? '' : ' is-collapsed'}`}
          aria-hidden={!isSecondaryNavigationExpanded || isBlankFormPage}
        >
          <div className="nav-panel-item active">
            <iconify-icon icon="ic:outline-description" width="20" aria-hidden="true"></iconify-icon>
            <span>Referral forms</span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="referral-main-content">
          {/* Page Header */}
          {!isBlankFormPage ? <div className="page-header">
            <h1>Referral forms</h1>
            <Button
              type="button"
              variant="filled"
              className="btn-new-form"
              onClick={handleCreateForm}
              disabled={isNewFormPage}
            >
              <iconify-icon icon="ic:outline-add-circle-outline" width="18" aria-hidden="true"></iconify-icon>
              New form
            </Button>
          </div> : null}

          {isBlankFormPage ? (
            <FormBuilder onBack={handleBack} />
          ) : isNewFormPage ? (
            <section className="new-form-page" aria-label="New form">
              <div className="new-form-subheader">
                <Button type="button" variant="mono" className="back-button" aria-label="Back to referral forms" onClick={handleBack}>
                  <iconify-icon icon="ic:outline-arrow-back" width="20" aria-hidden="true"></iconify-icon>
                </Button>
                {isEditingFormName ? (
                  <>
                    <h2 id="new-form-heading" className="form-name-heading-visually-hidden">{savedFormName}</h2>
                    <Input
                      ref={formNameInputRef}
                      type="text"
                      aria-label="Form name"
                      value={draftFormName}
                      size={Math.min(Math.max(draftFormName.length, 8), 32)}
                      onChange={(event) => setDraftFormName(event.target.value)}
                      onBlur={handleSaveFormName}
                      onKeyDown={handleFormNameInputKeyDown}
                      className="form-name-input"
                    />
                  </>
                ) : (
                  <h2
                    ref={formNameDisplayRef}
                    id="new-form-heading"
                    className="form-name-display"
                    role="button"
                    tabIndex={0}
                    aria-label={`Form name: ${savedFormName}. Select to rename.`}
                    onClick={handleStartEditingFormName}
                    onDoubleClick={handleStartEditingFormName}
                    onKeyDown={handleFormNameKeyDown}
                  >
                    {savedFormName}
                  </h2>
                )}
              </div>
              <div className="new-form-content">
                {conversationMode === 'landing' ? (
                <section className="new-form-module" aria-labelledby="ai-heading">
                  <input
                    ref={formFileInputRef}
                    className="form-file-input"
                    type="file"
                    accept={SUPPORTED_FORM_FILE_TYPES}
                    aria-label="Select an existing form or supporting document"
                    onChange={handleFormFileSelection}
                  />
                  <div className="ai-identity" aria-label="EMIS-X AI">
                    <iconify-icon icon="ic:outline-auto-awesome" width="32" aria-hidden="true"></iconify-icon>
                    <span>EMIS-X AI</span>
                  </div>
                  <h3 id="ai-heading">What would you like to create?</h3>
                  <div className="prompt-composer">
                    {selectedFormFileName ? (
                      <div className="selected-form-file">
                        <iconify-icon icon="ic:outline-description" width="20" aria-hidden="true"></iconify-icon>
                        <span>{selectedFormFileName}</span>
                        <Button
                          type="button"
                          variant="mono"
                          className="remove-form-file-button"
                          aria-label={`Remove ${selectedFormFileName}`}
                          onClick={handleRemoveSelectedFormFile}
                        >
                          <iconify-icon icon="ic:outline-close" width="20" aria-hidden="true"></iconify-icon>
                        </Button>
                      </div>
                    ) : null}
                    <Textarea
                      aria-label="Explain the goal of your form"
                      placeholder={window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        ? PROMPT_PLACEHOLDERS[promptPlaceholderIndex]
                        : PROMPT_PLACEHOLDERS[promptPlaceholderIndex].slice(0, promptPlaceholderLength)}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      className="prompt-input"
                    />
                    <div className="composer-actions">
                      <div className="composer-actions-left">
                        <Button
                          type="button"
                          variant="mono"
                          className="composer-icon-button"
                          aria-label="Enter form goal using voice"
                          aria-pressed={isVoiceInputActive}
                          title={isVoiceInputActive ? 'Stop voice input' : 'Enter form goal using voice'}
                          onClick={handleVoiceInput}
                        >
                          <iconify-icon icon="ic:outline-mic-none" width="20" aria-hidden="true"></iconify-icon>
                        </Button>
                        <Button type="button" variant="mono" className="composer-icon-button" aria-label="Add supporting information" onClick={handleAddSupportingInformation}>
                          <iconify-icon icon="ic:outline-add" width="20" aria-hidden="true"></iconify-icon>
                        </Button>
                      </div>
                      <Button type="button" variant="filled" className="composer-send-button" aria-label="Create form from document and prompt" onClick={handleSend} disabled={!prompt.trim() || !selectedFormFile}>
                        <iconify-icon icon="ic:outline-arrow-forward" width="24" aria-hidden="true"></iconify-icon>
                      </Button>
                    </div>
                  </div>
                  <div className="new-form-module-divider"></div>
                  <Button.Group className="new-form-actions">
                    <Button type="button" variant="mono" onClick={handleUploadExistingForm}>Upload existing form</Button>
                    <Button type="button" variant="mono" onClick={handleStartFromScratch}>Start from scratch</Button>
                  </Button.Group>
                </section>
                ) : (
                  <section className="conversation-workspace" aria-label="Form creation conversation">
                    <article className="conversation-user-turn" aria-label="Your request">
                      {selectedFormFile ? (
                        <div className="conversation-attachment">
                          <iconify-icon icon="ic:outline-description" width="24" aria-hidden="true"></iconify-icon>
                          <div>
                            <strong>{selectedFormFile.name}</strong>
                            <span>Uploaded form · {selectedFormFile.type || 'Document'} · {Math.ceil(selectedFormFile.size / 1024)} KB</span>
                          </div>
                        </div>
                      ) : (
                        <p>{submittedPrompt}</p>
                      )}
                    </article>

                    <article className="conversation-assistant-turn" aria-label="EMIS-X AI response">
                      <div className="assistant-identity">
                        <iconify-icon icon="ic:outline-auto-awesome" width="20" aria-hidden="true"></iconify-icon>
                        <span>EMIS-X AI</span>
                      </div>
                      {conversationMode === 'processing' ? (
                        <div className="processing-response" role="status" aria-live="polite">
                          <iconify-icon icon="ic:outline-autorenew" width="20" aria-hidden="true"></iconify-icon>
                          <span>{SIMULATED_PROCESSING_STEPS[processingStepIndex]}</span>
                          <p>Simulated AI response for prototype demonstration</p>
                        </div>
                      ) : conversationMode === 'draft' ? (
                        <div className="draft-ready-response">
                          <h3 tabIndex={-1} ref={completedProposalHeadingRef}>Your starting draft is ready</h3>
                          <p>Review the sections, questions and answer types before publishing.</p>
                          <p>This draft uses a simulated AI response for prototype demonstration.</p>
                        </div>
                      ) : (
                        <div className="proposal-response">
                          <h3 tabIndex={-1} ref={completedProposalHeadingRef}>Suggested starting point</h3>
                          <p>We’ve organised the questions from your document into a starting structure. Review what you want to include. You can make further changes in the form builder.</p>
                          <p className="secondary-copy">Service options and service contact information have not been included because forms are assigned to services separately.</p>
                          <p className="selection-summary">{selectedSectionCount} sections selected · {selectedQuestionCount} questions selected</p>
                          <Accordion type="multiple" className="proposal-accordion">
                            {proposal.map((section) => {
                              const selectedInSection = section.questions.filter((question) => selectedQuestions[question.id]).length
                              const isSectionSelected = selectedInSection === section.questions.length
                              const isSectionIndeterminate = selectedInSection > 0 && !isSectionSelected

                              return (
                                <AccordionItem value={section.id} key={section.id} borderless>
                                  <div className="proposal-section-header">
                                    <Checkbox aria-label={`Select ${section.name}`} checked={isSectionSelected} indeterminate={isSectionIndeterminate} onChange={(isSelected) => handleSectionSelectionChange(section, isSelected)} />
                                    <AccordionHeader>
                                      <AccordionTrigger arrowSide="right">
                                        <span className="proposal-section-details">
                                          <span className="proposal-section-title">{section.name}</span>
                                          <span className="proposal-section-preview">{section.preview}</span>
                                        </span>
                                        <span className="proposal-section-count">{selectedInSection} selected</span>
                                      </AccordionTrigger>
                                    </AccordionHeader>
                                  </div>
                                  <AccordionContent>
                                    <div className="proposal-questions">
                                      {section.questions.map((question) => (
                                        <div className="proposal-question" key={question.id}>
                                          <Checkbox aria-label={`Include ${question.label}`} checked={selectedQuestions[question.id]} onChange={(isSelected) => handleQuestionSelectionChange(question.id, isSelected)} />
                                          <div>
                                            <span>{question.label}</span>
                                            <small>{question.answerType}</small>
                                            {question.patientRecordInfo ? <Tag color="--primary-95" textColor="--primary-45-base">May be available from the patient record</Tag> : null}
                                            {question.suggestedAddition ? <Tag color="--primary-95" textColor="--primary-45-base">Suggested addition</Tag> : null}
                                            {question.helpText ? <p>{question.helpText}</p> : null}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )
                            })}
                          </Accordion>
                          <Accordion type="single" collapsible className="excluded-content">
                            <AccordionItem value="content-not-included" borderless>
                              <AccordionHeader><AccordionTrigger arrowSide="right">Content not included</AccordionTrigger></AccordionHeader>
                              <AccordionContent><p>We excluded service choices, contact information and referral guidance because they do not need to become questions in this form.</p><ul><li>Service choices</li><li>Service contact information</li><li>Referral guidance</li></ul></AccordionContent>
                            </AccordionItem>
                          </Accordion>
                          {selectedQuestionCount === 0 ? <p className="selection-validation">Select at least one question to create a draft.</p> : null}
                          <div className="assistant-actions">
                            <Button type="button" variant="mono" onClick={handleBackToDocument}>Back to document</Button>
                            <Button type="button" variant="filled" onClick={handleCreateDraft} disabled={selectedQuestionCount === 0}>Create draft form</Button>
                          </div>
                          {followUpResponse ? <p className="follow-up-response" role="status">{followUpResponse}</p> : null}
                        </div>
                      )}
                    </article>

                    {conversationMode !== 'processing' && conversationMode !== 'draft' ? (
                      <div className="follow-up-composer">
                        <Button type="button" variant="mono" className="composer-icon-button" aria-label="Add supporting information" onClick={handleAddSupportingInformation}>
                          <iconify-icon icon="ic:outline-add" width="20" aria-hidden="true"></iconify-icon>
                        </Button>
                        <Textarea aria-label="Ask EMIS-X AI to update the suggested form" placeholder="Ask EMIS-X AI to update the suggested form" value={followUpPrompt} onChange={(event) => setFollowUpPrompt(event.target.value)} />
                        <Button type="button" variant="filled" className="composer-send-button" aria-label="Send follow-up request" disabled={!followUpPrompt.trim()} onClick={handleFollowUpSend}>
                          <iconify-icon icon="ic:outline-arrow-forward" width="24" aria-hidden="true"></iconify-icon>
                        </Button>
                      </div>
                    ) : null}
                    {generationError ? <p className="generation-error" role="alert">{generationError}</p> : null}
                  </section>
                )}
              </div>
            </section>
          ) : (
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="referral-tabs"
          >
            <Tabs.TabList className="tab-list">
              <Tabs.Tab value="published" className="tab">Published <span className="form-tab-count">6</span></Tabs.Tab>
              <Tabs.Tab value="drafts" className="tab">Drafts <span className="form-tab-count">3</span></Tabs.Tab>
              <Tabs.Tab value="archived" className="tab">Archived <span className="form-tab-count">3</span></Tabs.Tab>
            </Tabs.TabList>

            {/* Published Tab Content */}
            <Tabs.TabContent value="published">
              <FormsTable forms={publishedFormSummaries} status="published" searchQuery={formSearchQuery} onSearchChange={setFormSearchQuery} />
            </Tabs.TabContent>

            {/* Drafts Tab Content */}
            <Tabs.TabContent value="drafts">
              <FormsTable forms={draftFormSummaries} status="drafts" searchQuery={formSearchQuery} onSearchChange={setFormSearchQuery} />
            </Tabs.TabContent>

            {/* Archived Tab Content */}
            <Tabs.TabContent value="archived">
              <FormsTable forms={archivedFormSummaries} status="archived" searchQuery={formSearchQuery} onSearchChange={setFormSearchQuery} />
            </Tabs.TabContent>
          </Tabs>
          )}
        </main>
      </div>
    </div>
  )
}

export default ReferralForms
ReferralForms.displayName = 'ReferralForms'
