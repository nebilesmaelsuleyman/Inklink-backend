const WebSocket = require('ws');
const Y = require('yjs');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

const MessageType = {
  Sync: 0,
  Awareness: 1,
};

function encode(type, payload) {
  const encoder = encoding.createEncoder();
  encoding.writeUint8(encoder, type);
  encoding.writeVarUint8Array(encoder, payload);
  return encoding.toUint8Array(encoder);
}

function decode(message) {
  const decoder = decoding.createDecoder(message);
  const type = decoding.readUint8(decoder);
  const payload = decoding.readVarUint8Array(decoder);
  return { type, payload };
}

function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'string') return new TextEncoder().encode(data);
  return new Uint8Array(data);
}

const ws = new WebSocket('ws://localhost:4000/collab?room=test-room');

const doc = new Y.Doc();
const text = doc.getText('shared');

const clientId = process.argv[2] || `client-${Math.random().toString(16).slice(2, 8)}`;
const shouldWrite = process.argv.includes('--write');

ws.on('open', () => {
  console.log(`[${clientId}] connected`);

  // Send local updates ONLY
  doc.on('update', (update, origin) => {
    if (origin === 'remote') return;
    console.log(`[${clientId}] sending update len=${update.length}`);
    ws.send(encode(MessageType.Sync, update));
  });

  if (shouldWrite) {
    setTimeout(() => {
      text.insert(0, 'Hello ');
      console.log(`[${clientId}] local insert -> "${text.toString()}"`);
    }, 1000);
  } else {
    console.log(`[${clientId}] read-only (no local insert)`);
  }
});

ws.on('message', (data, isBinary) => {
  if (!isBinary) {
    const asText = typeof data === 'string' ? data : data.toString();
    console.log('received non-binary message:', asText);
    return;
  }

  const message = toUint8Array(data);

  let decoded;
  try {
    decoded = decode(message);
  } catch (err) {
    // Backwards compatibility: some servers may still send raw Yjs updates.
    try {
      Y.applyUpdate(doc, message, 'remote');
      console.log(`[${clientId}] applied raw update; doc="${text.toString()}"`);
      return;
    } catch {
      console.warn('decode failed, ignoring message');
      return;
    }
    return;
  }

  const { type, payload } = decoded;

  if (type === MessageType.Sync) {
    Y.applyUpdate(doc, payload, 'remote');

    console.log(`[${clientId}] remote update applied; doc="${text.toString()}"`);
  }
});
