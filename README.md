# Vacation Planner

A personal vacation planning application with calendar view, event scheduling, expense tracking, and travel information management.

## Features

- 📅 **Calendar View** - Visual trip planning with date selection
- 📍 **Day-by-Day Itinerary** - Organize events by day with timestamps
- 💰 **Expense Tracking** - Track costs per event or day
- 🎒 **Packing Lists** - Manage what to bring
- 🌤️ **Weather Integration** (Coming soon)
- 👥 **Multi-user Support** - Share trips with travel companions

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Calendar**: FullCalendar
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Coming soon)

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. A Supabase account (free tier works)

### Setup Instructions

1. **Clone and install dependencies:**
   ```bash
   cd vacation-planner
   npm install
   ```

2. **Set up Supabase:**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run the contents of `supabase-schema.sql`
   - Get your project URL and anon key from Settings > API

3. **Configure environment variables:**
   - Update `.env.local` with your Supabase credentials:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Keep this secret!
     ```
   - Note: The `NEXT_PUBLIC_` variables are safe to expose as they rely on Row Level Security (RLS)

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)**

## Usage

1. **Create a Trip**: Click and drag on the calendar to select dates
2. **Add Details**: Name your trip and specify the destination
3. **Plan Days**: Add events, activities, and expenses for each day
4. **Track Expenses**: Monitor your budget in real-time
5. **Pack Smart**: Use the packing list to ensure you don't forget anything

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
├── lib/             # Utilities and Supabase client
└── types/           # TypeScript type definitions
```

## Roadmap

- [x] Basic calendar and trip creation
- [ ] Day-by-day event management
- [ ] Expense tracking with categories
- [ ] Packing list functionality
- [ ] Weather API integration
- [ ] User authentication
- [ ] Trip sharing between users
- [ ] Mobile app version

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Contributing

This is a personal project, but suggestions are welcome! Feel free to open an issue.