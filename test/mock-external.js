// Test helper: preload with `node --require ./test/mock-external.js server.js`.
// Intercepts the server's outbound calls to Groq (AI) and Bachs (payments) and
// returns canned responses shaped like the real ones, so the whole server can
// be exercised without any keys or network access.
const realFetch = global.fetch
global.fetch = async function (url, opts) {
  if (String(url).includes('api.groq.com')) {
    const prompt = JSON.parse(opts.body).messages[0].content
    const headers = [...prompt.matchAll(/^\[([A-Z ]+)\]$/gm)].map(m => m[1])
    const content = headers.map(h =>
      h === 'HEADLINES'
        ? '[HEADLINES]\nFirst headline\nSecond headline\nThird headline'
        : '[' + h + ']\nSample ' + h.toLowerCase() + ' copy.'
    ).join('\n\n')
    return new Response(JSON.stringify({
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { total_tokens: 123 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  if (String(url).includes('bachs.io/v1/checkout-sessions')) {
    const { reference } = JSON.parse(opts.body)
    return new Response(JSON.stringify({ checkout_url: 'https://checkout.bachs.test/pay/' + reference }),
      { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return realFetch(url, opts)
}
