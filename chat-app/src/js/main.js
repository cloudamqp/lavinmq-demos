/**
 * WamsChat - AMQP Stream Chat Application
 * Main application entry point
 */

import { AmqpConnectionManager } from './amqp-connection.js';
import { ChatChannelManager } from './chat-channel-manager.js';
import { ChatUIManager } from './chat-ui-manager.js';
import { OAuth2Client } from './oauth-client.js';

class WamsChatApp {
  constructor() {
    this.amqpConnection = new AmqpConnectionManager();
    this.channelManager = new ChatChannelManager(this.amqpConnection);
    this.uiManager = new ChatUIManager(this.channelManager);
    this.oauthClient = new OAuth2Client();
    this.logoutBtn = document.getElementById('logoutBtn');

    this.bindConnectionEvents();
    this.bindLogoutButton();
    this.initialize();
  }

  bindLogoutButton() {
    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  }

  async handleLogout() {
    await this.shutdown();
    this.oauthClient.logout();
    window.location.reload();
  }

  showLogoutButton() {
    if (this.logoutBtn) {
      this.logoutBtn.style.display = 'block';
    }
  }

  bindConnectionEvents() {
    this.amqpConnection.addEventListener('connecting', () => {
      console.log('Connecting to AMQP broker...');
      this.uiManager.updateConnectionStatus('connecting');
    });

    this.amqpConnection.addEventListener('connected', () => {
      console.log('Connected to AMQP broker');
      this.uiManager.updateConnectionStatus('connected');
      this.uiManager.enableChatInterface();
    });

    this.amqpConnection.addEventListener('disconnected', () => {
      console.log('Disconnected from AMQP broker');
      this.uiManager.updateConnectionStatus('disconnected');
      this.uiManager.disableChatInterface();
    });

    this.amqpConnection.addEventListener('error', event => {
      console.error('AMQP connection error:', event.detail);
      this.uiManager.updateConnectionStatus('error');
      this.uiManager.showError('Connection failed. Please check the AMQP broker.');
    });
  }

  async initialize() {
    try {
      // Check if OAuth is configured
      const isOAuthConfigured = !!import.meta.env.VITE_OAUTH_CLIENT_ID;

      // Handle OAuth callback if present
      if (this.oauthClient.isCallback()) {
        try {
          const token = await this.oauthClient.handleCallback();
          const username = this.oauthClient.getUsername();
          this.amqpConnection.setOAuthToken(token);
          console.log('OAuth authentication successful for user:', username);

          // Connect to AMQP after getting token
          await this.amqpConnection.connect();

          // Set username from JWT token
          this.uiManager.setUsername(username);
          this.uiManager.hideUsernameModal();
          await this.uiManager.handleUsernameSubmit();
          this.showLogoutButton();
          return;
        } catch (error) {
          console.error('OAuth callback failed:', error);
          this.uiManager.showError(`OAuth authentication failed: ${error.message}`);
          return;
        }
      }

      // Check if already authenticated with OAuth
      if (isOAuthConfigured && this.oauthClient.isAuthenticated()) {
        // Check if token is expired before trying to connect
        if (this.oauthClient.isTokenExpired()) {
          console.log('OAuth token expired, clearing and showing login');
          this.oauthClient.logout();
          this.uiManager.showUsernameModal(isOAuthConfigured, () => this.oauthClient.startOAuthFlow());
          return;
        }

        const token = this.oauthClient.getAccessToken();
        const username = this.oauthClient.getUsername();
        this.amqpConnection.setOAuthToken(token);

        // Connect to AMQP
        try {
          await this.amqpConnection.connect();
        } catch (error) {
          // If connection fails due to expired token, clear and show login
          if (error.message?.includes('ACCESS_REFUSED') || error.message?.includes('expired')) {
            console.log('OAuth token rejected, clearing and showing login');
            this.oauthClient.logout();
            this.uiManager.showUsernameModal(isOAuthConfigured, () => this.oauthClient.startOAuthFlow());
            return;
          }
          throw error;
        }

        // Set username from stored JWT info
        this.uiManager.setUsername(username);
        this.uiManager.hideUsernameModal();
        await this.uiManager.handleUsernameSubmit();
        this.showLogoutButton();
        return;
      }

      // Show username modal for basic auth or OAuth login
      this.uiManager.showUsernameModal(isOAuthConfigured, () => this.oauthClient.startOAuthFlow());

      // Connect to AMQP broker (for basic auth)
      if (!isOAuthConfigured) {
        await this.amqpConnection.connect();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.uiManager.showError('Failed to start the application');
    }
  }

  async shutdown() {
    console.log('Shutting down WamsChat...');

    // Unsubscribe from channels
    const username = this.uiManager.getUsername();
    if (username) {
      const channels = this.channelManager.getChannels();
      for (const channel of channels) {
        try {
          await this.channelManager.unsubscribeFromChannel(channel, username);
        } catch (error) {
          console.error(`Failed to unsubscribe from ${channel}:`, error);
        }
      }
    }

    // Disconnect from AMQP
    await this.amqpConnection.disconnect();
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new WamsChatApp();

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    app.shutdown();
  });

  // Make app available globally for debugging
  window.wamsChatApp = app;
});

export { WamsChatApp };
