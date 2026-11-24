import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llms } from '../llms';

export const GET: APIRoute = async ({ site }) => {
  const guides = (await getCollection('guides'))
    .toSorted((a, b) => a.data.order - b.data.order)
    .map(g => ({ id: g.id, ...g.data }));
  return new Response(llms(site!, guides), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
