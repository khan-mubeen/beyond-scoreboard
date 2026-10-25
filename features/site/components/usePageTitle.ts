import { useEffect } from "react";

/**
 * the page's <title>. app/routes.tsx sets each route's default in a layout effect; a page with
 * data of its own (a match: "Jukurit 3–2 Tappara · Kaleva Sports") sets a better one here,
 * which runs after it. null keeps the route's default
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
