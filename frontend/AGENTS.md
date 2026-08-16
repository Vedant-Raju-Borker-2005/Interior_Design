# Frontend Architecture & Conventions — InteriorAI

The frontend is a single-page Next.js application built with React, TypeScript, and TailwindCSS.

## Directory Structure

* [`src/app`](file:///d:/MyFiles/Interior_Design/frontend/src/app): Main routing directory.
  * [`onboarding/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/onboarding/page.tsx): Multi-step onboarding wizard (6 steps: Property Details → Scope & BHK → Budget & Timeline → Design Vibe → Material & Fabric → Colors).
  * [`floor-layout/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/floor-layout/[projectId]/page.tsx): Optional standard layout / blueprint upload screen (B2C only; skipped for B2B2C customers).
  * [`packages/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/packages/page.tsx): Tier packages catalogue — prices computed dynamically via `getDynamicPrice` (Basic = budget, Premium = budget + 2L, Luxury = budget + 5L).
  * [`customize/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/customize/[projectId]/page.tsx): Live modular configuration space with left accordion sidebar, dual budget tracking sub-boxes, and all-complete redirect panel.
  * [`visualize/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/visualize/[projectId]/page.tsx): Controlled 4-wall AI Render Studio with blueprint/photo/dimensions modes.
  * [`quotation/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/quotation/[projectId]/page.tsx): PDF quotation generation and download.
  * [`page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/page.tsx): Value-oriented landing page (headline: *"Designed & Delivered Starting Under ₹3 Lakhs"*, CTA: *"Design My Home Free"*).
  * [`login/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/login/page.tsx): Unified OTP access portal for customers, vendors, enterprise, and admins. Right-panel testimonial is contextual by mode (signin vs. signup).
  * [`enterprise/dashboard/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/dashboard/page.tsx): Enterprise B2B2C hub — fixed portfolio metrics + recent project activity.
  * [`enterprise/create-project/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/create-project/page.tsx): 4-step project configuration wizard.
  * [`enterprise/project/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/project/[projectId]/page.tsx): Per-project flat grid with status filters and invitation management.
* [`src/stores`](file:///d:/MyFiles/Interior_Design/frontend/src/stores): Global states using Zustand.
  * [`authStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/authStore.ts): Login tokens and current user profiles.
  * [`projectStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/projectStore.ts): Selected package details and current project configuration.
* [`src/lib/api.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/lib/api.ts): Axios REST API clients.
* [`src/components`](file:///d:/MyFiles/Interior_Design/frontend/src/components): Shared UI widgets (BhkSelector, CategoryDropdown, etc.).

---

## State Management

* **Zustand Stores**: Used for global states that persist across routes (e.g. auth tokens, project metadata).
* **Component Local State**: Used inside onboarding (form fields) and customization (variant choices) before pushing updates to the server.

---

## Coding Rules & Component Style Guidelines

* **Vanilla Tailwind CSS**: Always use vanilla Tailwind for layouts and styling. Selection state: `border-indigo-600` + subtle shadow.
* **Component Responsiveness**: All option grids must use standard breakpoints (`grid-cols-1 md:grid-cols-3` or similar).
* **No Hardcoded URLs**: Construct static/catalog paths relative to `process.env.NEXT_PUBLIC_API_URL` or `http://localhost:8000`.
* **Visual States & Notifications**:
  * Cards include `hover:scale-[1.02]` and checkmark overlay badges for active selections.
  * Product cards in Customizer render compatibility warning banners (color, material, fabric, price).
  * Global Toaster configured with 75px top offset (below fixed navbar).
  * Room labels use `getRoomLabelAndIcon` helper based on BHK type.

---

## Key Customizer Behaviours (Phase 9 & 10)

* **Single-Select Design Vibe**: `toggleStyle` replaces (not appends) the current selection — only one style may be active at a time.
* **Balcony Always Complete**: `checkRoomCompleteness` and `getCompletedCategoriesCount` short-circuit when `room_type === 'balcony'`.
* **Configuration Complete Panel**: When `allRoomsComplete && !userEditingCategory`, the right-hand panel swaps to a green-accented *"Proceed to AI Render"* prompt. Clicking any category button restores the product grid.
* **Dual Budget Sub-Boxes**: Budget tracking bar splits into two centered inner boxes (`bg-slate-950/40 border border-white/5 rounded-2xl shadow-inner`) — one for Remaining Budget, one for Variation (Spent). Both use `flex flex-col items-center justify-center text-center` with `text-slate-300` labels.
* **Accordion Collapse Control**: `hasSetInitialRoom` ensures only the first room expands on initial mount.
