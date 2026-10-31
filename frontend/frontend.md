# CAMPUSINTEL — PREMIUM UI/UX REDESIGN & IMPLEMENTATION

Act as a principal product designer, senior frontend engineer and design systems architect.

Your task is to transform the existing CampusFish project into a polished, production-quality academic intelligence platform with a distinctive Apple-inspired visual identity.

This is not a generic university dashboard. It is an intelligent platform that researches official university and college sources, discovers academic opportunities, detects changes in regulations and notices, and determines whether information is relevant or applicable to individual students.

The finished product must look like a serious, premium technology company built it.

## 1. FIRST: INSPECT THE EXISTING PROJECT

Before modifying anything:

1. Inspect the complete repository structure.
2. Identify the existing frontend framework, backend framework, styling system, component library and API architecture.
3. Read the existing README, build specifications, configuration files and relevant application code.
4. Understand which pages and features already work.
5. Identify existing API endpoints, database models and integrations.
6. Preserve existing working functionality.
7. Do not replace the backend or change the architecture unnecessarily.

The existing project may be based on the VTU Radar build specification. Evolve it into CampusFish while retaining useful working integrations.

Do not assume that every feature in the product vision has already been implemented.

If a feature is not supported by the backend, create an honest interface state rather than pretending it works.

## 2. PRODUCT IDENTITY

Product: CampusFish

Category: Autonomous Academic Intelligence Platform.

Tagline:

"Your Academic World. One Intelligence Platform."

Product description:

CampusFish continuously researches official institutional sources, discovers important academic updates and opportunities, tracks changes in policies and regulations, and helps students understand what applies to them.

Core product promise:

"Know what changed. Discover what you missed. Understand what applies to you. Know what to do next."

Target users:
- University students.
- College students.
- Students in affiliated institutions.
- Autonomous college students.
- Private and deemed university students.
- Students across different academic programmes and disciplines.

The product must not look or behave as a VTU-only platform.

## 3. FINAL VISUAL DIRECTION

Create an Apple-inspired light interface with:

- Minimalism.
- Generous whitespace.
- Editorial typography.
- Beautifully restrained layouts.
- Precise alignment.
- Sophisticated information hierarchy.
- Subtle animations.
- Clean typography.
- Carefully designed cards.
- Refined transitions.
- Exceptional responsive behaviour.

Visual references:
- Apple.com product pages.
- Apple's editorial typography and spacing.
- Premium minimalist SaaS applications.
- Modern research and productivity platforms.

Do not copy any specific website. Create an original CampusFish identity.

### Colour system

Use a monochrome visual identity.

Primary:
- Background: #FFFFFF
- Primary text: #111111
- Secondary background: #F7F7F7
- Secondary text: #737373
- Muted text: #A3A3A3
- Borders: #EAEAEA
- Dark surface: #111111
- Dark surface secondary: #1B1B1B

Use restrained semantic colours only when necessary:
- Success: muted green.
- Warning: muted amber.
- Error: muted red.
- Informational: neutral grey.

Avoid colourful gradients and excessive accent colours.

Primary buttons should be black with white text.

Secondary buttons should be white with subtle borders.

### Typography

Prefer Geist Sans or Inter.

Use:
- Large editorial headlines.
- Refined medium-weight section headings.
- Highly readable body text.
- Small, restrained metadata.
- Consistent line heights.
- Clear typographic hierarchy.

An elegant serif font may be used sparingly for large editorial headlines, if it improves the visual identity.

Avoid oversized typography everywhere.

### Spacing and layout

Use a spacious layout.

- Maximum content width around 1440px.
- Consistent horizontal padding.
- Generous vertical section spacing.
- Subtle borders.
- Small corner radii where appropriate.
- Larger radii for major feature cards.
- Avoid excessive nested containers.

Do not make the interface unnecessarily dense.

Whitespace must feel intentional, not like missing content.

## 4. GLOBAL NAVIGATION

Use a clean top navigation system.

