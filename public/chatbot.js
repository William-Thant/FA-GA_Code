// Chatbot functionality
class Chatbot {
  constructor() {
    this.messages = [];
    this.isOpen = false;
    this.init();
  }

  init() {
    this.createChatbotUI();
    this.attachEventListeners();
    this.addWelcomeMessage();
  }

  createChatbotUI() {
    const container = document.createElement('div');
    container.className = 'chatbot-container';
    container.innerHTML = `
      <button class="chatbot-toggle" id="chatbotToggle">
        <i class="fas fa-comments"></i>
      </button>
      <div class="chatbot-window" id="chatbotWindow">
        <div class="chatbot-header">
          <div>
            <h4><i class="fas fa-car"></i> Auto Sales Assistant</h4>
            <small style="opacity: 0.9;">Your car buying expert!</small>
          </div>
          <button class="chatbot-close" id="chatbotClose">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="chatbot-messages" id="chatbotMessages"></div>
        <div class="chatbot-input-area">
          <input type="text" class="chatbot-input" id="chatbotInput" placeholder="Type your message...">
          <button class="chatbot-send" id="chatbotSend">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(container);
  }

  attachEventListeners() {
    const toggle = document.getElementById('chatbotToggle');
    const close = document.getElementById('chatbotClose');
    const send = document.getElementById('chatbotSend');
    const input = document.getElementById('chatbotInput');

    toggle.addEventListener('click', () => this.toggleChat());
    close.addEventListener('click', () => this.toggleChat());
    send.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  toggleChat() {
    const window = document.getElementById('chatbotWindow');
    const toggle = document.getElementById('chatbotToggle');
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      window.classList.add('active');
      toggle.innerHTML = '<i class="fas fa-times"></i>';
      document.getElementById('chatbotInput').focus();
    } else {
      window.classList.remove('active');
      toggle.innerHTML = '<i class="fas fa-comments"></i>';
    }
  }

  addWelcomeMessage() {
    const welcomeMsg = "Welcome to our dealership! 🚗 I'm here to help you find your perfect vehicle. I can assist with:\n\n" +
      "• Browse vehicle inventory\n" +
      "• Vehicle specifications\n" +
      "• Financing options\n" +
      "• Test drive scheduling\n" +
      "• Trade-in information\n\n" +
      "What can I help you with today?";
    
    this.addMessage(welcomeMsg, 'bot');
    this.addQuickReplies([
      'View inventory',
      'Financing options',
      'Schedule test drive',
      'Trade-in value'
    ]);
  }

  addMessage(text, sender = 'bot') {
    const messagesContainer = document.getElementById('chatbotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
      <div class="message-content">
        ${text.replace(/\n/g, '<br>')}
        <div class="message-time">${time}</div>
      </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  addQuickReplies(replies) {
    const messagesContainer = document.getElementById('chatbotMessages');
    const quickRepliesDiv = document.createElement('div');
    quickRepliesDiv.className = 'message bot';
    
    let buttonsHTML = '<div class="quick-replies">';
    replies.forEach(reply => {
      buttonsHTML += `<button class="quick-reply-btn" onclick="chatbot.handleQuickReply('${reply}')">${reply}</button>`;
    });
    buttonsHTML += '</div>';
    
    quickRepliesDiv.innerHTML = `<div class="message-content">${buttonsHTML}</div>`;
    messagesContainer.appendChild(quickRepliesDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  handleQuickReply(reply) {
    this.addMessage(reply, 'user');
    
    // Send quick reply to AI
    const input = document.getElementById('chatbotInput');
    input.value = reply;
    this.sendMessage();
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbotMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
  }

  sendMessage() {
    const input = document.getElementById('chatbotInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    this.addMessage(message, 'user');
    input.value = '';
    
    this.showTypingIndicator();
    
    // Call backend API
    fetch('/api/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        sessionId: this.getSessionId()
      })
    })
    .then(response => response.json())
    .then(data => {
      this.hideTypingIndicator();
      if (data.response) {
        this.addMessage(data.response, 'bot');
        
        // Add contextual quick replies based on message content
        const quickReplies = this.getContextualQuickReplies(message);
        if (quickReplies.length > 0) {
          this.addQuickReplies(quickReplies);
        }
      } else {
        this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
      }
    })
    .catch(error => {
      console.error('Chatbot error:', error);
      this.hideTypingIndicator();
      this.addMessage('Sorry, I\'m having trouble connecting. Please try again later.', 'bot');
    });
  }

  getSessionId() {
    // Get or create a session ID for conversation continuity
    if (!localStorage.getItem('chatbot_session_id')) {
      localStorage.setItem('chatbot_session_id', 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
    }
    return localStorage.getItem('chatbot_session_id');
  }

  getContextualQuickReplies(message) {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('inventory') || lowerMsg.includes('car') || lowerMsg.includes('vehicle')) {
      return ['Financing options', 'Schedule test drive', 'Trade-in value'];
    }
    if (lowerMsg.includes('financ') || lowerMsg.includes('loan')) {
      return ['View inventory', 'Schedule test drive'];
    }
    if (lowerMsg.includes('test drive')) {
      return ['View inventory', 'Dealership hours', 'Contact sales'];
    }
    if (lowerMsg.includes('trade')) {
      return ['View inventory', 'Contact sales'];
    }
    
    return ['View inventory', 'Financing options', 'Schedule test drive'];
  }
}

// Initialize chatbot when page loads
let chatbot;
document.addEventListener('DOMContentLoaded', () => {
  chatbot = new Chatbot();
});
