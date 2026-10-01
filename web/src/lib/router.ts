export interface Route {
  page: string;
  param?: string;
}

type Listener = (route: Route) => void;

const listeners = new Set<Listener>();

function readHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return { page: "overview" };
  const [page, param] = raw.split("/");
  return { page: page || "overview", param: param ? decodeURIComponent(param) : undefined };
}

let current: Route = readHash();

window.addEventListener("hashchange", () => {
  current = readHash();
  for (const l of listeners) l(current);
});

export function getRoute(): Route {
  return current;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function navigate(page: string, param?: string) {
  const hash = param ? `#/${page}/${encodeURIComponent(param)}` : `#/${page}`;
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}