Do not use a permanent left sidebar.

Navigation:

- CampusFish logo.
- Overview.
- Discover.
- Changes.
- Eligibility.
- Research.
- Ask CampusFish.
- Student profile/avatar.

Keep navigation minimal and responsive.

On mobile, use a compact menu or appropriate mobile navigation.

The active navigation item must have a subtle, obvious visual indicator.

Add a profile menu containing:
- Student profile.
- Institution settings.
- Preferences.
- Sign out, only if authentication exists.

Do not invent authentication functionality.

## 5. LANDING PAGE

Build a polished landing page.

Hero headline:

"Your academic world.
One intelligence platform."

Supporting copy:

"Discover opportunities, understand academic changes and stay ahead of everything that matters to your education."

Primary CTA:
"Explore CampusFish"

Secondary CTA:
"How it works"

Include a carefully designed product preview.

Sections:

1. Hero.
2. How CampusFish works.
3. Academic intelligence capabilities.
4. Discover opportunities.
5. Understand what changed.
6. Personalized eligibility.
7. Research official sources.
8. Final CTA.

Avoid generic marketing sections and fake customer testimonials.

The landing page should feel like an established premium technology product.

## 6. INTELLIGENCE HOME

This is the most important authenticated screen.

The page should feel like a personalized academic intelligence briefing.

Header:

"Good morning, [Student Name]"

Supporting text:

"Here is what matters in your academic world."

Display the student's institution and academic profile in a restrained format.

Sections:

### A. Academic overview

Show only meaningful, supported metrics:
- Recently discovered updates.
- Important upcoming deadlines.
- New opportunities.
- Changes requiring attention.

Do not invent metrics or show fabricated activity.

### B. Important for you

A personalized feed of:
- Examination notifications.
- Re-examination applications.
- Revaluation deadlines.
- Scholarship announcements.
- Policy changes.
- New student programmes.
- Internship opportunities.
- Placement opportunities.
- Academic calendar changes.

Each item should display:
- Title.
- Category.
- Issuing authority.
- Publication date.
- Deadline, when available.
- Applicability status.
- Short summary.
- Original source link.

### C. You might have missed this

This is a signature CampusFish feature.

Discover opportunities or benefits students may not have actively searched for.

Each card should explain:
- What was discovered.
- Why it matters.
- Who may benefit.
- Eligibility conditions.
- Application deadline.
- Required next action.
- Original official source.

### D. Upcoming deadlines

Present important deadlines with a clean timeline or list.

Clearly distinguish:
- Upcoming.
- Due soon.
- Closed.
- Unknown.

Never infer that an application is open merely because its page still exists.

## 7. DISCOVER PAGE

Build a discovery experience for academic information.

Categories:
- Examinations.
- Scholarships.
- Financial benefits.
- Internships.
- Research programmes.
- Student development programmes.
- Hackathons and competitions.
- Placements.
- Academic policies.
- Student welfare.
- Academic administration.
- New introductions.

Provide:
- Category filtering.
- Search.
- Institution filtering where supported.
- Date filtering.
- Relevant student-specific information.

Keep the layout clean and editorial.

## 8. CHANGE INTELLIGENCE PAGE

This is one of CampusFish's signature features.

Title:

"What changed?"

Supporting text:

"Understand how institutional policies, academic rules and opportunities evolve over time."

Show historical comparisons between previous and current documents.

Every comparison should include:

- Original document title.
- Previous version.
- Current version.
- Publication dates.
- Issuing authority.
- Original source URLs.
- Changed sections.
- Added provisions.
- Removed provisions.
- Modified conditions.
- Potential student impact.

Use a refined comparison layout.

Clearly distinguish previous and current content.

Highlight changed passages without creating a visually noisy interface.

Provide a concise explanation:

"What changed?"
"Why does it matter?"
"Who may be affected?"
"What should the student do?"

Important rules:

