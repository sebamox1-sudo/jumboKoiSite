import { createContext, useContext } from 'react'

/**
 * The shared transition context + its consumer hook live here, apart from the
 * <TransitionProvider> component, so each file has a single concern (and Fast
 * Refresh stays happy — a component file that also exports a hook breaks it).
 */
export const TransitionContext = createContext(null)

/**
 * useTransitionNavigate — the elegant call-site API.
 * `const navigate = useTransitionNavigate(); navigate('/storia')`.
 * Identical ergonomics to react-router's `useNavigate`, but routes through the
 * cinematic void instead of swapping instantly.
 */
export function useTransitionNavigate() {
  const ctx = useContext(TransitionContext)
  if (!ctx) {
    throw new Error('useTransitionNavigate must be used within <TransitionProvider>')
  }
  return ctx.navigate
}
