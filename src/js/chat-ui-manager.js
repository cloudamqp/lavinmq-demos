/**
 * Chat UI Manager
 * Handles all user interface interactions
 */

class ChatUIManager {
  constructor(channelManager) {
    this.channelManager = channelManager;
    this.username = null;
    this.defaultChannel = 'general';
    this.currentChannel = this.defaultChannel;
    this.activeUsers = new Map(); // Map<username, lastSeen> - global active users across all channels
    this.directMessages = new Set(); // Set of usernames with DM conversations
    this.subscribedChannels = new Set(); // Set of channels the user is subscribed to

    // Message buffering for channels not in focus
    this.messageBuffers = new Map(); // Map<channelName, Array<message>>
    this.unreadCounts = new Map(); // Map<channelName, number>

    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    // Main elements
    this.usernameModal = document.getElementById('usernameModal');
    this.usernameForm = document.getElementById('usernameForm');
    this.usernameInput = document.getElementById('usernameInput');

    // Connection status
    this.connectionStatus = document.getElementById('connectionStatus');
    this.statusIndicator = this.connectionStatus.querySelector('.status-indicator');
    this.statusText = this.connectionStatus.querySelector('.status-text');

    // Channel management
    this.channelList = document.getElementById('channelList');
    this.newChannelInput = document.getElementById('newChannelInput');
    this.addChannelBtn = document.getElementById('addChannelBtn');
    this.currentChannelName = document.getElementById('currentChannelName');

    // Users list
    this.usersList = document.getElementById('usersList');

    // Direct messages
    this.dmList = document.getElementById('dmList');

    // Chat area
    this.messagesContainer = document.getElementById('messagesContainer');
    this.messageForm = document.getElementById('messageForm');
    this.messageInput = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.userCount = document.getElementById('userCount');
  }

