/**
 * Example WebSocket Server for CRDT Synchronization
 * 
 * This is a reference implementation for a Y.js WebSocket server
 * that can be used for development and testing. For production,
 * use a more robust implementation with proper authentication,
 * persistence, and scaling.
 * 
 * To run: npx ts-node lib/crdt/server-example.ts
 */

import WebSocket from 'ws'
import http from 'http'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'

const PORT = process.env.CRDT_WS_PORT || 4444

/**
 * Message types matching the client
 */
enum MessageType {
  SYNC = 0,
  AWARENESS = 1,
  AUTH = 2,
  QUERY_AWARENESS = 3,
  CUSTOM = 4
}

/**
 * Room management
 */
class Room {
  name: string
  doc: Y.Doc
  awareness: Map<WebSocket, number> = new Map()
  clients: Set<WebSocket> = new Set()
  
  constructor(name: string) {
    this.name = name
    this.doc = new Y.Doc({ guid: name })
  }
  
  /**
   * Add client to room
   */
  addClient(ws: WebSocket): void {
    this.clients.add(ws)
    
    // Send sync step 1
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MessageType.SYNC)
    syncProtocol.writeSyncStep1(encoder, this.doc)
    send(ws, encoding.toUint8Array(encoder))
  }
  
  /**
   * Remove client from room
   */
  removeClient(ws: WebSocket): void {
    const clientId = this.awareness.get(ws)
    if (clientId !== undefined) {
      this.awareness.delete(ws)
      
      // Notify other clients about disconnection
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MessageType.AWARENESS)
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.removeAwarenessStates(
          new awarenessProtocol.Awareness(this.doc),
          [clientId],
          'disconnect'
        )
      )
      
      this.broadcast(encoding.toUint8Array(encoder), ws)
    }
    
    this.clients.delete(ws)
  }
  
  /**
   * Broadcast message to all clients except sender
   */
  broadcast(message: Uint8Array, sender?: WebSocket): void {
    this.clients.forEach(client => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }
}

/**
 * Room management
 */
const rooms = new Map<string, Room>()

/**
 * Get or create room
 */
function getRoom(name: string): Room {
  let room = rooms.get(name)
  if (!room) {
    room = new Room(name)
    rooms.set(name, room)
    // console.log removed
  }
  return room
}

/**
 * Send message to client
 */
function send(ws: WebSocket, message: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message)
  }
}

/**
 * Handle client message
 */
function handleMessage(
  ws: WebSocket,
  room: Room,
  message: Uint8Array
): void {
  try {
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    
    switch (messageType) {
      case MessageType.SYNC:
        handleSync(ws, room, decoder)
        break
        
      case MessageType.AWARENESS:
        handleAwareness(ws, room, decoder)
        break
        
      case MessageType.AUTH:
        handleAuth(ws, room, decoder)
        break
        
      case MessageType.QUERY_AWARENESS:
        handleQueryAwareness(ws, room)
        break
        
      case MessageType.CUSTOM:
        handleCustom(ws, room, decoder)
        break
    }
  } catch (error) {
    console.error('Error handling message:', error)
  }
}

/**
 * Handle sync messages
 */
function handleSync(
  ws: WebSocket,
  room: Room,
  decoder: decoding.Decoder
): void {
  const encoder = encoding.createEncoder()
  const messageType = syncProtocol.readSyncMessage(
    decoder,
    encoder,
    room.doc,
    null
  )
  
  // Send sync response to sender
  if (encoding.length(encoder) > 0) {
    send(ws, encoding.toUint8Array(encoder))
  }
  
  // Broadcast update to other clients
  if (messageType === syncProtocol.messageYjsUpdate) {
    const updateEncoder = encoding.createEncoder()
    encoding.writeVarUint(updateEncoder, MessageType.SYNC)
    encoding.writeUint8Array(updateEncoder, message)
    room.broadcast(encoding.toUint8Array(updateEncoder), ws)
  }
}

/**
 * Handle awareness messages
 */
function handleAwareness(
  ws: WebSocket,
  room: Room,
  decoder: decoding.Decoder
): void {
  const update = decoding.readVarUint8Array(decoder)
  
  // Forward awareness update to all other clients
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MessageType.AWARENESS)
  encoding.writeVarUint8Array(encoder, update)
  room.broadcast(encoding.toUint8Array(encoder), ws)
}

/**
 * Handle auth messages
 */
function handleAuth(
  ws: WebSocket,
  room: Room,
  decoder: decoding.Decoder
): void {
  const authData = decoding.readVarString(decoder)
  
  try {
    const auth = JSON.parse(authData)
    // console.log removed
    
    // In production, validate auth token here
    // For now, just accept all connections
    
    // Store client ID for awareness
    room.awareness.set(ws, parseInt(auth.userId) || Math.random() * 1000000)
  } catch (error) {
    console.error('Invalid auth data:', error)
  }
}

/**
 * Handle awareness query
 */
function handleQueryAwareness(ws: WebSocket, room: Room): void {
  // Send all awareness states to the requesting client
  const states: number[] = []
  room.awareness.forEach((clientId) => {
    states.push(clientId)
  })
  
  if (states.length > 0) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MessageType.AWARENESS)
    // In a real implementation, we'd send actual awareness states
    // For now, just acknowledge the query
    encoding.writeVarUint8Array(encoder, new Uint8Array())
    send(ws, encoding.toUint8Array(encoder))
  }
}

/**
 * Handle custom messages
 */
function handleCustom(
  ws: WebSocket,
  room: Room,
  decoder: decoding.Decoder
): void {
  const customData = decoding.readVarString(decoder)
  
  // Forward custom message to all other clients
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MessageType.CUSTOM)
  encoding.writeVarString(encoder, customData)
  room.broadcast(encoding.toUint8Array(encoder), ws)
}

/**
 * Create HTTP server
 */
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      rooms: Array.from(rooms.keys()),
      roomCount: rooms.size
    }))
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

/**
 * Create WebSocket server
 */
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws: WebSocket, req) => {
  // Parse room name from URL
  const url = new URL(req.url!, `http://localhost:${PORT}`)
  const roomName = url.searchParams.get('room') || 'default'
  
  // console.log removed
  
  // Get or create room
  const room = getRoom(roomName)
  room.addClient(ws)
  
  // Handle messages
  ws.on('message', (data: WebSocket.Data) => {
    if (data instanceof ArrayBuffer) {
      handleMessage(ws, room, new Uint8Array(data))
    } else if (data instanceof Buffer) {
      handleMessage(ws, room, new Uint8Array(data))
    }
  })
  
  // Handle close
  ws.on('close', () => {
    // console.log removed
    room.removeClient(ws)
    
    // Clean up empty rooms
    if (room.clients.size === 0) {
      rooms.delete(roomName)
      // console.log removed
    }
  })
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
})

/**
 * Start server
 */
server.listen(PORT, () => {
  // console.log removed
  // console.log removed
  // console.log removed
})

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  // console.log removed
  
  wss.clients.forEach(ws => {
    ws.close()
  })
  
  server.close(() => {
    // console.log removed
    process.exit(0)
  })
})