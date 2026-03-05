# OWL

Welcome to the OWL social media platform! 🦉

Owl is a full-stack web application built with modern web technologies, following best practices for security, performance, and responsive design.

## Features

- **User Authentication:** Secure login, signup, and logout with JWT management and token refresh.
- **Dynamic Feeds:** "For You" personalized discovery and "Following" chronological feeds.
- **Social Interactions:** Like/unlike posts and Follow/Unfollow users with real-time UI updates.
- **Saved Posts:** Bookmark posts to view them later in your private collection.
- **Rich Media:** Multi-image post support with dynamic grid layouts (1-4 images).
- **Appearance:** Built-in support for Light and Dark modes with a persistent toggle.
- **Deleted Content:** Soft-delete mechanism with graceful placeholders for deleted posts in threads.
- **User Profiles:** Comprehensive profiles showing following/followers counts, total likes, and post history.
- **User Hover Cards:** Quick profile previews on hover throughout the platform.
- **Mobile Friendly:** Responsive layout with a dedicated mobile navigation bar and menu.
- **State Management:** Efficient global state using Zustand and React Query (TanStack Query).

## Technologies Used

- **Frontend:**
  - React (TypeScript)
  - Zustand (State management)
  - React Query (Data fetching & Caching)
  - Axios (HTTP client)
  - Mantine UI (Component library & Theming)

- **Backend:**
  - Node.js (Express)
  - Prisma (ORM)
  - PostgreSQL (Database)
  - JSON Web Tokens (JWT) for authentication
  - Argon2 (Password hashing)

- **DevOps:**
  - Docker & Docker Compose
  - Caddy (Web server / Reverse proxy)

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

3. **Set up environment variables:**
   Create a `.env` file in both the `client` and `server` directories (see [Environment Variables](#environment-variables)).

## Running the Application

1. **Development Mode:**
   Run both client and server concurrently from the root:
   ```sh
   pnpm dev
   ```

2. **Docker Mode:**
   ```sh
   docker-compose up --build
   ```

## API Endpoints

All API endpoints are prefixed with `/api/v1`.

- **Authentication:**
  - **POST** `/auth/signup` / `/auth/login` / `/auth/logout`
  - **GET** `/auth/refresh-token`

- **Users:**
  - **GET** `/users/:username` - Get user profile
  - **PUT** `/users/follow/:id` - Follow/Unfollow (protected)
  - **PUT** `/users/me/profile` - Update own profile (protected)

- **Posts:**
  - **GET** `/posts/for-you` / `/posts/following` / `/posts/hot`
  - **GET** `/posts/saved` - Get bookmarked posts (protected)
  - **GET** `/posts/:postId` - Get single post (handles deleted content)
  - **POST** `/posts` - Create post / Reply to post (protected)
  - **PUT** `/posts/:postId/like` / `/posts/:postId/save` (protected)
  - **DELETE** `/posts/:postId` - Soft-delete a post (protected)

## TODOs

- [x] **Navigation Enhancements**
  - [x] Implement return/back button logic.
  - [x] Mobile-friendly bottom navigation with quick-access menu.
- [x] **User Interface Improvements**
  - [x] Theme toggle for light and dark modes.
  - [x] Real-time UI updates (React Query).
- [x] **Media Support**
  - [x] Multi-image post layouts.
- [x] **Content Management**
  - [x] Graceful deleted post indicators.
  - [x] Post bookmarking (Saved posts).
- [ ] **Technical & Security**
  - [ ] Administrative roles for content moderation.
  - [ ] Rate limiting on API endpoints.
- [ ] **Real-Time Communication**
  - [ ] Chat functionality for messaging.
  - [ ] Real-time notifications.

## License
MIT License.
