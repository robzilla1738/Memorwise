import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { YoutubeTranscript } from 'youtube-transcript';

export interface ExtractedContent {
  title: string;
  text: string;
  sourceType: 'youtube' | 'url';
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url);
}

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/.test(url);
}

function isRedditUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?reddit\.com\/r\//.test(url);
}

function isGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(\/|$|\?|#)/);
  if (!match) return null;
  const nonRepoPaths = ['settings', 'pulls', 'issues', 'marketplace', 'explore', 'notifications', 'new', 'organizations', 'login', 'signup'];
  if (nonRepoPaths.includes(match[2].toLowerCase())) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|::1|\[::1\])/.test(hostname);
  } catch { return true; }
}

// ─── YouTube ─────────────────────────────────

async function extractYouTube(url: string): Promise<ExtractedContent> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Could not extract YouTube video ID from URL');

  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  if (!transcript || transcript.length === 0) {
    throw new Error('No transcript available for this YouTube video');
  }

  const text = transcript.map(t => t.text).join(' ');

  let title = `YouTube: ${videoId}`;
  try {
    const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`).then(r => r.text());
    const $ = cheerio.load(html);
    const pageTitle = $('title').text().replace(' - YouTube', '').trim();
    if (pageTitle) title = pageTitle;
  } catch { /* use default title */ }

  return { title, text, sourceType: 'youtube' };
}

// ─── X/Twitter ───────────────────────────────

async function extractTwitter(url: string): Promise<ExtractedContent> {
  // Extract tweet ID from URL
  const match = url.match(/status\/(\d+)/);
  if (!match) throw new Error('Could not extract tweet ID from URL');
  const tweetId = match[1];

  // Try the syndication/embed API (no auth required)
  try {
    const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json() as any;
      const authorName = data.user?.name || 'Unknown';
      const authorHandle = data.user?.screen_name || '';
      const tweetText = data.text || '';
      const createdAt = data.created_at || '';

      let fullText = `Tweet by @${authorHandle} (${authorName})`;
      if (createdAt) fullText += ` on ${createdAt}`;
      fullText += `:\n\n${tweetText}`;

      // Include quoted tweet if present
      if (data.quoted_tweet?.text) {
        fullText += `\n\nQuoted tweet by @${data.quoted_tweet.user?.screen_name || 'unknown'}:\n${data.quoted_tweet.text}`;
      }

      return { title: `@${authorHandle}: ${tweetText.slice(0, 80)}...`, text: fullText, sourceType: 'url' };
    }
  } catch { /* fallback below */ }

  // Fallback: try Nitter (open-source Twitter frontend)
  try {
    const nitterInstances = ['nitter.net', 'nitter.privacydev.net'];
    const twitterPath = url.replace(/https?:\/\/(x\.com|twitter\.com)/, '');

    for (const instance of nitterInstances) {
      try {
        const res = await fetch(`https://${instance}${twitterPath}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;

        const html = await res.text();
        const $ = cheerio.load(html);
        const tweetContent = $('.tweet-content').first().text().trim();
        const fullName = $('.fullname').first().text().trim();
        const username = $('.username').first().text().trim();

        if (tweetContent) {
          return {
            title: `${username}: ${tweetContent.slice(0, 80)}...`,
            text: `Tweet by ${fullName} (${username}):\n\n${tweetContent}`,
            sourceType: 'url',
          };
        }
      } catch { continue; }
    }
  } catch { /* fallback below */ }

  throw new Error('Could not extract tweet content. X/Twitter blocks direct scraping. Try copying the tweet text manually.');
}

// ─── Reddit ──────────────────────────────────

async function extractReddit(url: string): Promise<ExtractedContent> {
  // Reddit serves JSON when you append .json to any URL
  const jsonUrl = url.replace(/\/?(\?.*)?$/, '.json$1');

  try {
    const res = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Memorwise/1.0 (document extraction)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Reddit returned ${res.status}`);
    const data = await res.json() as any;

    // Reddit returns an array: [post, comments]
    const listing = Array.isArray(data) ? data : [data];
    const post = listing[0]?.data?.children?.[0]?.data;

    if (!post) throw new Error('Could not parse Reddit response');

    const title = post.title || 'Reddit Post';
    const selftext = post.selftext || '';
    const author = post.author || 'unknown';
    const subreddit = post.subreddit_name_prefixed || '';
    const score = post.score || 0;
    const numComments = post.num_comments || 0;

    let text = `${subreddit} — Posted by u/${author} (${score} upvotes, ${numComments} comments)\n\n`;
    text += `# ${title}\n\n`;
    if (selftext) text += selftext + '\n\n';

    // Extract top comments
    if (listing[1]?.data?.children) {
      const topComments = listing[1].data.children
        .filter((c: any) => c.kind === 't1' && c.data?.body)
        .slice(0, 10);

      if (topComments.length > 0) {
        text += '---\n\n## Top Comments\n\n';
        for (const comment of topComments) {
          const c = comment.data;
          text += `**u/${c.author}** (${c.score} pts):\n${c.body}\n\n`;
        }
      }
    }

    return { title: `[Reddit] ${title}`, text, sourceType: 'url' };
  } catch (err) {
    // Fallback to regular web extraction
    return extractWebPage(url);
  }
}

