import { handleGoRequest } from '../../_lib/store-vault-core.js';

export async function onRequestGet({ request, env }) {
  return handleGoRequest(request, env);
}
