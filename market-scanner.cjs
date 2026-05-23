#!/usr/bin/env node
/**
 * market-scanner.cjs — Scans GitHub repos + web for market opportunities.
 * Finds trending products, gaps, problems, and profitable niches.
 */

const GH_TOKEN = process.env.GH_TOKEN || '';
const API = 'https://api.github.com';

const headers = GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}`, 'User-Agent': 'profit-prime' } : { 'User-Agent': 'profit-prime' };

const log = msg => console.log(`[${new Date().toISOString().split('T')[1].split('.')[0]}] ${msg}`);

// ─── HELPERS ────────────────────────────────────────────────────

async function fetchJSON(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function searchWeb(q) {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json`, { headers: { 'User-Agent': 'profit-prime/1.0' } });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.RelatedTopics || []).slice(0, 10).map(t => t.Text || t.Result || '').filter(Boolean);
  } catch { return []; }
}

// ─── GITHUB SCANNER ─────────────────────────────────────────────

async function trendingRepos(topic, pages = 2) {
  const results = [];
  for (let page = 1; page <= pages; page++) {
    const q = topic ? `${topic} stars:>100 pushed:>2025-06-01` : 'stars:>500 pushed:>2025-09-01 sort:stars-desc';
    const data = await fetchJSON(`${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=25&page=${page}`);
    for (const r of data.items || []) {
      results.push({
        name: r.full_name,
        desc: (r.description || '').substring(0, 200),
        stars: r.stargazers_count,
        forks: r.forks_count,
        issues: r.open_issues_count,
        lang: r.language,
        topics: r.topics,
        url: r.html_url,
        created: r.created_at,
        updated: r.pushed_at,
      });
    }
  }
  return results;
}

async function topTopics(count = 30) {
  const data = await fetchJSON(`${API}/search/repositories?q=stars:>100&sort=stars&order=desc&per_page=100`);
  const tags = {};
  for (const r of data.items || []) {
    for (const t of r.topics || []) tags[t] = (tags[t] || 0) + 1;
  }
  return Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, count).map(e => ({ topic: e[0], count: e[1] }));
}

async function recentlyTrending() {
  // Repos with recent rapid star growth
  const data = await fetchJSON(`${API}/search/repositories?q=created:>2025-09-01 stars:>200&sort=stars&order=desc&per_page=50`);
  return (data.items || []).map(r => ({
    name: r.full_name,
    desc: (r.description || '').substring(0, 150),
    stars: r.stargazers_count,
    lang: r.language,
    topics: r.topics,
    age: Math.round((Date.now() - new Date(r.created_at)) / 86400000) + ' days',
  }));
}

// ─── MARKET ANALYSIS ────────────────────────────────────────────

async function analyzeGaps(repos) {
  // Find high-issue, low-fork repos (pain points / unsolved problems)
  const painful = repos.filter(r => r.issues > 20 && r.forks < r.stars * 0.3 && r.stars > 200)
    .sort((a, b) => (b.issues / b.stars) - (a.issues / a.stars))
    .slice(0, 10);

  // Find high-demand topics (many repos, many stars = crowded but profitable)
  const crowded = {};
  for (const r of repos) {
    for (const t of r.topics || []) {
      if (!crowded[t]) crowded[t] = { repos: 0, totalStars: 0 };
      crowded[t].repos++;
      crowded[t].totalStars += r.stars;
    }
  }

  return {
    painPoints: painful.map(r => ({
      name: r.name,
      desc: r.desc,
      stars: r.stars,
      openIssues: r.issues,
      painScore: Math.round((r.issues / r.stars) * 1000) / 10,
      issueLink: `${r.url}/issues`,
    })),
    crowdedTopics: Object.entries(crowded)
      .filter(([_, v]) => v.repos > 3)
      .sort((a, b) => b[1].totalStars - a[1].totalStars)
      .slice(0, 20)
      .map(([topic, v]) => ({ topic, repos: v.repos, totalStars: v.totalStars })),
  };
}

async function webResearch(queries) {
  const results = {};
  for (const q of queries) {
    log(`🌐 Searching: "${q}"`);
    results[q] = await searchWeb(q);
    await new Promise(r => setTimeout(r, 1000));
  }
  return results;
}

// ─── REPORT ─────────────────────────────────────────────────────

