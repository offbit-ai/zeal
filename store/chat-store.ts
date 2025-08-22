import { create } from 'zustand'
import { ChatMessage } from '../lib/orchestrator/types'

interface ChatStore {
  // Chat messages grouped by workflow ID
  messages: Record<string, ChatMessage[]>
  
  // Current workflow being edited
  currentWorkflowId: string | null
  
  // GraphRAG status
  graphRAGError: string | null
  
  // Get messages for current workflow
  getMessages: () => ChatMessage[]
  
  // Add a message to current workflow
  addMessage: (message: ChatMessage) => void
  
  // Update a message in current workflow
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void
  
  // Set all messages for current workflow
  setMessages: (messages: ChatMessage[]) => void
  
  // Clear messages for current workflow
  clearMessages: () => void
  
  // Set current workflow
  setCurrentWorkflowId: (workflowId: string | null) => void
  
  // Set GraphRAG error
  setGraphRAGError: (error: string | null) => void
}

// Default welcome message for new conversations
const DEFAULT_MESSAGE: ChatMessage = {
  id: '1',
  role: 'assistant',
  content:
    'What would you like to build today? I can help you create workflows by understanding your needs and automatically adding the right nodes and connections.',
  timestamp: new Date(),
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  messages: {},
  currentWorkflowId: null,
  graphRAGError: null,
  
  getMessages: () => {
    const state = get()
    const key = state.currentWorkflowId || 'default'
    return state.messages[key] || []
  },
  
  addMessage: (message) => {
    const state = get()
    const key = state.currentWorkflowId || 'default'
    set(state => ({
      messages: {
        ...state.messages,
        [key]: [...(state.messages[key] || []), message]
      }
    }))
  },
  
  updateMessage: (messageId, updates) => {
    const state = get()
    const key = state.currentWorkflowId || 'default'
    set(state => ({
      messages: {
        ...state.messages,
        [key]: (state.messages[key] || []).map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        )
      }
    }))
  },
  
  setMessages: (messages) => {
    const state = get()
    const key = state.currentWorkflowId || 'default'
    set(state => ({
      messages: {
        ...state.messages,
        [key]: messages
      }
    }))
  },
  
  clearMessages: () => {
    const state = get()
    const key = state.currentWorkflowId || 'default'
    const defaultMsg = { ...DEFAULT_MESSAGE, timestamp: new Date() }
    set(state => ({
      messages: {
        ...state.messages,
        [key]: [defaultMsg]
      }
    }))
  },
  
  setCurrentWorkflowId: (workflowId) => {
    const previousKey = get().currentWorkflowId || 'default'
    const newKey = workflowId || 'default'
    
    // If transitioning from default to a real workflow ID, move the messages
    if (previousKey === 'default' && workflowId && previousKey !== newKey) {
      const state = get()
      const defaultMessages = state.messages['default'] || []
      if (defaultMessages.length > 0) {
        set(state => ({
          currentWorkflowId: workflowId,
          messages: {
            ...state.messages,
            [workflowId]: defaultMessages,
            'default': [] // Clear default messages
          }
        }))
        return
      }
    }
    
    set({ currentWorkflowId: workflowId })
  },
  
  setGraphRAGError: (error) => {
    set({ graphRAGError: error })
  },
}))