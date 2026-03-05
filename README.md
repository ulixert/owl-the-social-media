# OWL

Welcome to the OWL social media platform! 🦉

Owl is a full-stack web application that includes user authentication, token management, and protected routes. The application is built using modern web technologies and follows best practices for security and performance.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Setup and Installation](#setup-and-installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Authentication Flow](#authentication-flow)
- [TODOs](#todos)
- [Contributing](#contributing)
- [License](#license)

## Features

- **User Authentication:** Secure login, signup, and logout with JWT management.
- **Dynamic Feeds:** "For You" personalized discovery and "Following" chronological feeds.
- **Social Interactions:** Like/unlike posts and Follow/Unfollow users with real-time UI updates.
- **Rich Media:** Multi-image post support with dynamic grid layouts (1-4 images).
- **Image Viewer:** Full-screen, interactive image gallery with keyboard navigation.
- **User Profiles:** Comprehensive profiles showing following/followers counts, total likes, and post history.
- **User Hover Cards:** Quick profile previews on hover throughout the platform.
- **Protected Actions:** Seamless authentication prompts for social interactions.
- **State Management:** Efficient global state using Zustand and React Query.

## Technologies Used

- **Frontend:**

  - React
  - TypeScript
  - Zustand (state management)
  - React Query (data fetching)
  - Axios (HTTP client)
  - Mantine UI (component library)

- **Backend:**

  - Node.js
  - Express
  - Prisma (ORM)
  - JSON Web Tokens (JWT) for authentication
  - Argon2 (password hashing)

- **Database:**

  - PostgreSQL

- **DevOps:**
  - Docker
  - Docker Compose
  - Nginx

## Setup and Installation

1. **Clone the repository:**

   ```sh
   git clone https://github.com/ulixert/owl-the-social-media.git
   cd owl
   ```

2. **Install dependencies:**

   The project uses **pnpm** as the package manager.

   ```sh
   pnpm install
   ```

3. **Set up the database:**

   Ensure you have PostgreSQL installed and running. Create a new database for the project.

4. **Set up environment variables:**

   Create a `.env` file in both the [`client`](client) and [`server`](server) directories and add the necessary environment variables (see [Environment Variables](#environment-variables)).

## Environment Variables

### Client

Create a `.env` file in the `client` directory with the following content:

```
VITE_API_PREFIX=http://localhost:3000/api
```

### Server

Create a `.env` file in the `server` directory with the following content:

```
DATABASE_URL=postgresql://user:password@localhost:5432/database
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
API_PREFIX=/api
```

## Running the Application

1. **Start the server:**

   ```sh
   cd server
   pnpm dev
   ```

2. **Start the client:**

   ```sh
   cd client
   pnpm dev
   ```

   Alternatively, you can start both the client and server from the root directory using the workspace scripts:

   ```sh
   pnpm dev
   ```

   This will run both the client and server concurrently.

3. **Running with Docker:**

   Ensure Docker and Docker Compose are installed. Then, run:

   ```sh
   docker-compose up --build
   ```

## Building for Production

To build the application for production, run:

```sh
pnpm build
```

This command will build both the client and the server.

## Starting the Application in Production

After building, you can start the application using:

```sh
pnpm start
```

This will start both the server and the client in production mode.

## API Endpoints

All API endpoints are prefixed with `/api/v1`.

- **Authentication:**
  - **POST** `/auth/signup` - User signup
  - **POST** `/auth/login` - User login
  - **POST** `/auth/logout` - User logout
  - **GET** `/auth/refresh-token` - Refresh access token

- **Users:**
  - **GET** `/users/:username` - Get user profile (includes follow status and stats)
  - **PUT** `/users/follow/:id` - Follow/Unfollow a user (protected)
  - **PUT** `/users/me/profile` - Update own profile (protected)
  - **GET** `/users/me/data` - Get own basic data (protected)

- **Posts:**
  - **GET** `/posts/hot` - Get trending posts
  - **GET** `/posts/for-you` - Personalized discovery feed (protected)
  - **GET** `/posts/following` - Chronological follow feed (protected)
  - **GET** `/posts/:postId` - Get single post details
  - **GET** `/posts/:postId/comments` - Get child posts (comments)
  - **POST** `/posts` - Create a new post (protected)
  - **POST** `/posts/:parentPostId` - Reply to a post (protected)
  - **PUT** `/posts/:postId/like` - Like/Unlike a post (protected)
  - **DELETE** `/posts/:postId` - Delete a post (protected)
  - **GET** `/posts/user/:username/posts` - Get user posts
  - **GET** `/posts/user/:username/replies` - Get user replies

## Authentication Flow

1. **Signup:**

   - User submits signup details.
   - Server creates a new user and returns an access token and a refresh token (stored in an HTTP-only cookie).

2. **Login:**

   - User submits login credentials.
   - Server validates credentials and returns an access token and a refresh token (stored in an HTTP-only cookie).

3. **Access Protected Routes:**

   - Client includes the access token in the `Authorization` header for protected routes.
   - Server verifies the access token and grants access.

4. **Token Refresh:**

   - When the access token expires, the client uses the refresh token to obtain a new access token.
   - The refresh token is sent in an HTTP-only cookie to the `/api/refresh-token` endpoint.

## Feed Algorithm

Owl uses a heuristic discovery engine to power its feeds:

### "Following" Feed
A strictly chronological stream of posts from accounts you follow, including your own posts.

### "For You" Feed
A personalized recommendation engine that blends content using a three-tier candidate generation strategy:
1. **In-Network:** Content from people you directly follow.
2. **Extended Social Graph:** Posts that have been liked by people you follow (finding content your circle finds interesting).
3. **Global Discovery:** A fallback to trending/popular posts (3+ likes) to ensure fresh content.

The resulting candidates are deduplicated and sorted chronologically to ensure a stable, non-shifting user experience.

## TODOs

- [ ] **Navigation Enhancements**

  - Implement return/back button logic throughout the application.
  - Design and integrate a header with page navigation.

- [ ] **User Interface Improvements**

  - Add refresh functionality to update data without reloading the page.
  - Implement a theme toggle button for light and dark modes.

- [x] **Media Support**

  - Enable uploading and displaying multiple images in posts.

- [ ] **Content Management**

  - Allow users to edit and update their existing posts.
  - Implement user account deletion functionality.
  - Display deleted items or posts with a special indicator.

- [ ] **Real-Time Communication**

  - Add chat functionality for real-time messaging between users.

- [ ] **Feature Enhancements**
  - [x] Show suggested content based on user interactions and preferences.
  - Integrate topic categorization for posts using tags or categories.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [`LICENSE`](LICENSE) file for details.
