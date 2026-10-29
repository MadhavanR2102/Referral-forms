import axios from 'axios'

export interface ProposalQuestion {
  id: string
  label: string
  answerType: string
  helpText?: string
  patientRecordInfo?: boolean
  suggestedAddition?: boolean
}

export interface ProposalSection {
  id: string
  name: string
  preview: string
  questions: ProposalQuestion[]
}

interface FormProposalResponse {
  sections: ProposalSection[]
}

export const generateFormProposal = async (prompt: string, documentText: string, fileName?: string): Promise<ProposalSection[]> => {
  const response = await axios.post<FormProposalResponse>('/api/form-proposals', { prompt, documentText, fileName }, { timeout: 60_000 })

  if (!Array.isArray(response.data.sections) || response.data.sections.length === 0) {
    throw new Error('The AI response did not contain any form sections')
  }

  return response.data.sections
}

export const updateFormProposal = async (prompt: string, documentText: string, followUp: string, proposal: ProposalSection[], fileName?: string): Promise<ProposalSection[]> => {
  const response = await axios.post<FormProposalResponse>('/api/form-proposals', { prompt, documentText, followUp, proposal, fileName }, { timeout: 60_000 })

  if (!Array.isArray(response.data.sections) || response.data.sections.length === 0) {
    throw new Error('The AI response did not contain any form sections')
  }

  return response.data.sections
}