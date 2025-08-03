import type { NextApiResponse } from 'next'
import type { Server as HTTPServer } from 'http'
import type { Socket as NetSocket } from 'net'
import type { Server as SocketIOServer } from 'socket.io'

interface SocketServer extends HTTPServer {
  io?: SocketIOServer
}

interface SocketWithIO extends NetSocket {
  server: SocketServer
}

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: SocketWithIO
}