import react from '@vitejs/plugin-react'
import axios from 'axios'
import { defineConfig } from 'vite'

const jsonResponse = (response: import('node:http').ServerResponse, status: number, body: unknown) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

const readRequestBody = async (request: import('node:http').IncomingMessage) => {
  let body = ''

  for await (const chunk of request) {
    body += chunk

    if (body.length > 100_000) {
      throw new Error('Request body is too large')
    }
  }

  return JSON.parse(body || '{}') as { prompt?: string; fileName?: string; documentText?: string; proposal?: unknown; followUp?: string }
}

const createProposalFromProvider = async (prompt: string, documentText: string, fileName?: string, followUp?: string, proposal?: unknown) => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('AI provider is not configured. Set OPENAI_API_KEY in .env.local and restart the dev server.')
  }

  const endpoint = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1/chat/completions'
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
  const response = await axios.post(endpoint, {
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Analyse the supplied document and user request. Return JSON only with a sections array. Each section must have id, name, preview and questions. Each question must have id, label and answerType. Optional question fields are helpText, patientRecordInfo and suggestedAddition. Do not invent content unrelated to the document. Use synthetic, non-identifying content only.',
        },
        { role: 'user', content: `Document filename: ${fileName ?? 'not supplied'}\nDocument text:\n${documentText}\n\nUser request:\n${prompt}${followUp ? `\n\nFollow-up request:\n${followUp}\n\nCurrent proposal:\n${JSON.stringify(proposal)}` : ''}` },
      ],
    }, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 60_000 })

  const result = response.data as { choices?: Array<{ message?: { content?: string } }> }
  const content = result.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('AI provider returned an empty response')
  }

  return JSON.parse(content)
}

const aiProxyPlugin = () => ({
  name: 'synthetic-ai-proxy',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/api/form-proposals', async (request, response) => {
      if (request.method !== 'POST') {
        jsonResponse(response, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const { prompt = '', documentText = '', fileName, followUp, proposal } = await readRequestBody(request)
        if (!documentText.trim()) {
          jsonResponse(response, 400, { error: 'The uploaded document text is missing or could not be extracted.' })
          return
        }
        const generatedProposal = await createProposalFromProvider(prompt, documentText, fileName, followUp, proposal)
        jsonResponse(response, 200, generatedProposal)
      } catch (error) {
        const message = axios.isAxiosError(error) ? 'The AI provider could not generate a response.' : error instanceof Error ? error.message : 'Unable to generate a form proposal'
        jsonResponse(response, axios.isAxiosError(error) ? 502 : 500, { error: message })
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), aiProxyPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
})
