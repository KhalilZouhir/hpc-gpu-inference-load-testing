import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ---- Custom metrics (names = InfluxDB measurements) ----
const tokensPerSecond   = new Trend('tokens_per_second');    // includes TTFT
const totalTokens       = new Trend('total_tokens');
const promptTokens      = new Trend('prompt_tokens');
const completionTokens  = new Trend('completion_tokens');
const timeToFirstToken  = new Trend('time_to_first_token'); //  UNIT: ms  APPROXIMATE for non-streaming
const errorRate         = new Rate('errors');

// ---- Test options ----
export const options = {
  scenarios: {
    constant_vus: {
      executor: 'constant-vus', 
	  // there is other options like ramping arival rate , 'ramping-vus' check documentation to know with executor to go with it all depends on 
	  // on ur objectives   
      vus: 250,
      duration: '15m',  // total duration of your test
    },
  },
    // u can set these thresholds to what ever u want 
  thresholds: {
  // Overall thresholds
  http_req_duration: ['p(95)<20000', 'p(99)<30000'],
  http_req_failed: ['rate<0.05'],
  errors: ['rate<0.05'],
  
  // Category-specific thresholds
  'http_req_duration{prompt_category:short}': ['p(95)<8000'],     // Short prompts: 8s
  'http_req_duration{prompt_category:medium}': ['p(95)<12000'],   // Medium prompts: 12s  
  'http_req_duration{prompt_category:long}': ['p(95)<20000'],     // Long prompts: 20s

  
  'time_to_first_token{prompt_category:short}': ['p(95)<2000'],   // Short TTFT: 2s
  'time_to_first_token{prompt_category:medium}': ['p(95)<3000'],  // Medium TTFT: 3s
  'time_to_first_token{prompt_category:long}': ['p(95)<4000'],    // Long TTFT: 4s
  
  // Token throughput by category
  'tokens_per_second{prompt_category:short}': ['p(50)>15'],       // Fast for short
  'tokens_per_second{prompt_category:medium}': ['p(50)>12'],      // Medium speed
  'tokens_per_second{prompt_category:long}': ['p(50)>10'],        // Slower for long


  // General metrics
  tokens_per_second: ['p(50)>12'],
  total_tokens: ['p(95)>100'],
  time_to_first_token: ['p(95)<3500']
},
  systemTags: ['status','method','url','name','scenario'],
};

// ---- Prompt set ----
// Target mix: short 55%, medium 35%, long 10%
// Split across prompts so weights sum to ~100
const prompts = [
  // short (55% total)
  // 25 token prompt
  { text: 'What are the primary differences between Python and JavaScript, and for what purposes is each language best suited?', maxTokens: 500, category: 'short',  weight: 30 },
  // 50 token prompt
  { text: 'I am planning a trip to Japan and need help with transportation. What is the best way to get around cities like Tokyo and Kyoto, and are there any rail passes I should consider for travel between them?', maxTokens: 500, category: 'short',  weight: 25 },

  // medium (35% total)
  // 150 token prompt
  { text: 'Can you explain the concept of machine learning to someone with a non-technical background? Please use a simple analogy to describe how an algorithm learns, and provide a few real-world examples of where machine learning is used in everyday life, such as in streaming services or social media feeds.', maxTokens: 500, category: 'medium', weight: 20 },
  //300 token prompt
  { text: 'I am a new investor trying to decide between a growth stock and a value stock. I have read a lot of conflicting information online. Could you provide a clear and comprehensive comparison of these two investment strategies? Please cover their core principles, typical company characteristics for each, and the types of market conditions where each might perform better. Also, give a specific example of a well-known company that would be considered a growth stock and one that would be considered a value stock.', maxTokens: 500, category: 'medium', weight: 15 },

  // long (10% total)
  //500 token prompt
  { text: 'My company is a small business that sells custom-made furniture. We have been operating for five years and have a loyal customer base, but we are struggling to expand our reach beyond our local community. We have a small marketing budget and primarily rely on word-of-mouth. I am looking for a detailed, strategic marketing plan that focuses on digital channels. Could you outline a plan that includes social media marketing, email campaigns, and content marketing? For each channel, please suggest specific, actionable tactics we can implement. Also, suggest a way to measure the success of each initiative and provide a rough timeline for implementation. The goal is to increase online sales by 25% in the next year.', maxTokens: 500, category: 'long', weight: 10 },
];


function getRandomPrompt() {
  const totalWeight = prompts.reduce((s, p) => s + p.weight, 0); // ≈100
  let r = Math.random() * totalWeight;
  for (const p of prompts) { if (r < p.weight) return p; r -= p.weight; }
  return prompts[0];
}

