# Product Requirements Document (PRD)
## Testimonial SaaS — MVP

**Product type:** Multi-tenant SaaS web application  
**Product reference:** Testimonial.to  
**Goal:** Build a minimal, functional testimonial collection and display platform where users can create testimonial collection pages, collect customer feedback, manage submissions, and embed testimonials on external websites.

---

## 1. Product Overview

The application enables individuals and businesses to collect testimonials through shareable public links without requiring contributors to create accounts.

Users can create multiple testimonial collection spaces, customize their collection forms, manage testimonials through an inbox, display selected testimonials in embeddable widgets, and upgrade their subscription for higher usage limits.

## 2. User Roles

- **Account Owner:** Creates spaces, configures forms, manages testimonials, customizes embeds, and manages billing.
- **Testimonial Contributor:** Submits testimonials through public links without authentication.

## 3. Core Features

### 3.1 Authentication

- Allow users to register, log in, and log out.
- Protect all dashboard and account-management routes.
- Ensure each user can access only their own spaces, testimonials, embeds, and billing information.

### 3.2 Dashboard

Provide an overview of testimonial collection activity, including:

- Total spaces created.
- Total testimonials collected.
- Total ratings and average rating, when ratings are enabled.
- Testimonials collected over time, displayed in a date-filterable chart.
- Recent testimonial submissions.
- Current subscription plan and remaining usage limits.
- Quick links to spaces, inbox, embeds, and billing.

### 3.3 Space Creation and Management

Users can create, edit, and delete testimonial collection spaces.

Each space must support:

- **Title:** Required.
- **Subtitle:** Optional.
- **Collection question/prompt:** Required; tells contributors what kind of testimonial to provide.
- **Form field configuration:** Select which predefined fields appear and whether each field is required.
- **Rating toggle:** Enable or disable star ratings.
- **Theme selection:** Choose from predefined visual themes.
- **Public URL:** Generate a unique, shareable URL for the space.

Default form fields:

- Name — required.
- Email address — required.
- Testimonial text — required.

Additional predefined fields:

- Company name.
- Social profile links.
- Profile photo.

Users can enable or disable optional fields and configure their required status. Name and email remain required in the MVP.

After creating a space, display a success screen with the public URL and actions to copy the link, open the page, or return to the dashboard.

### 3.4 Public Testimonial Submission Page

Anyone with a valid public link can submit a testimonial without signing up or logging in.

The page must:

- Display the space title, subtitle, collection prompt, and selected theme.
- Render only the configured fields, respecting their required status.
- Show a star-rating input only when enabled for the space.
- Include a consent checkbox asking whether the testimonial may be shared on social media.
- Validate inputs on both client and server.
- Save the testimonial against the correct space.
- Prevent unauthorized access to private dashboard functionality.

After successful submission, show a confirmation message with a playful animation, such as a confetti effect.

Prevent accidental duplicate submissions where practical, and provide clear loading, validation, and error states.

### 3.5 Testimonial Inbox

Provide an inbox listing all testimonials belonging to the user's spaces.

Each testimonial entry must display:

- Contributor name and email.
- Associated space.
- Submission date and time.
- Testimonial text.
- Rating, if enabled.
- Consent status for social sharing.
- Current visibility status.

Available actions:

- **Favorite:** Prioritize the testimonial at the top of its space's testimonial ordering.
- **Wall of Love:** Add or remove the testimonial from the space's publicly displayed Wall of Love.
- **Edit:** Update testimonial content and relevant details.
- **Delete:** Permanently remove the testimonial after confirmation.
- **Hide/Unhide:** Control whether an otherwise published testimonial appears in public displays.

Support basic filtering by space, rating, visibility, and date, plus search by contributor or testimonial text.

### 3.6 Wall of Love and Public Display

Each space can have a public Wall of Love displaying testimonials selected by its owner.

- Display only testimonials explicitly added to the Wall of Love.
- Exclude hidden and deleted testimonials.
- Show contributor details, testimonial text, and ratings when applicable.
- Prioritize favorited testimonials.
- Respect the space's theme and rating configuration.
- Update public displays when testimonials are edited, hidden, removed, or deleted.

