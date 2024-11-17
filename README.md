# Collaborative Todo App with Supabase

A modern, collaborative todo application built with React and Supabase, featuring real-time updates, task sharing, and notifications.

## Features

- User authentication and authorization
- Create, update, and delete todos
- Share todos with other users
- Task scheduling with due dates
- Real-time notifications
- Social media sharing
- Email notifications
- Dark/Light mode support

## Tech Stack

- Frontend: React with Vite
- UI Framework: Chakra UI
- Backend: Supabase
- Database: PostgreSQL (hosted by Supabase)
- Real-time: Supabase Realtime
- Authentication: Supabase Auth

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a new Supabase project at https://supabase.com

4. Copy your Supabase project URL and anon key from the project settings

5. Create a `.env` file in the root directory and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

6. Set up the database schema:
   - Go to the SQL editor in your Supabase dashboard
   - Copy the contents of `schema.sql` and execute it

7. Start the development server:
   ```bash
   npm run dev
   ```

## Database Schema

The application uses three main tables:
- `profiles`: Stores user profile information
- `todos`: Stores todo items with sharing capabilities
- `notifications`: Handles user notifications

Row Level Security (RLS) policies are implemented to ensure data security.

## Contributing

Feel free to submit issues and enhancement requests!
