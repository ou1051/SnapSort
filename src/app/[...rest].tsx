import { Redirect } from 'expo-router';

/**
 * Any unknown path goes to the home screen. Needed for the browser demo,
 * which may be served from a sub-path (GitHub Pages, an embedded page).
 */
export default function CatchAll() {
  return <Redirect href="/" />;
}