Social-sharing consent is a separate setting and must not automatically grant permission for unrelated uses.

### 3.7 Embeddable Testimonial Widgets

Allow users to generate JavaScript embed code for displaying their selected testimonials on external websites.

The embed builder must include:

- Space selection.
- **Layout:** Masonry-style grid and carousel-style layout.
- **Theme:** Light and dark modes.
- **Background color:** Preset colors and a custom color option.
- **Live preview:** Immediately reflect configuration changes.
- **Embed code:** Generate a copyable JavaScript snippet using the selected configuration.

The generated snippet should load the corresponding public testimonials and render the widget inside a designated container on an external website.

Requirements:

- The widget must work independently of the visitor's login status.
- Responsive layouts must support desktop and mobile screens.
- Hidden or deleted testimonials must not appear.
- The embed must respect the selected layout and theme.
- Widget rendering must not expose private user data, internal API credentials, or other spaces' testimonials.

### 3.8 Subscription and Billing

Implement two subscription plans.

| Feature | Free | Premium |
|---|---:|---:|
| Price | $0 | $99/month |
| Spaces | Up to 3 | Up to 25 |
| Testimonials per space | Up to 100 | Up to 1,000 |
| Dashboard analytics | Included | Included |
| Inbox and Wall of Love | Included | Included |
| Embed customization | Included | Included |

Premium pricing and limits must be configurable rather than hardcoded throughout the application.

Billing functionality:

- Display the current plan, usage, and available upgrade options.
- Provide an Upgrade button that redirects to Stripe Checkout.
- Create a Stripe Checkout Session on the server.
- Handle successful and cancelled checkout returns.
- Verify Stripe webhook signatures and process subscription events.
- Persist subscription status and plan information in the database.
- Show a success message after confirmed activation.
- Reflect the updated plan and limits throughout the dashboard.
- Support subscription cancellation, expiration, and payment failures through Stripe's billing lifecycle.
- Never activate Premium based only on a success-page redirect; verify the subscription through a trusted server-side Stripe event or API check.

Use Stripe's test mode during development.

**Usage enforcement:** Free users cannot create more than three spaces or collect more than 100 testimonials per space. Premium users cannot exceed 25 spaces or 1,000 testimonials per space. Enforce limits on the server, not just in the UI.

For existing data that exceeds a plan's limits after downgrade, preserve the data and prevent additional actions that exceed the limits. Do not silently delete content.

---

## 4. Key User Flows

### Flow A — Create a Space

1. Register or log in.
2. Open the dashboard and select Create Space.
3. Enter the title, subtitle, and collection prompt.
4. Configure fields, rating, and theme.
5. Save the space.
6. View the success page and copy the public link.

### Flow B — Submit a Testimonial

1. Open a public space link.
2. Read the collection prompt.
3. Complete the configured form and optional rating.
4. Set social-sharing consent.
5. Submit the testimonial.
6. See a success message and playful animation.

### Flow C — Manage Testimonials

1. Open the inbox.
2. Select a space or filter the submissions.
3. Review a testimonial.
4. Favorite, edit, hide, delete, or add it to the Wall of Love.
5. Verify the changes in the public display or embed.

### Flow D — Embed Testimonials

1. Open the embed builder.
2. Select a space and layout.
3. Customize the theme and background color.
4. Inspect the live preview.
5. Copy the generated JavaScript snippet.
6. Add the snippet to an external website and verify that it renders correctly.

### Flow E — Upgrade to Premium

1. Open Billing.
2. Select Upgrade.
3. Complete payment through Stripe Checkout.
4. Return to the application.
5. Confirm the subscription through Stripe verification/webhooks.
6. Update the subscription record and unlock Premium limits.

---

## 5. Data Model

Use a relational database with the following core entities.

