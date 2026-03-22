// test-client.js
const WebSocket = require('ws');
const Y = require('yjs');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

const MessageType = {
  Sync: 0,
  Awareness: 1
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

const ws = new WebSocket('ws://localhost:4000/collab?room=test-room');

const doc = new Y.Doc();
const text = doc.getText('shared');

ws.on('open', () => {
  console.log('connected');

  doc.on('update', (update) => {
    ws.send(encode(MessageType.Sync, update));
  });

  setTimeout(() => {
    text.insert(0, 'Hello ');
  }, 1000);
});

ws.on('message', (data) => {
  const { type, payload } = decode(new Uint8Array(data));

  if (type === MessageType.Sync) {
    Y.applyUpdate(doc, payload);
    console.log('doc content:', text.toString());
  }
});