- Never invent previous versions.
- Never fabricate historical dates.
- If a previous version does not exist, say so.
- Do not assume every revised regulation applies retrospectively.
- Show evidence for every reported change.
- Distinguish confirmed applicability from possible applicability.

## 9. PERSONALIZED ELIGIBILITY PAGE

Build a dedicated eligibility intelligence experience.

The system should evaluate whether an opportunity, scholarship, examination application or policy applies to the individual student.

Possible outcomes:

- Eligible.
- Potentially eligible.
- Not eligible.
- Not applicable.
- Unable to determine.

Every eligibility assessment should show:

1. Student profile information used.
2. Official eligibility requirements.
3. Conditions that match.
4. Conditions that do not match.
5. Missing information.
6. Exceptions or special conditions.
7. Effective dates.
8. Evidence and original source.

Use clear status labels.

Example:

"Potentially eligible"

"You satisfy the known academic requirements, but your family income information is missing."

Show the missing requirement and explain what the student needs to provide.

Never declare eligibility when a mandatory condition remains unknown.

Do not use AI-generated assumptions as evidence.

The frontend must distinguish:
- Eligibility.
- Institutional applicability.
- Individual qualification.

These are related but different concepts.

## 10. RESEARCH ACTIVITY PAGE

Show CampusFish's research activity in a sophisticated interface.

The page should communicate that the platform actively researches official institutional websites.

Display:
- Source being researched.
- Institution.
- Website being accessed.
- Research task.
- Current execution status.
- Recently discovered documents.
- Last successful scan.
- Errors and unavailable sources.

When TinyFish returns live execution events, display them appropriately.

Possible statuses:
- Queued.
- Researching.
- Extracting.
- Analysing.
- Completed.
- Failed.

Include a clear "Run research" or "Scan now" action only if the backend supports it.

Do not fabricate live browser activity.

If live research is unavailable, show the last successful research timestamp and an honest unavailable state.

## 11. ASK CAMPUSINTEL

Build a polished conversational research interface.

Suggested questions:

- Is there any supplementary examination application available for my semester?
- Am I eligible for this scholarship?
- What changed in my university's examination regulations?
- Which internships are currently relevant to my programme?
- Does this revised academic policy apply to my admission batch?

Responses should support:
- Concise answers.
- Source citations.
- Document links.
- Relevant dates.
- Eligibility reasoning.
- Missing information.
- Clear next steps.

Do not create a generic chatbot with an unsupported knowledge base.

If the existing backend supports retrieval and AI answers, integrate with it.

Otherwise, implement the interface and clearly indicate that the service is not connected yet.

## 12. STUDENT PROFILE

Create a clean profile and institution settings experience.

Student fields:

- Name.
- Institution.
- Institution type.
- Affiliating university, where applicable.
- Autonomy status.
- Programme.
- Branch or specialization.
- Semester or year.
- Academic scheme.
- Admission year.
- Graduation year.

Optional eligibility information should only be requested when needed for a relevant opportunity.

Do not assume all universities have the same academic structure.

Support different institution types:
- Affiliated colleges.
- Autonomous colleges.
- Private universities.
- Central universities.
- State universities.
- Deemed universities.
- Other recognized institutions.

## 13. COMPONENT DESIGN SYSTEM

Create reusable components for:

- Navigation.
- Buttons.
- Cards.
- Typography.
- Status labels.
- Search fields.
- Filter controls.
- Deadline indicators.
- Source citations.
- Document cards.
- Eligibility criteria.
- Comparison panels.
- Research activity items.
- Empty states.
- Error states.
- Loading skeletons.
- Modal dialogs.
- Dropdown menus.
- Toast notifications.

Use consistent component APIs and design tokens.

Avoid duplicating UI implementations across pages.

## 14. INTERACTION AND ANIMATION

Use subtle, high-quality interactions.

Examples:
- Smooth navigation transitions.
- Gentle card hover states.
- Button press feedback.
- Refined dropdown transitions.
- Subtle loading animations.
- Elegant skeleton loading.
- Smooth expansion of document details.
- Animated research status changes.

