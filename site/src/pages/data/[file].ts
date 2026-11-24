import type { APIRoute } from 'astro';
import { fixtures } from '../../examples/fixtures';
import { examples, unlisted } from '../../examples/index';
import { contents } from '../../examples/tree';

export function getStaticPaths() {
  const files = new Map<string, unknown>();
  for (const { id, data } of [...examples.values(), ...unlisted, ...fixtures]) {
    const value = contents(data);
    if (files.has(data.file) && files.get(data.file) !== value)
      throw new Error(`example "${id}": another example's data is also named ${data.file}`);
    files.set(data.file, value);
  }
  return [...files].map(([file, value]) => ({ params: { file }, props: { value } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.value), { headers: { 'Content-Type': 'application/json' } });