// ─── GitHub ──────────────────────────────────

async function extractGitHub(owner: string, repo: string): Promise<ExtractedContent> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: { 'Accept': 'application/vnd.github.raw', 'User-Agent': 'Memorwise/1.0' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const readme = await res.text();

  let title = `${owner}/${repo}`;
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Memorwise/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (repoRes.ok) {
      const repoData = await repoRes.json() as any;
      if (repoData.description) title = `${repoData.full_name} — ${repoData.description}`;
    }
  } catch { /* use default title */ }

  return { title, text: readme, sourceType: 'url' };
}

// ─── Generic Web Page ────────────────────────

async function extractWebPage(url: string): Promise<ExtractedContent> {
  if (isPrivateUrl(url)) throw new Error('Cannot fetch internal/private URLs');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`);
  const html = await response.text();

  // Try to extract structured data (JSON-LD) for recipes, articles, etc.
  const $ = cheerio.load(html);
  const structuredData = extractStructuredData($);
  if (structuredData) return structuredData;

  // Use Readability for clean content extraction
  const doc = new JSDOM(html, { url });
  const reader = new Readability(doc.window.document);
  const article = reader.parse();

  if (!article || !article.textContent?.trim()) {
    $('script, style, nav, footer, header, iframe, noscript').remove();
    const fallbackText = $('body').text().replace(/\s+/g, ' ').trim();
    const fallbackTitle = $('title').text().trim() || url;
    return { title: fallbackTitle, text: fallbackText, sourceType: 'url' };
  }

  return { title: article.title || url, text: article.textContent.trim(), sourceType: 'url' };
}

// ─── Structured Data (JSON-LD) ───────────────

function extractStructuredData($: cheerio.CheerioAPI): ExtractedContent | null {
  const scripts = $('script[type="application/ld+json"]');
  if (scripts.length === 0) return null;

  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Recipe
        if (item['@type'] === 'Recipe') {
          let text = `# ${item.name || 'Recipe'}\n\n`;
          if (item.description) text += `${item.description}\n\n`;
          if (item.prepTime || item.cookTime || item.totalTime) {
            text += '**Time:** ';
            if (item.prepTime) text += `Prep: ${formatDuration(item.prepTime)} `;
            if (item.cookTime) text += `Cook: ${formatDuration(item.cookTime)} `;
            if (item.totalTime) text += `Total: ${formatDuration(item.totalTime)}`;
            text += '\n\n';
          }
          if (item.recipeYield) text += `**Servings:** ${item.recipeYield}\n\n`;
          if (item.recipeIngredient) {
            text += '## Ingredients\n\n';
            for (const ing of item.recipeIngredient) text += `- ${ing}\n`;
            text += '\n';
          }
          if (item.recipeInstructions) {
            text += '## Instructions\n\n';
            const steps = Array.isArray(item.recipeInstructions) ? item.recipeInstructions : [item.recipeInstructions];
            steps.forEach((step: any, idx: number) => {
              const stepText = typeof step === 'string' ? step : step.text || step.name || '';
              if (stepText) text += `${idx + 1}. ${stepText}\n`;
            });
            text += '\n';
          }
          if (item.nutrition) {
            text += '## Nutrition\n\n';
            const n = item.nutrition;
            if (n.calories) text += `- Calories: ${n.calories}\n`;
            if (n.proteinContent) text += `- Protein: ${n.proteinContent}\n`;
            if (n.carbohydrateContent) text += `- Carbs: ${n.carbohydrateContent}\n`;
            if (n.fatContent) text += `- Fat: ${n.fatContent}\n`;
          }
          return { title: item.name || 'Recipe', text, sourceType: 'url' };
        }

        // Article
        if (item['@type'] === 'Article' || item['@type'] === 'NewsArticle' || item['@type'] === 'BlogPosting') {
          if (item.articleBody) {
            return { title: item.headline || item.name || 'Article', text: item.articleBody, sourceType: 'url' };
          }
        }
      }
    } catch { continue; }
  }

  return null;
}

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const parts = [];
  if (match[1]) parts.push(`${match[1]}h`);
  if (match[2]) parts.push(`${match[2]}m`);
  if (match[3]) parts.push(`${match[3]}s`);
  return parts.join(' ') || iso;
}

// ─── Main Router ─────────────────────────────

export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  if (isYouTubeUrl(url)) return extractYouTube(url);
  if (isTwitterUrl(url)) return extractTwitter(url);
  if (isRedditUrl(url)) return extractReddit(url);

  const ghRepo = isGitHubRepoUrl(url);
  if (ghRepo) {
    try { return await extractGitHub(ghRepo.owner, ghRepo.repo); }
    catch { /* fall through */ }
  }

  return extractWebPage(url);
}
