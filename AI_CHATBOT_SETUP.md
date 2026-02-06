# 🤖 AI Chatbot Setup Guide - Google Gemini Integration

## ✅ What's Been Installed

Your car dealership website now has an **AI-powered chatbot** using Google Gemini API!

### Features:
- 🧠 **Real AI responses** - Uses Google's Gemini Pro model
- 🚗 **Car dealership focused** - Trained specifically for automotive sales
- 💰 **FREE tier** - 1,500 requests/day at no cost
- 🔄 **Conversation memory** - Remembers context within each session
- ⚡ **Fallback system** - Works even without API key

---

## 🚀 How to Get Your FREE API Key

### Step 1: Visit Google AI Studio
Go to: **https://makersuite.google.com/app/apikey**

### Step 2: Sign In
- Sign in with your Google account
- No credit card required!

### Step 3: Create API Key
1. Click **"Create API Key"**
2. Select **"Create API key in new project"** (or choose existing project)
3. Copy your API key (starts with "AIza...")

### Step 4: Add to Your Project
Open your `.env` file and replace this line:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

With your actual key:
```
GEMINI_API_KEY=AIzaSyC...your_actual_key_here
```

### Step 5: Restart Your Server
Stop your Node.js server (Ctrl+C) and restart it:
```bash
node app.js
```

---

## 📊 Free Tier Limits

Google Gemini Free Tier includes:
- ✅ **1,500 requests per day**
- ✅ **15 requests per minute**
- ✅ **1 million tokens per day**

For a typical chatbot conversation:
- Average conversation = 3-5 messages
- **You can handle 300-500 full conversations per day FREE!**

---

## 🧪 Testing Your Chatbot

1. Open your website in a browser
2. Click the red chatbot button in the bottom-right corner
3. Try these test messages:
   - "Tell me about your inventory"
   - "What financing options do you offer?"
   - "I want to schedule a test drive"
   - "What's your trade-in process?"

### If API Key is Working:
- Responses will be natural and conversational
- AI will understand context and follow-up questions
- You'll see `source: 'gemini-ai'` in browser console

### If API Key is Missing:
- Chatbot still works with fallback responses
- Responses are pre-programmed but helpful
- You'll see `source: 'fallback'` in browser console

---

## 🛠️ Technical Details

### Files Modified:
1. **`controllers/ChatbotController.js`** - Backend AI logic
2. **`app.js`** - Added `/api/chatbot` route
3. **`public/chatbot.js`** - Updated frontend to call API
4. **`.env`** - Added GEMINI_API_KEY configuration

### API Endpoint:
```
POST /api/chatbot
Body: { "message": "user message", "sessionId": "optional_session_id" }
Response: { "response": "AI response", "source": "gemini-ai" or "fallback" }
```

### Conversation Context:
The AI knows about:
- Your vehicle inventory (/shop route)
- Financing and payment options
- Test drive scheduling
- Trade-in process
- Dealership hours
- Warranty information
- And more!

---

## 💡 Customization Tips

### Want to change the AI's personality?
Edit the `systemContext` in `controllers/ChatbotController.js`:
```javascript
this.systemContext = `You are an AI assistant for a premium car dealership...`
```

### Want to add more quick replies?
Edit `getContextualQuickReplies()` in `public/chatbot.js`

### Want to track analytics?
Add logging in `ChatbotController.chat()` method to track:
- Most common questions
- Conversation length
- User satisfaction

---

## 🔒 Security Notes

- ✅ API key is stored in `.env` (server-side only)
- ✅ Never exposed to frontend/browser
- ✅ Rate limiting handled by Google
- ✅ No user data sent to Google (only messages)

---

## 🆘 Troubleshooting

### "AI temporarily unavailable" error?
- Check if `.env` has correct API key
- Verify API key is active at Google AI Studio
- Check if you've exceeded free tier limits
- Chatbot will use fallback responses automatically

### Chatbot not responding at all?
- Check browser console for errors
- Verify `/api/chatbot` route is accessible
- Make sure server restarted after .env changes

### Want to test without API key?
- Just leave `GEMINI_API_KEY=your_gemini_api_key_here`
- Chatbot works perfectly with fallback responses!

---

## 📈 Next Steps

1. **Get your API key** (5 minutes)
2. **Test the chatbot** with various questions
3. **Monitor usage** at https://makersuite.google.com
4. **Customize responses** to match your dealership's brand
5. **Gather customer feedback** and iterate

---

## 🎉 You're All Set!

Your AI chatbot is ready to help customers 24/7. Even without the API key, it provides helpful fallback responses. With the API key, it becomes a smart, conversational assistant!

Questions? Check the code comments in:
- `controllers/ChatbotController.js`
- `public/chatbot.js`

Happy selling! 🚗💨
