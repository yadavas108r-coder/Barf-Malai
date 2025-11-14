## Image Upload Setup

### Imgur Configuration

1. **Get Imgur Client ID:**
   - Go to https://api.imgur.com/oauth2/addclient
   - Register a new application
   - Choose "OAuth 2 authorization without a callback URL"
   - Get your Client ID

2. **Update Admin Configuration:**
   - In `admin.js`, replace `YOUR_IMGUR_CLIENT_ID` with your actual Imgur Client ID:
   ```javascript
   this.imgurClientId = 'your_actual_imgur_client_id_here';
