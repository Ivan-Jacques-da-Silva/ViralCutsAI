# Design Guidelines: Sistema de Corte de Vídeos para Reels

## Design Approach

**Selected Approach:** Design System - Material Design 3 inspired
**Justification:** Utility-focused video editing tool requiring clear hierarchy, intuitive controls, and robust component patterns for file handling and processing workflows.

**Key Design Principles:**
- Functionality-first interface with minimal visual distractions
- Clear processing states and progress indicators
- Efficient two-tab workflow for different input methods
- Scannable video preview cards with actionable controls

---

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary):**
- Background: 220 15% 12% (deep blue-gray)
- Surface: 220 15% 18% (elevated cards)
- Surface Variant: 220 12% 22% (tabs, secondary surfaces)
- Primary: 210 100% 65% (vibrant blue for CTAs)
- On-Surface: 220 10% 95% (primary text)
- On-Surface Variant: 220 8% 70% (secondary text)
- Success: 142 76% 45% (processing complete)
- Border: 220 15% 28%

**Light Mode:**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Primary: 210 95% 55%
- On-Surface: 220 15% 15%
- Border: 220 10% 88%

### B. Typography

**Font Stack:**
- Primary: 'Inter' via Google Fonts (400, 500, 600)
- Monospace: 'JetBrains Mono' for file names, durations

**Type Scale:**
- Hero/Page Title: text-3xl font-semibold (2rem)
- Section Headers: text-xl font-semibold
- Card Titles: text-base font-medium
- Body Text: text-sm
- Captions/Meta: text-xs text-on-surface-variant

### C. Layout System

**Spacing Units:** Consistent use of 4, 6, 8, 12, 16, 24px (Tailwind: p-1, p-1.5, p-2, p-3, p-4, p-6)

**Container Hierarchy:**
- App Shell: max-w-7xl mx-auto with px-4 sm:px-6 lg:px-8
- Tab Panels: Full width with py-6 spacing
- Cards: Consistent p-4 to p-6 padding based on density

**Grid Patterns:**
- Video Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
- Two-column forms: grid-cols-1 md:grid-cols-2 gap-4

### D. Component Library

**Navigation:**
- Horizontal tab navigation (Upload/URL) with underline indicator
- Tab active state: border-b-2 border-primary with primary text color
- Tab inactive: border-transparent with on-surface-variant color

**Input Components:**
- File upload: Dashed border drop zone (h-48) with centered icon and text
- URL input: Full-width text input with platform icons (TikTok/YouTube/Facebook/Instagram)
- All inputs: rounded-lg with focus:ring-2 ring-primary/20

**Video Cards:**
- Thumbnail preview (16:9 aspect ratio) with play icon overlay
- Duration badge (absolute top-right, bg-black/80 text-white text-xs px-2 py-1 rounded)
- Title truncation with tooltip on hover
- Action buttons: Download icon button + "Ver Cortes" secondary button

**Progress Indicators:**
- Linear progress bar (h-1 bg-surface-variant with bg-primary fill)
- Processing status badge with animated pulse effect
- Percentage text below progress bar (text-sm text-center)

**Buttons:**
- Primary: bg-primary text-white hover:bg-primary/90 (rounded-lg px-4 py-2)
- Secondary: border border-border hover:bg-surface-variant (rounded-lg px-4 py-2)
- Icon-only: p-2 rounded-lg hover:bg-surface-variant transition

**Data Display:**
- Video list: Alternating card layout with consistent spacing
- Empty states: Centered icon + text in muted colors
- Error states: Red accent border with error icon and message

**Overlays:**
- Modal dialogs: max-w-2xl with backdrop blur (backdrop-blur-sm bg-black/50)
- Download modal: List of cuts with checkboxes + "Baixar Selecionados" button

### E. Animations

**Minimal, purposeful animations only:**
- Tab transitions: 200ms ease slide
- Card hover: subtle scale-[1.01] transform with 150ms transition
- Progress bar: smooth width transition with 300ms ease
- Loading states: Gentle pulse on processing cards
- Modal entry: 200ms fade + scale from 95% to 100%

---

## Images

**No hero images needed** - this is a utility application, not marketing.

**Video Thumbnails:**
- Display extracted frame from uploaded/analyzed videos
- Fallback: Gradient placeholder with video icon
- Aspect ratio: 16:9 (standard for Reels/TikTok)

**Platform Icons:**
- Use Font Awesome or Heroicons for social platform logos (TikTok, YouTube, Facebook, Instagram)
- Display next to URL input as visual context

**Empty States:**
- Upload tab: Cloud upload icon (Heroicons)
- No videos analyzed: Video camera icon with "Nenhum vídeo analisado ainda" message

---

## Key Interface Sections

1. **Header:** Logo + navigation breadcrumb (minimal)
2. **Tab Navigation:** Upload | URL (active underline indicator)
3. **Input Area:** Context-specific based on active tab
4. **Processing Queue:** Linear list of videos being analyzed
5. **Results Grid:** Masonry/grid of analyzed videos with cut previews
6. **Download Modal:** Checklist interface for batch downloads