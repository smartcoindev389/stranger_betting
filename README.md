# Betting Game Platform

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd betting
```

### 2. Database Setup

1. **Create MySQL Database**:
   ```sql
   CREATE DATABASE chat_maer;
   ```

2. **Run the Schema**:
   ```bash
   # Connect to MySQL and run the schema file
   mysql -u root -p chat_maer < backend/src/db/schema.sql
   ```
   
   Or manually execute the SQL file in your MySQL client:
   - Open `backend/src/db/schema.sql`
   - Execute it in your MySQL database

### 3. Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**:
   Edit `backend/.env` and fill in the required values:
   ```env
   # Database
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=chat_maer

   # JWT Secret (generate a strong random string)
   JWT_SECRET=your-very-secure-random-secret-key

   # Session Secret (generate a strong random string)
   SESSION_SECRET=your-very-secure-session-secret

   # Google OAuth (see GOOGLE_OAUTH_SETUP.md for setup)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret

   # Mercado Pago (optional, for payment features)
   MERCADO_PAGO_ACCESS_TOKEN=your-mercadopago-token
   ```

### 4. Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**:
   Edit `frontend/.env` and fill in the required values:
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_GOOGLE_CLIENT_ID=your-google-client-id
   ```

## Running the Project

### Development Mode

1. **Start the Backend Server**:
   ```bash
   cd backend
   npm run dev
   ```
   The backend will start on `http://localhost:3001`

2. **Start the Frontend** (in a new terminal):
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will start on `http://localhost:5173` (or port 3000)

3. **Access the Application**:
   Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

### Production Mode

1. **Build the Backend**:
   ```bash
   cd backend
   npm run build
   npm start
   ```

2. **Build the Frontend**:
   ```bash
   cd frontend
   npm run build
   npm start
   ```

## Environment Variables Reference

### backend (.env)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3001 |
| `NODE_ENV` | Environment (development/production) | No | development |
| `DB_HOST` | MySQL host | No | localhost |
| `DB_USER` | MySQL username | No | root |
| `DB_PASSWORD` | MySQL password | Yes | - |
| `DB_NAME` | Database name | No | chat_maer |
| `JWT_SECRET` | Secret for JWT tokens | Yes | - |
| `JWT_EXPIRES_IN` | JWT expiration time | No | 7d |
| `SESSION_SECRET` | Session secret | Yes | - |
| `CLIENT_URL` | Frontend URL | No | http://localhost:5173 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes* | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes* | - |
| `MERCADO_PAGO_ACCESS_TOKEN` | Mercado Pago access token | No** | - |

*Required for Google OAuth login
**Required only if using payment features

### Frontend (.env)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend API URL | No | http://localhost:3001 |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes* | - |

*Required for Google OAuth login

## Google OAuth Setup

For detailed instructions on setting up Google OAuth, see [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md).

Quick steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs
6. Copy Client ID and Client Secret to your `.env` files

## Mercado Pago Setup (Optional)

If you want to enable payment features:

1. Create an account at [Mercado Pago](https://www.mercadopago.com.br/)
2. Go to [Developers Dashboard](https://www.mercadopago.com.br/developers)
3. Create credentials and get your Access Token
4. Add it to `backend/.env` as `MERCADO_PAGO_ACCESS_TOKEN`

## Database Schema

The database includes the following main tables:
- `users` - User accounts and authentication
- `rooms` - Game rooms
- `matches` - Game match history
- `reports` - User reports
- `betting_transactions` - Betting history
- `pix_transactions` - Payment transactions

See `backend/src/db/schema.sql` for the complete schema.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Username-based login
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/verify` - Verify JWT token
- `POST /api/auth/set-username` - Set display username

### Admin (requires admin token)
- `POST /api/admin/users` - Get all users
- `POST /api/admin/users/ban` - Ban a user
- `POST /api/admin/users/unban` - Unban a user
- `POST /api/admin/reports` - Get all reports
- `POST /api/admin/stats` - Get statistics

### Payments
- `POST /api/pix/deposit` - Create deposit request
- `POST /api/pix/withdrawal` - Create withdrawal request

## Socket.io Events

### Client → Server
- `user_connect` - Connect user to socket
- `join_random` - Join random game room
- `join_keyword` - Join room by keyword
- `make_move` - Make a game move
- `send_message` - Send chat message
- `report_user` - Report a user

### Server → Client
- `connected` - User connected successfully
- `error` - Error occurred
- `game_start` - Game started
- `move_update` - Game move update
- `chat_message` - New chat message
- `account_banned` - Account banned notification

## Security Features

- **Auto-ban System**: Users with 5+ reports are automatically banned
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: All inputs are validated
- **SQL Injection Protection**: Using parameterized queries
- **CORS Protection**: Configured CORS for allowed origins only

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running: `mysql -u root -p`
- Check database credentials in `backend/.env`
- Ensure database exists: `CREATE DATABASE chat_maer;`

### Port Already in Use
- Change `PORT` in `backend/.env` if 3001 is taken
- Update `VITE_API_URL` in `frontend/.env` to match

### Google OAuth Not Working
- Verify Client ID and Secret are correct
- Check redirect URIs in Google Cloud Console
- Ensure both server and frontend use the same Client ID

### Socket.io Connection Issues
- Verify server is running
- Check CORS configuration
- Ensure WebSocket proxy is configured in `vite.config.ts`

## Development

### Code Style
- ESLint for linting
- Prettier for formatting
- TypeScript for type safety

### Scripts

**Backend:**
```bash
npm run dev      # Start development server with hot reload
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run linter
npm run format   # Format code
```

**Frontend:**
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run linter
```

## License

ISC

## Support

For issues and questions, please open an issue in the repository.



