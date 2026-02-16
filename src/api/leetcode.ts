import { allCategories, Category, Difficulty, Problem } from '../types/types';
import { getRating } from '../domain/problemRatings';

/** LeetCode GraphQL proxy endpoint (serverless function) see: api/leetcode-graphql.ts */
const GRAPHQL_URL = '/api/leetcode-graphql';

/* ----------------------------- Types (problems) ----------------------------- */
// Raw problem data shape from your external JSON file
interface RawProblemData {
  slug: string;
  title: string;
  isPaidOnly: boolean;
  isFundamental: boolean;
  popularity: number;
  difficulty: string;
  topicTags: string[];
  likes: number;
  dislikes: number;
  /** optional in problems-lite.json */
  description?: string;
  createdAt: number; // epoch time (seconds)
}

/* ------------------------------ Tag utilities ------------------------------ */
const categorySet = new Set(allCategories);
export function mapTagsToCategories(tags: string[]): Category[] {
  return tags.filter((tag): tag is (typeof allCategories)[number] =>
    categorySet.has(tag as (typeof allCategories)[number]),
  );
}

/* ------------------------- Problem catalog (unchanged) ---------------------- */
export async function fetchProblemCatalog(url: string): Promise<Problem[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data: RawProblemData[] = await res.json();

  return data.map((p) => ({
    slug: p.slug,
    title: p.title,
    tags: mapTagsToCategories(p.topicTags),
    description: p.description ?? '',
    difficulty: p.difficulty as Difficulty,
    rating: getRating(p.slug),
    popularity: p.popularity,
    isPaid: p.isPaidOnly,
    isFundamental: p.isFundamental,
    createdAt: p.createdAt,
  }));
}

/* ----------------------------- GraphQL helper ------------------------------ */
type GraphQLErrorShape = { message?: string };
type GraphQLResponse<T> = { data?: T; errors?: GraphQLErrorShape[] };

async function leetcodeGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const err: any = new Error('Rate limited');
    err.code = 'RATE_LIMITED';
    throw err;
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors && json.errors.length) {
    // Let callers decide whether to swallow or interpret as "not found".
    const msg = json.errors[0]?.message ?? 'GraphQL error';
    throw new Error(msg);
  }
  if (!json.data) {
    throw new Error('Empty GraphQL response');
  }
  return json.data;
}

/* --------------------------------- Queries --------------------------------- */

const DOES_USER_EXIST = `#graphql
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
  }
}
`;

/* ------------------------------- Public API -------------------------------- */
/**
 * Verify a LeetCode username exists using a minimal GraphQL query.
 * Returns the canonical username from LeetCode when found (LeetCode lowercases it).
 */
export async function verifyUser(
  username: string,
): Promise<{ exists: boolean; username?: string }> {
  try {
    type UserProfileData = {
      matchedUser: {
        username: string;
      } | null;
    };

    const data = await leetcodeGraphQL<UserProfileData>(DOES_USER_EXIST, { username });

    if (!data?.matchedUser) {
      return { exists: false };
    }

    return { exists: true, username: data.matchedUser.username };
  } catch (error) {
    // Handle the specific "user doesn't exist" error
    if (error instanceof Error && error.message === 'That user does not exist.') {
      return { exists: false };
    }
    // Re-throw other errors (like rate limiting, network issues, etc.)
    throw error;
  }
}
