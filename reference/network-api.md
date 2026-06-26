# Network Module API

## Overview

The `network` module provides the communication infrastructure for distributed personality instances in the Sirius Pulse ecosystem. It implements a client-server architecture where assistant instances connect to a central butler server, exchange messages, synchronize data, and manage connection state. The module is composed of several distinct components, each handling a specific aspect of network communication.

## Components

### Assistant Client (`assistant_client.py`)

The assistant client establishes and maintains a persistent WebSocket connection to a butler server. It implements the client-side of the protocol defined in `protocol.py`.

**Key responsibilities:**
- Connect to butler server using provided `ws://` URL.
- Send heartbeat signals at regular intervals.
- Deserialize incoming messages and dispatch them to registered handlers.
- Handle reconnection logic on network failure.
- Manage authentication and session tokens.

**Primary class:** `AssistantClient`

### Butler Server (`butler_server.py`)

The butler server acts as a central hub that accepts connections from multiple assistant clients. It maintains a registry of connected assistants and routes messages between them or to external services.

**Key responsibilities:**
- Listen on a configurable port for incoming WebSocket connections.
- Authenticate incoming assistant instances.
- Forward messages (e.g., text, data, control signals) to the appropriate destination.
- Broadcast system events to all connected assistants.
- Monitor client liveness and clean up stale connections.

**Primary class:** `ButlerServer`

### Data Sync API (`data_sync_api.py`)

The data sync API provides RESTful endpoints for synchronizing persistent state between the butler server and distributed assistants. It exposes CRUD operations on shared data collections.

**Endpoints (expected):**
- `GET /sync/{collection}` – retrieve all entries in a collection.
- `POST /sync/{collection}` – create a new entry.
- `PUT /sync/{collection}/{id}` – update an existing entry.
- `DELETE /sync/{collection}/{id}` – delete an entry.

**Primary class:** `DataSyncAPI`

### Protocol (`protocol.py`)

The protocol layer defines the wire format and message types used by all network communication. It includes serialization/deserialization utilities and a message schema.

**Message types (examples):**
- `HEARTBEAT` – keep-alive signal.
- `MESSAGE` – textual or structured chat message.
- `COMMAND` – remote procedure call instruction.
- `SYNC_REQUEST` / `SYNC_RESPONSE` – data synchronization.
- `ERROR` – error notification.

**Primary functions:** `encode_message`, `decode_message`, `create_message`

### Remote Bridge (`remote_bridge.py`)

The remote bridge enables inter-process communication between the local application and remote services (e.g., AI model endpoints). It manages connection lifecycle and request/response mapping.

**Key responsibilities:**
- Establish outbound connections to remote services.
- Translate local API calls into network requests.
- Handle timeouts, retries, and error propagation.
- Cache responses where appropriate.

**Primary class:** `RemoteBridge`

### Write Buffer (`write_buffer.py`)

The write buffer provides a thread-safe, asynchronous buffer for batched message writes. It accumulates outgoing messages and flushes them either on a timer or when a threshold is reached, reducing network overhead.

**Key features:**
- Configurable flush interval and batch size.
- Automatic reconnection on socket failure.
- Support for priority queues (urgent messages flushed immediately).
- Back-pressure handling to prevent memory overflow.

**Primary class:** `WriteBuffer`

## Usage Examples

### Starting the Butler Server
```python
from sirius_pulse.network.butler_server import ButlerServer

server = ButlerServer(host="0.0.0.0", port=8765)
server.start()
```

### Connecting an Assistant Client
```python
from sirius_pulse.network.assistant_client import AssistantClient

client = AssistantClient(url="ws://localhost:8765/ws")
client.connect()
client.send_message({"type": "MESSAGE", "content": "Hello!"})
```

### Synchronizing Data
```python
from sirius_pulse.network.data_sync_api import DataSyncAPI

api = DataSyncAPI(base_url="http://localhost:8765/sync")
entries = api.get("memories")
api.create("memories", {"text": "New memory", "timestamp": ...})
```

### Using Write Buffer
```python
from sirius_pulse.network.write_buffer import WriteBuffer

buffer = WriteBuffer(socket, flush_interval=1.0, batch_size=10)
buffer.enqueue("message1")
buffer.enqueue("message2")
# Buffer automatically flushes after 1 second or when 10 messages are queued.
```

## Integration Notes

- All network components are designed to work asynchronously. Use `asyncio` or threading accordingly.
- The module depends on `sirius_pulse.network.protocol` for message serialization.
- Environment variables can be used to override defaults (e.g., `BUTLER_HOST`, `BUTLER_PORT`, `ASSISTANT_URL`).
- Logging is handled via the standard `logging` module; configure `sirius_pulse.network` logger to see debug output.