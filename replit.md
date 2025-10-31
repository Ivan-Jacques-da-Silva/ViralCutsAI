# Overview

This is a video cutting system for Reels with two main workflows:

1. **Local Upload**: Users upload video files and the AI analyzes them for viral moments
2. **URL Download**: Users provide YouTube/Instagram/TikTok URLs for automatic video download and AI-powered analysis

The application uses AI (Google Gemini) to analyze video content and identify moments with **high viral potential** optimized for social media Reels format. The AI focuses on emotional content, revelations, strong hooks, dramatic moments, memorable phrases, and impactful visuals.

# Recent Updates (October 31, 2025)

## AI Analysis Enhancement
- Improved AI prompt to specifically identify **viral moments** instead of generic cuts
- AI now prioritizes: emotional content, insights/revelations, strong hooks, dramatic climaxes, memorable quotes, and impactful visuals
- Quality over quantity approach - fewer but more impactful cuts

## Manual Adjustment Interface
- Added precision controls in VideoPreview modal:
  - +/-5 seconds and +/-1 second buttons for quick adjustments
  - Numeric inputs for exact second-level control
  - Visual sliders for intuitive adjustment
  - Real-time video preview with adjustable range
- Improved visual feedback showing selected cut duration

## User Experience
- Enhanced cut visualization with highlighted cards
- Clear indicators for selected cuts
- Better messaging about viral potential
- Visual emphasis on AI-identified moments

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React 18 with TypeScript, built with Vite

**UI Component System**: 
- shadcn/ui components (Radix UI primitives)
- Material Design 3 inspired design system
- Tailwind CSS with custom theme variables
- Dark/light mode support with persistent user preference

**State Management**:
- TanStack Query (React Query) for server state
- Local React state for UI interactions
- No global state management library (uses React Context where needed)

**Routing**: Wouter for lightweight client-side routing

**Key Design Patterns**:
- Component composition with shadcn/ui
- Mobile-first responsive design
- Tab-based navigation for dual workflows
- Real-time processing status updates

## Backend Architecture

**Runtime**: Node.js with Express.js and TypeScript

**API Design**: RESTful endpoints with JSON responses
- `/api/videos/upload` - Multipart form upload for local files
- `/api/videos/url` - URL-based video download
- `/api/videos` - Video listing and retrieval

**File Upload Strategy**:
- Multer middleware for multipart/form-data handling
- Local filesystem storage in `uploads/` directory
- 100MB file size limit
- Video MIME type validation

**Video Processing Pipeline**:
1. Accept video (upload or download)
2. Store locally with unique timestamp-based filename
3. Send to Google Gemini for AI analysis
4. Store analysis results in database
5. Return metadata to frontend

**Error Handling**:
- Global Express error middleware
- Status code-based error responses
- Validation at route level

## Database Architecture

**ORM**: Drizzle ORM with PostgreSQL dialect

**Database Provider**: Neon serverless PostgreSQL with WebSocket support

**Schema Design**:
- `users` table - User authentication (id, username, password)
- `videos` table - Video metadata (id, title, videoPath, source, analysis, uploadedAt)

**Key Patterns**:
- UUID primary keys with `gen_random_uuid()`
- Timestamp tracking with `now()` defaults
- Zod schema validation via drizzle-zod integration
- Type-safe queries with Drizzle's type inference

## External Dependencies

### AI/ML Services
- **Google Gemini API** (@google/genai): Video content analysis using gemini-2.5-pro model
  - Analyzes video frames, objects, actions, text
  - Provides context-aware descriptions for intelligent cuts

### Video Download Services
- **yt-dlp** (system dependency): Multi-platform video downloader
  - Supports YouTube, TikTok, Instagram, Facebook, Twitter, Vimeo
  - Format selection for optimal quality (MP4 preferred)
  - Shell command execution via Node.js child_process

### Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL with WebSocket pooling
- **PostgreSQL**: Primary data store (provisioned via DATABASE_URL)

### Development Tools
- **Vite**: Build tool and dev server
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner (development only)

### UI Libraries
- **Radix UI**: Headless component primitives (40+ components)
- **TailwindCSS**: Utility-first styling
- **Lucide React**: Icon library
- **React Icons**: Social media platform icons (si-icons)
- **date-fns**: Date formatting with Portuguese locale

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **@hookform/resolvers**: Zod integration for forms

### File Handling
- **Multer**: Multipart/form-data parsing for file uploads

### Session Management
- **express-session**: Session middleware
- **connect-pg-simple**: PostgreSQL session store