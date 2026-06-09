import Anthropic from '@anthropic-ai/sdk'
import { redis } from '../utils/redis.js'

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
})

const MODEL        = 'claude-sonnet-4-20250514'
const MAX_TOKENS   = 1024
const CACHE_TTL    = 60  // seconds

// ── Rate limiting ─────────────────────────────────────────────────────────────
const AI_RATE_LIMIT_PER_USER_PER_MIN = 20

async function checkRateLimit(userId: string, feature: string): Promise<boolean> {
  const key    = `ai:rate:${feature}:${userId}:${Math.floor(Date.now() / 60000)}`
  const count  = await redis.incr(key)
  if (count === 1) await redis.expire(key, 120)
  return count <= AI_RATE_LIMIT_PER_USER_PER_MIN
}

// ── Cache helper ──────────────────────────────────────────────────────────────
async function cached<T>(key: string, fn: () => Promise<T>, ttl = CACHE_TTL): Promise<T> {
  try {
    const hit = await redis.get(`ai:cache:${key}`)
    if (hit) return JSON.parse(hit) as T
  } catch { /* cache miss */ }

  const result = await fn()
  await redis.setex(`ai:cache:${key}`, ttl, JSON.stringify(result))
  return result
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  senderId:    string
  senderName:  string
  body:        string
  createdAt:   string
}

export interface SummaryResult {
  bullets:   string[]
  timeRange: string
  count:     number
}

export interface SmartReply {
  text:  string
  tone:  'friendly' | 'formal' | 'brief'
}

export type ToneLabel = 'friendly' | 'formal' | 'tense' | 'urgent' | 'neutral'

// ── 1. Chat summariser ────────────────────────────────────────────────────────
/**
 * Summarise unread messages into 3-5 bullet points.
 * Called when user clicks "Catch me up" after 10+ unread messages.
 */
export async function summariseChat(
  userId:   string,
  chatId:   string,
  messages: ChatMessage[],
): Promise<SummaryResult> {
  if (!await checkRateLimit(userId, 'summary')) {
    throw new Error('Rate limit exceeded — try again in a minute')
  }

  const cacheKey = `summary:${chatId}:${messages[messages.length - 1]?.createdAt ?? 'empty'}`

  return cached(cacheKey, async () => {
    const transcript = messages
      .slice(-100) // max 100 messages
      .map(m => `[${m.senderName}]: ${m.body}`)
      .join('\n')

    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system: `You are a chat summariser. Given a conversation transcript, produce a concise summary.
Respond ONLY with valid JSON in this exact shape — no preamble, no markdown:
{"bullets":["bullet 1","bullet 2","bullet 3"],"timeRange":"string describing the time span"}

Rules:
- 3 to 5 bullet points maximum
- Each bullet: one clear sentence, past tense
- timeRange: e.g. "Last 2 hours" or "Today 9am–11am"
- Never include names in timeRange
- Never add commentary outside the JSON`,
      messages: [{ role: 'user', content: `Summarise this chat:\n\n${transcript}` }],
    })

    const raw  = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const clean = raw.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean) as { bullets: string[]; timeRange: string }
      return { ...parsed, count: messages.length }
    } catch {
      return { bullets: ['Could not summarise this conversation.'], timeRange: 'Recent', count: messages.length }
    }
  })
}

// ── 2. Smart replies ──────────────────────────────────────────────────────────
/**
 * Suggest 3 short reply options based on the last few messages.
 */