  bindEvents() {
    // Username form
    this.usernameForm.addEventListener('submit', e => {
      e.preventDefault();
      this.handleUsernameSubmit();
    });

    // Channel management
    this.addChannelBtn.addEventListener('click', () => {
      this.handleAddChannel();
    });

    this.newChannelInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.handleAddChannel();
      }
    });

    // Message form
    this.messageForm.addEventListener('submit', e => {
      e.preventDefault();
      this.handleMessageSubmit();
    });

    this.messageInput.addEventListener('input', () => {
      this.updateSendButtonState();
    });

    // Channel list clicks (event delegation)
    this.channelList.addEventListener('click', e => {
      const channelItem = e.target.closest('.channel-item');
      if (channelItem) {
        const channelName = channelItem.dataset.channel;
        this.switchChannel(channelName);
      }
    });

    // Users list clicks (event delegation) - for starting DMs
    this.usersList.addEventListener('click', e => {
      const userItem = e.target.closest('.user-item');
      if (userItem && !userItem.classList.contains('current-user')) {
        const username = userItem.querySelector('.user-name').textContent;
        this.startDirectMessage(username);
      }
    });

    // DM list clicks (event delegation)
    this.dmList.addEventListener('click', e => {
      const dmItem = e.target.closest('.dm-item');
      if (dmItem) {
        const username = dmItem.dataset.username;
        const dmChannel = this.getDMChannelName(username);
        this.switchChannel(dmChannel);
      }
    });

    // Channel manager events
    this.channelManager.addEventListener('messageReceived', e => {
      this.handleMessageReceived(e.detail);
    });

    this.channelManager.addEventListener('channelCreated', e => {
      this.addChannelToUI(e.detail.channelName);
    });

    this.channelManager.addEventListener('channelUnsubscribed', e => {
      this.handleChannelUnsubscribed(e.detail.channelName);
    });

    this.channelManager.addEventListener('userNotificationReceived', e => {
      this.handleUserNotification(e.detail.notification);
    });
  }

  showUsernameModal(isOAuthConfigured = false, oauthLoginCallback = null) {
    // Store OAuth callback for later use
    if (oauthLoginCallback) {
      this._oauthLoginCallback = oauthLoginCallback;
    }

    // If OAuth is configured, show OAuth button and hide username input
    if (isOAuthConfigured) {
      this.usernameInput.style.display = 'none';
      const submitButton = this.usernameModal.querySelector('button[type="submit"]');
      if (submitButton) submitButton.style.display = 'none';

      // Add OAuth login button if not already present
      let oauthButton = this.usernameModal.querySelector('.oauth-login-btn');
      if (!oauthButton) {
        oauthButton = document.createElement('button');
        oauthButton.type = 'button';
        oauthButton.className = 'oauth-login-btn';
        oauthButton.textContent = 'Sign in with GitHub';
        oauthButton.style.cssText = `
          padding: 12px 24px;
          background: #24292e;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 10px;
        `;
        oauthButton.addEventListener('click', () => {
          if (this._oauthLoginCallback) {
            this._oauthLoginCallback();
          }
        });
        this.usernameModal.querySelector('.modal-content').appendChild(oauthButton);
      }
    }

    this.usernameModal.style.display = 'flex';
    if (!isOAuthConfigured) {
      this.usernameInput.focus();
    }
  }

  hideUsernameModal() {
    this.usernameModal.style.display = 'none';
  }

  async handleUsernameSubmit() {
    console.log('[DEBUG] handleUsernameSubmit called');
    // Use already-set username (from OAuth) or read from input field
    const username = this.username || this.usernameInput.value.trim();
    if (!username || username.length > 20) {
      console.log('[DEBUG] Invalid username:', username, 'length:', username?.length);
      return;
    }

    this.username = username;
    console.log('[DEBUG] Username set to:', username);
    this.hideUsernameModal();

    // Update page title to include username
    document.title = `${username} - WamsChat - AMQP Stream Chat`;

    // Subscribe to default channel and user notifications
    try {
      console.log('[DEBUG] About to subscribe to default channel:', this.defaultChannel);
      await this.channelManager.subscribeToChannel(this.defaultChannel, this.username);
      console.log('[DEBUG] Subscribed to default channel');
      this.subscribedChannels.add(this.defaultChannel);

      // Subscribe to user-specific notifications for DMs
      console.log('[DEBUG] About to subscribe to user notifications');
      await this.channelManager.subscribeToUserNotifications(this.username);
      console.log('[DEBUG] Subscribed to user notifications');

      // Add default channel to UI
      this.addChannelToUI(this.defaultChannel);

      this.updateChannelUI(this.defaultChannel);

      // Add current user to global active users list
      this.activeUsers.set(username, Date.now());
      this.updateUserCount();
      this.updateUsersList();

      this.enableChatInterface();
      console.log('[DEBUG] handleUsernameSubmit completed successfully');
    } catch (error) {
      console.error('Failed to join channel:', error);
      console.error('[DEBUG] Error stack:', error.stack);
      this.showError('Failed to join chat. Please try again.');
    }
  }

  async handleAddChannel() {
    const channelName = this.newChannelInput.value.trim().toLowerCase();
    if (!channelName || channelName.length > 50) {
      return;
    }

    // Validate channel name (alphanumeric and dashes only)
    if (!/^[a-z0-9-]+$/.test(channelName)) {
      this.showError('Channel name can only contain letters, numbers, and dashes');
      return;
    }

    try {
      await this.channelManager.createChannel(channelName);
      this.newChannelInput.value = '';
      this.switchChannel(channelName);
    } catch (error) {
      console.error('Failed to create channel:', error);
      this.showError('Failed to create channel');
    }
  }

  async handleMessageSubmit() {
    const content = this.messageInput.value.trim();
    if (!content || content.length > 1000) {
      return;
    }

    try {
      await this.channelManager.sendMessage(this.currentChannel, this.username, content);
      this.messageInput.value = '';
      this.updateSendButtonState();
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showError('Failed to send message');
    }
  }

  async switchChannel(channelName) {
    // Don't allow switching to user notification channels
    if (channelName.startsWith('user-notifications-')) {
      return;
    }

    if (this.currentChannel === channelName) {
      return;
    }

    // Subscribe to new channel (both regular channels and DMs need to be created in channel manager)
    const isDM = this.isDMChannel(channelName);

    if (!this.subscribedChannels.has(channelName)) {
      try {
        await this.channelManager.subscribeToChannel(channelName, this.username);
        this.subscribedChannels.add(channelName);
      } catch (error) {
        console.error('Failed to subscribe to channel:', error);
        this.showError(isDM ? 'Failed to start direct message' : 'Failed to join channel');
        return;
      }
    }

    // Update current channel and UI
    this.currentChannel = channelName;
    this.updateChannelUI(channelName);

    // Clear current messages and load buffered messages for this channel
    this.clearMessages();
    this.loadBufferedMessages(channelName);

    // Reset unread count for this channel
    this.unreadCounts.set(channelName, 0);
    this.updateUnreadIndicator(channelName);
  }

  updateChannelUI(channelName) {
    const isDM = this.isDMChannel(channelName);

    // Update active channel in sidebar
    document.querySelectorAll('.channel-item').forEach(item => {
      item.classList.toggle('active', !isDM && item.dataset.channel === channelName);
    });

    // Update active DM in sidebar
    document.querySelectorAll('.dm-item').forEach(item => {
      const dmUsername = item.dataset.username;
      const dmChannelName = this.getDMChannelName(dmUsername);
      item.classList.toggle('active', isDM && dmChannelName === channelName);
    });

    // Update channel name in header
    if (isDM) {
      const dmUsername = this.getDMUsernameFromChannel(channelName);
      this.currentChannelName.textContent = `@ ${dmUsername}`;
    } else {
      this.currentChannelName.textContent = `# ${channelName}`;
    }

    // Always show global active users (for both channels and DMs)
    this.updateUserCount();
    this.updateUsersList();
  }

  addChannelToUI(channelName) {
    // Hide user notification channels from UI
    if (channelName.startsWith('user-notifications-')) {
      return;
    }

    // Hide DM channels from regular channel list (they belong in DM section)
    if (this.isDMChannel(channelName)) {
      return;
    }

    // Check if channel already exists in UI
    if (document.querySelector(`[data-channel="${channelName}"]`)) {
      return;
    }

    const channelItem = document.createElement('div');
    channelItem.className = 'channel-item';
    channelItem.dataset.channel = channelName;

    if (channelName === this.defaultChannel) {
      // Default channel without leave button
      channelItem.innerHTML = `
        <span class="channel-hash">#</span>
        <span class="channel-name">${channelName}</span>
      `;
    } else {
      // Other channels with leave button
      channelItem.innerHTML = `
        <span class="channel-hash">#</span>
        <span class="channel-name">${channelName}</span>
        <button class="channel-leave-btn" type="button" title="Leave channel">×</button>
      `;

      // Add event listener for leave button
      const leaveBtn = channelItem.querySelector('.channel-leave-btn');
      leaveBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent channel switching
        this.leaveChannel(channelName);
      });
    }

    this.channelList.appendChild(channelItem);
  }

  handleMessageReceived({ channelName, message }) {
    // Don't display messages from user notification channels
    if (channelName.startsWith('user-notifications-')) {
      return;
    }

    // Track active users based on message activity
    this.updateActiveUsers(channelName, message);

    // Initialize message buffer for this channel if it doesn't exist
    if (!this.messageBuffers.has(channelName)) {
      this.messageBuffers.set(channelName, []);
    }
    if (!this.unreadCounts.has(channelName)) {
      this.unreadCounts.set(channelName, 0);
    }

    // Add message to buffer
    this.messageBuffers.get(channelName).push(message);

    // If this is the active channel, display the message immediately and don't increment unread count
    if (channelName === this.currentChannel) {
      this.displayMessage(message);
    } else {
      // If not the active channel, increment unread count and update UI indicator
      this.unreadCounts.set(channelName, this.unreadCounts.get(channelName) + 1);
      this.updateUnreadIndicator(channelName);
    }
  }

  displayMessage(message) {
    // Filter out join/leave system messages in DM channels
    if (message.type === 'system' && this.isDMChannel(this.currentChannel)) {
      const content = message.content;
      // Don't show join/leave messages in DMs
      if (content.includes(' joined the channel') || content.includes(' left the channel')) {
        return;
      }
    }

    const messageElement = document.createElement('div');

    if (message.type === 'system') {
      messageElement.className = 'system-message';
      messageElement.textContent = message.content;
    } else {
      messageElement.className = 'message';
      messageElement.innerHTML = `
        <div class="message-header">
          <span class="message-author">${this.escapeHtml(message.username)}</span>
          <span class="message-timestamp">${this.formatTimestamp(message.timestamp)}</span>
        </div>
        <div class="message-content">${this.escapeHtml(message.content)}</div>
      `;
    }

    // Remove welcome message if it exists
    const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();
  }

  clearMessages() {
    this.messagesContainer.innerHTML = '';
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  updateConnectionStatus(status) {
    this.statusIndicator.className = `status-indicator ${status}`;

    const statusTexts = {
      connected: 'Connected',
      connecting: 'Connecting...',
      disconnected: 'Disconnected',
      error: 'Connection Error',
    };

    this.statusText.textContent = statusTexts[status] || 'Unknown';
  }

  enableChatInterface() {
    this.messageInput.disabled = false;
    this.updateSendButtonState();
  }

  disableChatInterface() {
    this.messageInput.disabled = true;
    this.sendButton.disabled = true;
  }

  updateSendButtonState() {
    const hasContent = this.messageInput.value.trim().length > 0;
    const isEnabled = hasContent && !this.messageInput.disabled;
    this.sendButton.disabled = !isEnabled;
  }

  showError(message) {
    // Simple error display - could be enhanced with a proper notification system
    console.error('UI Error:', message);

    // For now, show in a system message
    if (this.currentChannel) {
      const errorMessage = {
        type: 'system',
        content: `Error: ${message}`,
        timestamp: new Date().toISOString(),
      };
      this.displayMessage(errorMessage);
    }
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async leaveChannel(channelName) {
    // Don't allow leaving the default channel
    if (channelName === this.defaultChannel) {
      this.showError(`Cannot leave the ${this.defaultChannel} channel`);
      return;
    }

    // Don't allow leaving DM channels this way
    if (this.isDMChannel(channelName)) {
      return;
    }

    // Don't allow leaving user notification channels
    if (channelName.startsWith('user-notifications-')) {
      return;
    }

    try {
      await this.channelManager.unsubscribeFromChannel(channelName, this.username);
      this.subscribedChannels.delete(channelName);

      // Remove from active users
      this.activeUsers.delete(channelName);

      // If we're currently in this channel, switch to default
      if (this.currentChannel === channelName) {
        await this.switchChannel(this.defaultChannel);
      }

      // Remove channel from UI
      const channelItem = document.querySelector(`[data-channel="${channelName}"]`);
      if (channelItem) {
        channelItem.remove();
      }
    } catch (error) {
      console.error('Failed to leave channel:', error);
      this.showError('Failed to leave channel');
    }
  }

  getDMChannelName(username) {
    // Create a consistent DM channel name by sorting usernames
    const users = [this.username, username].sort();
    return `dm-${users[0]}-${users[1]}`;
  }

  async startDirectMessage(username) {
    if (username === this.username) {
      return; // Can't DM yourself
    }

    // Add to DM list if not already there
    if (!this.directMessages.has(username)) {
      this.directMessages.add(username);
      this.addDMToUI(username);
    }

    // Get DM channel name
    const dmChannel = this.getDMChannelName(username);

    // Send DM initiation notification to the other user
    try {
      await this.channelManager.sendDMInitiationNotification(this.username, username, dmChannel);
    } catch (error) {
      console.error('Failed to send DM initiation notification:', error);
    }

    // Switch to DM channel
    await this.switchChannel(dmChannel);
  }

  addDMToUI(username) {
    // Check if DM already exists in UI
    if (document.querySelector(`[data-username="${username}"]`)) {
      return;
    }

    const dmItem = document.createElement('div');
    dmItem.className = 'dm-item';
    dmItem.dataset.username = username;
    dmItem.innerHTML = `
      <span class="dm-avatar">@</span>
      <span class="dm-username">${this.escapeHtml(username)}</span>
    `;

    this.dmList.appendChild(dmItem);
  }

  isDMChannel(channelName) {
    return channelName.startsWith('dm-');
  }

  getDMUsernameFromChannel(channelName) {
    if (!this.isDMChannel(channelName)) {
      return null;
    }

    const parts = channelName.split('-');
    if (parts.length === 3) {
      const [, user1, user2] = parts;
      return user1 === this.username ? user2 : user1;
    }
    return null;
  }

  getUsername() {
    return this.username;
  }

  setUsername(username) {
    this.username = username;
  }

  handleChannelUnsubscribed(_channelName) {
    // When leaving a channel, user might still be active in other channels
    // So we don't remove them from global active users here
    // They'll be removed when they send a "left the channel" system message
  }

  handleUserNotification(notification) {
    console.log('Processing user notification:', notification);

    if (notification.type === 'dm-initiation') {
      // Someone is trying to start a DM with us
      const fromUsername = notification.from;
      const dmChannelName = notification.dmChannel;

      console.log(`Received DM initiation from ${fromUsername}, channel: ${dmChannelName}`);

      // Add them to our DM list if not already there
      if (!this.directMessages.has(fromUsername)) {
        this.directMessages.add(fromUsername);
        this.addDMToUI(fromUsername);
        console.log(`Added ${fromUsername} to DM list`);
      }

      // Subscribe to the DM channel so we can receive their messages
      if (!this.subscribedChannels.has(dmChannelName)) {
        console.log(`Auto-subscribing to DM channel: ${dmChannelName}`);
        this.channelManager.subscribeToChannel(dmChannelName, this.username)
          .then(() => {
            this.subscribedChannels.add(dmChannelName);
            console.log(`Successfully auto-subscribed to DM channel from ${fromUsername}`);
          })
          .catch(error => {
            console.error('Failed to auto-subscribe to DM channel:', error);
          });
      } else {
        console.log(`Already subscribed to DM channel: ${dmChannelName}`);
      }
    }
  }

  updateActiveUsers(channelName, message) {
    // Don't track users on user notification channels
    if (channelName.startsWith('user-notifications-')) {
      return;
    }

    // Handle DM channels differently
    if (this.isDMChannel(channelName)) {
      // For DM channels, automatically add the other user to DM list if not already there
      if (message.type === 'message' && message.username && message.username !== this.username) {
        const dmUsername = message.username;
        if (!this.directMessages.has(dmUsername)) {
          this.directMessages.add(dmUsername);
          this.addDMToUI(dmUsername);
        }

        // Make sure we're subscribed to this DM channel
        if (!this.subscribedChannels.has(channelName)) {
          this.channelManager.subscribeToChannel(channelName, this.username)
            .then(() => {
              this.subscribedChannels.add(channelName);
            })
            .catch(error => {
              console.error('Failed to subscribe to DM channel:', error);
            });
        }
      }
      // Still track users globally even for DM channels
    }

    // Handle system messages for join/leave events
    if (message.type === 'system') {
      const content = message.content;

      // Check if it's a "left the channel" message
      const leftMatch = content.match(/^(.+) left the channel$/);
      if (leftMatch) {
        const username = leftMatch[1];
        // Remove from global active users
        this.activeUsers.delete(username);
        // Update UI
        this.updateUserCount();
        this.updateUsersList();
        return;
      }

      // Check if it's a "joined the channel" message
      const joinedMatch = content.match(/^(.+) joined the channel$/);
      if (joinedMatch) {
        const username = joinedMatch[1];
        // Add to global active users
        this.activeUsers.set(username, Date.now());
        // Update UI
        this.updateUserCount();
        this.updateUsersList();
        return;
      }

      // For other system messages, don't track users
      return;
    }

    // Track users from regular messages globally
    if (message.type === 'message' && message.username) {
      this.activeUsers.set(message.username, Date.now());
      // Update UI
      this.updateUserCount();
      this.updateUsersList();
    }
  }

  updateUserCount() {
    const userCount = this.activeUsers.size;
    const countText = userCount === 1 ? '1 user' : `${userCount} users`;
    this.userCount.textContent = countText;
  }

  updateUsersList() {
    // Clear the current users list
    this.usersList.innerHTML = '';

    if (this.activeUsers.size === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'users-empty';
      emptyMessage.textContent = 'No active users';
      this.usersList.appendChild(emptyMessage);
      return;
    }

    // Sort users alphabetically, but put current user first
    const sortedUsers = Array.from(this.activeUsers.keys()).sort((a, b) => {
      if (a === this.username) return -1;
      if (b === this.username) return 1;
      return a.localeCompare(b);
    });

    // Create user items
    sortedUsers.forEach(username => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';

      if (username === this.username) {
        userItem.classList.add('current-user');
      }

      userItem.innerHTML = `
        <span class="user-avatar">@</span>
        <span class="user-name">${this.escapeHtml(username)}</span>
      `;

      this.usersList.appendChild(userItem);
    });
  }

  loadBufferedMessages(channelName) {
    const bufferedMessages = this.messageBuffers.get(channelName);
    if (bufferedMessages && bufferedMessages.length > 0) {
      // Display all buffered messages for this channel
      bufferedMessages.forEach(message => {
        this.displayMessage(message);
      });
    }
  }

  updateUnreadIndicator(channelName) {
    const unreadCount = this.unreadCounts.get(channelName) || 0;
    const isDM = this.isDMChannel(channelName);

    if (isDM) {
      // Update DM item unread indicator
      const dmUsername = this.getDMUsernameFromChannel(channelName);
      const dmItem = document.querySelector(`[data-username="${dmUsername}"]`);
      if (dmItem) {
        this.updateItemUnreadIndicator(dmItem, unreadCount);
      }
    } else {
      // Update channel item unread indicator
      const channelItem = document.querySelector(`[data-channel="${channelName}"]`);
      if (channelItem) {
        this.updateItemUnreadIndicator(channelItem, unreadCount);
      }
    }
  }

  updateItemUnreadIndicator(item, unreadCount) {
    // Remove existing unread indicator
    const existingIndicator = item.querySelector('.unread-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Add unread indicator if there are unread messages
    if (unreadCount > 0) {
      const indicator = document.createElement('span');
      indicator.className = 'unread-indicator';
      indicator.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
      item.appendChild(indicator);
    }
  }
}export { ChatUIManager };
