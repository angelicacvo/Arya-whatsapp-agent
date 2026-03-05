# WhatsApp Shopping Assistant

A smart WhatsApp bot that helps users find and compare product prices across Colombian stores using AI.

## What Does It Do?

This bot connects to WhatsApp and automatically responds to users asking about product prices. When someone asks "How much is an iPhone 13?", the bot:

1. Understands that the user wants price information
2. Searches real prices across Colombian online stores
3. Compares prices from different retailers
4. Recommends the best deal
5. Saves the conversation to a database

## Technologies Used

- **NestJS** - Backend framework (Node.js with TypeScript)
- **OpenAI GPT-4** - Artificial intelligence for understanding messages and generating responses
- **SerpAPI** - Web search API to find real product prices online
- **WhatsApp Cloud API** - Official Meta API to send/receive WhatsApp messages
- **Supabase** - PostgreSQL database in the cloud
- **TypeORM** - Database communication tool
- **Docker** - Container system for easy deployment

## Prerequisites

Before starting, you need these accounts (all have free tiers):

1. **OpenAI Account** - Get API key from platform.openai.com
2. **SerpAPI Account** - Get free API key from serpapi.com (100 searches/month free)
3. **Meta Developer Account** - Get WhatsApp API access from developers.facebook.com
4. **Supabase Account** - Get free PostgreSQL database from supabase.com
5. **Node.js 20+** - Download from nodejs.org

## Installation Steps

### Step 1: Clone the Repository

Download or clone this project to your computer.

### Step 2: Install Dependencies

Open a terminal in the project folder and run:

```
npm install
```

This downloads all necessary libraries.

### Step 3: Configure Environment Variables

Create a file named `.env` in the project root folder. Copy the content from `.env.example` and fill in your credentials:

**OPENAI_API_KEY**
- Go to platform.openai.com
- Create an API key in your account settings
- Paste it here (starts with "sk-proj-")

**SERPAPI_KEY**
- Go to serpapi.com and create a free account
- Copy your API key from the dashboard
- Paste it here

**WHATSAPP_CLOUD_API_VERSION**
- Keep as "v22.0" (current WhatsApp API version)

**WHATSAPP_CLOUD_API_PHONE_NUMBER_ID**
- Go to developers.facebook.com
- Create a WhatsApp Business App
- Get your Phone Number ID from the dashboard
- Paste it here

**WHATSAPP_CLOUD_API_ACCESS_TOKEN**
- In the same WhatsApp dashboard
- Generate an access token
- Paste it here

**WHATSAPP_CLOUD_API_WEBHOOK_VERIFICATION**
- Create a random secret phrase (like "mySecretToken123")
- You'll need this when configuring the webhook

**Database Variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)**
- Go to supabase.com and create a free project
- Go to Project Settings > Database
- Copy the connection details
- Paste each value in the corresponding variable

**PORT**
- Keep as 3000 (or change if you prefer another port)

### Step 4: Set Up Database Tables

Go to your Supabase project dashboard > SQL Editor and run the SQL file located at `database/schema.sql`. This creates the necessary tables.

### Step 5: Start the Application

Run in terminal:

```
npm run start:dev
```

The bot will start on http://localhost:3000

### Step 6: Configure WhatsApp Webhook

You need a public URL for WhatsApp to send messages to your bot. Options:

**Option A: Using ngrok (for testing)**
- Install ngrok from ngrok.com
- Run: `ngrok http 3000`
- Copy the HTTPS URL (like https://abc123.ngrok.io)
- Go to your WhatsApp dashboard > Configuration
- Set webhook URL: https://abc123.ngrok.io/whatsapp/webhook
- Set verify token: the same value you put in WHATSAPP_CLOUD_API_WEBHOOK_VERIFICATION
- Subscribe to "messages" events

**Option B: Deploy to a server (production)**
- Use Railway, Render, or any cloud service
- Follow their deployment instructions
- Use the public URL they provide for the webhook

## Testing Your Bot

### Method 1: Test via Postman

Send a POST request to:
```
URL: http://localhost:3000/whatsapp/webhook
Method: POST
Headers: Content-Type: application/json
```

Body example:
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "573001234567",
          "id": "wamid.test123",
          "type": "text",
          "text": {
            "body": "cuanto cuesta un iphone 13"
          }
        }]
      }
    }]
  }]
}
```

### Method 2: Test via WhatsApp

Once webhook is configured:
- Send a message from your phone to the WhatsApp Business number
- The bot should respond automatically

## Postman Collection

A complete Postman collection is available for testing the API endpoints:

**Collection ID:** `0b280cc9-4baa-4071-8962-a1cadcbc5522`

**Available Endpoints:**

1. **GET /whatsapp/webhook** - Webhook Verification
   - Query Parameters:
     - `hub.mode`: "subscribe"
     - `hub.verify_token`: Your verification token
     - `hub.challenge`: Test challenge value
   - Response: Returns the challenge value if verification is successful

2. **POST /whatsapp/webhook** - Receive WhatsApp Message
   - Headers: `Content-Type: application/json`
   - Body: WhatsApp Cloud API webhook format (see collection for example)
   - Response: "Message processed" (200 OK)

**Collection Variables:**
- `base_url`: Railway deployment URL (https://bountiful-reprieve-production.up.railway.app)
- `verify_token`: Webhook verification token

**How to Use:**
1. Go to your Postman workspace
2. Find "WhatsApp Agent API" collection
3. Update variables with your own values if testing locally
4. Run the requests to test the endpoints

**For Local Testing:**
Change the `base_url` variable to `http://localhost:3003` (or your local port).

