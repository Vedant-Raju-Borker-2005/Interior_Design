# Frontend Architecture & Conventions — InteriorAI

The frontend is a single-page Next.js application built with React, TypeScript, and TailwindCSS.

## Directory Structure

* [`src/app`](file:///d:/MyFiles/Interior_Design/frontend/src/app): Main routing directory.
  * [`onboarding/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/onboarding/page.tsx): Main multi-step onboarding wizard.
  * [`floor-layout/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/floor-layout/[projectId]/page.tsx): Selection or upload screen for project floor plan blueprint.
  * [`packages/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/packages/page.tsx): Tier packages catalogues view.
  * [`customize/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/customize/[projectId]/page.tsx): Live modular configuration space.
  * [`page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/page.tsx): Value-oriented landing page.
  * [`login/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/login/page.tsx): Unified access portal for customers, vendors, and admins.
* [`src/stores`](file:///d:/MyFiles/Interior_Design/frontend/src/stores): Global states using Zustand.
  * [`authStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/authStore.ts): Login tokens and current user profiles.
  * [`projectStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/projectStore.ts): Selected package details and current project configuration.
* [`src/lib/api.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/lib/api.ts): Axios REST API clients.

---

## State Management

* **Zustand Stores**:
  * Used for global states that persist across routes (e.g. auth tokens, project metadata).
* **Component Local State**:
  * Used inside onboarding (form fields) and customization (variant choices) before pushing updates to the server.

---

## Coding Rules & Component Style Guidelines

* **Vanilla Tailwind CSS**:
  * Always use vanilla Tailwind CSS for layouts and styling.
  * Selection state card styling: Card highlights must use a clear border (`border-indigo-600`) and subtle shadows.
* **Component Responsiveness**:
  * All option grids (style vibes, laminate finishes, fabrics) must be fully responsive using standard breakpoints (`grid-cols-1 md:grid-cols-3` or similar).
* **No Hardcoded URLs**:
  * Always construct static/catalog paths relative to the backend API base (`process.env.NEXT_PUBLIC_API_URL` or `http://localhost:8000`).
* **Visual States**:
  * Cards should include distinct hover scale transforms (`hover:scale-[1.02]`) and explicit visual indicator badges (like a checkmark overlay) for active selections.
