const axios = require('axios');

class ChatbotController {
  constructor() {
    // Initialize Gemini AI
    this.apiKey = process.env.GEMINI_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️  GEMINI_API_KEY not found in environment variables. Chatbot will use fallback responses.');
    }
    
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    
    // System context for the car dealership
    this.systemContext = `You are an AI assistant for a premium car dealership website. Your role is to help customers with:
- Browsing vehicle inventory (cars, SUVs, trucks, luxury vehicles)
- Providing information about vehicle specifications, features, and pricing
- Explaining financing options, loan terms, APR rates, and leasing
- Scheduling test drives and appointments
- Trade-in valuations and the trade-in process
- Warranty information and vehicle guarantees
- Dealership hours: Monday-Saturday 9 AM - 8 PM, Sunday 10 AM - 6 PM
- Home delivery services (3-7 business days)
- Purchase history and account management

Be helpful, professional, and enthusiastic about helping customers find their perfect vehicle. Keep responses concise (2-4 sentences typically) and friendly. If asked about specific vehicles not in the inventory, suggest viewing the full inventory page at /shop. For detailed inquiries, direct users to contact the sales team via the support page at /support.`;

    this.conversationHistory = new Map(); // Store conversation history per session
  }

  // Main method to handle chat messages
  async chat(req, res) {
    try {
      const { message, sessionId } = req.body;
      
      console.log('🤖 Chatbot received message:', message);
      console.log('📍 Session ID:', sessionId || 'default');

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // If API key is not configured, use fallback
      if (!this.apiKey) {
        console.log('⚠️  No API key configured, using fallback response');
        return res.json({ 
          response: this.getFallbackResponse(message),
          source: 'fallback'
        });
      }
      
      console.log('🚀 Calling Gemini API at:', this.apiUrl);

      // Get or create conversation history for this session
      const historyKey = sessionId || 'default';
      if (!this.conversationHistory.has(historyKey)) {
        this.conversationHistory.set(historyKey, []);
      }
      const history = this.conversationHistory.get(historyKey);

      // Build the prompt with context
      const fullPrompt = `${this.systemContext}\n\nCustomer: ${message}\n\nAssistant:`;

      // Generate response using Gemini REST API
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const text = response.data.candidates[0].content.parts[0].text;
      
      console.log('✅ AI Response received successfully');
      console.log('📝 Response preview:', text.substring(0, 100) + '...');

      // Store in conversation history (keep last 10 exchanges)
      history.push({ user: message, bot: text });
      if (history.length > 10) {
        history.shift();
      }

      return res.json({ 
        response: text,
        source: 'gemini-ai'
      });

    } catch (error) {
      console.error('❌ Chatbot error:', error.response?.data || error.message);
      console.log('🔄 Falling back to predefined responses');
      
      // Fallback to rule-based response if AI fails
      return res.json({ 
        response: this.getFallbackResponse(req.body.message),
        source: 'fallback',
        error: 'AI temporarily unavailable'
      });
    }
  }

  // Fallback responses when AI is not available
  getFallbackResponse(message) {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('inventory') || lowerMsg.includes('car') || lowerMsg.includes('vehicle')) {
      return "You can browse our complete vehicle inventory by visiting our <a href='/shop'>inventory page</a>. We have a wide selection of sedans, SUVs, trucks, and luxury vehicles!";
    }
    if (lowerMsg.includes('financ') || lowerMsg.includes('loan') || lowerMsg.includes('payment')) {
      return "We offer competitive financing options with flexible terms! Our finance specialists can help you find the best rates. Contact our sales team for personalized assistance.";
    }
    if (lowerMsg.includes('test drive') || lowerMsg.includes('appointment')) {
      return "Schedule a test drive to experience your dream car! Contact us through our <a href='/support'>support page</a> to book an appointment.";
    }
    if (lowerMsg.includes('trade') || lowerMsg.includes('trade-in')) {
      return "We offer competitive trade-in values! Get an estimate by contacting our team through the <a href='/support'>support page</a>.";
    }
    if (lowerMsg.includes('hour') || lowerMsg.includes('open') || lowerMsg.includes('close')) {
      return "We're open Monday-Saturday, 9 AM - 8 PM, and Sunday 10 AM - 6 PM. Our online showroom is available 24/7!";
    }
    if (lowerMsg.includes('warranty') || lowerMsg.includes('guarantee')) {
      return "All our vehicles come with comprehensive warranties and satisfaction guarantees. Contact our sales team for specific warranty details.";
    }
    
    return "I'm here to help! You can browse our <a href='/shop'>vehicle inventory</a>, learn about financing options, schedule test drives, or <a href='/support'>contact our sales team</a> for personalized assistance.";
  }

  // Clear conversation history for a session
  clearHistory(req, res) {
    const { sessionId } = req.body;
    if (sessionId && this.conversationHistory.has(sessionId)) {
      this.conversationHistory.delete(sessionId);
    }
    res.json({ success: true });
  }
}

module.exports = new ChatbotController();
