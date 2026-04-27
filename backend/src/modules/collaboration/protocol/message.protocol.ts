export enum MessageType {
  Sync = 0,
  Awareness = 1,
}

export class MessageProtocol {
  static encode(type: MessageType, payload: Uint8Array): Uint8Array {
    const body = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    const length = body.byteLength;
    const message = new Uint8Array(1 + 4 + length);
    const view = new DataView(message.buffer);

    message[0] = type;
    view.setUint32(1, length, false);
    message.set(body, 5);

    return message;
  }

  static decode(message: Uint8Array): {
    type: MessageType;
    payload: Uint8Array;
  } {
    if (!(message instanceof Uint8Array) || message.byteLength < 5) {
      throw new Error('Invalid message');
    }

    const view = new DataView(
      message.buffer,
      message.byteOffset,
      message.byteLength,
    );
    const type = view.getUint8(0) as MessageType;
    const payloadLength = view.getUint32(1, false);

    if (message.byteLength !== 5 + payloadLength) {
      throw new Error('Invalid payload length');
    }

    const payload = message.slice(5);

    return { type, payload };
  }
}
