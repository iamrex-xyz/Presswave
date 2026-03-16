export default async function handler(req, res) {
  const key = process.env.STRIPE_SECRET_KEY;
  return res.status(200).json({
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 7) : null,
    keyLength: key ? key.length : 0,
    allEnvKeys: Object.keys(process.env).filter(k => k.startsWith("STRIPE") || k.startsWith("SUPABASE") || k.startsWith("AGENT")),
  });
}
