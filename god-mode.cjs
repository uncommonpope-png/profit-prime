#!/usr/bin/env node
/**
 * god-mode.cjs — Sub-agent army for continuous market research
 * 
 * Launches 6 specialized research agents to discover product opportunities:
 * 1. AI Agent Infrastructure
 * 2. AI Memory & Context
 * 3. AI Config & Skills
 * 4. AI Social Media & Content
 * 5. AI Developer Productivity
 * 6. AI Business Automation
 * 
 * Plus: AI company creator sentiment analysis
 * Plus: Unmet needs discovery
 * 
 * Designed for GitHub Actions CI (one cycle, then exits)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const XAI_API_KEY = process.env.XAI_API_KEY;
const REPORT_FILE = process.env.REPORT_FILE || 'god-mode-report.json';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '.';

if (!XAI_API_KEY) {
  console.error('ERROR: XAI_API_KEY environment variable is required');
  process.exit(1);
}

const XAI_MODEL = 'grok-4-fast';
const XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';

async function callGrok(systemPrompt, userMessage, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 4000,
    label = 'grok call'
  } = options;

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: XAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature,
      max_tokens: maxTokens
    });

    const req = https.request(XAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            resolve(parsed.choices[0].message.content);
          } else {
            reject(new Error(`[${label}] Unexpected response: ${data.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`[${label}] Parse error: ${e.message}, raw: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function researchCategory(categoryName, focusPrompt) {
  const systemPrompt = `You are a ruthless market research agent. Your only job: find SPECIFIC, ACTIONABLE product opportunities that can be built for profit.

For every product idea you find, you MUST include:
- Product name
- One-line description
- Target price point
- Build difficulty (Low/Medium/Hard)
- Who the competitors are (be specific — name actual companies/tools)
- What gap they're leaving open
- How long to build an MVP

Do NOT give vague advice. Do NOT say "consider building X." Be specific about pricing, competitors, and gaps.

You MUST find exactly 10 specific product ideas in the category "${categoryName}" based on CURRENT 2026 market conditions. Return them as a numbered JSON array.`;

  try {
    console.log(`\n=== Researching: ${categoryName} ===`);
    const result = await callGrok(systemPrompt, focusPrompt, {
      label: categoryName,
      maxTokens: 5000,
      temperature: 0.8
    });
    
    // Try to parse as JSON, if not, try to extract JSON from the text
    let products;
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        products = JSON.parse(jsonMatch[0]);
      } else {
        // Save raw and create structured output
        products = { raw: result, category: categoryName, note: 'Could not parse JSON from response' };
      }
    } catch (e) {
      products = { raw: result, category: categoryName, note: `Parse error: ${e.message}` };
    }
    
    return products;
  } catch (err) {
    console.error(`ERROR researching ${categoryName}: ${err.message}`);
    return { error: err.message, category: categoryName };
  }
}

async function researchCreatorSentiment() {
  const systemPrompt = `You are a market intelligence analyst tracking what AI company founders, CTOs, and executives are saying about their biggest problems building and scaling AI products in 2026.

Search your knowledge for specific quotes, complaints, and pain points voiced by:
- Anthropic execs (Dario Amodei, Cat Wu, Boris Cherny)
- Google DeepMind (Demis Hassabis)
- OpenAI leadership
- AI startup founders
- CTOs at enterprises deploying AI

For each pain point, identify:
1. Who said it
2. What the exact problem is
3. Whether any product exists to solve it
4. What the market gap looks like

Return 15 specific, named pain points with quotes. Be specific. Use real names and real quotes.`;

  try {
    console.log('\n=== Researching AI Creator Sentiment ===');
    const result = await callGrok(systemPrompt, 'List the 15 most important pain points AI company leaders are talking about in 2026, with specific names, quotes, and the market gap each creates.', {
      label: 'creator-sentiment',
      maxTokens: 5000,
      temperature: 0.5
    });
    return result;
  } catch (err) {
    console.error(`ERROR researching creator sentiment: ${err.message}`);
    return { error: err.message };
  }
}

async function researchUnmetNeeds() {
  const systemPrompt = `You are a product gap analyst. Your job is to identify what software developers and businesses NEED that does NOT exist yet.

Analyze the biggest gaps:
- What do developers repeatedly ask for on Reddit, Hacker News, and GitHub Issues?
- What tools are developers piecing together from multiple services because no single product exists?
- What workflows are still manual despite AI advances?
- Where is there demand but no supply?

Return 10 specific, verifiable product gaps with evidence of demand (Reddit threads, GitHub issues, HN comments). Be specific. Include URLs or thread titles where possible.`;

  try {
    console.log('\n=== Researching Unmet Needs ===');
    const result = await callGrok(systemPrompt, 'List the top 10 products/tools that developers clearly need but DO NOT exist yet in 2026. Include evidence of demand.', {
      label: 'unmet-needs',
      maxTokens: 5000,
      temperature: 0.6
    });
    return result;
  } catch (err) {
    console.error(`ERROR researching unmet needs: ${err.message}`);
    return { error: err.message };
  }
}

// --- Main ---
async function main() {
  console.log('█ GOD MODE — SUB-AGENT ARMY');
  console.log('█ Launching 8 research agents across 6 categories + 2 meta-analyses\n');

  const startTime = Date.now();

  // Launch all research in parallel
  const results = await Promise.allSettled([
    researchCategory('AI Agent Infrastructure', 'Find 10 product opportunities in AI agent infrastructure — deployment, testing, monitoring, security, orchestration tools for AI agents. Focus on infrastructure gaps that enterprises will pay for.'),
    researchCategory('AI Memory & Context', 'Find 10 product opportunities in AI memory and context management — persistent memory, context window optimization, memory sharing between agents, compaction preservation. This is the #1 unsolved problem.'),
    researchCategory('AI Config & Skills Ecosystem', 'Find 10 product opportunities in CLAUDE.md/AGENTS.md/config management — marketplace, testing, compliance, translation between harnesses, analytics. No quality signal exists yet.'),
    researchCategory('AI Social Media & Content', 'Find 10 product opportunities in AI social media and content automation — beyond simple posting, focus on multi-account management, compliance, closed-loop systems, analytics.'),
    researchCategory('AI Developer Productivity', 'Find 10 product opportunities in AI developer productivity — code review for AI-generated code, auto-documentation, dead code removal, framework migration, dependency resolution.'),
    researchCategory('AI Business Automation', 'Find 10 product opportunities in AI business automation — vendor negotiation, contract review, SOC2 compliance, tax deduction finding, meeting follow-up, physical mail.'),
    researchCreatorSentiment(),
    researchUnmetNeeds()
  ]);

  const report = {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    categories: {
      agentInfrastructure: results[0].status === 'fulfilled' ? results[0].value : results[0].reason?.message,
      memoryContext: results[1].status === 'fulfilled' ? results[1].value : results[1].reason?.message,
      configSkills: results[2].status === 'fulfilled' ? results[2].value : results[2].reason?.message,
      socialMedia: results[3].status === 'fulfilled' ? results[3].value : results[3].reason?.message,
      devProductivity: results[4].status === 'fulfilled' ? results[4].value : results[4].reason?.message,
      businessAutomation: results[5].status === 'fulfilled' ? results[5].value : results[5].reason?.message,
    },
    metaAnalyses: {
      creatorSentiment: results[6].status === 'fulfilled' ? results[6].value : results[6].reason?.message,
      unmetNeeds: results[7].status === 'fulfilled' ? results[7].value : results[7].reason?.message,
    }
  };

  // Count products found
  let totalProducts = 0;
  for (const key of ['agentInfrastructure', 'memoryContext', 'configSkills', 'socialMedia', 'devProductivity', 'businessAutomation']) {
    const data = report.categories[key];
    if (Array.isArray(data)) {
      totalProducts += data.length;
    } else if (data && typeof data === 'object' && !data.error) {
      totalProducts += 1; // raw text
    }
  }

  report.totalProductsFound = totalProducts;

  // Write report
  const reportPath = path.join(OUTPUT_DIR, REPORT_FILE);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n✓ God Mode complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`✓ Report written to ${reportPath}`);
  console.log(`✓ Products found: ${totalProducts}`);
  
  // Print summary
  console.log('\n=== CATEGORY SUMMARY ===');
  for (const [key, label] of [
    ['agentInfrastructure', 'AI Agent Infrastructure'],
    ['memoryContext', 'AI Memory & Context'],
    ['configSkills', 'AI Config & Skills'],
    ['socialMedia', 'AI Social Media'],
    ['devProductivity', 'AI Developer Productivity'],
    ['businessAutomation', 'AI Business Automation'],
  ]) {
    const data = report.categories[key];
    if (Array.isArray(data)) {
      console.log(`  ✓ ${label}: ${data.length} products`);
      data.forEach((p, i) => {
        const name = p.name || p.product || `Product ${i+1}`;
        const price = p.price || p.pricing || '?';
        console.log(`    ${i+1}. ${name} — ${price}`);
      });
    } else if (data && data.error) {
      console.log(`  ✗ ${label}: ERROR — ${data.error}`);
    } else {
      console.log(`  ~ ${label}: Raw text (${(data || '').substring(0, 60)}...)`);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
