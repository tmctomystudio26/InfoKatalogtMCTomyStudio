import { handleVerifyRequest } from '../../_lib/store-vault-core.js';

export async function onRequestPost({ request, env }) {
  return handleVerifyRequest(request, env);
}
