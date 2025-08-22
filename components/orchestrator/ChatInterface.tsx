'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { ChatMessage, AgentResponse, StreamingAgentResponse } from '../../lib/orchestrator/types'
// Use the new state machine agent
import OrchestratorAgentStateMachine from '../../lib/orchestrator/agent-state-machine'
import { initializeGraphRAGForOrchestrator } from '../../lib/orchestrator/initialize-graphrag'
import Markdown from 'react-markdown'
import { useChatStore } from '../../store/chat-store'


interface ChatInterfaceProps {
  workflowId: string | null
  onWorkflowCreated: (workflowId: string) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export default function ChatInterface({
  workflowId,
  onWorkflowCreated,
  isLoading,
  setIsLoading,
}: ChatInterfaceProps) {
  // Use Zustand store directly with proper selectors
  const currentWorkflowId = useChatStore(state => state.currentWorkflowId)
  const messages = useChatStore(state => {
    const key = state.currentWorkflowId || 'default'
    return (state.messages[key] || []) as ChatMessage[]
  })
  const addMessage = useChatStore(state => state.addMessage)
  const updateMessage = useChatStore(state => state.updateMessage)
  const setCurrentWorkflowId = useChatStore(state => state.setCurrentWorkflowId)
  const graphRAGError = useChatStore(state => state.graphRAGError)
  const setGraphRAGError = useChatStore(state => state.setGraphRAGError)
  
  const [input, setInput] = useState('')
  const [agent, setAgent] = useState<OrchestratorAgentStateMachine | null>(null)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const userHasScrolledRef = useRef(false)
  const lastMessageCountRef = useRef(messages.length)
  
  // Update current workflow ID in store and initialize messages
  useEffect(() => {
    setCurrentWorkflowId(workflowId)
    
    // Initialize with default message only once per workflow
    // Check the store directly to avoid dependency on messages
    const state = useChatStore.getState()
    const key = workflowId || 'default'
    const existingMessages = state.messages[key]
    
    if (!existingMessages || existingMessages.length === 0) {
      const defaultMsg: ChatMessage = {
        id: '1',
        role: 'assistant',
        content: 'What would you like to build today? I can help you create workflows by understanding your needs and automatically adding the right nodes and connections.',
        timestamp: new Date(),
      }
      state.addMessage(defaultMsg)
    }
  }, [workflowId, setCurrentWorkflowId])

  const scrollToBottom = (force = false) => {
    if ((!userHasScrolledRef.current || force) && messagesContainerRef.current) {
      // Use scrollTop to scroll within the container only
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  // Initialize GraphRAG and OrchestratorAgent
  useEffect(() => {
    const initializeAgent = async () => {
      try {
        // Always create the agent first
        const fallbackAgent = new OrchestratorAgentStateMachine()
        setAgent(fallbackAgent)
        
        // Then try to enhance it with GraphRAG
        try {
          const statusResponse = await fetch('/api/graphrag/initialize')
          if (!statusResponse.ok) {
            console.warn('⚠️ GraphRAG endpoint not available. Using fallback search.')
            setGraphRAGError('GraphRAG not available - using search')
            return
          }
          
          const status = await statusResponse.json()
          if (!status.initialized) {
            console.warn('⚠️ GraphRAG snapshot not found. Build the project first.')
            setGraphRAGError('GraphRAG not built - using search')
            return
          }
        } catch (error) {
          console.warn('⚠️ Failed to check GraphRAG status:', error)
          setGraphRAGError('GraphRAG check failed - using search')
          return
        }

        // Create backend LLM wrapper that calls our API
        const backendLLM = {
          invoke: async (prompt: string) => {
            console.log('[BackendLLM] Invoking with prompt length:', prompt.length)
            
            // Use the backend LLM API for all GraphRAG operations
            const response = await fetch('/api/orchestrator/llm', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              },
              body: JSON.stringify({ 
                messages: [
                  { role: 'system', content: 'You are a helpful assistant that analyzes workflows and selects appropriate nodes.' },
                  { role: 'user', content: prompt }
                ]
              }),
            })

            if (!response.ok) {
              const errorText = await response.text()
              console.error('LLM API error:', response.status, response.statusText, errorText)
              
              // Try to parse error
              try {
                const errorData = JSON.parse(errorText)
                if (errorData.error === 'OpenRouter API key not configured') {
                  console.error('❌ OpenRouter API key is not configured. Please set OPENROUTER_API_KEY environment variable.')
                  // Return empty array as fallback for GraphRAG
                  return '[]'
                }
              } catch (e) {
                // Ignore parse error
              }
              
              throw new Error(`Failed to invoke LLM: ${response.statusText}`)
            }

            const data = await response.json()
            console.log('[BackendLLM] Response received, content length:', data.content?.length)
            return data.content
          },
        }

        // Create minimal embedding service for client-side
        const clientEmbeddings = {
          embedQuery: async (text: string) => {
            // Client doesn't need real embeddings - GraphRAG snapshot has them
            return Array(1536).fill(0)
          },
        }

        // Initialize GraphRAG with backend services
        let graphRAG = null
        try {
          graphRAG = await initializeGraphRAGForOrchestrator(backendLLM, clientEmbeddings)
          console.log('✅ GraphRAG initialized successfully')
          // Create agent with GraphRAG
          const orchestratorAgent = new OrchestratorAgentStateMachine({ graphRAG })
          setAgent(orchestratorAgent)
        } catch (error) {
          console.warn('⚠️ GraphRAG initialization failed:', error)
          setGraphRAGError('GraphRAG unavailable - using traditional search')
          // Agent was already set as fallback, no need to create another
        }
      } catch (error) {
        console.error('Failed to initialize OrchestratorAgent:', error)
        // Ensure we always have an agent
        if (!agent) {
          setAgent(new OrchestratorAgentStateMachine())
        }
      }
    }

    initializeAgent()
  }, [])

  // Handle scroll events to detect if user has scrolled up
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50
      userHasScrolledRef.current = !isAtBottom
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to bottom on new messages, but respect user scroll position
  useEffect(() => {
    // Only scroll if messages were added (not just updated)
    if (messages.length > lastMessageCountRef.current) {
      scrollToBottom()
      lastMessageCountRef.current = messages.length
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !agent) return

    const userMessageContent = input.trim()
    const userMessageId = `user-${Date.now()}`
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    }

    addMessage(userMessage)
    setInput('')
    setIsLoading(true)
    // Force scroll to bottom when user sends a message
    scrollToBottom(true)

    try {
      // Get existing nodes and connections for context
      const existingNodes = workflowId ? [] : undefined // TODO: fetch if needed
      const existingConnections = workflowId ? [] : undefined
      // Get chat history including the new user message
      const chatHistory = [...messages.filter(m => m.role !== 'system'), userMessage]

      // Create initial assistant message with unique ID
      const assistantMessageId = `assistant-${Date.now()}`
      setStreamingMessageId(assistantMessageId)

      const initialMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }
      addMessage(initialMessage)

      // Process with streaming - use the saved user message content
      const stream = agent.processMessageStream(userMessageContent, workflowId, {
        existingNodes,
        existingConnections,
        chatHistory,
      })

      let finalWorkflowId: string | null = workflowId
      let accumulatedContent = ''
      let actionCount = 0

      for await (const response of stream) {
        console.log('[ChatInterface] Received streaming response:', response.type, response.content?.substring(0, 100))
        
        switch (response.type) {
          case 'status':
            // Update the streaming message with status
            console.log('[ChatInterface] Updating status message:', response.content)
            updateMessage(assistantMessageId, {
              content: response.content || ''
            })
            break

          case 'message':
            // Accumulate content
            if (response.content) {
              accumulatedContent += (accumulatedContent ? '\n' : '') + response.content
              console.log('[ChatInterface] Updating message, accumulated length:', accumulatedContent.length)
              // Update message directly
              updateMessage(assistantMessageId, {
                content: accumulatedContent
              })
            }
            if (response.workflowId && !workflowId) {
              // Immediately trigger workflow creation when we get the ID
              finalWorkflowId = response.workflowId
              onWorkflowCreated(response.workflowId)
            }
            break

          case 'action':
            actionCount++
            // Optionally show action in UI
            break

          case 'complete':
            // Final update with metadata
            if (response.workflowId && !finalWorkflowId) {
              finalWorkflowId = response.workflowId
            }
            updateMessage(assistantMessageId, {
              content: accumulatedContent || 'Workflow updated successfully.',
              metadata: response.metadata,
            })
            break

          case 'error':
            updateMessage(assistantMessageId, {
              content: response.content || 'An error occurred.'
            })
            
            // Show toast notification if requested
            if (response.metadata?.showToast) {
              // Create and show toast
              const toastMessage = response.metadata.details 
                ? `${response.content}\n${response.metadata.details}`
                : response.content
              
              // Simple toast implementation - you can replace with a proper toast library
              const toast = document.createElement('div')
              toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md'
              toast.innerHTML = `
                <div class="flex items-start">
                  <svg class="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                  </svg>
                  <div>
                    <div class="font-medium">${response.content}</div>
                    ${response.metadata.details ? `<div class="text-sm mt-1 opacity-90">${response.metadata.details}</div>` : ''}
                  </div>
                </div>
              `
              document.body.appendChild(toast)
              
              // Auto-remove after 5 seconds
              setTimeout(() => {
                toast.style.transition = 'opacity 0.3s'
                toast.style.opacity = '0'
                setTimeout(() => document.body.removeChild(toast), 300)
              }, 5000)
            }
            break

          case 'question':
            // Handle interactive questions
            if (response.questions && response.questions.length > 0) {
              const questionContent = response.content + '\n\n' + 
                response.questions.map((q: any) => `**${q.question}**`).join('\n\n')
              
              accumulatedContent = questionContent
              updateMessage(assistantMessageId, {
                content: questionContent,
                metadata: { 
                  pendingQuestions: response.questions,
                  requiresInput: true 
                }
              })
              
              // Store workflow ID for context
              if (response.workflowId) {
                finalWorkflowId = response.workflowId
              }
            }
            break

          case 'crdt_sync_required':
            // Force a CRDT sync by triggering a manual poll
            // This ensures connections are visible immediately
            if (response.metadata?.connectionCount > 0) {
              // Send a message to the embed view to trigger CRDT poll
              const embedFrame = document.querySelector('iframe') as HTMLIFrameElement
              if (embedFrame && embedFrame.contentWindow) {
                embedFrame.contentWindow.postMessage(
                  { type: 'force-crdt-sync', workflowId: finalWorkflowId || workflowId },
                  '*'
                )
              }
            }
            break

          case 'workflow_ready':
            // Workflow is fully configured and ready
            accumulatedContent = response.content || 'Workflow is ready!'
            const currentMsg = messages.find(m => m.id === assistantMessageId)
            updateMessage(assistantMessageId, {
              content: accumulatedContent,
              metadata: { ...currentMsg?.metadata, workflowReady: true }
            })
            break
        }
      }

      // Workflow creation is now handled immediately when we receive the ID

      // Show action summary if any actions were performed
      if (actionCount > 0) {
        const actionMessage: ChatMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
          content: `Performed ${actionCount} action${actionCount > 1 ? 's' : ''}`,
          timestamp: new Date(),
        }
        addMessage(actionMessage)
      }
    } catch (error) {
      console.error('Error processing message:', error)

      // Update streaming message with error or add new error message
      if (streamingMessageId) {
        updateMessage(streamingMessageId, {
          content: 'I encountered an error while processing your request. Please try again.',
        })
      } else {
        const errorMessage: ChatMessage = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'I encountered an error while processing your request. Please try again.',
          timestamp: new Date(),
        }
        addMessage(errorMessage)
      }
    } finally {
      setStreamingMessageId(null)
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map(message => (
          <div
            key={message.id}
            className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-4 py-2',
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'system'
                    ? 'bg-gray-100 text-gray-600 text-sm italic'
                    : 'bg-gray-100 text-gray-900'
              )}
            >
              <Markdown>{message.content}</Markdown>
              {message.metadata && (
                <div className="mt-2 text-xs opacity-75">
                  {message.metadata.nodeCount && (
                    <span>Added {message.metadata.nodeCount} nodes</span>
                  )}
                  {message.metadata.connectionCount && (
                    <span className="ml-2">
                      Created {message.metadata.connectionCount} connections
                    </span>
                  )}
                </div>
              )}
              <div
                className={cn(
                  'text-xs mt-1',
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                )}
              >
                {message.timestamp instanceof Date 
                  ? message.timestamp.toLocaleTimeString()
                  : new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 p-4 flex flex-col bg-white"
      >
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              !input.trim() || isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            Send
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {graphRAGError && <span className="text-amber-600">⚠️ {graphRAGError}</span>}
          {!graphRAGError && agent && <span className="text-green-600">✅ GraphRAG enabled</span>}
        </div>
      </form>
    </div>
  )
}