/**
 * Tests for ChatChannelManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatChannelManager } from '../src/js/chat-channel-manager.js';

// Mock AMQP connection
const mockAmqpConnection = {
  getChannel: vi.fn(() => ({
    exchangeDeclare: vi.fn(),
    queueDeclare: vi.fn(),
    queueBind: vi.fn(),
    consume: vi.fn(() => ({ consumerTag: 'test-consumer' })),
    publish: vi.fn(),
    cancel: vi.fn(),
  })),
};

describe('ChatChannelManager', () => {
  let channelManager;

  beforeEach(() => {
    channelManager = new ChatChannelManager(mockAmqpConnection);
    vi.clearAllMocks();
  });

  describe('createChannel', () => {
    it('should create a new channel successfully', async () => {
      const channelName = 'test-channel';
      const channelInfo = await channelManager.createChannel(channelName);

      expect(channelInfo).toEqual({
        name: channelName,
        streamName: `chat.${channelName}`,
        exchangeName: `chat-exchange-${channelName}`,
        queueName: `chat-stream-${channelName}`,
        consumer: null,
      });

      expect(channelManager.channels.has(channelName)).toBe(true);
    });

    it('should return existing channel if already created', async () => {
      const channelName = 'existing-channel';
      const firstCall = await channelManager.createChannel(channelName);
      const secondCall = await channelManager.createChannel(channelName);

      expect(firstCall).toBe(secondCall);
    });

    it('should throw error if AMQP connection not available', async () => {
      const mockConnectionWithoutChannel = {
        getChannel: vi.fn(() => null),
      };
      const manager = new ChatChannelManager(mockConnectionWithoutChannel);

      await expect(manager.createChannel('test')).rejects.toThrow(
        'AMQP connection not available'
      );
    });
  });

  describe('generateMessageId', () => {
    it('should generate unique message IDs', () => {
      const id1 = channelManager.generateMessageId();
      const id2 = channelManager.generateMessageId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]{9}$/);
    });
  });

  describe('sendMessage', () => {
    it('should send a message to the correct exchange', async () => {
      const channelName = 'test-channel';
      const username = 'testuser';
      const content = 'Hello world';

      await channelManager.createChannel(channelName);
      await channelManager.sendMessage(channelName, username, content);

      const mockChannel = mockAmqpConnection.getChannel();
      expect(mockChannel.publish).toHaveBeenCalledWith(
        `chat-exchange-${channelName}`,
        channelName,
        expect.stringContaining(content),
        expect.objectContaining({
          persistent: true,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should throw error for non-existent channel', async () => {
      await expect(
        channelManager.sendMessage('nonexistent', 'user', 'message')
      ).rejects.toThrow('Channel nonexistent not found');
    });
  });

  describe('subscribeToChannel', () => {
    it('should subscribe to channel and set it as active', async () => {
      const channelName = 'test-channel';
      const username = 'testuser';

      await channelManager.subscribeToChannel(channelName, username);

      expect(channelManager.getActiveChannel()).toBe(channelName);
      expect(mockAmqpConnection.getChannel().consume).toHaveBeenCalled();
    });
  });

  describe('getChannels', () => {
    it('should return list of channel names', async () => {
      await channelManager.createChannel('channel1');
      await channelManager.createChannel('channel2');

      const channels = channelManager.getChannels();
      expect(channels).toEqual(['channel1', 'channel2']);
    });
  });
});
