# Mercado Pago Pix Integration Setup

## Credentials Received

You have received the following production credentials from Mercado Pago:

- **Public Key**: `APP_USR-4b57c57d-2663-4012-9bf0-48e7868ac584`
- **Access Token**: `APP_USR-7371226747769223-052119-484a3b089263f38abb5b16fb5b957492-411569260`
- **Client ID**: `7371226747769223`
- **Client Secret**: `yLdUCH2IAdtggpo3zWmwI9Pdxpjvlemf`

## Which Credential to Use

For the **Pix integration** (server-side), you only need the **Access Token**.

- ✅ **Access Token**: Used for server-side Pix payments (what we implemented)
- ⚠️ **Public Key**: Used for frontend integrations (Mercado Pago Checkout Pro) - not needed for current Pix integration
- ⚠️ **Client ID & Secret**: Used for OAuth flows - not needed for current Pix integration

## Setup Instructions

### 1. Create `.env` file in the `server` directory

Create a file named `.env` in the `server` folder with the following content:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=real_skills

# Mercado Pago Configuration
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-7371226747769223-052119-484a3b089263f38abb5b16fb5b957492-411569260
```

### 2. Replace the Access Token

Copy your Access Token and paste it in the `.env` file:

```
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-7371226747769223-052119-484a3b089263f38abb5b16fb5b957492-411569260
```

### 3. Start the Server

```bash
cd server
npm run dev
```

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit the `.env` file to git
- The `.env` file should be in `.gitignore`
- Keep your Access Token secret
- These are **production credentials** - use them carefully

## Testing

1. Start your server
2. Open the frontend and navigate to the Pix Wallet component
3. Try creating a deposit request
4. You should see a QR code generated from Mercado Pago

## Webhook Setup (Optional)

If you want instant payment notifications (optional - polling works fine):

1. Use ngrok for development: `ngrok http 3001`
2. Configure webhook in Mercado Pago dashboard: `https://your-ngrok-url.ngrok.io/api/pix/webhook`
3. Or use your production domain when deployed

The system works perfectly without webhooks using the polling mechanism.

