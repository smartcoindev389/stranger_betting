# Vercel Deployment Guide

This guide covers deploying your betting game platform to Vercel. Since your application uses Socket.io (which requires persistent connections), we'll deploy the frontend to Vercel and provide options for the backend.

## Architecture Overview

- **Frontend**: Deploy to Vercel (Static Site + Serverless Functions)
- **Backend**: Deploy separately (Railway, Render, or another service that supports persistent connections)
- **Database**: Use a cloud MySQL database (PlanetScale, AWS RDS, or similar)

## Option 1: Frontend on Vercel + Backend on Railway/Render (Recommended)

### Step 1: Deploy Frontend to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

3. **Create `vercel.json` configuration**:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "devCommand": "npm run dev",
     "installCommand": "npm install",
     "framework": "vite",
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

4. **Update environment variables**:
   - Create a `.env.production` file or set them in Vercel dashboard
   - Update `VITE_API_URL` to point to your backend URL (e.g., `https://your-backend.railway.app`)

5. **Deploy to Vercel**:
   ```bash
   vercel
   ```
   Or use the Vercel dashboard:
   - Go to [vercel.com](https://vercel.com)
   - Import your Git repository
   - Set root directory to `frontend`
   - Configure build settings:
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Install Command: `npm install`

6. **Set Environment Variables in Vercel Dashboard**:
   - Go to Project Settings → Environment Variables
   - Add:
     - `VITE_API_URL`: Your backend URL (e.g., `https://your-backend.railway.app`)
     - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth Client ID

### Step 2: Deploy Backend to Railway (Recommended for Socket.io)

Railway supports persistent connections needed for Socket.io.

1. **Sign up at [railway.app](https://railway.app)**

2. **Create a new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo" (connect your repository)

3. **Configure the service**:
   - Root Directory: `backend`
   - Build Command: `npm run build`
   - Start Command: `npm start`

4. **Set Environment Variables** in Railway:
   ```
   NODE_ENV=production
   PORT=3001
   DB_HOST=your-database-host
   DB_USER=your-database-user
   DB_PASSWORD=your-database-password
   DB_NAME=real_skills
   JWT_SECRET=your-jwt-secret
   SESSION_SECRET=your-session-secret
   CLIENT_URL=https://your-frontend.vercel.app
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   MERCADO_PAGO_ACCESS_TOKEN=your-mercadopago-token (optional)
   ```

5. **Set up MySQL Database**:
   - In Railway, add a MySQL service
   - Or use PlanetScale, AWS RDS, or another cloud MySQL provider
   - Update `DB_HOST`, `DB_USER`, `DB_PASSWORD` accordingly

6. **Update CORS in Backend**:
   Update `backend/src/index.ts` to include your Vercel frontend URL:
   ```typescript
   const allowedOrigins = [
     config.clientUrl,
     "https://your-frontend.vercel.app",
     "https://your-frontend.vercel.app",
     // ... other origins
   ];
   ```

### Step 3: Update Frontend Socket Configuration

Update `frontend/src/utils/socket.ts` to use your backend URL:

```typescript
const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://your-backend.railway.app';
```

## Option 2: Full Stack on Vercel (Limited Socket.io Support)

⚠️ **Warning**: Vercel's serverless functions don't support persistent WebSocket connections well. Socket.io will have limitations.

### Create API Routes Structure

1. **Create `api` directory in frontend**:
   ```
   frontend/
   ├── api/
   │   ├── auth/
   │   │   └── [...].ts
   │   ├── pix/
   │   │   └── [...].ts
   │   └── admin/
   │       └── [...].ts
   ```

2. **Create proxy API routes** (example for auth):
   ```typescript
   // frontend/api/auth/[...].ts
   import type { VercelRequest, VercelResponse } from '@vercel/node';
   
   export default async function handler(
     req: VercelRequest,
     res: VercelResponse
   ) {
     const backendUrl = process.env.BACKEND_URL || 'https://your-backend.railway.app';
     const path = req.query['path'] as string[];
     const url = `${backendUrl}/api/auth/${path.join('/')}`;
     
     try {
       const response = await fetch(url, {
         method: req.method,
         headers: {
           'Content-Type': 'application/json',
           ...(req.headers.authorization && { Authorization: req.headers.authorization }),
         },
         body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
       });
       
       const data = await response.json();
       res.status(response.status).json(data);
     } catch (error) {
       res.status(500).json({ error: 'Internal server error' });
     }
   }
   ```

3. **For Socket.io**, you'll still need a separate backend service.

## Recommended Setup: Frontend (Vercel) + Backend (Railway)

### Complete Deployment Steps

1. **Deploy Backend to Railway**:
   ```bash
   # In Railway dashboard:
   # 1. Connect GitHub repo
   # 2. Set root directory: backend
   # 3. Set build command: npm run build
   # 4. Set start command: npm start
   # 5. Add environment variables
   # 6. Add MySQL database service
   ```

2. **Deploy Frontend to Vercel**:
   ```bash
   cd frontend
   vercel
   ```

3. **Update CORS in Backend**:
   Add your Vercel domain to allowed origins in `backend/src/index.ts`.

4. **Update Frontend Environment Variables**:
   In Vercel dashboard, set:
   - `VITE_API_URL`: Your Railway backend URL
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth Client ID

5. **Database Setup**:
   - Use Railway's MySQL service or external provider
   - Run the schema: `mysql -h [host] -u [user] -p [database] < backend/src/db/schema.sql`
   - Or use Railway's database console

## Environment Variables Checklist

### Frontend (Vercel)
- `VITE_API_URL` - Backend API URL
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID

### Backend (Railway/Render)
- `NODE_ENV=production`
- `PORT=3001`
- `DB_HOST` - Database host
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_NAME=real_skills`
- `JWT_SECRET` - Strong random secret
- `SESSION_SECRET` - Strong random secret
- `CLIENT_URL` - Your Vercel frontend URL
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
- `MERCADO_PAGO_ACCESS_TOKEN` - (Optional) Mercado Pago token

## Post-Deployment Checklist

- [ ] Backend is accessible and health check works
- [ ] Frontend can connect to backend API
- [ ] Socket.io connections work (check browser console)
- [ ] Google OAuth redirects work (update redirect URIs in Google Console)
- [ ] Database connection is working
- [ ] CORS is properly configured
- [ ] Environment variables are set correctly

## Troubleshooting

### Socket.io Connection Issues
- Ensure backend supports WebSocket connections (Railway, Render do)
- Check CORS configuration includes frontend URL
- Verify `VITE_API_URL` is correct in frontend

### CORS Errors
- Add your Vercel domain to `allowedOrigins` in backend
- Check that credentials are properly configured

### Database Connection
- Verify database credentials
- Check that database allows connections from your backend IP
- Ensure database exists and schema is applied

### Build Errors
- Check Node.js version (should be >= 18)
- Verify all dependencies are in `package.json`
- Check build logs in Vercel/Railway dashboard

## Alternative Backend Hosting Options

1. **Render** (render.com) - Similar to Railway, supports persistent connections
2. **Fly.io** (fly.io) - Good for Socket.io, supports WebSockets
3. **DigitalOcean App Platform** - Supports persistent connections
4. **AWS EC2 / Lightsail** - Full control, requires more setup

## Cost Considerations

- **Vercel**: Free tier available, paid plans for more features
- **Railway**: Free tier with $5 credit, then pay-as-you-go
- **Database**: PlanetScale has free tier, or use Railway's MySQL

## Security Notes

- Never commit `.env` files
- Use strong secrets for JWT and session
- Enable HTTPS everywhere
- Configure CORS properly
- Use environment variables for all secrets

