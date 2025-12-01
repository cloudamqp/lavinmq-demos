/**
 * Tests for ChatUIManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DOM elements
const createMockElement = (id, tagName = 'div') => {
  const element = {
    id,
    tagName,
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    style: {},
    className: '',
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
    },
    addEventListener: vi.fn(),
    querySelector: vi.fn(),
    appendChild: vi.fn(),
    focus: vi.fn(),
  };
  return element;
};

// Mock document
global.document = {
  getElementById: vi.fn(id => createMockElement(id)),
  createElement: vi.fn(tagName => createMockElement('created', tagName)),
  querySelectorAll: vi.fn(() => []),
  querySelector: vi.fn(),
  addEventListener: vi.fn(),
};

// Mock channel manager
const mockChannelManager = {
  addEventListener: vi.fn(),
  subscribeToChannel: vi.fn(),
  unsubscribeFromChannel: vi.fn(),
  createChannel: vi.fn(),
  sendMessage: vi.fn(),
  getChannels: vi.fn(() => []),
  getActiveChannel: vi.fn(),
};

describe('ChatUIManager', () => {
  let ChatUIManager;
  let uiManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamic import to avoid issues with DOM mocking
    const module = await import('../src/js/chat-ui-manager.js');
    ChatUIManager = module.ChatUIManager;

    uiManager = new ChatUIManager(mockChannelManager);
  });

  describe('formatTimestamp', () => {
    it('should format timestamp correctly for today', () => {
      const today = new Date();
      const timestamp = today.toISOString();

      const formatted = uiManager.formatTimestamp(timestamp);

      // Should return time in HH:MM format for today
      expect(formatted).toMatch(/^\d{1,2}:\d{2}$/);
    });

    it('should format timestamp correctly for other days', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const timestamp = yesterday.toISOString();

      const formatted = uiManager.formatTimestamp(timestamp);

      // Should return date format for other days
      expect(formatted).toMatch(/^[A-Za-z]{3} \d{1,2}$/);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const escaped = uiManager.escapeHtml(input);

      expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should handle regular text', () => {
      const input = 'Hello world!';
      const escaped = uiManager.escapeHtml(input);

      expect(escaped).toBe('Hello world!');
    });
  });

  describe('updateConnectionStatus', () => {
    it('should update status indicator class', () => {
      uiManager.updateConnectionStatus('connected');

      expect(uiManager.statusIndicator.className).toBe('status-indicator connected');
      expect(uiManager.statusText.textContent).toBe('Connected');
    });

    it('should handle unknown status', () => {
      uiManager.updateConnectionStatus('unknown');

      expect(uiManager.statusText.textContent).toBe('Unknown');
    });
  });

  describe('enableChatInterface', () => {
    it('should enable message input', () => {
      uiManager.enableChatInterface();

      expect(uiManager.messageInput.disabled).toBe(false);
    });
  });

  describe('disableChatInterface', () => {
    it('should disable both input and send button', () => {
      uiManager.disableChatInterface();

      expect(uiManager.messageInput.disabled).toBe(true);
      expect(uiManager.sendButton.disabled).toBe(true);
    });
  });
});