- **User:** ID, name, email, authentication reference, timestamps.
- **Space:** ID, owner ID, title, subtitle, prompt, theme, rating enabled, public slug, timestamps.
- **SpaceField:** ID, space ID, field type, label, enabled, required, display order.
- **Testimonial:** ID, space ID, contributor details, testimonial text, optional rating, additional field values, social-sharing consent, favorite status, Wall of Love status, visibility status, submission timestamp.
- **Subscription:** ID, user ID, plan, status, Stripe customer ID, Stripe subscription ID, current billing period.
- **EmbedConfiguration:** ID, space ID, layout, theme mode, background color, configuration settings, timestamps.

Use appropriate foreign keys, unique constraints, and indexes. Store optional contributor fields in a structured format or a normalized schema, while keeping the core testimonial fields queryable.

Enforce ownership and authorization at the database-access or server-service layer.

---

## 6. Non-Functional Requirements

- Responsive and accessible UI with clear loading, empty, success, and error states.
- Secure authentication, authorization, and server-side validation.
- Public submission endpoints protected against spam and abuse through rate limiting and appropriate validation.
- Private contributor details must never be exposed by public APIs or embed responses.
- Stripe secrets and webhook signing secrets must remain server-side.
- Public slugs must be unique and difficult to guess where appropriate.
- Dashboard queries should be scoped to the authenticated user.
- Deleting a space or testimonial must follow a consistent data-deletion policy.
- Use environment variables for credentials, API keys, and configuration.
- Provide database migrations and seed data for local development.

## 7. Technical Implementation Guidance

If starting from an empty repository, use the following default stack:

- **Frontend and server:** Next.js with TypeScript.
- **Styling:** Tailwind CSS and a reusable component library.
- **Database:** PostgreSQL with Prisma ORM.
- **Authentication:** A secure, maintained authentication solution compatible with Next.js.
- **Payments:** Stripe Checkout, Billing, and webhooks.
- **Charts:** A lightweight charting library.
- **Embeds:** A standalone JavaScript widget loader with an isolated rendering container.

If the repository already contains a configured stack, inspect it first and follow the existing architecture unless a change is necessary.

Keep business logic, database access, payment processing, and public widget rendering separated into maintainable modules.

## 8. MVP Acceptance Criteria

The MVP is complete when:

1. A user can register, log in, and access a protected dashboard.
2. A user can create, configure, edit, and delete spaces within plan limits.
3. A contributor can submit a testimonial without an account.
4. Form fields and rating behavior match the space configuration.
5. Submissions appear in the correct user's inbox.
6. Favorite, edit, delete, hide, and Wall of Love actions work and persist.
7. Dashboard counters and date-filterable analytics reflect stored data.
8. The public Wall of Love displays only eligible testimonials.
9. The embed builder previews the selected layout and generates a working JavaScript snippet.
10. Free and Premium usage limits are enforced server-side.
11. Stripe Checkout and verified webhooks correctly activate and update subscriptions.
12. Users cannot access another user's private data by manipulating URLs, IDs, or API requests.
13. The core experience works on desktop and mobile.

## 9. Out of Scope for the MVP

- AI-generated testimonial summaries or marketing copy.
- Automated email campaigns and reminder sequences.
- Video recording and video testimonial uploads.
- Advanced analytics, conversion attribution, and A/B testing.
- Custom domains and white-label branding.
- Team accounts, roles, and collaboration.
- Multiple payment providers.
- Complex integrations with third-party marketing platforms.

## 10. Instructions for the AI Coding Agent

1. Inspect the repository and existing project instructions before changing files.
2. Present a concise implementation plan and identify any blocking decisions.
3. Build the application incrementally, starting with the database schema, authentication, and space management.
4. Implement public submissions and the inbox before the Wall of Love and embed builder.
5. Implement subscription enforcement and Stripe integration after the core product flows work.
6. Add migrations, environment-variable documentation, seed data, and meaningful tests.
7. Run the available linting, type-checking, and tests after each major stage.
8. Never commit secrets, bypass authentication, or use client-side checks as the sole enforcement of permissions or subscription limits.
9. Do not implement out-of-scope features unless explicitly requested.
10. Keep the application functional at each stage and document any assumptions or incomplete integrations.

**Definition of success:** A user can sign up, create a branded testimonial collection page, share its link, collect customer testimonials, manage and publish selected testimonials, embed them on an external website, and upgrade to Premium through Stripe.