Use Framer Motion if it is already installed or can be added without unnecessary complexity.

Keep animations fast and understated.

Respect reduced-motion preferences.

Do not add:
- Excessive parallax.
- Glowing effects.
- Unnecessary 3D objects.
- Distracting background animations.
- Large animated gradients.

## 15. RESPONSIVE DESIGN

The application must work beautifully on:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

Do not simply shrink the desktop dashboard.

Reorganize layouts for smaller screens.

Ensure:
- Navigation remains usable.
- Cards fit naturally.
- Tables have appropriate responsive alternatives.
- Document comparisons remain readable.
- Buttons are touch-friendly.
- No horizontal overflow.

## 16. TECHNICAL IMPLEMENTATION

Preserve the existing technology stack unless there is a compelling reason to change it.

If the existing project follows the provided VTU Radar specification, preserve:

- Next.js frontend.
- Tailwind CSS.
- FastAPI backend.
- Existing TinyFish integration.
- Existing Claude integration.
- Existing Supabase integration.
- Existing API endpoints and data models.

Do not rebuild working services.

Use the existing component library if one is already configured.

If shadcn/ui is already installed, use it consistently.

Use Lucide icons if available.

Do not install unnecessary packages.

Keep API keys and secrets on the server.

Do not expose service-role keys or API credentials to the browser.

Use real backend data whenever available.

For missing functionality, show an honest empty or disconnected state.

Never use invented live data.

## 17. DATA AND PRODUCT INTEGRITY

This is an academic information platform. Accuracy matters.

Every displayed official notice should retain its source URL.

Clearly distinguish:
- Publication date.
- Discovery date.
- Effective date.
- Application deadline.

Never fabricate:
- University notices.
- Scholarship amounts.
- Eligibility conditions.
- Policy changes.
- Examination deadlines.
- Research execution status.
- Student eligibility decisions.

If a value is unknown, display "Not specified" or "Unable to determine".

If sample data is necessary for a visual demonstration, label it clearly as sample data.

## 18. QUALITY AND FINISHING

The final interface should feel:
- Premium.
- Calm.
- Minimal.
- Intelligent.
- Trustworthy.
- Modern.
- Consistent.
- Responsive.

Avoid:
- Generic admin-dashboard layouts.
- Excessive cards.
- Overcrowded screens.
- Unnecessary charts.
- Fake statistics.
- Large empty spaces without purpose.
- Excessive rounded containers.
- Emoji-based interface icons.
- Bright gradients.
- Excessive accent colours.
- Placeholder text in finished screens.

Pay special attention to spacing, alignment, typography, component consistency and empty states.

## 19. IMPLEMENTATION ORDER

Work in this order:

1. Repository inspection.
2. Existing functionality assessment.
3. Design tokens and global styles.
4. Global top navigation.
5. Landing page.
6. Authenticated application shell.
7. Intelligence home.
8. Discover page.
9. Change intelligence.
10. Eligibility intelligence.
11. Research activity.
12. Ask CampusFish.
13. Student profile.
14. Responsive refinement.
15. Loading, empty and error states.
16. Final quality checks.

After implementation:

- Run the available lint command.
- Run the available build command.
- Fix all errors introduced by your changes.
- Check responsive layouts.
- Verify navigation.
- Verify existing API integrations remain functional.
- Verify that no fake live activity or unsupported features were introduced.

## 20. FINAL DELIVERY REPORT

When finished, report:

1. What was inspected.
2. What was implemented.
3. Which pages were completed.
4. Which existing backend integrations were preserved.
5. Which features remain unconnected.
6. Which dependencies were added, if any.
7. Lint/build results.
8. How to run the application locally.

IMPORTANT:

Do not stop after creating a landing page.

Implement a coherent, polished CampusFish application experience.

Prioritize real functionality, visual consistency, responsive behaviour and trustworthy academic information over decorative effects.

The result should look like a premium technology product, not a college project template.