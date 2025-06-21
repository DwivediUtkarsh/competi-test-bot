import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Simple passthrough proxy to Gamma API to avoid CORS during local dev
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path = [] } = req.query as { path: string[] };
  const gammaBase = process.env.NEXT_PUBLIC_POLYMARKET_API_URL || 'https://gamma-api.polymarket.com';

  const url = `${gammaBase}/${path.join('/')}`;

  try {
    const response = await axios({
      method: req.method as any,
      url,
      params: req.method === 'GET' ? req.query : undefined,
      data: req.body,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      timeout: 10000,
    });

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Proxy error', error.message);
    res.status(error.response?.status || 500).json({ error: 'Proxy failed' });
  }
} 