export async function getSmartReplies(
  userId:   string,
  messages: ChatMessage[],
  lang = 'en',
): Promise<SmartReply[]> {
  if (!await checkRateLimit(userId, 'smart-reply')) {
    return []
  }

  const lastFive = messages.slice(-5)
  const cacheKey = `replies:${lastFive.map(m => m.body.slice(0, 20)).join('|')}:${lang}`

  return cached(cacheKey, async () => {
    const transcript = lastFive.map(m => `[${m.senderName}]: ${m.body}`).join('\n')

    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 300,
      system: `You are a smart reply generator for a chat app.
Given recent messages, suggest exactly 3 short reply options.
Respond ONLY with valid JSON — no preamble, no markdown:
[{"text":"reply text","tone":"friendly"},{"text":"reply text","tone":"formal"},{"text":"reply text","tone":"brief"}]

Rules:
- Each reply: max 10 words
- Vary tones: one friendly, one formal, one brief/casual
- Language: ${lang}
- Never include the sender's name in replies
- Replies must be natural, not robotic`,
      messages: [{ role: 'user', content: `Recent messages:\n${transcript}\n\nGenerate 3 smart replies.` }],
    })

    const raw   = response.content[0]?.type === 'text' ? response.content[0].text : '[]'
    const clean = raw.replace(/```json|```/g, '').trim()

    try {
      return JSON.parse(clean) as SmartReply[]
    } catch {
      return []
    }
  }, 30) // shorter TTL for replies
}

// ── 3. Tone detection ─────────────────────────────────────────────────────────
/**
 * Detect the tone of a single message.
 * Returns quickly — prompt is tiny, cached aggressively.
 */
export async function detectTone(
  userId:  string,
  message: string,
): Promise<ToneLabel> {
  if (message.length < 20) return 'neutral'
  if (!await checkRateLimit(userId, 'tone')) return 'neutral'

  const cacheKey = `tone:${Buffer.from(message).toString('base64').slice(0, 40)}`

  return cached(cacheKey, async () => {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 10,
      system: 'Classify the tone of this message. Reply with EXACTLY one word: friendly, formal, tense, urgent, or neutral. Nothing else.',
      messages: [{ role: 'user', content: message }],
    })

    const raw = response.content[0]?.type === 'text'
      ? response.content[0].text.trim().toLowerCase()
      : 'neutral'

    const valid: ToneLabel[] = ['friendly', 'formal', 'tense', 'urgent', 'neutral']
    return valid.includes(raw as ToneLabel) ? (raw as ToneLabel) : 'neutral'
  }, 300) // cache tone for 5 min
}

// ── 4. Spam / toxicity filter ─────────────────────────────────────────────────
/**
 * Check if a message is spam or toxic before delivering it.
 * Returns true if the message is safe to deliver.
 */
export async function isSafeMessage(message: string): Promise<{ safe: boolean; reason?: string }> {
  if (message.length < 3) return { safe: true }

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 50,
    system: `You are a content safety classifier for a chat app.
Respond ONLY with valid JSON: {"safe":true} or {"safe":false,"reason":"brief reason"}
A message is unsafe if it contains: hate speech, harassment, threats, spam, or illegal content.
Normal conversation, strong opinions, and mild profanity are SAFE.`,
    messages: [{ role: 'user', content: `Classify: "${message}"` }],
  })

  const raw   = response.content[0]?.type === 'text' ? response.content[0].text : '{"safe":true}'
  const clean = raw.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(clean) as { safe: boolean; reason?: string }
  } catch {
    return { safe: true }
  }
}

// ── 5. Translation ────────────────────────────────────────────────────────────
/**
 * Translate a message to the target language.
 * Uses Claude directly (DeepL key optional for production volume).
 */
export async function translateMessage(
  userId:         string,
  message:        string,
  targetLanguage: string,
): Promise<string> {
  if (!await checkRateLimit(userId, 'translate')) {
    throw new Error('Rate limit exceeded')
  }

  const cacheKey = `translate:${targetLanguage}:${Buffer.from(message).toString('base64').slice(0, 40)}`

  return cached(cacheKey, async () => {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 500,
      system: `You are a translator. Translate the user's message to ${targetLanguage}.
Reply with ONLY the translated text — no explanation, no quotes, no preamble.`,
      messages: [{ role: 'user', content: message }],
    })

    return response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : message
  }, 3600) // cache translations for 1 hour
}
