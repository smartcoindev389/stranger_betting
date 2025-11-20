# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for the betting application.

## Prerequisites

1. A Google Cloud Platform account
2. Access to Google Cloud Console

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen first:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in the required information (App name, User support email, Developer contact)
   - Add your email as a test user (for testing)
   - Save and continue through the scopes and test users screens
6. For the OAuth client ID:
   - **Application type**: Web application
   - **Name**: Give it a name (e.g., "Betting App OAuth")
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173` (for development)
     - `http://localhost:3000` (alternative dev port)
     - Your production URL (when deploying)
   - **Authorized redirect URIs**: 
     - `http://localhost:5173` (for development)
     - `http://localhost:3000` (alternative dev port)
     - Your production URL (when deploying)
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Backend Environment Variables

Create or update the `.env` file in the `server` directory:

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Session Secret (generate a strong random string)
SESSION_SECRET=your_session_secret_here

# Other existing environment variables...
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=real_skills
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret_here
```

### Generate Session Secret

You can generate a secure session secret using one of these methods:

**Option A: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B: Using OpenSSL**
```bash
openssl rand -hex 32
```

## Step 3: Configure Frontend Environment Variables

Create or update the `.env` file in the `frontend` directory:

```env
# Google OAuth Client ID (same as backend)
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# Backend API URL
VITE_API_URL=http://localhost:3001
```

**Note**: In Vite, environment variables must be prefixed with `VITE_` to be accessible in the browser.

## Step 4: Database Schema

The database schema already includes the necessary OAuth fields:
- `oauth_provider` (ENUM: 'google')
- `oauth_id` (VARCHAR)
- `email` (VARCHAR)
- `profile_picture` (VARCHAR)

If you haven't run the schema migration yet, make sure to run:
```sql
-- The schema is in server/src/db/schema.sql
```

### Migrating Existing Databases

If you have an existing database with the old schema that included Facebook, you'll need to update the ENUM:

```sql
-- Update the oauth_provider ENUM to only include 'google'
ALTER TABLE users MODIFY COLUMN oauth_provider ENUM('google') NULL;
```

**Note**: This project only supports Google authentication. Facebook support has been removed.

## Step 5: Install Dependencies

### Backend
```bash
cd server
npm install
```

The following packages are already installed:
- `passport`
- `passport-google-token`
- `express-session`
- `@types/passport`
- `@types/express-session`

### Frontend
```bash
cd frontend
npm install
```

The following package is already installed:
- `@react-oauth/google`

## Step 6: Start the Application

### Start Backend Server
```bash
cd server
npm run dev
```

### Start Frontend (in a new terminal)
```bash
cd frontend
npm run dev
```

## Step 7: Test Google OAuth

1. Navigate to the login page
2. Click "Sign in with Google"
3. Select your Google account
4. Grant permissions
5. You should be redirected back to the application and logged in

## Troubleshooting

### Common Issues

1. **"Invalid Google profile data" error**
   - Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correctly set in the backend `.env`
   - Verify the credentials in Google Cloud Console

2. **CORS errors**
   - Make sure `CLIENT_URL` in backend `.env` matches your frontend URL
   - Check that the frontend URL is in the `allowedOrigins` array in `server/src/index.ts`

3. **"Authentication failed" error**
   - Check browser console for detailed error messages
   - Verify that the Google Client ID in frontend `.env` matches the backend
   - Ensure the redirect URI in Google Cloud Console matches your frontend URL

4. **Session not persisting**
   - Make sure `SESSION_SECRET` is set in backend `.env`
   - Check that cookies are enabled in your browser
   - Verify CORS credentials are enabled (already configured)

5. **Database errors**
   - Ensure the database is running and accessible
   - Verify the database schema has been applied
   - Check database connection settings in `.env`

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env` files to Git (they should be in `.gitignore`)
- Use strong, unique secrets for production
- Never share your secrets publicly
- Rotate secrets regularly in production environments
- Use HTTPS in production
- Keep your Google Client Secret secure

## Production Deployment

When deploying to production:

1. Update Google Cloud Console OAuth credentials:
   - Add your production domain to **Authorized JavaScript origins**
   - Add your production domain to **Authorized redirect URIs**

2. Update environment variables:
   - Set `NODE_ENV=production`
   - Use production database credentials
   - Use production URLs for `CLIENT_URL` and `VITE_API_URL`
   - Use strong, unique secrets

3. Ensure HTTPS is enabled (required for secure cookies in production)

