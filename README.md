Testimonial SaaS MVP
A modern, full-stack Testimonial & "Wall of Love" Management SaaS platform inspired by Testimonial.to. Built to allow creators and business owners to collect video/text testimonials, manage public submission walls, customize embed widgets with animated visual effects, and seamlessly share social proof on their websites.
---
🛠️ Tech Stack & Prerequisites
Framework: Next.js 16 (App Router with Turbopack)
Styling: Tailwind CSS, Framer Motion (Animations), Lucide React (Icons)
Database & ORM: SQLite / Prisma ORM
Authentication: NextAuth.js (Auth.js) / Custom Credentials Session
Payments: Stripe Integration (with Test/Mock Checkout Fallback)
---
🚀 How to Run the Project Locally
Follow these steps to set up and run the development environment:
1. Clone the Repository & Install Dependencies
```bash
git clone <repository-url>
cd testimonial-saas
npm install
```
2. Environment Configuration
Create a `.env` file in the root directory and configure the environment variables:
```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="your-super-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Stripe Payment Integration
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```
3. Database Setup & Prisma Generation
Push the Prisma schema to create/sync your SQLite database and generate the Prisma Client:
```bash
npx prisma db push
npx prisma generate
```
4. Start the Development Server
Run the Next.js development server with Turbopack:
```bash
npm run dev
```
Open http://localhost:3000 in your browser to view the app.
---
✅ Feature Implementation Status
🟢 Completed Features
Dashboard Shell & Layout:
Persistent Left Sidebar navigation (`/dashboard`) spanning Overview, Spaces, Inbox, Wall of Love, Billing, and Settings.
Unified layout preventing navigation breaks or missing sidebars.
Space & Testimonial Management:
Create and configure customized spaces for collecting social proof.
Public submission landing page at `/p/[slug]` with functional form validation and instant DB persistence.
Animated celebration success state with a funny GIF/animation upon submission and a "Back to Dashboard" button.
Wall of Love & Embed Manager:
Toggle-Based System: Testimonials are added to or removed from the wall via an "Add to Wall" toggle in the Inbox/Testimonials manager.
Layout Selection: Choose between `Masonry - Animated`, `Masonry - Fixed`, and `Carousel / Slider`.
Visual Customizations: Real floating heart animation (bottom-to-top continuous stream), theme toggling (Light/Dark), scroll direction controls, and display options (hide dates/source icons).
Embed Code Generator: One-click clipboard copy for embed scripts (`<script async ...></script>`) with instant toast notifications.
Public unauthenticated view maintained at `/p/[slug]/wall` with a dedicated owner preview inside the dashboard at `/dashboard/wall-of-love`.
Billing & Subscriptions:
Usage metrics breakdown for spaces and testimonials.
Upgrading flow with built-in mock fallback for test mode when valid Stripe API keys are not provided.
🟡 Pending / In-Progress
Video Testimonial Recording: Direct webcam recording and storage pipeline.
Advanced Analytics: Detailed impression and click-through tracking for embedded widgets.
Automated Social Imports: Importing reviews directly from Twitter/X, G2, or Trustpilot.
---
🤖 Agentic Tools & Engineering Workflows
During the design, development, and refactoring of this project, several AI agent workflows and tools were leveraged:
Agentic Tool / Workflow	Purpose & Implementation Area	Location / Context
Puku CLI / Claude Code Subagents	Task delegation for isolated execution (e.g., refactoring auth routing, writing schema migrations, styling component drawers).	Project workspace & terminal runtime
Custom Agent Skills	Execution of Prisma database synchronization (`npx prisma db push` + `npx prisma generate`) and linting hooks.	Automated terminal workflows
MCP (Model Context Protocol) Tools	Contextual image and visual analysis to align dashboard UI directly with reference design screenshots.	IDE / Multimodal interaction layer
Turbopack Dev Inspector Hooks	Diagnostic parsing of Next.js 16 dynamic route warnings (`uncached data during navigation`) and dynamic rendering configuration (`force-dynamic`).	`app/dashboard/*` route handlers
---
📄 License
This project is open-source and available under the MIT License.
```

### Summary of what was created:
* **Project Documentation (`README.md`)**: A complete markdown file structured with setup steps, feature breakdown, database instructions, and agentic tools documentation.