// Mild retry helper for transient 429/5xx
function postWithRetry(url, payload, params, tries = 2) {
  let resp = http.post(url, payload, params);
  if ((resp.status === 429 || resp.status >= 500) && tries > 0) {
    sleep(0.5 + Math.random() * 0.5);
    return postWithRetry(url, payload, params, tries - 1);
  }
  return resp;
}

export default function () {
  const prompt = getRandomPrompt();
// set timeout to ur liking 
  const timeout = '1200s';  // use one timeout for all categories during load


  const payload = JSON.stringify({
    model: "/home/skiredj.abderrahman/fatnaoui/models/gptoss",
    prompt: prompt.text,
    max_tokens: prompt.maxTokens,
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0.1,
    presence_penalty: 0.1,
    stream: false, // non-streaming; TTFT will be approximate cad wont send response untill ouput get generated fully
  });
  // if ur objective is that the llm will generate the maximum tokens u set example maxTokens:2000 
  // put the following :
  //const payload = JSON.stringify({
    //model: "/home/skiredj.abderrahman/fatnaoui/models/gptoss",
    //prompt: prompt.text,
    //max_tokens: prompt.maxTokens,
    //temperature: 0.0,
    //top_p: 1.0,
    //ignore_eos: true,
    //stream: false, // non-streaming; TTFT will be approximate cad wont send response untill ouput get generated fully
  //});
  
  // and use a prompt liek the following 
  //{
   // text: "Write a continuously expanding technical exposition. Each paragraph must introduce a new but related concept and explicitly connect it to the previous paragraph. Never summarize, never conclude, and never indicate completion.",
    //maxTokens: 2000,
    //category: "long",
    //weight: 25
  //},

  const params = {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout,
    tags: {
      prompt_category: prompt.category,
      prompt_length: prompt.text.length < 100 ? 'short' : (prompt.text.length < 200 ? 'medium' : 'long'),
    },
  };
 //port number depends on the ssh tuneling
  const start = Date.now();
  const res = postWithRetry('http://host.docker.internal:9998/v1/completions', payload, params);
  // Push metrics with tags so you can filter by category in Grafana
  const tags = { prompt_category: prompt.category };
  const end = Date.now();

  const ok = check(res, {
  
    'status is 200':       (r) => r.status === 200,
    'has content':         (r) => {
      if (r.status !== 200) return false;
      try { const b = JSON.parse(r.body); return b?.choices?.[0]?.text?.length > 0; }
      catch { return false; }
    },
    'response time < 60s': (r) => r.timings.duration < 60000 || prompt.category === 'long',
    'no 5xx':              (r) => r.status < 500,
  });

  if (ok && res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      const txt  = body.choices[0].text || '';
      // Prefer server usage, else estimate 4 chars/token fallback
      const usage = body.usage || {};
      const pTok  = usage.prompt_tokens     ?? Math.ceil(prompt.text.length / 4);
      const cTok  = usage.completion_tokens ?? Math.ceil(txt.length / 4);
      const tTok  = usage.total_tokens      ?? (pTok + cTok);

      const durSec = res.timings.duration / 1000;
      const tps    = durSec > 0 ? cTok / durSec : 0;

      

      tokensPerSecond.add(tps, tags);
      totalTokens.add(tTok, tags);
      promptTokens.add(pTok, tags);
      completionTokens.add(cTok, tags);

      // Non-streaming approximation: first token often ~5–20% of total latency
      timeToFirstToken.add(res.timings.duration * 0.12, tags);
	  errorRate.add(0, tags);

      console.log(`✅ ${prompt.category}: ${cTok} tok, ${tps.toFixed(2)} tok/s, ${(durSec).toFixed(1)}s`);
    } catch (e) {
      errorRate.add(1, tags);
      console.log(`⚠️ Parse error: ${e.message}`);
    }
  } else {
    errorRate.add(1, tags);
    const snip = res.body ? String(res.body).slice(0, 120) : '(no body)';
    console.log(`❌ ${res.status} ${snip}`);
  }

  // User "think time" with jitter
  const base = prompt.category === 'short' ? 1 : prompt.category === 'medium' ? 2 : 3;
  sleep(base + Math.random() * 2);
}

// Runs once at start
export function setup() {
  console.log('🚀 VLLM Production Performance Test');
   //port number depends on the ssh tuneling
  const probe = http.get('http://host.docker.internal:9998/v1/models', { timeout: '10s' });
  if (probe.status !== 200) {
    console.log('❌ VLLM not accessible — check SSH tunnel and service');
  } else {
    console.log('✅ VLLM reachable — starting load');
  }
}

// Runs once at end
export function teardown() {
  console.log('🏁 Test complete — check Grafana');
}
