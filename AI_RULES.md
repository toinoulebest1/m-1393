# AI Development Rules

This document outlines the technical stack and coding conventions for this project. Following these rules ensures consistency, maintainability, and leverages the existing architecture.

## Tech Stack

This is a modern web application built with the following technologies:

-   **Framework**: React (using Vite for a fast development experience).
-   **Language**: TypeScript for type safety and improved developer experience.
-   **UI Components**: A custom component library built with **shadcn/ui**, which uses Radix UI primitives for accessibility.
-   **Styling**: **Tailwind CSS** for all utility-first styling.
-   **Routing**: **React Router** (`react-router-dom`) for all client-side navigation.
-   **Backend & Database**: **Supabase** for the database, authentication, and serverless Edge Functions.
-   **State Management**:
    -   **TanStack Query (`react-query`)** for managing server state (fetching, caching, and updating data from Supabase).
    -   **React Context API** for global UI state, such as the `PlayerContext`.
-   **Forms**: **React Hook Form** for building forms, paired with **Zod** for schema validation.
-   **Icons**: **Lucide React** for a consistent and lightweight icon set.

## Library Usage Rules

To keep the codebase clean and predictable, please adhere to the following library choices for specific tasks.

### 1. UI Components & Styling

-   **Rule**: **Always use `shadcn/ui` components** from `@/components/ui` for building the user interface.
-   **Styling**: All styling **must** be done using **Tailwind CSS** classes. Use the `cn()` utility from `@/lib/utils.ts` to conditionally apply classes.
-   **Icons**: Use icons exclusively from the `lucide-react` library.
-   **Rationale**: This maintains a consistent design system, ensures accessibility, and keeps styling co-located with the component markup.

### 2. State Management

-   **Rule**: For data fetched from Supabase (e.g., songs, playlists, user profiles), use **TanStack Query (`@tanstack/react-query`)**.
-   **Rule**: For global, client-side UI state that needs to be shared across many components (e.g., the current song in the player), use **React Context**. See `src/contexts/PlayerContext.tsx` for an example.
-   **Rationale**: Separating server cache management from UI state management is a best practice that improves performance and simplifies logic.

### 3. Routing

-   **Rule**: All routes are defined in `src/App.tsx` using `<BrowserRouter>`, `<Routes>`, and `<Route>` from `react-router-dom`.
-   **Navigation**: Use the `useNavigate()` hook for programmatic navigation.
-   **Rationale**: Centralizes route management and follows the project's established pattern.

### 4. Forms

-   **Rule**: All forms must be built using **React Hook Form** (`react-hook-form`).
-   **Validation**: Use **Zod** to define validation schemas for forms.
-   **Rationale**: This is the established pattern in the codebase (see `src/components/ui/form.tsx`) and provides a powerful, performant way to handle forms.

### 5. Notifications (Toasts)

-   **Rule**: Use **Sonner** for all user notifications (toasts). Import it via `import { toast } from "sonner";`.
-   **Rationale**: It is lightweight, easy to use, and already integrated into the application layout (`Index.tsx` and `App.tsx`).

### 6. Backend & Database

-   **Rule**: All interactions with the backend **must** use the Supabase client instance.
-   **Import**: `import { supabase } from "@/integrations/supabase/client";`
-   **Rationale**: This ensures all database queries, authentication calls, and function invocations use the same configured client.

### 7. File Structure

-   **Pages**: Create new pages in `src/pages/`.
-   **Reusable Components**: Create new general-purpose components in `src/components/`.
-   **Custom Hooks**: Place new custom hooks in `src/hooks/`.
-   **Contexts**: Define new global contexts in `src/contexts/`.
-   **Utilities**: Add new helper functions to `src/lib/utils.ts` or other files in `src/utils/`.
-   **Types**: Define shared TypeScript types in `src/types/`.