import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { CollaborationGateway } from './collaboration.gateway';
import { MessageProtocol, MessageType } from '../protocol/message.protocol';
import { RoomService } from '../services/room.service';

describe('CollaborationGateway', () => {
  it('wraps initial sync in MessageProtocol', async () => {
    const doc = new Y.Doc();
    const room = {
      name: 'test-room',
      doc,
      awareness: new Awareness(doc),
      connections: new Set(),
      createdAt: new Date(),
    };

    const roomService = {
      getOrCreate: jest.fn().mockResolvedValue(room),
    } as unknown as RoomService;

    const gateway = new CollaborationGateway(roomService);

    const client = {
      send: jest.fn(),
      on: jest.fn(),
    } as any;

    await gateway.handleConnection(client, {
      url: '/collab?room=test-room',
    } as any);

    const expectedState = Y.encodeStateAsUpdate(doc);
    const expectedMessage = MessageProtocol.encode(
      MessageType.Sync,
      expectedState,
    );

    expect(client.send).toHaveBeenCalled();
    expect(client.send.mock.calls[0][0]).toEqual(expectedMessage);

    room.awareness.destroy();
  });
});
