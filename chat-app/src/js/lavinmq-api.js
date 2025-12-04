/**
 * LavinMQ HTTP API Client
 * Provides access to LavinMQ management API for queue stats, connections, and overview
 */
export class LavinMQApiClient {
  constructor() {
    this.hostname = import.meta.env.VITE_AMQP_HOST || 'localhost';
    this.port = import.meta.env.VITE_AMQP_PORT || '15672';
    this.vhost = import.meta.env.VITE_AMQP_VHOST || '/';
    this.username = null;
    this.password = null;
  }

  /**
   * Set credentials for HTTP Basic Auth
   * @param {string} username
   * @param {string} password
   */
  setCredentials(username, password) {
    this.username = username;
    this.password = password;
  }

  /**
   * Get the base URL for the LavinMQ HTTP API
   * In development, uses Vite proxy (/api) to avoid CORS
   * In production, uses the full URL to the LavinMQ API
   */
  getBaseUrl() {
    // In development (Vite dev server), use proxy
    if (import.meta.env.DEV) {
      return '/api';
    }

    // In production, use full URL
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    // For HTTPS, use default port (443), otherwise use configured port
    const port = protocol === 'https:' ? '' : `:${this.port}`;
    return `${protocol}//${this.hostname}${port}/api`;
  }

  /**
   * Make an authenticated request to the LavinMQ API
   * @param {string} endpoint - API endpoint path
   * @returns {Promise<Object>} - JSON response
   */
  async fetch(endpoint) {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const headers = {};

    if (this.username && this.password) {
      headers['Authorization'] = 'Basic ' + btoa(`${this.username}:${this.password}`);
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`LavinMQ API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get broker overview statistics
   * @returns {Promise<Object>} - Overview data including message rates, connections, channels
   */
  async getOverview() {
    return this.fetch('/overview');
  }

  /**
   * Get all queues with their statistics
   * @returns {Promise<Array>} - Array of queue objects
   */
  async getQueues() {
    const encodedVhost = encodeURIComponent(this.vhost);
    return this.fetch(`/queues/${encodedVhost}`);
  }

  /**
   * Get specific queue statistics
   * @param {string} queueName - Name of the queue
   * @returns {Promise<Object>} - Queue statistics
   */
  async getQueue(queueName) {
    const encodedVhost = encodeURIComponent(this.vhost);
    const encodedQueue = encodeURIComponent(queueName);
    return this.fetch(`/queues/${encodedVhost}/${encodedQueue}`);
  }

  /**
   * Get all active connections
   * @returns {Promise<Array>} - Array of connection objects
   */
  async getConnections() {
    return this.fetch('/connections');
  }

  /**
   * Format overview data for display
   * @param {Object} overview - Raw overview data from API
   * @returns {string} - Formatted string for display
   */
  formatOverview(overview) {
    const lines = [
      '📊 LavinMQ Overview',
      '─'.repeat(40),
      `Node: ${overview.node || 'N/A'}`,
      `Version: ${overview.lavinmq_version || overview.rabbitmq_version || 'N/A'}`,
      '',
      '📬 Messages:',
      `  Ready: ${overview.queue_totals?.messages_ready || 0}`,
      `  Unacked: ${overview.queue_totals?.messages_unacknowledged || 0}`,
      `  Total: ${overview.queue_totals?.messages || 0}`,
      '',
      '🔗 Connections:',
      `  Total: ${overview.object_totals?.connections || 0}`,
      `  Channels: ${overview.object_totals?.channels || 0}`,
      '',
      '📁 Objects:',
      `  Queues: ${overview.object_totals?.queues || 0}`,
      `  Exchanges: ${overview.object_totals?.exchanges || 0}`,
      `  Consumers: ${overview.object_totals?.consumers || 0}`,
    ];
    return lines.join('\n');
  }

  /**
   * Format queue data for display
   * @param {Array} queues - Array of queue objects from API
   * @returns {string} - Formatted string for display
   */
  formatQueues(queues) {
    if (!queues || queues.length === 0) {
      return '📭 No queues found';
    }

    const lines = [
      '📋 Queue Information',
      '─'.repeat(50),
    ];

    // Filter to chat-related queues (streams)
    const chatQueues = queues.filter(q =>
      q.name.startsWith('chat-stream-') || q.name.startsWith('user-notifications-')
    );

    const queuesToShow = chatQueues.length > 0 ? chatQueues : queues;

    for (const queue of queuesToShow) {
      lines.push(`\n📦 ${queue.name}`);
      lines.push(`   Messages: ${queue.messages || 0} (ready: ${queue.messages_ready || 0}, unacked: ${queue.messages_unacknowledged || 0})`);
      lines.push(`   Consumers: ${queue.consumers || 0}`);
      lines.push(`   Type: ${queue.type || 'classic'}`);
      if (queue.arguments?.['x-queue-type']) {
        lines.push(`   Queue Type: ${queue.arguments['x-queue-type']}`);
      }
    }

    if (chatQueues.length > 0 && queues.length > chatQueues.length) {
      lines.push(`\n(Showing ${chatQueues.length} chat queues. Total queues: ${queues.length})`);
    }

    return lines.join('\n');
  }

  /**
   * Format connection data for display
   * @param {Array} connections - Array of connection objects from API
   * @returns {string} - Formatted string for display
   */
  formatConnections(connections) {
    if (!connections || connections.length === 0) {
      return '🔌 No active connections';
    }

    const lines = [
      '🔗 Active Connections',
      '─'.repeat(50),
      `Total: ${connections.length}`,
      '',
    ];

    for (const conn of connections.slice(0, 10)) { // Limit to 10 connections
      const user = conn.user || 'unknown';
      const protocol = conn.protocol || 'AMQP';
      const state = conn.state || 'unknown';
      const channels = conn.channels || 0;

      lines.push(`👤 ${user}`);
      lines.push(`   Protocol: ${protocol}`);
      lines.push(`   State: ${state}`);
      lines.push(`   Channels: ${channels}`);
      if (conn.client_properties?.product) {
        lines.push(`   Client: ${conn.client_properties.product}`);
      }
      lines.push('');
    }

    if (connections.length > 10) {
      lines.push(`... and ${connections.length - 10} more connections`);
    }

    return lines.join('\n');
  }
}
