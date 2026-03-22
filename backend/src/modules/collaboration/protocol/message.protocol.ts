// protocol/message.protocol.ts
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

export enum MessageType {
  Sync = 0,
  Awareness = 1,
}

export class MessageProtocol {
  static encode(type: MessageType, payload: Uint8Array): Uint8Array {
    const encoder = encoding.createEncoder();

    encoding.writeUint8(encoder, type);
    encoding.writeVarUint8Array(encoder, payload);

    return encoding.toUint8Array(encoder);
  }

  static decode(message: Uint8Array): {
    type: MessageType;
    payload: Uint8Array;
  } {
    const decoder = decoding.createDecoder(message);

    const type = decoding.readUint8(decoder);
    const payload = decoding.readVarUint8Array(decoder);

    return { type, payload };
  }
}