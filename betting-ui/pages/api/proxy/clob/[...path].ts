import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Passthrough proxy to Polymarket CLOB API for local development
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path = [] } = req.query as { path: string[] };
  const clobBase = 'https://clob.polymarket.com';

  const url = `${clobBase}/${path.join('/')}`;

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

    // Cache slightly to reduce rate limits
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('CLOB proxy error', error.message);
    res.status(error.response?.status || 500).json({ error: 'CLOB proxy failed' });
  }
} 