## Project Structure Explained

The project is organized in modules. Each module handles a specific responsibility:

**whatsapp/** - Handles WhatsApp communication
- Receives messages from WhatsApp API
- Sends responses back to users
- Verifies webhook connections

**openai/** - Handles artificial intelligence
- Analyzes user messages to understand intent
- Determines if user wants price information
- Generates friendly responses using GPT-4
- Uses a "tool" system to fetch price data when needed

**price-comparison/** - Handles price searching (THE TOOL)
- Searches Google for product prices using SerpAPI
- Extracts price information from search results
- Compares prices across different stores
- Formats data for the AI to use
- Returns the best deals to users

**database/** - Handles data storage
- Saves all conversations to PostgreSQL
- Records user phone numbers, messages, and bot responses
- Tracks which products people search for
- Enables analytics and conversation history

**common/** - Shared utilities
- Security functions to detect malicious inputs
- Input sanitization to prevent attacks
- Validation schemas using Zod library

## How It Works (Step by Step)

1. User sends WhatsApp message: "How much is an iPhone?"
2. WhatsApp API sends message to your webhook endpoint
3. **whatsapp module** receives and validates the message
4. Message is sent to **openai module** for analysis
5. **openai module** uses GPT-4 to understand user wants price info
6. GPT-4 decides to use the "get_price_comparison" tool
7. **price-comparison module** searches Google via SerpAPI
8. Finds prices from Mercado Libre, Falabella, Exito, etc.
9. Extracts and organizes price data
10. Returns data to **openai module**
11. GPT-4 generates a friendly response with recommendations
12. **whatsapp module** sends response back to user
13. **database module** saves the entire conversation

## Deployment Options

### Docker Compose (Recommended for Local)

Make sure your .env file is configured, then run:
```
docker-compose up -d
```

### Railway (Recommended for Production)

Railway automatically deploys your app:
1. Create account on railway.app
2. Connect your GitHub repository
3. Add all environment variables in Railway dashboard
4. Railway builds and deploys automatically
5. Use the provided URL for WhatsApp webhook configuration

### Direct Node.js

For production without Docker:
```
npm run build
npm run start:prod
```

## Common Issues

**Bot doesn't respond**
- Check that all environment variables are correctly set
- Verify webhook is configured in WhatsApp dashboard
- Check logs for errors

**Database connection fails**
- Verify Supabase credentials are correct
- Check that database tables were created with schema.sql
- Ensure database port is 6543 (Supabase default)

**Price search returns no results**
- Verify SERPAPI_KEY is valid
- Check you haven't exceeded the free tier limit (100 searches/month)
- Try with common products like "iPhone" or "PlayStation"

**OpenAI errors**
- Verify API key is valid and has credits
- Check you're using a compatible model (gpt-4o-mini)

## Security Features

The bot includes multiple security layers:
- Malicious input detection (SQL injection, prompt injection)
- Input sanitization (removes dangerous characters)
- Rate limiting capabilities
- Secure database connections
- Type validation using Zod schemas

## Additional Notes

- Free tier limits: 100 SerpAPI searches per month, OpenAI credits depend on your plan
- WhatsApp Cloud API is free for most usage levels
- The bot works specifically for Colombian stores by default
- All conversations are saved in the database for analytics

## Support

For issues or questions, check the logs in the terminal or in your cloud provider dashboard. Most problems are related to incorrect environment variables or API credentials.
