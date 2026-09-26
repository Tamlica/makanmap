# MakanMap

A full-featured food journal application with a map-first interface. Track places you've visited, want to visit, or want to avoid, complete with photos, ratings, and pricing information—all visualized on an interactive map.

## Features

### Map-First Interface
- **Full-screen MapLibreGL map** with responsive design (desktop drawer + mobile sheets)
- **Real-time user location tracking** - Blue pulsing dot shows your current GPS location
- **Status-specific icons** - Visual indicators for place status (visited ✓, want to go 📍, avoid ✗)
- **Smart clustering** - Automatically groups nearby places by status
- **Search integration** - Find locations using OpenStreetMap Nominatim

### Place Management
- **Add/edit/delete places** with intuitive modal form
- **Place details** - Name, location (coordinates), photos, notes, status, rating, price range, visit date, and tags
- **Status tracking** - Mark places as "visited", "want to go", or "avoid"
- **Image uploads** - Upload food photos to Supabase Storage with cloud preview

### Rating System
- **Half-step ratings** (0.5 to 5.0 stars) - Click to rate on both halves
- **Visual display** - Filled, half-filled, and empty stars in detail view
- **Filterable** - Click star counts in filter panel to filter by minimum rating

### Pricing
- **IDR-based pricing** idealized for Indonesian food scenes
- **Dual slider controls** - Min and max price range (20,000 - 200,000 IDR, 5,000 step)
- **Smart formatting** - Displays prices with IDR currency format

### Tags & Colors
- **Tag system** - Create and assign tags to places
- **Color-coded tagging** - Choose from customizable color swatches for each tag
- **Multi-select filtering** - Filter places by one or more tags

### Advanced Filtering
- **Status filter** - Show/hide places by status
- **Rating filter** - Clickable stars to filter by minimum rating
- **Price range slider** - Dual slider for min/max price
- **Tag multi-select** - Filter by multiple tags simultaneously
- **Reset all filters** - One-click to clear all active filters

### Mobile Optimized
- **Responsive design** - Optimized for phones, tablets, and desktops
- **Dynamic viewport height** - Works around mobile browser UI (address bar)
- **Touch-friendly controls** - Appropriately sized buttons and inputs
- **Bottom sheet modals** - More natural mobile navigation experience

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) 16.1.6 with Turbopack
- **Map**: MapLibreGL with custom clustering and SVG icon support
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL, Auth-ready)
- **State**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- **Language**: TypeScript
- **Storage**: Supabase Storage for place images

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/Tamlica/makanmap.git
   cd makanmap
   npm install
   ```

2. **Set up Supabase:**
   - Create a Supabase project at [supabase.com](https://supabase.com)
   - Run migrations from `supabase/migrations/`:
     - `20260220_init_food_journal.sql` (base schema)
     - `20260220_add_place_image.sql` (image support)
     - `20260220_price_range_idr.sql` (IDR pricing)
     - `20260220_rating_half.sql` (half-step ratings)
     - `20260221_add_place_images_array.sql`
     - `20260221_add_rls_policies.sql`
     - `20260221_add_storage_policies.sql`
   - Copy your Supabase project URL and anon key

3. **Configure environment:**
   ```bash
   # Create .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production
```bash
npm run build
npm run start
```

## Project Structure

```
makanmap/
├── app/                           # Next.js app directory
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Main page with map, filters, forms
│   └── globals.css               # Global styles
├── components/
│   ├── map/
│   │   └── place-map.tsx         # Map container with clustering & user location
│   ├── place/
│   │   ├── place-form.tsx        # Add/edit place modal
│   │   ├── place-detail-panel.tsx # View/edit/delete place details
│   │   └── filter-panel.tsx      # Advanced filtering sidebar
│   └── ui/
│       └── map.tsx               # MapLibreGL wrapper component
├── lib/
│   ├── types/
│   │   └── food-journal.ts       # TypeScript domain types
│   ├── constants/
│   │   └── food-journal.ts       # Status styles, min/max prices
│   ├── stores/
│   │   ├── use-food-journal-store.ts  # Zustand store (CRUD)
│   │   └── use-map-ui-store.ts        # UI state (panels, selections)
│   ├── supabase/
│   │   ├── client.ts              # Supabase browser client
│   │   └── queries.ts             # Database queries & uploads
│   ├── food-journal-utils.ts      # Helper functions (filtering, GeoJSON)
│   ├── format.ts                  # Formatting helpers (IDR, etc.)
│   └── utils.ts                   # General utilities
├── supabase/
│   └── migrations/               # Database schema migrations
└── public/                        # Static assets
```

## Key Components

### PlaceMap (`components/map/place-map.tsx`)
Main map container with:
- Separate clustering by status (visited/want_to_go/avoid)
- Status-specific SVG icon rendering
- User location layer with pulsing animation
- Initial centering by geolocation or Indonesia fallback
- Click handlers for place selection

### PlaceForm (`components/place/place-form.tsx`)
Modal form to add/edit places with:
- Image upload with cloud preview
- Star rating selector (0.5 increments)
- Custom calendar datepicker (date conditional on "visited" status)
- Tag creation and selection
- Color picker modal for tag colors
- IDR price range slider
- Status buttons with color highlights

### FilterPanel (`components/place/filter-panel.tsx`)
Advanced filtering with:
- Status multi-select checkboxes
- Clickable star rating filter
- Dual price range sliders
- Tag multi-select
- Reset all button

### PlaceDetailPanel (`components/place/place-detail-panel.tsx`)
Read-only or editable place details showing:
- Name, location, image
- Star rating with half-star display
- IDR-formatted price
- Tags with colors
- Visit date (if visited)
- Edit and delete buttons

## Data Model

### Place
```typescript
type Place = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  status: "visited" | "want_to_go" | "avoid";
  rating: number;           // 0.5-5.0 (half steps)
  priceRange: number;       // 20000-200000 (IDR)
  visitDate?: string;       // ISO date string (only for visited)
  imageUrl?: string;        // Supabase Storage URL
  tagIds: string[];         // References to tags
};
```

### JournalTag
```typescript
type JournalTag = {
  id: string;
  name: string;
  colorHex: string;         // e.g., "#ef4444"
};
```

## Database Schema

### places table
- `id` (int, primary key)
- `name` (text, required)
- `latitude` (numeric, required)
- `longitude` (numeric, required)
- `status` (text enum, required)
- `rating` (numeric(2,1), 0.5-5.0)
- `price_range` (integer, 20000-200000)
- `visit_date` (date, nullable)
- `image_url` (text, nullable)
- `created_at` (timestamp)

### tags table
- `id` (uuid, primary key)
- `name` (text, required)
- `color_hex` (text, required)
- `created_at` (timestamp)

### place_tags (junction table)
- `place_id` (int, foreign key)
- `tag_id` (uuid, foreign key)

## Browser Support

- **Desktop**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: iOS Safari 14+, Chrome Android, Firefox Android
- **Geolocation**: Requires HTTPS or localhost (browser security requirement)

## Features In Progress / Future

- User authentication / multi-user support
- Social sharing (share places with friends)
- Restaurant recommendations
- Photo gallery per place
- Route planning between places
- Offline support (PWA)

## Contributing

Contributions welcome! Areas of interest:
- UI/UX improvements
- Performance optimization
- Additional filtering options
- Export/import functionality

## License

MIT
