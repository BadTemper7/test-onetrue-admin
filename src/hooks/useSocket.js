import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { SOCKET_URL } from "../lib/api"

const realtimeEvents = [
  "socket:connected",
  "client:registered",
  "client:approved",
  "client:rejected",
  "account:updated",
  "admin:user_created",
  "admin:user_updated",
  "admin:user_deleted",
  "billing_rate:created",
  "billing_rate:updated",
  "billing_rate:deleted",
  "billing_rate:reference_applied",
  "yard:area_created",
  "yard:area_updated",
  "yard:area_deleted",
  "yard:block_created",
  "yard:block_updated",
  "yard:block_deleted",
  "yard:slot_reserved",
  "yard:slot_released",
  "yard:slot_relocated",
  "inventory:block_created",
  "inventory:block_updated",
  "inventory:block_deleted",
  "inventory:container_assigned",
  "inventory:container_created",
  "inventory:updated",
  "storage:updated",
  "preAdvice:submitted",
  "preAdvice:confirmed",
  "preAdvice:rejected",
  "gateIn:completed",
  "booking:submitted",
  "booking:resubmitted",
  "booking:approved",
  "booking:rejected",
  "booking:gate_in_approved",
  "booking:stored",
  "booking:billing_operation_updated",
  "booking:payment_submitted",
  "booking:payment_approved",
  "booking:payment_rejected",
  "booking:gate_out_requested",
  "booking:gate_out_approved",
  "booking:completed",
  "booking:relocated",
]

export const useSocket = ({ token, enabled = true }) => {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (!enabled || !token) return undefined

    // WebSocket-only prevents service workers/Workbox and load balancers from
    // caching or splitting the multi-request Socket.IO polling handshake.
    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket"],
      upgrade: false,
      rememberUpgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 15000,
    })

    const handleConnect = () => setConnected(true)
    const handleDisconnect = () => setConnected(false)
    const handleConnectError = (error) => {
      setConnected(false)
      console.warn("Realtime connection unavailable:", error?.message || error)
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connect_error", handleConnectError)

    const handlers = realtimeEvents.map((eventName) => {
      const handler = (payload) => {
        const eventItem = { type: eventName, payload, time: new Date().toISOString() }
        setEvents((prev) => [eventItem, ...prev.slice(0, 19)])

        window.dispatchEvent(
          new CustomEvent("otli:realtime", {
            detail: eventItem,
          })
        )
      }

      socket.on(eventName, handler)
      return [eventName, handler]
    })

    return () => {
      handlers.forEach(([eventName, handler]) => socket.off(eventName, handler))
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connect_error", handleConnectError)
      socket.disconnect()
    }
  }, [enabled, token])

  return { connected, events }
}