function printReport(trending, recent, gaps, webResults) {
  console.log(`\n${'█'.repeat(56)}`);
  console.log(`  PROFIT PRIME — MARKET SCANNER`);
  console.log(`  Scanning GitHub + Web for opportunities`);
  console.log(`${'█'.repeat(56)}\n`);

  // TOP TOPICS
  console.log(`📊 TOP TRENDING TOPICS ON GITHUB`);
  console.log(`─`.repeat(48));
  for (const t of trending.slice(0, 15)) {
    console.log(`  ${t.topic.padEnd(25)} ${t.count} repos`);
  }

  // RECENT RISING STARS
  console.log(`\n🚀 RECENT RISING STARS (< 90 days old, > 200 stars)`);
  console.log(`─`.repeat(48));
  for (const r of recent.slice(0, 10)) {
    console.log(`  ${r.name.padEnd(35)} ⭐${r.stars}  ${r.age} old  [${r.lang || '?'}]`);
    if (r.desc) console.log(`  ${r.desc.substring(0, 100)}`);
    console.log();
  }

  // PAIN POINTS (high open issues = market gap)
  console.log(`🩹 PAIN POINTS — High issue count relative to stars`);
  console.log(`   These repos have many unsolved issues = market gaps`);
  console.log(`─`.repeat(48));
  for (const p of gaps.painPoints.slice(0, 8)) {
    console.log(`  ${p.name.padEnd(35)} ⭐${p.stars}  🐛${p.openIssues} issues  (pain: ${p.painScore}%)`);
    console.log(`  ${p.desc.substring(0, 100)}`);
    console.log(`  ${p.issueLink}`);
    console.log();
  }

  // CROWDED TOPICS
  console.log(`🏢 CROWDED TOPICS (high competition = proven demand)`);
  console.log(`─`.repeat(48));
  for (const t of gaps.crowdedTopics.slice(0, 10)) {
    console.log(`  ${t.topic.padEnd(25)} ${t.repos} repos  ${t.totalStars} total ⭐`);
  }

  // WEB RESEARCH
  console.log(`\n🌐 WEB — Problems people are asking about`);
  console.log(`─`.repeat(48));
  for (const [query, results] of Object.entries(webResults)) {
    console.log(`  🔍 "${query}"`);
    for (const r of results.slice(0, 5)) {
      console.log(`     • ${r.substring(0, 120)}`);
    }
    console.log();
  }

  // PROFITABLE NICHES
  console.log(`💰 RECOMMENDED PROFITABLE NICHES`);
  console.log(`─`.repeat(48));
  const niches = [
    { niche: 'AI-powered developer tools', why: 'Trending + high pain + SaaS model' },
    { niche: 'DevOps automation for small teams', why: 'High demand, underserved' },
    { niche: 'Code quality & security scanners', why: 'Recurring revenue, enterprise' },
    { niche: 'AI content generation tools', why: 'Exploding growth, many angles' },
    { niche: 'Data pipeline / ETL tools', why: 'Boring = profitable, high switching cost' },
    { niche: 'Developer documentation tools', why: 'Hated problem, everyone needs' },
    { niche: 'Monitoring & observability for indie devs', why: 'Cheap alternative to Datadog' },
  ];
  for (const n of niches) {
    console.log(`  💎 ${n.niche}`);
    console.log(`     ${n.why}`);
  }
}

// ─── MAIN ───────────────────────────────────────────────────────

async function main() {
  log('🔍 Starting market scan...');

  log('📡 Fetching trending repos...');
  const repos = await trendingRepos('', 3);
  log(`   Got ${repos.length} repos`);

  log('📡 Fetching top topics...');
  const topics = await topTopics(30);
  log(`   Got ${topics.length} topics`);

  log('📡 Fetching recent rising stars...');
  const recent = await recentlyTrending();

  log('📡 Fetching recent AI/dev tools...');
  const aiRepos = await trendingRepos('ai-tools', 1);

  log('📊 Analyzing gaps...');
  const gaps = await analyzeGaps([...repos, ...aiRepos]);

  log('🌐 Researching web for problems...');
  const webQ = [
    'biggest problems in software development 2026',
    'what developers need but cannot find tool',
    'most painful developer experience problems',
    'profitable SaaS ideas for developers 2026',
    'ai tools small business need',
  ];
  const webResults = await webResearch(webQ);

  printReport(topics, recent, gaps, webResults);

  // Save report
  const report = {
    scannedAt: new Date().toISOString(),
    reposScanned: repos.length,
    topics,
    recent,
    gaps,
    webResearch: webResults,
  };
  require('fs').writeFileSync('market-report.json', JSON.stringify(report, null, 2));
  log('✅ Report saved to market-report.json');
}

main().catch(e => console.error('FATAL:', e));
